const mongoose = require('mongoose');
require('dotenv').config();

// Force Node.js DNS to use Google DNS
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

async function fixIndex() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected.');

        const collection = mongoose.connection.collection('beatpurchases');
        const indexes = await collection.indexes();
        console.log('Current Indexes:', JSON.stringify(indexes, null, 2));

        const uniqueIndex = indexes.find(idx => idx.unique && idx.key.artist === 1 && idx.key.beat === 1);

        if (uniqueIndex) {
            console.log('Found unique index:', uniqueIndex.name);
            await collection.dropIndex(uniqueIndex.name);
            console.log('Successfully dropped unique index.');
        } else {
            console.log('No unique index artist/beat found. Checking for any unique indexes...');
            const anyUnique = indexes.find(idx => idx.unique && idx.name !== '_id_');
            if (anyUnique) {
                console.log('Found another unique index:', anyUnique.name);
                await collection.dropIndex(anyUnique.name);
                console.log('Dropped it.');
            }
        }

        console.log('Index fix complete.');
        process.exit(0);
    } catch (error) {
        console.error('Error fixing index:', error);
        process.exit(1);
    }
}

fixIndex();
