const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/db');
const { getOptionalUser } = require('../middleware/auth');
const { z } = require('zod');
const OpenAI = require('openai');

const router = express.Router();

const chatSchema = z.object({
    message: z.string(),
    session_id: z.string().nullable().optional()
});

// Initialize Groq client (OpenAI-compatible, runs open source Llama 3.3 70B)
function getGroqClient() {
    return new OpenAI({
        apiKey: process.env.GROQ_API_KEY,
        baseURL: 'https://api.groq.com/openai/v1'
    });
}

router.post('/chat', getOptionalUser, async (req, res) => {
    try {
        const body = chatSchema.parse(req.body);
        const db = getDb();
        const session_id = body.session_id || uuidv4();
        const timestamp = new Date().toISOString();
        const user_id = req.user ? req.user.id : null;

        const groqKey = process.env.GROQ_API_KEY;
        if (!groqKey) {
            // Fallback if no Groq key configured
            await db.collection('chat_history').insertOne({ session_id, role: "user", content: body.message, timestamp, user_id });
            const fallback = "I'm the NAOM Jewels assistant! To enable AI responses, please set GROQ_API_KEY in your .env file (get a free key at console.groq.com).";
            await db.collection('chat_history').insertOne({ session_id, role: "assistant", content: fallback, timestamp, user_id });
            return res.json({ response: fallback, session_id });
        }

        // Fetch recent chat history for context
        const history = await db.collection('chat_history')
            .find({ session_id }, { projection: { _id: 0 } })
            .sort({ timestamp: -1 })
            .limit(20)
            .toArray();
        history.reverse();

        // Fetch product catalog context
        const products = await db.collection('products')
            .find({}, { projection: { _id: 0, name: 1, category: 1, price: 1, description: 1, metal: 1 } })
            .limit(15)
            .toArray();
        const productsContext = JSON.stringify(products);

        // Build messages array for Groq
        const messages = [
            {
                role: 'system',
                content: `You are NAOM Jewels' AI shopping assistant. You help customers find the perfect jewelry pieces.
Available product categories: Rings, Necklaces, Earrings, Bracelets, Bangles, Anklets, Pendants, Nose Pins.
Metal types: Gold, Silver, Rose Gold, Platinum.
Some of our products: ${productsContext}
Be helpful, friendly, and knowledgeable about jewelry. Keep responses concise and engaging. Suggest specific products from the catalog when relevant.`
            },
            ...history.map(msg => ({ role: msg.role, content: msg.content }))
        ];

        // Save user message to DB
        await db.collection('chat_history').insertOne({ session_id, role: "user", content: body.message, timestamp, user_id });
        messages.push({ role: 'user', content: body.message });

        // Call Groq API (Llama 3.3 70B - open source model)
        const groq = getGroqClient();
        const completion = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages,
            max_tokens: 512,
            temperature: 0.7,
        });

        const response = completion.choices[0]?.message?.content || "I couldn't generate a response. Please try again.";

        // Save assistant response to DB
        await db.collection('chat_history').insertOne({ session_id, role: "assistant", content: response, timestamp: new Date().toISOString(), user_id });

        res.json({ response, session_id });
    } catch (e) {
        console.error('AI chat error:', e.message);
        if (e instanceof z.ZodError) return res.status(422).json({ detail: e.errors });
        // Return a graceful fallback
        res.json({ response: "Sorry, I had trouble processing your request. Please try again.", session_id: req.body.session_id || uuidv4() });
    }
});

router.get('/recommendations', getOptionalUser, async (req, res) => {
    try {
        const db = getDb();
        const all_products = await db.collection('products').find({}, { projection: { _id: 0 } }).limit(30).toArray();
        if (all_products.length === 0) return res.json({ recommendations: [], reason: "No products available" });

        const groqKey = process.env.GROQ_API_KEY;
        if (!groqKey) {
            // Fallback: random recommendations
            const shuffled = [...all_products].sort(() => 0.5 - Math.random());
            return res.json({ recommendations: shuffled.slice(0, 6), reason: "Featured products" });
        }

        try {
            const groq = getGroqClient();

            // Get user wishlist for context if logged in
            let userContext = '';
            if (req.user) {
                const wishlist = await db.collection('wishlists').findOne({ user_id: req.user.id }, { projection: { _id: 0 } });
                if (wishlist && wishlist.product_ids && wishlist.product_ids.length > 0) {
                    const wishlistProducts = await db.collection('products')
                        .find({ id: { $in: wishlist.product_ids.slice(0, 5) } }, { projection: { _id: 0, name: 1, category: 1 } })
                        .toArray();
                    userContext = `User's wishlist includes: ${JSON.stringify(wishlistProducts)}`;
                }
            }

            const productsJson = JSON.stringify(all_products.slice(0, 20).map(p => ({ id: p.id, name: p.name, category: p.category, price: p.price })));
            const prompt = `Given these jewelry products: ${productsJson}
${userContext}
Select 4-6 product IDs that would make great recommendations. Aim for variety in category and price.
Respond ONLY with a JSON array of product IDs, like: ["id1","id2","id3"]`;

            const completion = await groq.chat.completions.create({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { role: 'system', content: 'You are a jewelry recommendation engine. Respond ONLY with a JSON array of product IDs. No other text.' },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 200,
                temperature: 0.5,
            });

            const raw = completion.choices[0]?.message?.content || '';
            const match = raw.match(/\[[\s\S]*?\]/);
            if (match) {
                const recommendedIds = JSON.parse(match[0]);
                const recommended = all_products.filter(p => recommendedIds.includes(p.id));
                if (recommended.length > 0) {
                    return res.json({ recommendations: recommended, reason: "AI-powered recommendations" });
                }
            }
        } catch (aiErr) {
            console.error('Groq recommendation error:', aiErr.message);
        }

        // Fallback: random selection
        const shuffled = [...all_products].sort(() => 0.5 - Math.random());
        res.json({ recommendations: shuffled.slice(0, 6), reason: "Featured products" });
    } catch (e) {
        console.error('Recommendations error:', e);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

module.exports = router;
