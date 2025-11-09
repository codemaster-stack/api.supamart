const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const Seller = require('../models/Seller');
const Admin = require('../models/Admin');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads/logos');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed!'));
  }
});

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
router.post('/register/seller', upload.single('storeLogo'), async (req, res) => {
  try {
    const {
      email, password, storeName, storeURL, storeDescription,
      fullName, country, phoneNumber,
      addressLine1, addressLine2, city, stateProvince, postalCode
    } = req.body;

    const existingSeller = await Seller.findOne({ email });
    if (existingSeller) {
      return res.status(400).json({
        success: false,
        message: 'Seller already exists with this email'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Store logo is required'
      });
    }

    const seller = await Seller.create({
      email,
      password,
      storeName,
      storeURL,
      storeLogo: `/uploads/logos/${req.file.filename}`,
      storeDescription,
      fullName,
      country,
      phoneNumber,
      address: {
        line1: addressLine1,
        line2: addressLine2,
        city,
        stateProvince,
        postalCode
      }
    });

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
        isApproved: seller.isApproved
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/auth/register/admin
router.post('/register/admin', async (req, res) => {
  try {
    const { email, password, phone, country, accountType } = req.body;

    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Admin already exists with this email'
      });
    }

    const admin = await Admin.create({
      email,
      password,
      phone,
      country,
      accountType
    });

    const token = generateToken(admin._id, admin.role);

    res.status(201).json({
      success: true,
      message: 'Admin registered successfully',
      token,
      admin: {
        id: admin._id,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
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

    let account = await User.findOne({ email }).select('+password');
    let role = 'user';
    let dashboardUrl = '/userpage';

    if (!account) {
      account = await Seller.findOne({ email }).select('+password');
      if (account) {
        role = 'seller';
        dashboardUrl = '/merchant';
        
        if (!account.isApproved) {
          return res.status(403).json({
            success: false,
            message: 'Your seller account is pending approval'
          });
        }
      }
    }

    if (!account) {
      account = await Admin.findOne({ email }).select('+password');
      if (account) {
        role = 'admin';
        dashboardUrl = '/admin-dashboard';
      }
    }

    if (!account) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    if (!account.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated'
      });
    }

    const isPasswordValid = await account.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const token = generateToken(account._id, role);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      role,
      dashboardUrl,
      user: {
        id: account._id,
        email: account.email,
        role: role,
        name: account.fullName || account.storeName || 'Admin'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;