require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Supplier = require('../models/Supplier');

const connectDB = require('../config/db');

const seed = async () => {
  if (process.env.NODE_ENV === 'production' && !process.argv.includes('--prod-safe')) {
    console.error('❌ ERROR: Running seed script in production is disabled unless --prod-safe is passed.');
    process.exit(1);
  }
  await connectDB();
  console.log('🌱 Seeding database...');

  // Clear existing
  await Promise.all([
    User.deleteMany(),
    Product.deleteMany(),
    Customer.deleteMany(),
    Supplier.deleteMany(),
  ]);

  // Users
  const admin = await User.create({
    name: 'Maina Kamau',
    email: 'admin@retailedge.co.ke',
    password: 'admin1234',
    role: 'admin',
    branch: 'Nairobi Main Branch',
  });
  await User.create({
    name: 'Grace Wangari',
    email: 'manager@retailedge.co.ke',
    password: 'manager1234',
    role: 'manager',
    branch: 'Nairobi Main Branch',
  });
  await User.create({
    name: 'Brian Otieno',
    email: 'cashier@retailedge.co.ke',
    password: 'cashier1234',
    role: 'cashier',
    branch: 'Nairobi Main Branch',
  });
  await User.create({
    name:"Joseph maina",
    email: 'josekamaemaina2005@gmail.com',
    password: 'shipman88',
    role: 'manager',
    branch: 'Nairobi Main Branch',
  })

  // Suppliers
  const [unga, dola, ketepa] = await Supplier.insertMany([
    { name: 'Unga Group', phone: '+254 20 123 4567', reliabilityScore: 98 },
    { name: 'Dola Foods Ltd', phone: '+254 20 987 6543', reliabilityScore: 85 },
    { name: 'Ketepa Tea', phone: '+254 20 555 1234', reliabilityScore: 62 },
  ]);

  // Products
  await Product.insertMany([
    { name: 'Unga Wa Dola (2kg)',       sku: 'SKU-29384-NBO', productId: 'RE-GRC-00001', barcode: '6001082001234', category: 'Groceries',   price: 180,   costPrice: 140, stock: 5,   reorderLevel: 50,  supplier: dola._id   },
    { name: 'Jogoo Maize Flour (2kg)',   sku: 'JOG-MZE-2KG',  productId: 'RE-GRA-00002', barcode: '6001082005678', category: 'Grains',      price: 210,   costPrice: 160, stock: 450, reorderLevel: 150, supplier: unga._id   },
    { name: 'Ketepa Tea Bags (100g)',    sku: 'KTP-TEA-100',  productId: 'RE-BEV-00003', barcode: '6001082009012', category: 'Beverages',   price: 185,   costPrice: 130, stock: 0,   reorderLevel: 40,  supplier: ketepa._id },
    { name: 'Blue Band (450g)',          sku: 'BLB-450G',     productId: 'RE-GRC-00004', barcode: '6001082003456', category: 'Groceries',   price: 420,   costPrice: 320, stock: 120, reorderLevel: 30                         },
    { name: 'Brookside Milk (500ml)',    sku: 'BRK-MLK-500',  productId: 'RE-DAI-00005', barcode: '6001082007890', category: 'Dairy',       price: 65,    costPrice: 50,  stock: 82,  reorderLevel: 30                         },
    { name: 'White Bread (400g)',        sku: 'WHT-BRD-400',  productId: 'RE-BAK-00006', barcode: '6001082002345', category: 'Bakery',      price: 60,    costPrice: 45,  stock: 40,  reorderLevel: 20                         },
    { name: 'Indomie Noodles (70g)',     sku: 'IND-ON-070',   productId: 'RE-FMC-00007', barcode: '8999999012345', category: 'FMCG',        price: 45,    costPrice: 30,  stock: 240, reorderLevel: 60                         },
    { name: 'Coca-Cola (500ml)',         sku: 'CC-PET-500',   productId: 'RE-BEV-00008', barcode: '5000112637922', category: 'Beverages',   price: 60,    costPrice: 45,  stock: 15,  reorderLevel: 50                         },
    { name: 'Greek Yogurt (500g)',       sku: 'GRK-YGT-500',  productId: 'RE-DAI-00009', barcode: '6001082006789', category: 'Dairy',       price: 320,   costPrice: 240, stock: 28,  reorderLevel: 20                         },
    { name: 'Premium Smartphone',        sku: 'SMRT-PREM-1',  productId: 'RE-ELE-00010', barcode: '8901234567890', category: 'Electronics', price: 45000, costPrice: 38000, stock: 8, reorderLevel: 3                          },
    { name: 'Fresh Fri Cooking Oil (3L)',sku: 'SKU-88273-WST', productId: 'RE-GRC-00011', barcode: '6001082004567', category: 'Groceries',  price: 580,   costPrice: 450, stock: 12,  reorderLevel: 50                         },
    { name: 'Long Grain Rice (5kg)',     sku: 'LGR-RCE-5KG',  productId: 'RE-GRC-00012', barcode: '6001082008901', category: 'Groceries',   price: 650,   costPrice: 500, stock: 95,  reorderLevel: 40                         },
  ]);

  // Customers
  await Customer.insertMany([
    { name: 'Sarah Wanjiku', phone: '+254712345678', loyaltyPoints: 1240, totalSpend: 128450, totalVisits: 42, tier: 'Gold', lastPurchase: new Date() },
    { name: 'David Ndungu', phone: '+254722987654', loyaltyPoints: 450, totalSpend: 45900, totalVisits: 18, tier: 'Silver', lastPurchase: new Date('2024-03-12') },
    { name: 'Mercy Akinyi', phone: '+254733111222', loyaltyPoints: 120, totalSpend: 12200, totalVisits: 5, tier: 'Bronze', lastPurchase: new Date('2024-02-28') },
    { name: 'John Mutua', phone: '+254700123456', loyaltyPoints: 820, totalSpend: 82000, totalVisits: 31, tier: 'Silver', lastPurchase: new Date() },
  ]);

  console.log('✅ Database seeded successfully!');
  console.log('📧 Admin login:   admin@retailedge.co.ke   / admin1234');
  console.log('📧 Manager login: manager@retailedge.co.ke / manager1234');
  console.log('📧 Cashier login: cashier@retailedge.co.ke / cashier1234');
  console.log('📧 Manager login: josekamaemaina2005@gmail.com  / shipman88');
  mongoose.disconnect();
};

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
