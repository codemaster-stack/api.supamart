const geoip = require('geoip-lite');

// Map country codes to currencies
const countryCurrencyMap = {
  'US': 'USD',
  'GB': 'GBP',
  'NG': 'NGN',
  'GH': 'GHS',
  'ZA': 'ZAR',
  'KE': 'KES',
  'DE': 'EUR',
  'FR': 'EUR',
  'IT': 'EUR',
  'ES': 'EUR',
  'NL': 'EUR',
  'BE': 'EUR',
  'AT': 'EUR',
  'PT': 'EUR',
  'IE': 'EUR',
  'JP': 'JPY',
  'CN': 'CNY',
  'IN': 'INR',
  'CA': 'CAD',
  'AU': 'AUD',
  'BR': 'BRL',
  'MX': 'MXN',
  'AR': 'ARS',
  'CL': 'CLP',
  'CO': 'COP',
  'PE': 'PEN',
  'SG': 'SGD',
  'MY': 'MYR',
  'TH': 'THB',
  'ID': 'IDR',
  'PH': 'PHP',
  'VN': 'VND',
  'AE': 'AED',
  'SA': 'SAR',
  'EG': 'EGP',
  'TR': 'TRY',
  'RU': 'RUB',
  'PL': 'PLN',
  'SE': 'SEK',
  'NO': 'NOK',
  'DK': 'DKK',
  'CH': 'CHF',
  'NZ': 'NZD',
  'HK': 'HKD',
  'KR': 'KRW',
  'TW': 'TWD'
};

// Get user location from IP
function getLocationFromIP(ip) {
  // Handle localhost/development
  if (!ip || ip === '::1' || ip === '127.0.0.1' || ip === 'localhost' || ip.includes('127.0.0.1')) {
    return {
      country: 'NG', // Default to Nigeria for development
      currency: 'NGN',
      timezone: 'Africa/Lagos',
      city: 'Lagos',
      region: 'Lagos'
    };
  }

  // Extract actual IP if it's in x-forwarded-for format
  const actualIP = ip.split(',')[0].trim();
  
  const geo = geoip.lookup(actualIP);
  
  if (!geo) {
    return {
      country: 'US',
      currency: 'USD',
      timezone: 'America/New_York',
      city: '',
      region: ''
    };
  }

  return {
    country: geo.country,
    currency: countryCurrencyMap[geo.country] || 'USD',
    timezone: geo.timezone,
    city: geo.city || '',
    region: geo.region || ''
  };
}

module.exports = {
  getLocationFromIP,
  countryCurrencyMap
};