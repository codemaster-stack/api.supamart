const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true,
    required: true
  },
  
  buyer: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    name: String,
    email: String,
    phone: String
  },
  
  items: [{
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Seller',
      required: true
    },
    name: String,
    price: {
      amount: Number,
      currency: String
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    subtotal: Number
  }],
  
  shippingAddress: {
    fullName: String,
    address: String,
    city: String,
    state: String,
    country: String,
    postalCode: String,
    phone: String
  },
  
  payment: {
    method: {
      type: String,
      enum: ['card', 'bank_transfer', 'paypal', 'stripe'],
      required: true
    },
    currency: {
      type: String,
      enum: ['USD', 'GBP', 'EUR', 'NGN'],
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
      default: 'pending'
    },
    transactionId: String,
    paidAt: Date
  },
  
  escrow: {
    status: {
      type: String,
      enum: ['held', 'released', 'refunded'],
      default: 'held'
    },
    heldAt: Date,
    releasedAt: Date,
    releaseScheduledFor: Date // Auto-release after X days
  },
  
  shipping: {
    status: {
      type: String,
      enum: ['pending', 'processing', 'shipped', 'in_transit', 'delivered', 'returned'],
      default: 'pending'
    },
    carrier: String,
    trackingNumber: String,
    shippedAt: Date,
    estimatedDelivery: Date,
    deliveredAt: Date
  },
  
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'completed', 'cancelled', 'refunded'],
    default: 'pending'
  },
  
  deliveryConfirmed: {
    type: Boolean,
    default: false
  },
  
  deliveryConfirmedBy: {
    type: String,
    enum: ['buyer', 'auto', 'admin']
  },
  
  deliveryConfirmedAt: Date,
  
  notes: String,
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Generate unique order number
orderSchema.pre('save', async function(next) {
  if (this.isNew) {
    this.orderNumber = 'ORD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9).toUpperCase();
  }
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Order', orderSchema);