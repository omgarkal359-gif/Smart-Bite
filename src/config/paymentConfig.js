/**
 * SGU Smart-Bite Enterprise Payment Configuration
 * Target recipient bank account & UPI details for shop transactions.
 */

export const isMobileDevice = () => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
};

export const SHOP_PAYMENT_CONFIG = {
  phone: '9607102196',
  formattedPhone: '+91 9607102196',
  primaryUpiId: '9607102196@upi',
  alternateUpiId: '9607102196@ybl',
  payeeName: 'Smart Bite Food Court',
  bankNote: 'SmartBite Order Payment',

  /**
   * Generates standard UPI URI with fixed, non-editable pre-filled amount.
   * `am` = Amount, `mam` = Minimum Amount (locks amount to exact total in UPI apps),
   * `mode=02` = Secure QR/Intent transaction, `mc=5812` = Food & Restaurants MCC.
   *
   * @param {number} amount - Total payable bill amount in INR
   * @param {string} shopName - Stall or food court name for transaction notes
   * @param {string} customNote - Transaction memo
   * @returns {string} Standard UPI URI string
   */
  getUpiUri: (amount, shopName = 'Smart Bite Food Court', customNote = 'SmartBite Order') => {
    const vpa = '9607102196@upi';
    const pn = encodeURIComponent(shopName || 'Smart Bite Food Court');
    const tn = encodeURIComponent(customNote || 'SmartBite Order');
    const safeAmount = Number(amount || 0).toFixed(2);
    // am and mam locked to safeAmount ensures the amount is pre-filled and non-editable
    return `upi://pay?pa=${vpa}&pn=${pn}&am=${safeAmount}&mam=${safeAmount}&cu=INR&tn=${tn}&mode=02&mc=5812`;
  },

  /**
   * Generates dynamic QR code image URL for scanning on Laptop / Desktop view
   *
   * @param {number} amount - Total payable amount in INR
   * @param {string} shopName - Stall or food court name
   * @param {number} size - QR code pixel dimensions (e.g. 240)
   * @returns {string} QR Code image URL
   */
  getQrCodeUrl: (amount, shopName = 'Smart Bite Food Court', size = 240) => {
    const upiUri = SHOP_PAYMENT_CONFIG.getUpiUri(amount, shopName);
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(upiUri)}&margin=10`;
  }
};

export default SHOP_PAYMENT_CONFIG;
