const mongoose = require('mongoose');
const crypto = require('crypto');
const DistributionRequest = require('./models/DistributionRequest');

mongoose.connect('mongodb://127.0.0.1:27017/clgproject2').then(async () => {
    const reqs = await DistributionRequest.find({ receiptNumber: { $exists: false } });
    for (const r of reqs) {
        r.receiptNumber = 'RAPIRA-' + crypto.randomBytes(4).toString('hex').toUpperCase();
        await r.save();
    }
    console.log('Updated ' + reqs.length + ' documents');
    process.exit(0);
}).catch(console.error);
