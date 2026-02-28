const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
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
  country: {
    type: String,
    required: [true, 'Country is required']
  },
  phoneNumber: {
    type: String,
    required: [true, 'Phone number is required']
  },

   location: {
    country: String,
    city: String,
    region: String,
    timezone: String
  },
  currency: {
    type: String,
    default: 'USD'
  },
  lastIP: {
    type: String
  },
  
  role: {
    type: String,
    default: 'user',
    enum: ['user']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  resetToken: {
  type: String,
  default: null
},
resetTokenExpiry: {
  type: Date,
  default: null
},
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);