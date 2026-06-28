import mongoose from 'mongoose';

const saleItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  sellingPrice: { type: Number, required: true },
  total: { type: Number, required: true }
});

const saleSchema = new mongoose.Schema({
  invoiceNumber: { type: String, required: true, unique: true },
  items: [saleItemSchema],
  subtotal: { type: Number, required: true },
  tax: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  totalPrice: { type: Number, required: true },
  amountPaid: { type: Number, required: true },
  changeDue: { type: Number, required: true },
  cashier: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null }
}, { timestamps: true });

export default mongoose.model('Sale', saleSchema);
