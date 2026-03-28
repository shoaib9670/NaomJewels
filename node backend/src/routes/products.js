const express = require('express');
const { getDb } = require('../config/db');

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const { category, min_price, max_price, metal, color, search, sort, limit = 50, skip = 0 } = req.query;
        const db = getDb();
        const query = {};

        if (category) query.category = category.toLowerCase();
        if (min_price) query.price = { $gte: parseFloat(min_price) };
        if (max_price) query.price = { ...query.price, $lte: parseFloat(max_price) };
        if (metal) query.metal = metal.toLowerCase();
        if (color) query.color = color.toLowerCase();
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        let sortKey = 'created_at';
        let sortDir = -1;
        if (sort === 'price_low') { sortKey = 'price'; sortDir = 1; }
        else if (sort === 'price_high') { sortKey = 'price'; sortDir = -1; }
        else if (sort === 'popular') { sortKey = 'reviews_count'; sortDir = -1; }

        const products = await db.collection('products')
            .find(query, { projection: { _id: 0 } })
            .sort({ [sortKey]: sortDir })
            .skip(parseInt(skip))
            .limit(parseInt(limit))
            .toArray();

        const total = await db.collection('products').countDocuments(query);
        res.json({ products, total, skip: parseInt(skip), limit: parseInt(limit) });
    } catch (e) {
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

router.get('/featured', async (req, res) => {
    try {
        const db = getDb();
        const bestsellers = await db.collection('products').find({ is_bestseller: true }, { projection: { _id: 0 } }).limit(8).toArray();
        const new_arrivals = await db.collection('products').find({ is_new: true }, { projection: { _id: 0 } }).limit(8).toArray();
        res.json({ bestsellers, new_arrivals });
    } catch (e) {
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

router.get('/:product_id', async (req, res) => {
    if (req.params.product_id === 'featured') return; // avoid conflict
    try {
        const db = getDb();
        const product = await db.collection('products').findOne({ id: req.params.product_id }, { projection: { _id: 0 } });
        if (!product) return res.status(404).json({ detail: "Product not found" });

        const related = await db.collection('products').find(
            { category: product.category, id: { $ne: product.id } },
            { projection: { _id: 0 } }
        ).limit(4).toArray();

        res.json({ product, related });
    } catch (e) {
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

module.exports = router;
