const { upload } = require('../config/cloudinary');
const express = require('express');
const router = express.Router();
const Seller = require('../models/Seller');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { protect, authorize } = require('../middleware/auth');

// @route   GET /api/sellers/:id
// @desc    Get seller details
// @access  Protected - Seller
router.get('/:id', protect, authorize('seller'), async (req, res) => {
  try {
    // Make sure seller can only access their own data
    if (req.user.id !== req.params.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }
    
    const seller = await Seller.findById(req.params.id).select('-password');
    
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller not found'
      });
    }
    
    res.json({
      success: true,
      seller
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/sellers/:id/stats
// @desc    Get seller dashboard stats
// @access  Protected - Seller
router.get('/:id/stats', protect, authorize('seller'), async (req, res) => {
  try {
    if (req.user.id !== req.params.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }
    
    // Count active products
    const activeProducts = await Product.countDocuments({
      sellerId: req.params.id,
      isActive: true
    });
    
    // Count pending orders
    const pendingOrders = await Order.countDocuments({
      'items.sellerId': req.params.id,
      status: { $in: ['pending', 'processing'] }
    });
    
    // Calculate total sales
    const salesData = await Order.aggregate([
      { 
        $match: { 
          'items.sellerId': req.user.id,
          status: 'completed'
        } 
      },
      { $unwind: '$items' },
      { 
        $match: { 
          'items.sellerId': req.user.id 
        } 
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$items.subtotal' }
        }
      }
    ]);
    
    const totalSales = salesData[0]?.total || 0;
    
    res.json({
      success: true,
      stats: {
        activeProducts,
        pendingOrders,
        totalSales
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/sellers/:id/orders/recent
// @desc    Get recent orders for seller
// @access  Protected - Seller
router.get('/:id/orders/recent', protect, authorize('seller'), async (req, res) => {
  try {
    if (req.user.id !== req.params.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }
    
    const orders = await Order.find({
      'items.sellerId': req.params.id
    })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('buyer.userId', 'fullName email');
    
    res.json({
      success: true,
      orders
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/sellers/:id/products
// @desc    Get all products for seller
// @access  Protected - Seller
router.get('/:id/products', protect, authorize('seller'), async (req, res) => {
  try {
    if (req.user.id !== req.params.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }
    
    const products = await Product.find({
      sellerId: req.params.id
    }).sort({ createdAt: -1 });
    
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

// @route   PUT /api/sellers/:id
// @desc    Update seller profile
// @access  Protected - Seller
router.put('/:id', protect, authorize('seller'), async (req, res) => {
  try {
    if (req.user.id !== req.params.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }
    
    const { storeName, storeDescription, phoneNumber, address } = req.body;
    
    const seller = await Seller.findByIdAndUpdate(
      req.params.id,
      {
        storeName,
        storeDescription,
        phoneNumber,
        address
      },
      { new: true, runValidators: true }
    ).select('-password');
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      seller
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});


// @route   POST /api/sellers/:id/bank-account
// @desc    Add bank account
// @access  Protected - Seller
router.post('/:id/bank-account', protect, authorize('seller'), async (req, res) => {
  try {
    if (req.user.id !== req.params.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }
    
    const { currency, bankName, accountName, accountNumber, swiftCode } = req.body;
    
    const seller = await Seller.findById(req.params.id);
    
    seller.bankAccounts.push({
      currency,
      bankName,
      accountName,
      accountNumber,
      swiftCode: swiftCode || ''
    });
    
    await seller.save();
    
    res.json({
      success: true,
      message: 'Bank account added successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   DELETE /api/sellers/:id/bank-account/:accountId
// @desc    Remove bank account
// @access  Protected - Seller
router.delete('/:id/bank-account/:accountId', protect, authorize('seller'), async (req, res) => {
  try {
    if (req.user.id !== req.params.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }
    
    const seller = await Seller.findById(req.params.id);
    
    seller.bankAccounts = seller.bankAccounts.filter(
      account => account._id.toString() !== req.params.accountId
    );
    
    await seller.save();
    
    res.json({
      success: true,
      message: 'Bank account removed'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/sellers/:id/payout
// @desc    Request payout
// @access  Protected - Seller
router.post('/:id/payout', protect, authorize('seller'), async (req, res) => {
  try {
    if (req.user.id !== req.params.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }
    
    const { currency, amount, accountId } = req.body;
    
    const seller = await Seller.findById(req.params.id);
    
    // Check if seller has enough balance
    if (seller.wallets[currency].balance < amount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance'
      });
    }
    
    // Deduct from balance (in production, create payout request record)
    seller.wallets[currency].balance -= amount;
    await seller.save();
    
    // In production, you'd create a Payout model and send to payment processor
    
    res.json({
      success: true,
      message: 'Payout request submitted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});


// @route   PUT /api/sellers/:id/logo
// @desc    Update seller store logo
// @access  Protected - Seller
router.put('/:id/logo', protect, authorize('seller'), upload.single('storeLogo'), async (req, res) => {
  try {
    if (req.user.id !== req.params.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a logo file'
      });
    }
    
    const seller = await Seller.findByIdAndUpdate(
      req.params.id,
      { storeLogo: req.file.path },
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Logo updated successfully',
      storeLogo: seller.storeLogo
    });
    
  } catch (error) {
    console.error('Logo update error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update logo'
    });
  }
});

module.exports = router;