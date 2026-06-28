import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
  shopName: { type: String, default: 'Maddix Shop' },
  taxRate: { type: Number, default: 0 }, // percentage
  currency: { type: String, default: 'USD' },
  address: { type: String, default: 'Shop Address, Kampala' },
  phone: { type: String, default: '+256752972945' }
}, { timestamps: true });

export default mongoose.model('Settings', settingsSchema);
