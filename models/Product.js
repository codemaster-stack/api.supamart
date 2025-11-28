const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: true
  },
  
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true
  },
  
  description: {
    type: String,
    required: [true, 'Product description is required']
  },
  
  category: {
    type: String,
    required: true,
    enum: ['Electronics', 'Fashion', 'Home', 'Beauty', 'Sports', 'Books', 'Food', 'Cars' , 'Other']
  },
  
  price: {
    amount: {
      type: Number,
      required: [true, 'Price is required'],
      min: 0
    },
    currency: {
      type: String,
      required: true,
      enum: ['USD', 'GBP', 'EUR', 'NGN'],
      default: 'USD'
    }
  },
  
  images: [{
    url: String,
    publicId: String // Cloudinary public ID
  }],
  
  stock: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  
  condition: {
    type: String,
    enum: ['New', 'Used - Like New', 'Used - Good', 'Used - Fair'],
    default: 'New'
  },
  
  shipping: {
    weight: Number, // in kg
    dimensions: {
      length: Number,
      width: Number,
      height: Number
    },
    shipsFrom: String, // Country code
    shippingFee: {
      domestic: Number,
      international: Number
    }
  },
  
  isActive: {
    type: Boolean,
    default: true
  },
  
  isFeatured: {
    type: Boolean,
    default: false
  },
  
  views: {
    type: Number,
    default: 0
  },
  
  sales: {
    type: Number,
    default: 0
  },
  
  rating: {
    average: { type: Number, default: 0, min: 0, max: 5 },
    count: { type: Number, default: 0 }
  },
  
  tags: [String],
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp on save
productSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Product', productSchema);