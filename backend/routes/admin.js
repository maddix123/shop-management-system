import express from 'express';
import Sale from '../models/Sale.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Get dashboard stats (Admin & Manager)
router.get('/stats', authenticate, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0,0,0,0);

    // Today's sales
    const todaySales = await Sale.find({ createdAt: { $gte: today } });
    const todayRevenue = todaySales.reduce((sum, s) => sum + s.totalPrice, 0);

    // Total sales orders
    const totalOrders = await Sale.countDocuments();

    // Low stock count
    const lowStockCount = await Product.countDocuments({
      $expr: { $lte: ['$stockQuantity', '$lowStockThreshold'] }
    });

    // Monthly Profit (Selling Price - Cost Price) * Quantity
    const allSales = await Sale.find().populate('items.product');
    let totalProfit = 0;
    
    allSales.forEach(sale => {
      sale.items.forEach(item => {
        if (item.product) {
          const profitPerUnit = item.sellingPrice - (item.product.costPrice || 0);
          totalProfit += profitPerUnit * item.quantity;
        }
      });
    });

    res.json({
      stats: {
        todayRevenue,
        todayOrders: todaySales.length,
        totalOrders,
        lowStockCount,
        totalProfit
      }
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to retrieve stats' });
  }
});

// User Accounts CRUD (Admin only)
router.get('/users', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve users' });
  }
});

router.post('/users', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    
    const existing = await User.findOne({ $or: [{ username }, { email }] });
    if (existing) return res.status(400).json({ error: 'Username or email already exists' });

    const user = await User.create({ username, email, password, role });
    res.status(201).json({ message: 'User created successfully', user: { id: user._id, username, email, role } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create user' });
  }
});

router.put('/users/:id', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const { username, email, role, isActive } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (username) user.username = username;
    if (email) user.email = email;
    if (role) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;

    await user.save();
    res.json({ message: 'User updated successfully', user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

export default router;
