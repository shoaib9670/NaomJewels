const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/db');

const router = express.Router();

router.route('/')
    .get(async (req, res) => {
        return handleSeed(req, res);
    })
    .post(async (req, res) => {
        return handleSeed(req, res);
    });

async function handleSeed(req, res) {
    try {
        const db = getDb();
        const existing = await db.collection('products').countDocuments({});
        if (existing > 0) {
            return res.json({ message: `Database already has ${existing} products` });
        }

        const now = new Date().toISOString();
        const products = [
            // Rings
            { id: uuidv4(), name: "Golden Star Constellation Ring", description: "Elegant 18K gold plated ring with celestial star design. Perfect for everyday luxury.", price: 89.99, original_price: 129.99, category: "rings", images: ["https://images.unsplash.com/photo-1724937798320-d0c4fac1787d?w=600"], metal: "gold", color: "gold", stock: 25, rating: 4.8, reviews_count: 156, is_bestseller: true, is_new: false, created_at: now },
            { id: uuidv4(), name: "Silver Zircon Eternity Band", description: "Stunning 925 sterling silver band with brilliant zircon stones.", price: 129.99, original_price: 179.99, category: "rings", images: ["https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=600"], metal: "silver", color: "silver", stock: 18, rating: 4.7, reviews_count: 89, is_bestseller: false, is_new: true, created_at: now },
            { id: uuidv4(), name: "Rose Gold Infinity Love Ring", description: "Beautiful rose gold plated infinity ring symbolizing eternal love.", price: 79.99, original_price: 99.99, category: "rings", images: ["https://images.unsplash.com/photo-1603561596112-0a132b757442?w=600"], metal: "rose gold", color: "rose gold", stock: 30, rating: 4.9, reviews_count: 234, is_bestseller: true, is_new: false, created_at: now },
            // Necklaces
            { id: uuidv4(), name: "Diamond Heart Pendant Necklace", description: "Exquisite pendant necklace featuring a diamond-encrusted heart design on a delicate chain.", price: 199.99, original_price: 299.99, category: "necklaces", images: ["https://images.pexels.com/photos/6502503/pexels-photo-6502503.jpeg?w=600"], metal: "gold", color: "gold", stock: 15, rating: 4.9, reviews_count: 312, is_bestseller: true, is_new: false, created_at: now },
            { id: uuidv4(), name: "Layered Pearl Station Necklace", description: "Elegant layered necklace with freshwater pearls.", price: 149.99, original_price: 199.99, category: "necklaces", images: ["https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600"], metal: "silver", color: "white", stock: 20, rating: 4.6, reviews_count: 78, is_bestseller: false, is_new: true, created_at: now },
            { id: uuidv4(), name: "Minimalist Bar Necklace", description: "Sleek and modern bar pendant necklace. Subtle elegance for everyday wear.", price: 59.99, original_price: 79.99, category: "necklaces", images: ["https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=600"], metal: "gold", color: "gold", stock: 35, rating: 4.5, reviews_count: 145, is_bestseller: false, is_new: false, created_at: now },
            // Earrings
            { id: uuidv4(), name: "Crystal Drop Earrings", description: "Stunning crystal drop earrings that catch the light beautifully.", price: 69.99, original_price: 99.99, category: "earrings", images: ["https://images.unsplash.com/photo-1758995115555-766abbd9a491?w=600"], metal: "silver", color: "silver", stock: 40, rating: 4.8, reviews_count: 267, is_bestseller: true, is_new: false, created_at: now },
            { id: uuidv4(), name: "Golden Huggie Hoops", description: "Classic huggie hoop earrings in polished gold.", price: 49.99, original_price: 69.99, category: "earrings", images: ["https://images.unsplash.com/photo-1630019852942-f89202989a59?w=600"], metal: "gold", color: "gold", stock: 50, rating: 4.7, reviews_count: 189, is_bestseller: false, is_new: true, created_at: now },
            { id: uuidv4(), name: "Pearl Stud Earrings", description: "Timeless freshwater pearl studs set in sterling silver.", price: 39.99, original_price: 59.99, category: "earrings", images: ["https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=600"], metal: "silver", color: "white", stock: 60, rating: 4.9, reviews_count: 421, is_bestseller: true, is_new: false, created_at: now },
            // Bracelets
            { id: uuidv4(), name: "Tennis Bracelet Classic", description: "Elegant tennis bracelet with brilliant-cut stones.", price: 179.99, original_price: 249.99, category: "bracelets", images: ["https://images.pexels.com/photos/4166450/pexels-photo-4166450.jpeg?w=600"], metal: "silver", color: "silver", stock: 12, rating: 4.9, reviews_count: 198, is_bestseller: true, is_new: false, created_at: now },
            { id: uuidv4(), name: "Charm Link Bracelet", description: "Playful charm bracelet with delicate gold links and removable charms.", price: 89.99, original_price: 119.99, category: "bracelets", images: ["https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=600"], metal: "gold", color: "gold", stock: 25, rating: 4.6, reviews_count: 134, is_bestseller: false, is_new: true, created_at: now },
            // Bangles
            { id: uuidv4(), name: "Crystal Bangle Set", description: "Set of 3 stackable bangles with crystal accents.", price: 119.99, original_price: 159.99, category: "bangles", images: ["https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=600"], metal: "gold", color: "gold", stock: 20, rating: 4.7, reviews_count: 156, is_bestseller: false, is_new: false, created_at: now },
            { id: uuidv4(), name: "Sleek Modern Bangle", description: "Minimalist bangle with a sleek, modern design.", price: 59.99, original_price: 79.99, category: "bangles", images: ["https://images.unsplash.com/photo-1535632787350-4e68ef0ac584?w=600"], metal: "silver", color: "silver", stock: 35, rating: 4.5, reviews_count: 89, is_bestseller: false, is_new: true, created_at: now },
            // Anklets
            { id: uuidv4(), name: "Dainty Chain Anklet", description: "Delicate gold chain anklet with tiny heart charms.", price: 34.99, original_price: 49.99, category: "anklets", images: ["https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=600"], metal: "gold", color: "gold", stock: 45, rating: 4.6, reviews_count: 178, is_bestseller: true, is_new: false, created_at: now },
            { id: uuidv4(), name: "Beaded Anklet Set", description: "Set of 2 beaded anklets in complementary colors.", price: 29.99, original_price: 39.99, category: "anklets", images: ["https://images.unsplash.com/photo-1602173574767-37ac01994b2a?w=600"], metal: "silver", color: "multicolor", stock: 50, rating: 4.4, reviews_count: 67, is_bestseller: false, is_new: true, created_at: now },
            // Pendants
            { id: uuidv4(), name: "Birthstone Pendant", description: "Personalized birthstone pendant in your choice of month.", price: 79.99, original_price: 99.99, category: "pendants", images: ["https://images.unsplash.com/photo-1599643477877-530eb83abc8e?w=600"], metal: "silver", color: "multicolor", stock: 30, rating: 4.8, reviews_count: 245, is_bestseller: true, is_new: false, created_at: now },
            { id: uuidv4(), name: "Initial Letter Pendant", description: "Elegant initial pendant. A personal touch for everyday style.", price: 49.99, original_price: 69.99, category: "pendants", images: ["https://images.unsplash.com/photo-1611085583191-a3b181a88401?w=600"], metal: "gold", color: "gold", stock: 40, rating: 4.7, reviews_count: 156, is_bestseller: false, is_new: false, created_at: now },
            // Nose Pins
            { id: uuidv4(), name: "Diamond Nose Stud", description: "Delicate diamond nose stud in 14K gold setting.", price: 69.99, original_price: 89.99, category: "nose-pins", images: ["https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=600"], metal: "gold", color: "gold", stock: 25, rating: 4.9, reviews_count: 134, is_bestseller: true, is_new: false, created_at: now },
            { id: uuidv4(), name: "Tiny Flower Nose Ring", description: "Adorable flower-shaped nose ring with crystal center.", price: 29.99, original_price: 39.99, category: "nose-pins", images: ["https://images.unsplash.com/photo-1602173574767-37ac01994b2a?w=600"], metal: "silver", color: "silver", stock: 55, rating: 4.6, reviews_count: 89, is_bestseller: false, is_new: true, created_at: now },
        ];

        await db.collection('products').insertMany(products);
        res.json({ message: `Seeded ${products.length} products` });
    } catch (e) {
        console.error('Seed error:', e);
        res.status(500).json({ detail: "Seed failed: " + e.message });
    }
}

module.exports = router;
