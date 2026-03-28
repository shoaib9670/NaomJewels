const { MongoClient } = require('mongodb');
require('dotenv').config();

const url = process.env.MONGO_URL;
const dbName = process.env.DB_NAME;

let db = null;
let client = null;

async function connectToDatabase() {
    if (db) return db;
    client = new MongoClient(url, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
    });
    await client.connect();
    console.log('Connected successfully to MongoDB');
    db = client.db(dbName);
    return db;
}

function getDb() {
    if (!db) throw new Error('Database not initialized. Call connectToDatabase() first.');
    return db;
}

function getClient() {
    return client;
}

module.exports = { connectToDatabase, getDb, getClient };
