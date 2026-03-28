const express = require('express');
const { getDb } = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
    try {
        const db = getDb();
        const orders = await db.collection('orders')
            .find({ user_id: req.user.id }, { projection: { _id: 0 } })
            .sort({ created_at: -1 })
            .limit(50)
            .toArray();

        for (const order of orders) {
            const items_with_products = [];
            for (const item of (order.items || [])) {
                const product = await db.collection('products').findOne({ id: item.product_id }, { projection: { _id: 0 } });
                if (product) items_with_products.push({ ...item, product });
            }
            order.items = items_with_products;
        }
        res.json({ orders });
    } catch (e) {
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

module.exports = router;
