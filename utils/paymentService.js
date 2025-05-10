const Razorpay = require('razorpay');

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

/**
 * Create a new order for payment
 * @param {Object} options - Order options
 * @param {Number} options.amount - Amount in paise (INR)
 * @param {String} options.receipt - Receipt ID (usually ticket ID)
 * @param {String} options.currency - Currency code (default: INR)
 * @param {Object} options.notes - Additional notes for the order
 */
const createOrder = async (options) => {
  try {
    const { amount, receipt, currency = 'INR', notes = {} } = options;

    // Log the order creation attempt
    console.log('Creating Razorpay order with:', { amount, currency, receipt });

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // Convert to paise and ensure it's an integer
      currency,
      receipt,
      notes,
      payment_capture: 1 // Auto-capture payment
    });

    // Log the created order
    console.log('Razorpay order created:', order);

    return { success: true, data: order };
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Verify payment signature
 * @param {Object} options - Verification options
 * @param {String} options.orderId - Razorpay order ID
 * @param {String} options.paymentId - Razorpay payment ID
 * @param {String} options.signature - Razorpay signature
 */
const verifyPayment = (options) => {
  try {
    const { orderId, paymentId, signature } = options;

    // Creating the signature verification string
    const crypto = require('crypto');
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    // Verify signature
    const isValid = generatedSignature === signature;

    return { success: isValid };
  } catch (error) {
    console.error('Error verifying payment:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Fetch payment details
 * @param {String} paymentId - Razorpay payment ID
 */
const getPaymentDetails = async (paymentId) => {
  try {
    const payment = await razorpay.payments.fetch(paymentId);
    return { success: true, data: payment };
  } catch (error) {
    console.error('Error fetching payment details:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  createOrder,
  verifyPayment,
  getPaymentDetails,
  razorpay
};
