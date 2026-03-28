const express = require('express');
const { getDb } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { z } = require('zod');

const router = express.Router();

const cartItemSchema = z.object({
    product_id: z.string(),
    quantity: z.number().int().default(1)
});

router.get('/', requireAuth, async (req, res) => {
    try {
        const db = getDb();
        const cart = await db.collection('carts').findOne({ user_id: req.user.id }, { projection: { _id: 0 } });
        if (!cart) return res.json({ items: [], total: 0 });

        let total = 0;
        const items_with_products = [];
        for (const item of (cart.items || [])) {
            const product = await db.collection('products').findOne({ id: item.product_id }, { projection: { _id: 0 } });
            if (product) {
                items_with_products.push({ ...item, product });
                total += product.price * item.quantity;
            }
        }
        res.json({ items: items_with_products, total: Number(total.toFixed(2)) });
    } catch (e) {
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

router.post('/add', requireAuth, async (req, res) => {
    try {
        const body = cartItemSchema.parse(req.body);
        const db = getDb();
        const product = await db.collection('products').findOne({ id: body.product_id }, { projection: { _id: 0 } });
        if (!product) return res.status(404).json({ detail: "Product not found" });

        const cart = await db.collection('carts').findOne({ user_id: req.user.id });
        if (!cart) {
            await db.collection('carts').insertOne({
                user_id: req.user.id,
                items: [{ product_id: body.product_id, quantity: body.quantity }]
            });
        } else {
            const existingItem = (cart.items || []).find(i => i.product_id === body.product_id);
            if (existingItem) {
                await db.collection('carts').updateOne(
                    { user_id: req.user.id, "items.product_id": body.product_id },
                    { $inc: { "items.$.quantity": body.quantity } }
                );
            } else {
                await db.collection('carts').updateOne(
                    { user_id: req.user.id },
                    { $push: { items: { product_id: body.product_id, quantity: body.quantity } } }
                );
            }
        }
        res.json({ message: "Added to cart" });
    } catch (e) {
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

router.put('/update', requireAuth, async (req, res) => {
    try {
        const body = cartItemSchema.parse(req.body);
        const db = getDb();
        if (body.quantity <= 0) {
            await db.collection('carts').updateOne(
                { user_id: req.user.id },
                { $pull: { items: { product_id: body.product_id } } }
            );
        } else {
            await db.collection('carts').updateOne(
                { user_id: req.user.id, "items.product_id": body.product_id },
                { $set: { "items.$.quantity": body.quantity } }
            );
        }
        res.json({ message: "Cart updated" });
    } catch (e) {
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

router.delete('/:product_id', requireAuth, async (req, res) => {
    try {
        const db = getDb();
        await db.collection('carts').updateOne(
            { user_id: req.user.id },
            { $pull: { items: { product_id: req.params.product_id } } }
        );
        res.json({ message: "Item removed from cart" });
    } catch (e) {
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

router.delete('/', requireAuth, async (req, res) => {
    try {
        const db = getDb();
        await db.collection('carts').deleteOne({ user_id: req.user.id });
        res.json({ message: "Cart cleared" });
    } catch (e) {
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

module.exports = router;
