import mongoose from 'mongoose';

const vendorSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  contactPerson: { type: String, trim: true, default: '' },
  phone: { type: String, required: true, unique: true, trim: true },
  email: { type: String, trim: true, default: '' },
  address: { type: String, trim: true, default: '' }
}, { timestamps: true });

export default mongoose.model('Vendor', vendorSchema);
