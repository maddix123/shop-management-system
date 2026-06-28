import express from 'express';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// ==================== CUSTOM CATEGORIES ROUTES ====================

// Get all categories (and seed defaults if none exist)
router.get('/categories', authenticate, async (req, res) => {
  try {
    let categories = await Category.find().sort({ name: 1 });
    
    if (categories.length === 0) {
      const defaults = [
        'Grocery', 'Beverages', 'Electronics', 'Apparel', 
        'Cosmetics', 'Pharmaceuticals', 'Home & Office', 'Bakery', 'Other'
      ];
      await Category.create(defaults.map(name => ({ name })));
      categories = await Category.find().sort({ name: 1 });
    }
    
    res.json({ categories });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve categories' });
  }
});

// Create custom category (Admin & Manager)
router.post('/categories', authenticate, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || name.trim() === '') return res.status(400).json({ error: 'Category name is required' });

    const existing = await Category.findOne({ name: name.trim() });
    if (existing) return res.status(400).json({ error: 'Category already exists' });

    const category = await Category.create({ name: name.trim() });
    res.status(201).json({ message: 'Category created successfully', category });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// ==================== PRODUCT CRUD ROUTES ====================

// Get all products
router.get('/', authenticate, async (req, res) => {
  try {
    const products = await Product.find().sort({ name: 1 });
    res.json({ products });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve products' });
  }
});

// Search product by SKU
router.get('/sku/:sku', authenticate, async (req, res) => {
  try {
    const product = await Product.findOne({ sku: req.params.sku.trim() });
    if (!product) return res.status(404).json({ error: 'Product not found with this SKU' });
    res.json({ product });
  } catch (err) {
    res.status(500).json({ error: 'SKU lookup failed' });
  }
});

// Create product (Admin / Manager)
router.post('/', authenticate, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { name, sku, category, costPrice, sellingPrice, stockQuantity, lowStockThreshold, supplier } = req.body;
    
    const existing = await Product.findOne({ sku: sku.trim() });
    if (existing) return res.status(400).json({ error: 'Product SKU already exists' });

    const product = await Product.create({
      name,
      sku: sku.trim(),
      category,
      costPrice: parseFloat(costPrice),
      sellingPrice: parseFloat(sellingPrice),
      stockQuantity: parseInt(stockQuantity),
      lowStockThreshold: parseInt(lowStockThreshold),
      supplier
    });

    res.status(201).json({ message: 'Product created successfully', product });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// Update product
router.put('/:id', authenticate, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { name, category, costPrice, sellingPrice, stockQuantity, lowStockThreshold, supplier } = req.body;
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    if (name) product.name = name;
    if (category) product.category = category;
    if (costPrice !== undefined) product.costPrice = parseFloat(costPrice);
    if (sellingPrice !== undefined) product.sellingPrice = parseFloat(sellingPrice);
    if (stockQuantity !== undefined) product.stockQuantity = parseInt(stockQuantity);
    if (lowStockThreshold !== undefined) product.lowStockThreshold = parseInt(lowStockThreshold);
    if (supplier) product.supplier = supplier;

    await product.save();
    res.json({ message: 'Product updated successfully', product });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// Delete product
router.delete('/:id', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

export default router;
