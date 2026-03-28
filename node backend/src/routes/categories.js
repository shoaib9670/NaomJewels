const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
    const categories = [
        { "id": "rings", "name": "Rings", "image": "https://images.unsplash.com/photo-1724937798320-d0c4fac1787d?w=400" },
        { "id": "necklaces", "name": "Necklaces", "image": "https://images.pexels.com/photos/6502503/pexels-photo-6502503.jpeg?w=400" },
        { "id": "earrings", "name": "Earrings", "image": "https://images.unsplash.com/photo-1758995115555-766abbd9a491?w=400" },
        { "id": "bracelets", "name": "Bracelets", "image": "https://images.pexels.com/photos/4166450/pexels-photo-4166450.jpeg?w=400" },
        { "id": "bangles", "name": "Bangles", "image": "https://images.pexels.com/photos/4166450/pexels-photo-4166450.jpeg?w=400" },
        { "id": "anklets", "name": "Anklets", "image": "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=400" },
        { "id": "pendants", "name": "Pendants", "image": "https://images.pexels.com/photos/6502503/pexels-photo-6502503.jpeg?w=400" },
        { "id": "nose-pins", "name": "Nose Pins", "image": "https://images.unsplash.com/photo-1758995115555-766abbd9a491?w=400" }
    ];
    res.json({ categories });
});

module.exports = router;
