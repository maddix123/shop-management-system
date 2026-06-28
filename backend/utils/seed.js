import User from '../models/User.js';
import Product from '../models/Product.js';
import Settings from '../models/Settings.js';

export async function seedDB() {
  try {
    // 1. Seed Admin Account
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@maddix.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'MaddixAdmin123!';

    const existingAdmin = await User.findOne({ email: adminEmail });
    if (!existingAdmin) {
      await User.create({
        username: 'admin',
        email: adminEmail,
        password: adminPassword,
        role: 'admin',
        isActive: true
      });
      console.log('✅ Default admin user created');
    }

    // 2. Seed Default Settings
    const existingSettings = await Settings.findOne();
    if (!existingSettings) {
      await Settings.create({
        shopName: 'Maddix Shop',
        taxRate: 18, // 18% VAT
        currency: 'UGX',
        address: 'Shop 24, Boulevard Mall, Kampala',
        phone: '+256752972945'
      });
      console.log('✅ Default shop settings created');
    }

    // 3. Seed Default Products (for quick testing/demo)
    const productCount = await Product.countDocuments();
    if (productCount === 0) {
      const defaultProducts = [
        {
          name: 'Coca Cola 500ml',
          sku: '5000112630985',
          category: 'Beverages',
          costPrice: 1500,
          sellingPrice: 2000,
          stockQuantity: 120,
          lowStockThreshold: 15,
          supplier: 'Century Bottling'
        },
        {
          name: 'Supreme Wheat Flour 1kg',
          sku: '6000245190123',
          category: 'Grocery',
          costPrice: 3500,
          sellingPrice: 4500,
          stockQuantity: 80,
          lowStockThreshold: 10,
          supplier: 'Mukwano Group'
        },
        {
          name: 'Premium Jasmine Rice 5kg',
          sku: '8850123456789',
          category: 'Grocery',
          costPrice: 18000,
          sellingPrice: 24000,
          stockQuantity: 4, // low stock!
          lowStockThreshold: 10,
          supplier: 'Tilda Uganda'
        },
        {
          name: 'Samsung Galaxy A15',
          sku: '8806098123456',
          category: 'Electronics',
          costPrice: 550000,
          sellingPrice: 650000,
          stockQuantity: 15,
          lowStockThreshold: 3,
          supplier: 'Samsung East Africa'
        }
      ];

      await Product.create(defaultProducts);
      console.log('✅ Default shop products seeded');
    }
  } catch (err) {
    console.error('Database seeding error:', err);
  }
}
