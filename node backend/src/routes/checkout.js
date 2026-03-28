const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { z } = require('zod');

const router = express.Router();

const checkoutSchema = z.object({
    origin_url: z.string()
});

router.post('/create-session', requireAuth, async (req, res) => {
    try {
        const body = checkoutSchema.parse(req.body);
        const db = getDb();

        const cart = await db.collection('carts').findOne({ user_id: req.user.id }, { projection: { _id: 0 } });
        if (!cart || !(cart.items && cart.items.length > 0)) {
            return res.status(400).json({ detail: "Cart is empty" });
        }

        let total = 0.0;
        for (const item of cart.items) {
            const product = await db.collection('products').findOne({ id: item.product_id }, { projection: { _id: 0 } });
            if (product) total += product.price * item.quantity;
        }

        if (total <= 0) return res.status(400).json({ detail: "Invalid cart total" });

        const session_id = uuidv4();
        const url = `${body.origin_url}/checkout/success?session_id=${session_id}`;

        const transaction = {
            id: uuidv4(),
            session_id,
            user_id: req.user.id,
            user_email: req.user.email,
            amount: total,
            currency: "usd",
            payment_status: "pending",
            status: "initiated",
            created_at: new Date().toISOString()
        };
        await db.collection('payment_transactions').insertOne(transaction);

        res.json({ url, session_id });
    } catch (e) {
        if (e instanceof z.ZodError) return res.status(422).json({ detail: e.errors });
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

router.get('/status/:session_id', requireAuth, async (req, res) => {
    try {
        const db = getDb();
        const session_id = req.params.session_id;
        const transaction = await db.collection('payment_transactions').findOne({ session_id }, { projection: { _id: 0 } });
        if (!transaction) return res.status(404).json({ detail: "Transaction not found" });

        const status = {
            status: "complete",
            payment_status: "paid",
            amount_total: transaction.amount,
            currency: "usd"
        };

        if (transaction.payment_status !== "paid" && status.payment_status === "paid") {
            await db.collection('payment_transactions').updateOne(
                { session_id },
                { $set: { payment_status: status.payment_status, status: status.status } }
            );

            const cart = await db.collection('carts').findOne({ user_id: req.user.id }, { projection: { _id: 0 } });
            if (cart) {
                const order = {
                    id: uuidv4(),
                    user_id: req.user.id,
                    items: cart.items,
                    total: transaction.amount,
                    payment_session_id: session_id,
                    status: "confirmed",
                    created_at: new Date().toISOString()
                };
                await db.collection('orders').insertOne(order);
                await db.collection('carts').deleteOne({ user_id: req.user.id });
            }
        }
        res.json({
            status: status.status,
            payment_status: status.payment_status,
            amount_total: status.amount_total,
            currency: status.currency
        });
    } catch (e) {
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

module.exports = router;
