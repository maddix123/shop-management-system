import express from 'express';
import Customer from '../models/Customer.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// List all customers
router.get('/', authenticate, async (req, res) => {
  try {
    const customers = await Customer.find().sort({ name: 1 });
    res.json({ customers });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve customers' });
  }
});

// Search customer by phone
router.get('/phone/:phone', authenticate, async (req, res) => {
  try {
    const customer = await Customer.findOne({ phone: req.params.phone.trim() });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json({ customer });
  } catch (err) {
    res.status(500).json({ error: 'Customer lookup failed' });
  }
});

// Create new customer
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, phone, email, address } = req.body;
    
    const existing = await Customer.findOne({ phone: phone.trim() });
    if (existing) return res.status(400).json({ error: 'Customer with this phone already exists' });

    const customer = await Customer.create({
      name,
      phone: phone.trim(),
      email,
      address
    });

    res.status(201).json({ message: 'Customer registered successfully', customer });
  } catch (err) {
    res.status(500).json({ error: 'Failed to register customer' });
  }
});

export default router;
