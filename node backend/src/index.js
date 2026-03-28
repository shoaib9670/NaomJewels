const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();
const { connectToDatabase } = require('./config/db');

const authRoutes = require('./routes/auth');
const productsRoutes = require('./routes/products');
const cartRoutes = require('./routes/cart');
const wishlistRoutes = require('./routes/wishlist');
const checkoutRoutes = require('./routes/checkout');
const aiRoutes = require('./routes/ai');
const ordersRoutes = require('./routes/orders');
const categoriesRoutes = require('./routes/categories');
const seedRoutes = require('./routes/seed');

const app = express();
const port = process.env.PORT || 8000;

// Middleware
const corsOrigins = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['*'];
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);
        if (corsOrigins.includes('*') || corsOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
}));
app.use(express.json());
app.use(morgan('dev'));

// Setup Routes
// Basic routes
app.get('/', (req, res) => {
    res.json({
        status: "Online",
        message: "NAOM Jewels API is running",
        documentation: "/api/"
    });
});

app.get('/health', (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get('/api/', (req, res) => {
    res.json({ message: "Welcome to NAOM Jewels API", version: "1.0.0" });
});

app.post('/api/webhook/stripe', (req, res) => {
    res.json({ received: true });
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/seed', seedRoutes);

// Start server
async function startServer() {
    // Start HTTP server immediately
    app.listen(port, () => {
        console.log(`Node backend listening at http://0.0.0.0:${port}`);
        console.log("Press CTRL+C to quit");
    });
    // Try connecting to MongoDB (non-blocking)
    connectToDatabase()
        .then(() => console.log('MongoDB connection established'))
        .catch(err => console.error('MongoDB connection failed:', err.message, '\nSet MONGO_URL in .env to a valid MongoDB connection string.'));
}

startServer();

