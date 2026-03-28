const express = require('express');
const { getDb } = require('../config/db');
const { requireAuth, getOptionalUser } = require('../middleware/auth');
const { z } = require('zod');

const router = express.Router();

const wishlistItemSchema = z.object({
    product_id: z.string()
});

router.get('/', requireAuth, async (req, res) => {
    try {
        const db = getDb();
        const wishlist = await db.collection('wishlists').findOne({ user_id: req.user.id }, { projection: { _id: 0 } });
        if (!wishlist) return res.json({ items: [] });

        const items_with_products = [];
        for (const product_id of (wishlist.product_ids || [])) {
            const product = await db.collection('products').findOne({ id: product_id }, { projection: { _id: 0 } });
            if (product) items_with_products.push(product);
        }
        res.json({ items: items_with_products });
    } catch (e) {
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

router.post('/add', requireAuth, async (req, res) => {
    try {
        const body = wishlistItemSchema.parse(req.body);
        const db = getDb();
        const product = await db.collection('products').findOne({ id: body.product_id }, { projection: { _id: 0 } });
        if (!product) return res.status(404).json({ detail: "Product not found" });

        await db.collection('wishlists').updateOne(
            { user_id: req.user.id },
            { $addToSet: { product_ids: body.product_id } },
            { upsert: true }
        );
        res.json({ message: "Added to wishlist" });
    } catch (e) {
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

router.delete('/:product_id', requireAuth, async (req, res) => {
    try {
        const db = getDb();
        await db.collection('wishlists').updateOne(
            { user_id: req.user.id },
            { $pull: { product_ids: req.params.product_id } }
        );
        res.json({ message: "Removed from wishlist" });
    } catch (e) {
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

router.get('/check/:product_id', getOptionalUser, async (req, res) => {
    try {
        if (!req.user) return res.json({ in_wishlist: false });

        const db = getDb();
        const wishlist = await db.collection('wishlists').findOne({ user_id: req.user.id }, { projection: { _id: 0 } });
        const in_wishlist = wishlist ? (wishlist.product_ids || []).includes(req.params.product_id) : false;
        res.json({ in_wishlist });
    } catch (e) {
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

module.exports = router;
