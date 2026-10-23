import bcrypt from 'bcryptjs';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(backendRoot, '.env') });

const dataDir = path.join(backendRoot, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = `file:${path.join(dataDir, 'stocksense.db').replace(/\\/g, '/')}`;
}

const prisma = new PrismaClient();

function pkr(n: number) {
  return Math.round(n * 100);
}

type ProductSeed = {
  sku: string;
  name: string;
  description: string;
  category: string;
  department: string;
  supplier: string;
  cost: number;
  sell: number;
  stock: number;
  reorder: number;
  unit: string;
};

const PRODUCTS: ProductSeed[] = [
  // Grocery
  { sku: 'GR-SUG-01', name: 'Sugar', description: 'White sugar 1kg bag', category: 'Staples', department: 'Grocery', supplier: 'Ali Traders', cost: 140, sell: 180, stock: 120, reorder: 30, unit: 'bags' },
  { sku: 'GR-RIC-01', name: 'Rice', description: 'Basmati rice 5kg', category: 'Staples', department: 'Grocery', supplier: 'Ali Traders', cost: 950, sell: 1200, stock: 80, reorder: 20, unit: 'bags' },
  { sku: 'GR-FLO-01', name: 'Flour', description: 'Wheat flour 10kg', category: 'Staples', department: 'Grocery', supplier: 'Peshawar Mills', cost: 1100, sell: 1350, stock: 60, reorder: 15, unit: 'bags' },
  { sku: 'GR-OIL-01', name: 'Cooking Oil', description: 'Sunflower oil 5L', category: 'Oils', department: 'Grocery', supplier: 'Ali Traders', cost: 2200, sell: 2650, stock: 45, reorder: 12, unit: 'bottles' },
  { sku: 'GR-TEA-01', name: 'Tea', description: 'Black tea 900g', category: 'Beverages', department: 'Grocery', supplier: 'Khyber Foods', cost: 780, sell: 950, stock: 70, reorder: 20, unit: 'packs' },
  { sku: 'GR-MLK-01', name: 'Milk', description: 'UHT milk 1L', category: 'Dairy', department: 'Grocery', supplier: 'Khyber Foods', cost: 220, sell: 280, stock: 90, reorder: 25, unit: 'cartons' },
  { sku: 'GR-BIS-01', name: 'Biscuits', description: 'Assorted cream biscuits', category: 'Snacks', department: 'Grocery', supplier: 'Khyber Foods', cost: 90, sell: 130, stock: 150, reorder: 40, unit: 'packs' },
  { sku: 'GR-SOD-01', name: 'Soft Drinks', description: '1.5L cola bottle', category: 'Beverages', department: 'Grocery', supplier: 'Valley Distributors', cost: 120, sell: 170, stock: 200, reorder: 50, unit: 'bottles' },
  { sku: 'GR-SPL-01', name: 'Spaghetti', description: 'Pasta 500g', category: 'Staples', department: 'Grocery', supplier: 'Ali Traders', cost: 180, sell: 240, stock: 55, reorder: 15, unit: 'packs' },
  { sku: 'GR-DAL-01', name: 'Lentils', description: 'Masoor dal 1kg', category: 'Staples', department: 'Grocery', supplier: 'Peshawar Mills', cost: 280, sell: 350, stock: 40, reorder: 12, unit: 'bags' },
  { sku: 'GR-SLT-01', name: 'Salt', description: 'Iodized salt 800g', category: 'Staples', department: 'Grocery', supplier: 'Ali Traders', cost: 50, sell: 80, stock: 100, reorder: 25, unit: 'packs' },
  { sku: 'GR-JAM-01', name: 'Jam', description: 'Mixed fruit jam 450g', category: 'Spreads', department: 'Grocery', supplier: 'Khyber Foods', cost: 320, sell: 420, stock: 35, reorder: 10, unit: 'jars' },
  { sku: 'GR-HNY-01', name: 'Honey', description: 'Natural honey 500g', category: 'Spreads', department: 'Grocery', supplier: 'Valley Distributors', cost: 650, sell: 850, stock: 28, reorder: 8, unit: 'jars' },
  { sku: 'GR-CHK-01', name: 'Chicken Nuggets', description: 'Frozen nuggets 1kg', category: 'Frozen', department: 'Grocery', supplier: 'Khyber Foods', cost: 900, sell: 1150, stock: 22, reorder: 8, unit: 'packs' },
  { sku: 'GR-YOG-01', name: 'Yogurt', description: 'Plain yogurt 1kg', category: 'Dairy', department: 'Grocery', supplier: 'Khyber Foods', cost: 250, sell: 320, stock: 5, reorder: 15, unit: 'tubs' },
  { sku: 'GR-EGS-01', name: 'Eggs', description: 'Farm eggs dozen', category: 'Dairy', department: 'Grocery', supplier: 'Valley Distributors', cost: 320, sell: 400, stock: 0, reorder: 20, unit: 'dozens' },
  { sku: 'GR-BTR-01', name: 'Butter', description: 'Salted butter 200g', category: 'Dairy', department: 'Grocery', supplier: 'Khyber Foods', cost: 380, sell: 480, stock: 8, reorder: 12, unit: 'packs' },
  { sku: 'GR-CHF-01', name: 'Cheese Slices', description: 'Processed cheese 200g', category: 'Dairy', department: 'Grocery', supplier: 'Ali Traders', cost: 420, sell: 550, stock: 30, reorder: 10, unit: 'packs' },

  // Electronics
  { sku: 'EL-TC-01', name: 'Type-C Cable', description: 'USB Type-C fast charge cable 1m', category: 'Cables', department: 'Electronics', supplier: 'Ali Traders', cost: 250, sell: 450, stock: 15, reorder: 20, unit: 'pcs' },
  { sku: 'EL-WM-01', name: 'Wireless Mouse', description: '2.4G wireless optical mouse', category: 'Peripherals', department: 'Electronics', supplier: 'TechHub PK', cost: 900, sell: 1450, stock: 40, reorder: 10, unit: 'pcs' },
  { sku: 'EL-KB-01', name: 'Keyboard', description: 'USB membrane keyboard', category: 'Peripherals', department: 'Electronics', supplier: 'TechHub PK', cost: 1200, sell: 1900, stock: 35, reorder: 10, unit: 'pcs' },
  { sku: 'EL-HP-01', name: 'Headphones', description: 'Over-ear wired headphones', category: 'Audio', department: 'Electronics', supplier: 'TechHub PK', cost: 1500, sell: 2400, stock: 25, reorder: 8, unit: 'pcs' },
  { sku: 'EL-PB-01', name: 'Power Bank', description: '10000mAh power bank', category: 'Power', department: 'Electronics', supplier: 'Ali Traders', cost: 2200, sell: 3200, stock: 18, reorder: 8, unit: 'pcs' },
  { sku: 'EL-USB-01', name: 'USB Drive', description: '32GB USB 3.0 flash drive', category: 'Storage', department: 'Electronics', supplier: 'TechHub PK', cost: 700, sell: 1100, stock: 50, reorder: 15, unit: 'pcs' },
  { sku: 'EL-CHG-01', name: 'Charger', description: '20W USB-C wall charger', category: 'Power', department: 'Electronics', supplier: 'Ali Traders', cost: 800, sell: 1300, stock: 42, reorder: 12, unit: 'pcs' },
  { sku: 'EL-SPK-01', name: 'Bluetooth Speaker', description: 'Portable BT speaker', category: 'Audio', department: 'Electronics', supplier: 'TechHub PK', cost: 2800, sell: 4200, stock: 14, reorder: 5, unit: 'pcs' },
  { sku: 'EL-EAR-01', name: 'Earbuds', description: 'Wireless earbuds case', category: 'Audio', department: 'Electronics', supplier: 'TechHub PK', cost: 1800, sell: 2800, stock: 3, reorder: 10, unit: 'pcs' },
  { sku: 'EL-HDMI-01', name: 'HDMI Cable', description: 'HDMI 2.0 cable 2m', category: 'Cables', department: 'Electronics', supplier: 'Ali Traders', cost: 350, sell: 600, stock: 0, reorder: 15, unit: 'pcs' },
  { sku: 'EL-WEB-01', name: 'Webcam', description: '1080p USB webcam', category: 'Peripherals', department: 'Electronics', supplier: 'TechHub PK', cost: 3500, sell: 5200, stock: 12, reorder: 5, unit: 'pcs' },
  { sku: 'EL-HUB-01', name: 'USB Hub', description: '4-port USB hub', category: 'Peripherals', department: 'Electronics', supplier: 'Ali Traders', cost: 650, sell: 1000, stock: 28, reorder: 8, unit: 'pcs' },
  { sku: 'EL-LED-01', name: 'LED Bulb', description: '12W LED bulb cool white', category: 'Lighting', department: 'Electronics', supplier: 'Valley Distributors', cost: 180, sell: 280, stock: 90, reorder: 25, unit: 'pcs' },
  { sku: 'EL-EXT-01', name: 'Extension Board', description: '4-socket extension board', category: 'Power', department: 'Electronics', supplier: 'Valley Distributors', cost: 750, sell: 1100, stock: 20, reorder: 8, unit: 'pcs' },
  { sku: 'EL-MEM-01', name: 'MicroSD Card', description: '64GB microSD with adapter', category: 'Storage', department: 'Electronics', supplier: 'TechHub PK', cost: 1100, sell: 1650, stock: 33, reorder: 10, unit: 'pcs' },

  // Clothing
  { sku: 'CL-TS-01', name: 'T-Shirt', description: 'Cotton crew neck T-shirt M', category: 'Tops', department: 'Clothing', supplier: 'Nowshera Apparel', cost: 450, sell: 899, stock: 60, reorder: 15, unit: 'pcs' },
  { sku: 'CL-JN-01', name: 'Jeans', description: 'Slim fit denim jeans', category: 'Bottoms', department: 'Clothing', supplier: 'Nowshera Apparel', cost: 1800, sell: 3200, stock: 40, reorder: 10, unit: 'pcs' },
  { sku: 'CL-JK-01', name: 'Jacket', description: 'Lightweight windbreaker', category: 'Outerwear', department: 'Clothing', supplier: 'Nowshera Apparel', cost: 2500, sell: 4500, stock: 22, reorder: 6, unit: 'pcs' },
  { sku: 'CL-HD-01', name: 'Hoodie', description: 'Fleece hoodie unisex', category: 'Outerwear', department: 'Clothing', supplier: 'Nowshera Apparel', cost: 1600, sell: 2900, stock: 30, reorder: 8, unit: 'pcs' },
  { sku: 'CL-SH-01', name: 'Shirt', description: 'Formal cotton shirt', category: 'Tops', department: 'Clothing', supplier: 'Nowshera Apparel', cost: 1200, sell: 2200, stock: 35, reorder: 10, unit: 'pcs' },
  { sku: 'CL-SHO-01', name: 'Shoes', description: 'Casual sneakers', category: 'Footwear', department: 'Clothing', supplier: 'Frontier Footwear', cost: 2800, sell: 4800, stock: 25, reorder: 8, unit: 'pairs' },
  { sku: 'CL-CAP-01', name: 'Cap', description: 'Adjustable baseball cap', category: 'Accessories', department: 'Clothing', supplier: 'Nowshera Apparel', cost: 350, sell: 699, stock: 45, reorder: 12, unit: 'pcs' },
  { sku: 'CL-SKT-01', name: 'Socks', description: 'Cotton socks pack of 3', category: 'Accessories', department: 'Clothing', supplier: 'Nowshera Apparel', cost: 200, sell: 399, stock: 80, reorder: 20, unit: 'packs' },
  { sku: 'CL-BLT-01', name: 'Belt', description: 'Leather belt brown', category: 'Accessories', department: 'Clothing', supplier: 'Frontier Footwear', cost: 700, sell: 1299, stock: 18, reorder: 6, unit: 'pcs' },
  { sku: 'CL-SCA-01', name: 'Scarf', description: 'Winter wool scarf', category: 'Accessories', department: 'Clothing', supplier: 'Nowshera Apparel', cost: 500, sell: 999, stock: 4, reorder: 10, unit: 'pcs' },
  { sku: 'CL-TRS-01', name: 'Trousers', description: 'Chino trousers', category: 'Bottoms', department: 'Clothing', supplier: 'Nowshera Apparel', cost: 1400, sell: 2500, stock: 0, reorder: 8, unit: 'pcs' },
  { sku: 'CL-POL-01', name: 'Polo Shirt', description: 'Pique polo shirt', category: 'Tops', department: 'Clothing', supplier: 'Nowshera Apparel', cost: 800, sell: 1599, stock: 28, reorder: 8, unit: 'pcs' },
  { sku: 'CL-SND-01', name: 'Sandals', description: 'Casual summer sandals', category: 'Footwear', department: 'Clothing', supplier: 'Frontier Footwear', cost: 900, sell: 1699, stock: 32, reorder: 10, unit: 'pairs' },

  // Household
  { sku: 'HH-DET-01', name: 'Detergent', description: 'Laundry detergent 2kg', category: 'Cleaning', department: 'Household', supplier: 'CleanHome Supplies', cost: 650, sell: 850, stock: 55, reorder: 15, unit: 'packs' },
  { sku: 'HH-DIS-01', name: 'Dishwashing Liquid', description: 'Dish soap 750ml', category: 'Cleaning', department: 'Household', supplier: 'CleanHome Supplies', cost: 280, sell: 380, stock: 70, reorder: 20, unit: 'bottles' },
  { sku: 'HH-BRM-01', name: 'Broom', description: 'Floor broom with stick', category: 'Tools', department: 'Household', supplier: 'CleanHome Supplies', cost: 350, sell: 550, stock: 25, reorder: 8, unit: 'pcs' },
  { sku: 'HH-BOX-01', name: 'Storage Box', description: 'Plastic storage box 30L', category: 'Storage', department: 'Household', supplier: 'Valley Distributors', cost: 900, sell: 1400, stock: 20, reorder: 6, unit: 'pcs' },
  { sku: 'HH-TWL-01', name: 'Towels', description: 'Bath towel set of 2', category: 'Linens', department: 'Household', supplier: 'CleanHome Supplies', cost: 700, sell: 1200, stock: 30, reorder: 10, unit: 'sets' },
  { sku: 'HH-CLN-01', name: 'Cleaning Supplies', description: 'Multi-surface cleaner kit', category: 'Cleaning', department: 'Household', supplier: 'CleanHome Supplies', cost: 550, sell: 850, stock: 18, reorder: 8, unit: 'kits' },
  { sku: 'HH-BKT-01', name: 'Bucket', description: 'Plastic bucket 20L', category: 'Tools', department: 'Household', supplier: 'Valley Distributors', cost: 400, sell: 650, stock: 22, reorder: 8, unit: 'pcs' },
  { sku: 'HH-MOP-01', name: 'Mop', description: 'Spin mop with bucket', category: 'Tools', department: 'Household', supplier: 'CleanHome Supplies', cost: 1800, sell: 2800, stock: 12, reorder: 5, unit: 'pcs' },
  { sku: 'HH-TRS-01', name: 'Trash Bags', description: 'Garbage bags roll of 30', category: 'Cleaning', department: 'Household', supplier: 'Ali Traders', cost: 220, sell: 350, stock: 60, reorder: 15, unit: 'rolls' },
  { sku: 'HH-AIR-01', name: 'Air Freshener', description: 'Room spray 300ml', category: 'Cleaning', department: 'Household', supplier: 'CleanHome Supplies', cost: 280, sell: 450, stock: 2, reorder: 10, unit: 'bottles' },
  { sku: 'HH-PIL-01', name: 'Pillow', description: 'Fiber fill pillow', category: 'Linens', department: 'Household', supplier: 'Valley Distributors', cost: 600, sell: 999, stock: 0, reorder: 8, unit: 'pcs' },
  { sku: 'HH-SHT-01', name: 'Bed Sheet', description: 'Cotton bed sheet queen', category: 'Linens', department: 'Household', supplier: 'Valley Distributors', cost: 1500, sell: 2500, stock: 16, reorder: 5, unit: 'sets' },
  { sku: 'HH-GLV-01', name: 'Kitchen Gloves', description: 'Rubber gloves pair', category: 'Cleaning', department: 'Household', supplier: 'CleanHome Supplies', cost: 120, sell: 220, stock: 45, reorder: 12, unit: 'pairs' },
  { sku: 'HH-SPG-01', name: 'Sponges', description: 'Kitchen sponges pack of 6', category: 'Cleaning', department: 'Household', supplier: 'Ali Traders', cost: 90, sell: 160, stock: 75, reorder: 20, unit: 'packs' },
];

