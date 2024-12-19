const { MongoClient } = require('mongodb');

const mongoUrl = 'mongodb://localhost:27017';
const dbName = 'WEB_UU';
const collectionName = 'food_name';

let db, collection;

async function connectDB() {
    try {
        const client = await MongoClient.connect(mongoUrl, { useUnifiedTopology: true });
        db = client.db(dbName);
        collection = db.collection(collectionName);
        console.log('MongoDB connected successfully!');
        return collection;
    } catch (error) {
        console.error('MongoDB connection error:', error);
        throw error;
    }
}

module.exports = { connectDB };