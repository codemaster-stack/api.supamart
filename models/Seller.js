const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const sellerSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Business email is required'],
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 8,
    select: false
  },
  storeName: {
    type: String,
    required: [true, 'Store name is required'],
    trim: true
  },
  storeURL: {
    type: String,
    trim: true
  },
  shopURL: {
    type: String,
    unique: true,
    required: true,
    lowercase: true,
    trim: true
  },
  storeLogo: {
    type: String,
    required: [true, 'Store logo is required']
  },
  storeDescription: {
    type: String,
    required: [true, 'Store description is required']
  },
  fullName: {
    type: String,
    required: [true, 'Contact person name is required'],
    trim: true
  },
  country: {
    type: String,
    required: [true, 'Country is required']
  },
  phoneNumber: {
    type: String,
    required: [true, 'Phone number is required']
  },
  address: {
    line1: {
      type: String,
      required: [true, 'Address line 1 is required']
    },
    line2: String,
    city: {
      type: String,
      required: [true, 'City is required']
    },
    stateProvince: {
      type: String,
      required: [true, 'State/Province is required']
    },
    postalCode: {
      type: String,
      required: [true, 'Postal code is required']
    }
  },
  
  // Multi-currency wallets
  wallets: {
    USD: {
      balance: { type: Number, default: 0 },
      pendingBalance: { type: Number, default: 0 },
      totalEarnings: { type: Number, default: 0 }
    },
    GBP: {
      balance: { type: Number, default: 0 },
      pendingBalance: { type: Number, default: 0 },
      totalEarnings: { type: Number, default: 0 }
    },
    EUR: {
      balance: { type: Number, default: 0 },
      pendingBalance: { type: Number, default: 0 },
      totalEarnings: { type: Number, default: 0 }
    },
    NGN: {
      balance: { type: Number, default: 0 },
      pendingBalance: { type: Number, default: 0 },
      totalEarnings: { type: Number, default: 0 }
    }
  },
  
  // Bank account info for withdrawals
  bankAccounts: [{
    currency: { type: String, enum: ['USD', 'GBP', 'EUR', 'NGN'] },
    accountNumber: String,
    accountName: String,
    bankName: String,
    swiftCode: String,
    isDefault: { type: Boolean, default: false }
  }],
  
  role: {
    type: String,
    default: 'seller',
    enum: ['seller']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isApproved: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving
sellerSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
sellerSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Seller', sellerSchema);