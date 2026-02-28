const mongoose = require('mongoose');
const { upload } = require('../config/cloudinary');
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Seller = require('../models/Seller');
const Admin = require('../models/Admin');
const { getLocationFromIP } = require('../utils/geolocation');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const axios = require('axios');
const qs = require('querystring');


// Generate JWT Token
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

// @route   POST /api/auth/register/user
router.post('/register/user', async (req, res) => {
  try {
    const { fullName, email, password, country, phoneNumber } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    const user = await User.create({
      fullName,
      email,
      password,
      country,
      phoneNumber
    });

    const token = generateToken(user._id, user.role);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});


// @route   POST /api/auth/register/seller
// @desc    Register a new seller (with Cloudinary upload)
// @access  Public
router.post('/register/seller', upload.single('storeLogo'), async (req, res) => {
  try {
    const {
      email, 
      password, 
      storeName, 
      storeURL, 
      storeDescription,
      fullName, 
      country, 
      phoneNumber,
      addressLine1, 
      addressLine2, 
      city, 
      stateProvince, 
      postalCode
    } = req.body;

    // Validate required fields
    if (!email || !password || !storeName || !storeDescription || 
        !fullName || !country || !phoneNumber || !addressLine1 || 
        !city || !stateProvince || !postalCode) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    // Check if seller exists
    const existingSeller = await Seller.findOne({ email });
    if (existingSeller) {
      return res.status(400).json({
        success: false,
        message: 'Seller already exists with this email'
      });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Store logo is required'
      });
    }

    // Generate shopURL from storeURL or storeName
    let shopURL = storeURL || storeName.toLowerCase().replace(/\s+/g, '-');
    
    // Make sure shopURL is unique
    let existingShop = await Seller.findOne({ shopURL });
    if (existingShop) {
      // Add random number if shopURL already exists
      shopURL = `${shopURL}-${Math.floor(Math.random() * 10000)}`;
    }

    // Create seller with Cloudinary URL
    const seller = await Seller.create({
      email,
      password,
      storeName,
      storeURL: storeURL || '', // Original storeURL input
      shopURL: shopURL, // ← IMPORTANT: This is the unique shop identifier
      storeLogo: req.file.path, // Cloudinary URL
      storeDescription,
      fullName,
      country,
      phoneNumber,
      address: {
        line1: addressLine1,
        line2: addressLine2 || '',
        city,
        stateProvince,
        postalCode
      }
    });

    // Generate token
    const token = generateToken(seller._id, seller.role);

    res.status(201).json({
      success: true,
      message: 'Seller registered successfully. Awaiting approval.',
      token,
      seller: {
        id: seller._id,
        storeName: seller.storeName,
        email: seller.email,
        role: seller.role,
        isApproved: seller.isApproved,
        storeLogo: seller.storeLogo,
        shopURL: seller.shopURL // ← Send this to frontend
      }
    });
  } catch (error) {
    console.error('Seller registration error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Registration failed'
    });
  }
});

// @desc    Register a new admin
// @access  Public (Should be protected in production!)
router.post('/register/admin', async (req, res) => {
  try {
    const { email, password, confirmPassword, fullName } = req.body;

    // Validate required fields
    if (!email || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Check if passwords match
    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
      });
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must contain uppercase, lowercase, number, and special character'
      });
    }

    // Check if admin exists
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Admin already exists with this email'
      });
    }

    // Create admin (using default values for fields not in form)
    const admin = await Admin.create({
      email,
      password,
      fullName: fullName || '',
      phone: 'N/A',
      country: 'N/A',
      accountType: 'Admin'
    });

    // Generate token
    const token = generateToken(admin._id, admin.role);

    res.status(201).json({
      success: true,
      message: 'Admin registered successfully',
      token,
      admin: {
        id: admin._id,
        email: admin.email,
        fullName: admin.fullName,
        role: admin.role
      }
    });
  } catch (error) {
    console.error('Admin registration error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Registration failed'
    });
  }
});



