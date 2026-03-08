const express = require('express');
const router = express.Router();
const Banner = require('../models/Banner');
const jwt = require('jsonwebtoken');

// Admin auth middleware
function adminAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'No token' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ success: false, message: 'Admins only' });
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
}

// PUBLIC - get all active banners
router.get('/', async (req, res) => {
  try {
    const banners = await Banner.find({ isActive: true }).sort({ createdAt: -1 });
    res.json({ success: true, banners });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ADMIN - add banner
router.post('/', adminAuth, async (req, res) => {
  try {
    const { imageUrl, linkUrl, title } = req.body;
    if (!imageUrl || !linkUrl) return res.status(400).json({ success: false, message: 'Image URL and Link URL are required' });
    const banner = await Banner.create({ imageUrl, linkUrl, title });
    res.status(201).json({ success: true, banner });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ADMIN - delete banner
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    await Banner.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Banner deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;