const Razorpay = require('razorpay');

// Detect environment
const isDevelopment = process.env.NODE_ENV !== 'production';
console.log(`Payment Service running in ${isDevelopment ? 'DEVELOPMENT' : 'PRODUCTION'} mode`);

// Check if Razorpay API keys are set
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  console.error('WARNING: Razorpay API keys are not set in environment variables!');
  console.error('Payment functionality will not work correctly in production.');
  console.error('Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in your .env file.');

  if (isDevelopment) {
    console.log('Using development mode with mock payment gateway.');
  }
}

// Initialize Razorpay with error handling
let razorpay;

// Create a mock Razorpay implementation for development mode
const createMockRazorpay = () => {
  console.log('Creating MOCK Razorpay implementation for development');
  return {
    orders: {
      create: async (options) => {
        console.log('MOCK: Creating order with options:', options);
        // Simulate a delay
        await new Promise(resolve => setTimeout(resolve, 500));

        // Return a mock order object
        return {
          id: 'order_mock_' + Math.random().toString(36).substring(2, 15),
          entity: 'order',
          amount: options.amount,
          amount_paid: 0,
          amount_due: options.amount,
          currency: options.currency || 'INR',
          receipt: options.receipt,
          status: 'created',
          attempts: 0,
          notes: options.notes || {},
          created_at: Math.floor(Date.now() / 1000)
        };
      }
    },
    payments: {
      fetch: async (paymentId) => {
        console.log('MOCK: Fetching payment details for:', paymentId);
        // Simulate a delay
        await new Promise(resolve => setTimeout(resolve, 500));

        // Return a mock payment object
        return {
          id: paymentId,
          entity: 'payment',
          amount: 10000,
          currency: 'INR',
          status: 'captured',
          order_id: 'order_mock_123',
          method: 'card',
          card_id: null,
          description: 'Mock Payment',
          email: 'customer@example.com',
          contact: '+919999999999',
          notes: {},
          fee: 0,
          tax: 0,
          error_code: null,
          error_description: null,
          created_at: Math.floor(Date.now() / 1000)
        };
      }
    }
  };
};

try {
  // Always use real Razorpay implementation
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });

  // Log successful initialization (with masked key for security)
  const maskedKeyId = process.env.RAZORPAY_KEY_ID ?
    `${process.env.RAZORPAY_KEY_ID.substring(0, 4)}...${process.env.RAZORPAY_KEY_ID.substring(process.env.RAZORPAY_KEY_ID.length - 4)}` :
    'undefined';
  console.log(`Razorpay initialized with key_id: ${maskedKeyId}`);
} catch (error) {
  console.error('Failed to initialize Razorpay:', error);

  // Create a dummy razorpay object that logs errors instead of crashing
  razorpay = {
    orders: {
      create: async () => {
        console.error('Attempted to create order but Razorpay is not properly initialized');
        return Promise.reject(new Error('Razorpay is not properly initialized'));
      }
    },
    payments: {
      fetch: async () => {
        console.error('Attempted to fetch payment but Razorpay is not properly initialized');
        return Promise.reject(new Error('Razorpay is not properly initialized'));
      }
    }
  };
}

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
    // Validate required parameters
    if (!options || typeof options !== 'object') {
      throw new Error('Invalid options provided to createOrder');
    }

    const { amount, receipt, currency = 'INR', notes = {} } = options;

    // Validate amount
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      throw new Error(`Invalid amount: ${amount}. Amount must be a positive number.`);
    }

    // Validate receipt
    if (!receipt) {
      throw new Error('Receipt ID is required');
    }

    // Log the order creation attempt
    console.log('Creating order with:', {
      amount,
      currency,
      receipt: receipt.substring(0, 10) + '...' // Truncate for security
    });

    // Ensure minimum amount is at least 1 rupee (Razorpay requirement)
    let finalAmount = parseFloat(amount);
    if (finalAmount < 1) {
      console.log(`Amount ${finalAmount} is less than minimum 1 rupee, setting to minimum 1 rupee`);
      finalAmount = 1;
    }

    // Convert amount to paise (smallest currency unit)
    const amountInPaise = Math.round(finalAmount * 100);

    // Check if Razorpay keys are set
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw new Error('Razorpay API keys are not configured. Please check your environment variables.');
    }

    // Create the order
    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency,
      receipt,
      notes,
      payment_capture: 1 // Auto-capture payment
    });

    // Log the created order (with sensitive info masked)
    console.log('Razorpay order created:', {
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      status: order.status,
      created_at: order.created_at
    });

    return { success: true, data: order };
  } catch (error) {
    console.error('Error creating order:', error);

    // Provide more detailed error information
    let errorMessage = error.message || 'Unknown error';
    let errorCode = error.code || 'UNKNOWN';

    // Check for Razorpay API error response
    if (error.error) {
      if (typeof error.error === 'object') {
        errorMessage = error.error.description || errorMessage;
        errorCode = error.error.code || errorCode;
      }
    }

    // Check for specific Razorpay error types
    if (error.description) {
      errorMessage = `${errorMessage}: ${error.description}`;
    }

    // Check for network connectivity issues
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      errorMessage = 'Could not connect to Razorpay API. Please check your internet connection.';
      errorCode = 'NETWORK_ERROR';
    }

    // Log the detailed error for debugging
    console.log('Detailed payment error:', JSON.stringify(error, null, 2));

    return {
      success: false,
      error: errorMessage,
      code: errorCode,
      details: typeof error === 'object' ? JSON.stringify(error) : error.toString()
    };
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

    // For all orders, verify the signature
    if (!process.env.RAZORPAY_KEY_SECRET) {
      console.error('Missing Razorpay key secret for payment verification');
      return {
        success: false,
        error: 'Payment verification configuration error'
      };
    }

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
    // Fetch payment details from Razorpay
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
