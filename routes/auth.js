const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const Seller = require('../models/Seller');
const Admin = require('../models/Admin');
const { getLocationFromIP } = require('../utils/geolocation');

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
        dashboardUrl = '/admin-dashboard';
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
        name: account.fullName || account.storeName || 'Admin',
        currency: currency, // Send currency to frontend
        location: location // Send location to frontend
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

module.exports = router;