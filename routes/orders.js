const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const Seller = require('../models/Seller');
const Transaction = require('../models/Transaction');
const { protect } = require('../middleware/auth');
const { convertPrice } = require('../utils/currency');

// @route   POST /api/orders
// @desc    Create new order (with escrow)
// @access  Protected - User
router.post('/', protect, async (req, res) => {
  try {
    const { items, shippingAddress, paymentMethod, paymentCurrency } = req.body;
    
    // Calculate total and create order items
    let orderItems = [];
    let total = 0;
    
    for (const item of items) {
      const product = await Product.findById(item.productId);
      
      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product not found: ${item.productId}`
        });
      }
      
      if (product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}`
        });
      }
      
      // Convert price to payment currency
      const convertedPrice = convertPrice(
        product.price.amount,
        product.price.currency,
        paymentCurrency
      );
      
      const subtotal = convertedPrice * item.quantity;
      
      orderItems.push({
        productId: product._id,
        sellerId: product.sellerId,
        name: product.name,
        price: {
          amount: convertedPrice,
          currency: paymentCurrency
        },
        quantity: item.quantity,
        subtotal
      });
      
      total += subtotal;
      
      // Reduce stock
      product.stock -= item.quantity;
      await product.save();
    }
    
    // Create order
    const order = await Order.create({
      buyer: {
        userId: req.user.id,
        name: req.user.fullName,
        email: req.user.email,
        phone: req.user.phoneNumber
      },
      items: orderItems,
      shippingAddress,
      payment: {
        method: paymentMethod,
        currency: paymentCurrency,
        amount: total,
        status: 'processing'
      },
      escrow: {
        status: 'held',
        heldAt: Date.now(),
        releaseScheduledFor: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days
      }
    });
    
    // Create transactions for each seller (held in escrow)
    for (const item of orderItems) {
      await Transaction.create({
        orderId: order._id,
        sellerId: item.sellerId,
        type: 'escrow_hold',
        amount: item.subtotal,
        currency: paymentCurrency,
        status: 'pending',
        description: `Payment held in escrow for order ${order.orderNumber}`
      });
      
      // Update seller's pending balance
      const seller = await Seller.findById(item.sellerId);
      seller.wallets[paymentCurrency].pendingBalance += item.subtotal;
      await seller.save();
    }
    
    res.status(201).json({
      success: true,
      message: 'Order created successfully. Payment held in escrow.',
      order
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   PUT /api/orders/:orderId/confirm-delivery
// @desc    Confirm delivery (releases escrow)
// @access  Protected - User
router.put('/:orderId/confirm-delivery', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    if (order.buyer.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }
    
    // Update order status
    order.deliveryConfirmed = true;
    order.deliveryConfirmedBy = 'buyer';
    order.deliveryConfirmedAt = Date.now();
    order.status = 'completed';
    order.escrow.status = 'released';
    order.escrow.releasedAt = Date.now();
    await order.save();
    
    // Release funds to sellers
    for (const item of order.items) {
      // Update transaction
      await Transaction.create({
        orderId: order._id,
        sellerId: item.sellerId,
        type: 'escrow_release',
        amount: item.subtotal,
        currency: order.payment.currency,
        status: 'completed',
        description: `Payment released from escrow for order ${order.orderNumber}`
      });
      
      // Update seller's wallet
      const seller = await Seller.findById(item.sellerId);
      const currency = order.payment.currency;
      seller.wallets[currency].pendingBalance -= item.subtotal;
      seller.wallets[currency].balance += item.subtotal;
      seller.wallets[currency].totalEarnings += item.subtotal;
      await seller.save();
    }
    
    res.json({
      success: true,
      message: 'Delivery confirmed. Funds released to sellers.',
      order
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;