// @route   POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Get user's IP address
    const userIP = req.headers['x-forwarded-for'] || 
                   req.connection.remoteAddress || 
                   req.socket.remoteAddress;

    // Check in User collection
    let account = await User.findOne({ email }).select('+password');
    let role = 'user';
    let dashboardUrl = '/userpage';
    let location = null;
    let currency = 'USD';

    // If user account found, detect location and currency
    if (account && role === 'user') {
      location = getLocationFromIP(userIP);
      currency = location.currency;
      
      // Update user's location and currency
      await User.findByIdAndUpdate(account._id, {
        location: {
          country: location.country,
          city: location.city,
          region: location.region,
          timezone: location.timezone
        },
        currency: currency,
        lastIP: userIP
      });
    }

    // If not found, check Seller collection
    if (!account) {
      account = await Seller.findOne({ email }).select('+password');
      if (account) {
        role = 'seller';
        dashboardUrl = '/merchant';
        
        if (!account.isApproved) {
          return res.status(403).json({
            success: false,
            message: 'Your seller account is pending approval. Please wait for admin verification.'
          });
        }
      }
    }

    // If still not found, check Admin collection
    if (!account) {
      account = await Admin.findOne({ email }).select('+password');
      if (account) {
        role = 'admin';
        dashboardUrl = '/admin-dashboard.html'; // CRITICAL: Add .html
        console.log('✅ Admin login detected');
      }
    }

    // If account not found in any collection
    if (!account) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if account is active
    if (!account.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact support.'
      });
    }

    // Verify password
    const isPasswordValid = await account.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Generate token
    const token = generateToken(account._id, role);
    
    console.log('✅ Login successful:', {
      email: account.email,
      role: role,
      dashboardUrl: dashboardUrl
    });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      role, // CRITICAL: Make sure role is sent
      dashboardUrl,
      user: {
        id: account._id,
        email: account.email,
        role: role, // CRITICAL: Include role in user object too
        name: account.fullName || account.storeName || 'Admin',
        currency: currency,
        location: location
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed. Please try again.'
    });
  }
});



// @route POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email required' });

    // Find user in any collection
    let user = await User.findOne({ email }) ||
               await Seller.findOne({ email }) ||
               await Admin.findOne({ email });

    if (!user) {
      // Always return success message to avoid revealing accounts
      return res.status(200).json({ success: true, message: 'If this email exists, a reset link has been sent' });
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
   const updateResult = await mongoose.connection.collection('sellers').updateOne(
  { _id: user._id },
  { $set: {
    resetToken: token,
    resetTokenExpiry: new Date(Date.now() + 3600000)
  }}
);
    // Generate reset link
    const resetLink = `${process.env.FRONTEND_URL}/reset-password.html?token=${token}`;

    // Send email via Zoho
    await sendResetEmail(email, resetLink);

    res.status(200).json({ success: true, message: 'If this email exists, a reset link has been sent' });
   } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ success: false, message: 'Something went wrong' });
  }
});


async function sendResetEmail(toEmail, resetLink) {
  try {
    const tokenResponse = await axios.post(
      'https://accounts.zoho.com/oauth/v2/token',
      qs.stringify({
        refresh_token: process.env.ZOHO_REFRESH_TOKEN,
        client_id: process.env.ZOHO_CLIENT_ID,
        client_secret: process.env.ZOHO_CLIENT_SECRET,
        grant_type: 'refresh_token'
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const accessToken = tokenResponse.data.access_token;

    // Get account ID first
    const accountsRes = await axios.get('https://mail.zoho.com/api/accounts', {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` }
    });

    const accountId = accountsRes.data.data[0].accountId;

    await axios.post(
      `https://mail.zoho.com/api/accounts/${accountId}/messages`,
      {
        fromAddress: process.env.ZOHO_EMAIL,
        toAddress: toEmail,
        subject: 'Supamart Password Reset',
        content: `<p>Click <a href="${resetLink}">here</a> to reset your password. This link expires in 1 hour.</p>`
      },
      {
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`✅ Reset email sent to ${toEmail}`);
  } catch (err) {
    console.error('Error sending email via Zoho API:', err.response?.data || err.message);
  }
}
// @route POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ success: false, message: 'Token and password required' });

    const now = new Date();

    // Find using native MongoDB driver
    let sellerDoc = await mongoose.connection.collection('sellers').findOne({ resetToken: token, resetTokenExpiry: { $gt: now } });
    let userDoc = await mongoose.connection.collection('users').findOne({ resetToken: token, resetTokenExpiry: { $gt: now } });
    let adminDoc = await mongoose.connection.collection('admins').findOne({ resetToken: token, resetTokenExpiry: { $gt: now } });

    let collection = sellerDoc ? 'sellers' : userDoc ? 'users' : adminDoc ? 'admins' : null;
    let doc = sellerDoc || userDoc || adminDoc;

    if (!doc) return res.status(400).json({ success: false, message: 'Invalid or expired token' });

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Update password and clear token
    await mongoose.connection.collection(collection).updateOne(
      { _id: doc._id },
      { $set: { password: hashedPassword }, $unset: { resetToken: '', resetTokenExpiry: '' } }
    );

    res.status(200).json({ success: true, message: 'Password has been reset successfully' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ success: false, message: 'Something went wrong' });
  }
});




module.exports = router;