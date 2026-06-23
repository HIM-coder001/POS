require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Category = require('../models/Category');

const DEFAULT_CATEGORIES = [
  { name: 'Groceries', description: 'General grocery items' },
  { name: 'Electronics', description: 'Electronic devices and accessories' },
  { name: 'Dairy', description: 'Milk, cheese, yoghurt and dairy products' },
  { name: 'Beverages', description: 'Drinks, juices, water and soft drinks' },
  { name: 'Bakery', description: 'Bread, cakes and baked goods' },
  { name: 'Grains', description: 'Rice, maize, wheat and grains' },
  { name: 'FMCG', description: 'Fast-moving consumer goods' },
  { name: 'Snacks', description: 'Crisps, biscuits and snack foods' },
  { name: 'Other', description: 'Miscellaneous products' },
];

async function seed() {
  if (process.env.NODE_ENV === 'production' && !process.argv.includes('--prod-safe')) {
    console.error('❌ ERROR: Running seed script in production is disabled unless --prod-safe is passed.');
    process.exit(1);
  }
  await connectDB();
  let created = 0;
  for (const cat of DEFAULT_CATEGORIES) {
    const exists = await Category.findOne({ name: cat.name });
    if (!exists) {
      await Category.create(cat);
      console.log(`✅ Created: ${cat.name}`);
      created++;
    } else {
      console.log(`⏭  Already exists: ${cat.name}`);
    }
  }
  console.log(`\nDone. ${created} new categories created.`);
  await mongoose.disconnect();
}

seed().catch(err => { console.error(err); process.exit(1); });
