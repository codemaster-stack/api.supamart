const axios = require('axios');

// Free currency API
const EXCHANGE_RATE_API = 'https://api.exchangerate-api.com/v4/latest/USD';

let exchangeRates = {};

// Fetch and cache exchange rates
async function updateExchangeRates() {
  try {
    const response = await axios.get(EXCHANGE_RATE_API);
    exchangeRates = response.data.rates;
    console.log('✅ Exchange rates updated');
    return exchangeRates;
  } catch (error) {
    console.error('❌ Error fetching exchange rates:', error.message);
    return exchangeRates;
  }
}

// Convert price from one currency to another
function convertPrice(amount, fromCurrency, toCurrency) {
  if (!exchangeRates[fromCurrency] || !exchangeRates[toCurrency]) {
    return amount;
  }

  const amountInUSD = amount / exchangeRates[fromCurrency];
  const convertedAmount = amountInUSD * exchangeRates[toCurrency];
  
  return Math.round(convertedAmount * 100) / 100;
}

// Get currency symbol
function getCurrencySymbol(currencyCode) {
  const symbols = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'NGN': '₦',
    'GHS': '₵',
    'ZAR': 'R',
    'KES': 'KSh',
    'JPY': '¥',
    'CNY': '¥',
    'INR': '₹',
    'CAD': 'C$',
    'AUD': 'A$',
    'BRL': 'R$',
    'MXN': 'Mex$'
  };
  
  return symbols[currencyCode] || currencyCode + ' ';
}

// Update rates every hour
setInterval(updateExchangeRates, 60 * 60 * 1000);

// Initial fetch
updateExchangeRates();

module.exports = {
  updateExchangeRates,
  convertPrice,
  getCurrencySymbol,
  getExchangeRates: () => exchangeRates
};