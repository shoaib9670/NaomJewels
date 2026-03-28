const jwt = require('jsonwebtoken');
require('dotenv').config();
const { getDb } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'naom_jewels_secret_key_2024_very_secure';

async function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ detail: "Authentication required" });
    }

    const token = authHeader.split(' ')[1];
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        const db = getDb();
        const user = await db.collection('users').findOne({ id: payload.sub }, { projection: { _id: 0 } });
        if (!user) {
            return res.status(401).json({ detail: "User not found" });
        }
        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ detail: "Token expired" });
        }
        return res.status(401).json({ detail: "Invalid token" });
    }
}

async function getOptionalUser(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        req.user = null;
        return next();
    }
    const token = authHeader.split(' ')[1];
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        const db = getDb();
        const user = await db.collection('users').findOne({ id: payload.sub }, { projection: { _id: 0 } });
        req.user = user || null;
    } catch (error) {
        req.user = null;
    }
    next();
}

module.exports = { requireAuth, getOptionalUser, JWT_SECRET };