export async function seed() {
  console.log('Seeding StockSense AI database...');

  // Idempotent: clear in dependency order if re-seeding via db:reset
  await prisma.aIActionProposal.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.department.deleteMany();

  const departments = await Promise.all(
    [
      { name: 'Grocery', description: 'Food and daily essentials' },
      { name: 'Clothing', description: 'Apparel and footwear' },
      { name: 'Electronics', description: 'Gadgets and accessories' },
      { name: 'Household', description: 'Home and cleaning supplies' },
    ].map((d) => prisma.department.create({ data: d }))
  );
  const deptMap = Object.fromEntries(departments.map((d) => [d.name, d]));

  const supplierNames = [
    { name: 'Ali Traders', phone: '091-5210001', email: 'sales@alitraders.pk', address: 'GT Road, Nowshera' },
    { name: 'Peshawar Mills', phone: '091-5210002', email: 'orders@peshawarmills.pk', address: 'Industrial Estate, Peshawar' },
    { name: 'Khyber Foods', phone: '091-5210003', email: 'info@khyberfoods.pk', address: 'Ring Road, Peshawar' },
    { name: 'Valley Distributors', phone: '091-5210004', email: 'contact@valleydist.pk', address: 'Cantt, Nowshera' },
    { name: 'TechHub PK', phone: '091-5210005', email: 'sales@techhub.pk', address: 'Saddar, Peshawar' },
    { name: 'Nowshera Apparel', phone: '091-5210006', email: 'hello@napparel.pk', address: 'Mall Road, Nowshera' },
    { name: 'Frontier Footwear', phone: '091-5210007', email: 'orders@frontierfw.pk', address: 'Chowk Yadgar, Peshawar' },
    { name: 'CleanHome Supplies', phone: '091-5210008', email: 'sales@cleanhome.pk', address: 'Hayatabad, Peshawar' },
  ];
  const suppliers = await Promise.all(supplierNames.map((s) => prisma.supplier.create({ data: s })));
  const supplierMap = Object.fromEntries(suppliers.map((s) => [s.name, s]));

  const categoryKeys = new Map<string, string>();
  for (const p of PRODUCTS) {
    const key = `${p.department}::${p.category}`;
    if (!categoryKeys.has(key)) {
      const cat = await prisma.category.create({
        data: { name: p.category, departmentId: deptMap[p.department].id },
      });
      categoryKeys.set(key, cat.id);
    }
  }

  const managerHash = await bcrypt.hash('Manager@123', 10);
  const staffHash = await bcrypt.hash('Staff@123', 10);

  const manager = await prisma.user.create({
    data: {
      name: 'Ayesha Khan',
      email: 'manager@stocksense.local',
      passwordHash: managerHash,
      role: 'MANAGER',
      departmentId: null,
    },
  });

  const staff = await prisma.user.create({
    data: {
      name: 'Bilal Ahmed',
      email: 'staff@stocksense.local',
      passwordHash: staffHash,
      role: 'STAFF',
      departmentId: deptMap['Electronics'].id,
    },
  });

  const productRecords = [];
  for (const p of PRODUCTS) {
    const created = await prisma.product.create({
      data: {
        sku: p.sku,
        name: p.name,
        description: p.description,
        categoryId: categoryKeys.get(`${p.department}::${p.category}`)!,
        departmentId: deptMap[p.department].id,
        supplierId: supplierMap[p.supplier].id,
        costPrice: pkr(p.cost),
        sellingPrice: pkr(p.sell),
        currentStock: p.stock,
        reorderLevel: p.reorder,
        unit: p.unit,
      },
    });
    productRecords.push(created);
  }

  const byName = Object.fromEntries(productRecords.map((p) => [p.name, p]));

  // Deterministic recent movements (this week) so top-seller & dashboard agree
  const now = new Date();
  const daysAgo = (n: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    return d;
  };

  type Mov = {
    product: string;
    type: string;
    qty: number;
    daysAgo: number;
    userId: string;
    supplier?: string;
  };

  const movements: Mov[] = [
    { product: 'Type-C Cable', type: 'STOCK_IN', qty: 20, daysAgo: 5, userId: manager.id, supplier: 'Ali Traders' },
    { product: 'Keyboard', type: 'STOCK_IN', qty: 15, daysAgo: 4, userId: staff.id, supplier: 'TechHub PK' },
    { product: 'Sugar', type: 'STOCK_IN', qty: 50, daysAgo: 3, userId: manager.id, supplier: 'Ali Traders' },
    { product: 'Rice', type: 'STOCK_IN', qty: 30, daysAgo: 3, userId: manager.id, supplier: 'Ali Traders' },
    // Sales — Type-C Cable should be top seller this week
    { product: 'Type-C Cable', type: 'SALE', qty: 12, daysAgo: 2, userId: staff.id },
    { product: 'Type-C Cable', type: 'SALE', qty: 8, daysAgo: 1, userId: staff.id },
    { product: 'Wireless Mouse', type: 'SALE', qty: 7, daysAgo: 2, userId: staff.id },
    { product: 'Keyboard', type: 'SALE', qty: 5, daysAgo: 1, userId: manager.id },
    { product: 'Sugar', type: 'SALE', qty: 10, daysAgo: 1, userId: staff.id },
    { product: 'Biscuits', type: 'SALE', qty: 15, daysAgo: 0, userId: staff.id },
    { product: 'Headphones', type: 'DAMAGED', qty: 2, daysAgo: 2, userId: manager.id },
    { product: 'Soft Drinks', type: 'SALE', qty: 20, daysAgo: 0, userId: staff.id },
    { product: 'T-Shirt', type: 'SALE', qty: 6, daysAgo: 1, userId: staff.id },
    { product: 'Detergent', type: 'STOCK_OUT', qty: 5, daysAgo: 2, userId: manager.id },
  ];

  for (const m of movements) {
    const product = byName[m.product];
    if (!product) continue;
    // Reconstruct previous/new based on current stock is tricky after seed stocks are final.
    // We create historical movements that are consistent with narrative but don't mutate current stock again.
    // For consistency: movements are recorded as historical with synthetic previous/new around current.
    const previousStock = product.currentStock;
    let newStock = previousStock;
    if (m.type === 'STOCK_IN') newStock = previousStock; // already reflected in seeded stock
    else newStock = previousStock;

    await prisma.stockMovement.create({
      data: {
        productId: product.id,
        type: m.type,
        quantity: m.qty,
        previousStock: m.type === 'STOCK_IN' ? Math.max(0, previousStock - m.qty) : previousStock + m.qty,
        newStock: previousStock,
        reason: `Seed ${m.type}`,
        supplierId: m.supplier ? supplierMap[m.supplier].id : product.supplierId,
        performedBy: m.userId,
        source: 'FORM',
        unitCost: product.costPrice,
        unitPrice: m.type === 'SALE' ? product.sellingPrice : null,
        createdAt: daysAgo(m.daysAgo),
      },
    });
  }

  await prisma.auditLog.createMany({
    data: [
      {
        userId: manager.id,
        action: 'SEED_COMPLETE',
        entityType: 'System',
        metadata: JSON.stringify({ products: PRODUCTS.length }),
      },
    ],
  });

  console.log(`Seeded ${PRODUCTS.length} products, ${suppliers.length} suppliers, 2 users`);
  console.log('Demo accounts:');
  console.log('  manager@stocksense.local / Manager@123');
  console.log('  staff@stocksense.local / Staff@123');
}

const isDirectRun = process.argv[1]?.includes('seed');
if (isDirectRun) {
  seed()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
