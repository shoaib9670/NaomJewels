const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { z } = require('zod');
const { getDb } = require('../config/db');
const { requireAuth, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();
const JWT_EXPIRATION_HOURS = 24;

const userCreateSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
    name: z.string().min(1)
});

const userLoginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1)
});

function createToken(userId, email) {
    return jwt.sign(
        { sub: userId, email },
        JWT_SECRET,
        { expiresIn: `${JWT_EXPIRATION_HOURS}h` }
    );
}

router.post('/register', async (req, res) => {
    try {
        const body = userCreateSchema.parse(req.body);
        const db = getDb();

        const existing = await db.collection('users').findOne({ email: body.email });
        if (existing) {
            return res.status(400).json({ detail: "Email already registered" });
        }

        const userId = uuidv4();
        const hashedPassword = await bcrypt.hash(body.password, 10);

        const user = {
            id: userId,
            email: body.email,
            password: hashedPassword,
            name: body.name,
            created_at: new Date().toISOString()
        };

        await db.collection('users').insertOne(user);

        const token = createToken(userId, body.email);
        res.json({
            access_token: token,
            token_type: "bearer",
            user: {
                id: userId,
                email: body.email,
                name: body.name,
                created_at: user.created_at
            }
        });
    } catch (e) {
        if (e instanceof z.ZodError) {
            return res.status(422).json({ detail: e.errors });
        }
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

router.post('/login', async (req, res) => {
    try {
        const body = userLoginSchema.parse(req.body);
        const db = getDb();

        const user = await db.collection('users').findOne({ email: body.email });
        if (!user || !(await bcrypt.compare(body.password, user.password))) {
            return res.status(401).json({ detail: "Invalid email or password" });
        }

        const token = createToken(user.id, user.email);
        res.json({
            access_token: token,
            token_type: "bearer",
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                created_at: user.created_at
            }
        });
    } catch (e) {
        if (e instanceof z.ZodError) {
            return res.status(422).json({ detail: e.errors });
        }
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

router.get('/me', requireAuth, (req, res) => {
    res.json({
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        created_at: req.user.created_at
    });
});

module.exports = router;
