import express from 'express';
import Sale from '../models/Sale.js';
import Product from '../models/Product.js';
import Customer from '../models/Customer.js';
import { authenticate } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Get all sales
router.get('/', authenticate, async (req, res) => {
  try {
    const sales = await Sale.find()
      .populate('cashier', 'username')
      .populate('customer', 'name phone')
      .sort({ createdAt: -1 });
    res.json({ sales });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve sales' });
  }
});

// Create checkout sale
router.post('/checkout', authenticate, async (req, res) => {
  try {
    const { items, subtotal, tax, discount, totalPrice, amountPaid, changeDue, customerId } = req.body;

    if (!items || items.length === 0) return res.status(400).json({ error: 'Cart is empty' });

    // Validate and deduct stock
    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) return res.status(404).json({ error: `Product ${item.name} not found` });
      
      if (product.stockQuantity < item.quantity) {
        return res.status(400).json({ error: `Insufficient stock for ${product.name}. Available: ${product.stockQuantity}` });
      }
    }

    // Deduct stock
    const saleItems = [];
    for (const item of items) {
      const product = await Product.findById(item.productId);
      product.stockQuantity -= item.quantity;
      await product.save();

      saleItems.push({
        product: product._id,
        name: product.name,
        quantity: item.quantity,
        sellingPrice: item.sellingPrice,
        total: item.quantity * item.sellingPrice
      });
    }

    // Handle customer spend
    let customerObj = null;
    if (customerId) {
      customerObj = await Customer.findById(customerId);
      if (customerObj) {
        customerObj.purchaseCount += 1;
        customerObj.totalSpent += parseFloat(totalPrice);
        await customerObj.save();
      }
    }

    const invoiceNumber = 'INV-' + uuidv4().substring(0, 8).toUpperCase();
    const sale = await Sale.create({
      invoiceNumber,
      items: saleItems,
      subtotal: parseFloat(subtotal),
      tax: parseFloat(tax || 0),
      discount: parseFloat(discount || 0),
      totalPrice: parseFloat(totalPrice),
      amountPaid: parseFloat(amountPaid),
      changeDue: parseFloat(changeDue),
      cashier: req.user._id,
      customer: customerObj ? customerObj._id : null
    });

    // Notify dashboads over Socket.io
    const io = req.app.get('io');
    if (io) {
      io.emit('sale:created', {
        invoiceNumber,
        totalPrice,
        cashier: req.user.username,
        itemsCount: saleItems.length
      });
    }

    res.status(201).json({ message: 'Transaction completed successfully', sale });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: 'Transaction checkout failed' });
  }
});

export default router;
