const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Seller = require('../models/Seller');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { protect, authorize } = require('../middleware/auth');

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard stats
// @access  Protected - Admin only
router.get('/dashboard', protect, authorize('admin'), async (req, res) => {
  try {
    // Get counts
    const totalUsers = await User.countDocuments();
    const totalSellers = await Seller.countDocuments();
    const totalProducts = await Product.countDocuments();
    const totalOrders = await Order.countDocuments();
    
    // Get revenue (sum of all completed orders)
    const revenueData = await Order.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$payment.amount' } } }
    ]);
    const totalRevenue = revenueData[0]?.total || 0;
    
    // Get pending seller approvals
    const pendingSellers = await Seller.countDocuments({ isApproved: false });
    
    // Get monthly revenue for chart
    const monthlyRevenue = await Order.aggregate([
      { 
        $match: { 
          status: 'completed',
          createdAt: { $gte: new Date(new Date().setMonth(new Date().getMonth() - 6)) }
        } 
      },
      {
        $group: {
          _id: { $month: '$createdAt' },
          total: { $sum: '$payment.amount' }
        }
      },
      { $sort: { '_id': 1 } }
    ]);
    
    // Get monthly user growth for chart
    const monthlyUsers = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(new Date().setMonth(new Date().getMonth() - 6)) }
        }
      },
      {
        $group: {
          _id: { $month: '$createdAt' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]);
    
    res.json({
      success: true,
      stats: {
        totalRevenue,
        totalUsers,
        totalSellers,
        totalOrders,
        pendingSellers
      },
      charts: {
        monthlyRevenue,
        monthlyUsers
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/admin/users
// @desc    Get all users with pagination
// @access  Protected - Admin only
router.get('/users', protect, authorize('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    
    let query = {};
    if (search) {
      query = {
        $or: [
          { fullName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      };
    }
    
    const users = await User.find(query)
      .select('-password')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });
    
    const count = await User.countDocuments(query);
    
    res.json({
      success: true,
      users,
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

// @route   GET /api/admin/sellers
// @desc    Get all sellers with pagination
// @access  Protected - Admin only
router.get('/sellers', protect, authorize('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 20, status = 'all' } = req.query;
    
    let query = {};
    if (status === 'pending') {
      query.isApproved = false;
    } else if (status === 'approved') {
      query.isApproved = true;
    }
    
    const sellers = await Seller.find(query)
      .select('-password')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });
    
    const count = await Seller.countDocuments(query);
    
    res.json({
      success: true,
      sellers,
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

// @route   PUT /api/admin/sellers/:id/approve
// @desc    Approve seller
// @access  Protected - Admin only
router.put('/sellers/:id/approve', protect, authorize('admin'), async (req, res) => {
  try {
    const seller = await Seller.findByIdAndUpdate(
      req.params.id,
      { isApproved: true },
      { new: true }
    );
    
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Seller approved successfully',
      seller
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   DELETE /api/admin/sellers/:id
// @desc    Delete/Suspend seller
// @access  Protected - Admin only
router.delete('/sellers/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const seller = await Seller.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Seller suspended successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/admin/products
// @desc    Get all products
// @access  Protected - Admin only
router.get('/products', protect, authorize('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const products = await Product.find()
      .populate('sellerId', 'storeName email')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });
    
    const count = await Product.countDocuments();
    
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

// @route   DELETE /api/admin/products/:id
// @desc    Delete product
// @access  Protected - Admin only
router.delete('/products/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/admin/orders
// @desc    Get all orders
// @access  Protected - Admin only
router.get('/orders', protect, authorize('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const orders = await Order.find()
      .populate('buyer.userId', 'fullName email')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });
    
    const count = await Order.countDocuments();
    
    res.json({
      success: true,
      orders,
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

module.exports = router;