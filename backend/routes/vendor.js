import express from 'express';
import Vendor from '../models/Vendor.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const vendors = await Vendor.find().sort({ name: 1 });
    res.json({ vendors });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve vendors' });
  }
});

router.post('/', authenticate, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { name, contactPerson, phone, email, address } = req.body;
    
    const existing = await Vendor.findOne({ phone: phone.trim() });
    if (existing) return res.status(400).json({ error: 'Vendor with this phone already exists' });

    const vendor = await Vendor.create({
      name,
      contactPerson,
      phone: phone.trim(),
      email,
      address
    });

    res.status(201).json({ message: 'Vendor added successfully', vendor });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add vendor' });
  }
});

export default router;
