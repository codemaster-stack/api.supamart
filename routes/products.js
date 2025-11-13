const { convertPrice, getCurrencySymbol } = require('../utils/currency');
const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Seller = require('../models/Seller');
const { protect, authorize } = require('../middleware/auth');
const multer = require('multer');
const upload = multer();

// @route   POST /api/products/convert-price
// @desc    Convert product price to user's currency
// @access  Protected
router.post('/convert-price', async (req, res) => {
  try {
    const { price, fromCurrency, toCurrency } = req.body;
    
    const convertedPrice = convertPrice(price, fromCurrency, toCurrency);
    const symbol = getCurrencySymbol(toCurrency);
    
    res.json({
      success: true,
      originalPrice: price,
      originalCurrency: fromCurrency,
      convertedPrice: convertedPrice,
      targetCurrency: toCurrency,
      symbol: symbol,
      formattedPrice: `${symbol}${convertedPrice.toLocaleString()}`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Price conversion failed'
    });
  }
});

// @route   GET /api/products
// @desc    Get all products (for index page)
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { category, search, minPrice, maxPrice, page = 1, limit = 20 } = req.query;
    
    let query = { isActive: true };
    
    // Filter by category
    if (category) {
      query.category = category;
    }
    
    // Search by name or description
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }
    
    // Price range filter
    if (minPrice || maxPrice) {
      query['price.amount'] = {};
      if (minPrice) query['price.amount'].$gte = parseFloat(minPrice);
      if (maxPrice) query['price.amount'].$lte = parseFloat(maxPrice);
    }
    
    const products = await Product.find(query)
      .populate('sellerId', 'storeName storeLogo shopURL')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });
    
    const count = await Product.countDocuments(query);
    
    res.json({
      success: true,
      products,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      total: count
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/products/featured
// @desc    Get featured products (for index page)
// @access  Public
router.get('/featured', async (req, res) => {
  try {
    const products = await Product.find({ isActive: true, isFeatured: true })
      .populate('sellerId', 'storeName storeLogo shopURL')
      .limit(8)
      .sort({ sales: -1 });
    
    res.json({
      success: true,
      products
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/products/seller/:shopURL
// @desc    Get products by seller shop URL
// @access  Public
router.get('/seller/:shopURL', async (req, res) => {
  try {
    const seller = await Seller.findOne({ shopURL: req.params.shopURL });
    
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller shop not found'
      });
    }
    
    const products = await Product.find({
      sellerId: seller._id,
      isActive: true
    }).sort({ createdAt: -1 });
    
    res.json({
      success: true,
      seller: {
        id: seller._id,
        storeName: seller.storeName,
        storeLogo: seller.storeLogo,
        storeDescription: seller.storeDescription,
        shopURL: seller.shopURL
      },
      products
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/products
// @desc    Create a new product (sellers only)
// @access  Protected - Seller
router.post('/', protect, authorize('seller'), async (req, res) => {
  try {
    const {
      name, 
      description, 
      category, 
      price, 
      currency,  // FIXED: removed 'priceC' typo
      stock, 
      condition, 
      shippingWeight, 
      shippingFee, 
      tags
    } = req.body;
    
    // Upload images to Cloudinary
    const images = req.files.map(file => ({
      url: file.path,
      publicId: file.filename
    }));

    
    const product = await Product.create({
      sellerId: req.user.id,
      name,
      description,
      category,
      price: {
        amount: price,
        currency: currency || 'USD'
      },
      images,
      stock,
      condition,
      shipping: {
        weight: shippingWeight,
        shippingFee: JSON.parse(shippingFee)
      },
      tags: tags ? tags.split(',').map(tag => tag.trim()) : []
    });
    
    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      product
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// IMPORTANT: Add module.exports at the end
module.exports = router;