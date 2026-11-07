require('dotenv').config({ path: 'd:/Nightcode/rapira/.env' });
const mongoose = require('mongoose');

async function searchDb() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const models = ['Concert', 'Artist', 'WebsiteSettings', 'Media', 'MediaBackup', 'DailyConcert', 'Product', 'TeamMember'];
  for (const m of models) {
    try {
      const Model = require('../models/' + m);
      const docs = await Model.find({}).lean();
      console.log('=== ' + m + ' (' + docs.length + ' docs) ===');
      for (const d of docs) {
        const str = JSON.stringify(d);
        const matches = str.match(/https?:\/\/[^\s"'<>\\]+\.(?:jpg|jpeg|png|webp|avif)|(?:\/images\/[^\s"'<>\\]+)/gi);
        if (matches) {
          console.log((d.title || d.name || d._id) + ':', Array.from(new Set(matches)));
        }
      }
    } catch (err) {
      console.log('Error querying ' + m + ':', err.message);
    }
  }
  await mongoose.disconnect();
}
searchDb();

