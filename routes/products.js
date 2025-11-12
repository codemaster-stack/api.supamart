const { convertPrice, getCurrencySymbol } = require('../utils/currency');

// @route   POST /api/products/convert-price
// @desc    Convert product price to user's currency
// @access  Protected
router.post('/products/convert-price', async (req, res) => {
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