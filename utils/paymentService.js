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
  // In development mode with missing keys, use mock implementation
  if (isDevelopment && (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET)) {
    razorpay = createMockRazorpay();
  } else {
    // Use real Razorpay in production or when keys are available
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    // Log successful initialization (with masked key for security)
    const maskedKeyId = process.env.RAZORPAY_KEY_ID ?
      `${process.env.RAZORPAY_KEY_ID.substring(0, 4)}...${process.env.RAZORPAY_KEY_ID.substring(process.env.RAZORPAY_KEY_ID.length - 4)}` :
      'undefined';
    console.log(`Razorpay initialized with key_id: ${maskedKeyId}`);
  }
} catch (error) {
  console.error('Failed to initialize Razorpay:', error);

  // In development mode, fall back to mock implementation
  if (isDevelopment) {
    console.log('Falling back to mock implementation in development mode');
    razorpay = createMockRazorpay();
  } else {
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

    // Convert amount to paise (smallest currency unit)
    const amountInPaise = Math.round(parseFloat(amount) * 100);

    // Special handling for development mode
    if (isDevelopment && (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET)) {
      console.log('Using mock Razorpay implementation in development mode');

      try {
        // Create the order using our mock implementation
        const order = await razorpay.orders.create({
          amount: amountInPaise,
          currency,
          receipt,
          notes,
          payment_capture: 1
        });

        console.log('Mock order created:', {
          id: order.id,
          amount: order.amount,
          status: order.status
        });

        return { success: true, data: order, isMock: true };
      } catch (mockError) {
        console.error('Error in mock order creation:', mockError);
        throw mockError;
      }
    }

    // For production or when keys are available
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

    // Special handling for development mode
    if (isDevelopment) {
      console.log('Development mode: Creating fallback mock order due to error');

      try {
        // Generate a mock order as fallback
        const mockOrder = {
          id: 'order_mock_fallback_' + Math.random().toString(36).substring(2, 10),
          entity: 'order',
          amount: options.amount ? Math.round(parseFloat(options.amount) * 100) : 10000,
          amount_paid: 0,
          amount_due: options.amount ? Math.round(parseFloat(options.amount) * 100) : 10000,
          currency: options.currency || 'INR',
          receipt: options.receipt || 'fallback_receipt',
          status: 'created',
          attempts: 0,
          notes: options.notes || {},
          created_at: Math.floor(Date.now() / 1000)
        };

        console.log('Created fallback mock order:', {
          id: mockOrder.id,
          amount: mockOrder.amount
        });

        return {
          success: true,
          data: mockOrder,
          isMock: true,
          isFailbackMock: true,
          originalError: error.message
        };
      } catch (mockError) {
        console.error('Error creating fallback mock order:', mockError);
      }
    }

    // Provide more detailed error information
    let errorMessage = error.message || 'Unknown error';
    let errorCode = error.code || 'UNKNOWN';

    // Check for specific Razorpay error types
    if (error.description) {
      errorMessage = `${errorMessage}: ${error.description}`;
    }

    // Check for network connectivity issues
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      errorMessage = 'Could not connect to Razorpay API. Please check your internet connection.';
      errorCode = 'NETWORK_ERROR';
    }

    return {
      success: false,
      error: errorMessage,
      code: errorCode,
      details: error.toString()
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

    // Check if this is a mock order (starts with order_mock)
    if (isDevelopment && orderId && orderId.startsWith('order_mock')) {
      console.log('MOCK: Verifying mock payment', { orderId, paymentId });
      // Always return success for mock orders in development
      return {
        success: true,
        isMock: true,
        message: 'Mock payment verification successful'
      };
    }

    // For real orders, verify the signature
    if (!process.env.RAZORPAY_KEY_SECRET) {
      console.error('Missing Razorpay key secret for payment verification');

      // In development, allow proceeding without verification
      if (isDevelopment) {
        console.log('DEVELOPMENT MODE: Bypassing payment verification due to missing key');
        return {
          success: true,
          isMock: true,
          bypassedVerification: true,
          message: 'Payment verification bypassed in development mode'
        };
      }

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

    // In development mode, allow proceeding despite errors
    if (isDevelopment) {
      console.log('DEVELOPMENT MODE: Bypassing payment verification due to error');
      return {
        success: true,
        isMock: true,
        bypassedVerification: true,
        originalError: error.message,
        message: 'Payment verification bypassed in development mode due to error'
      };
    }

    return { success: false, error: error.message };
  }
};

/**
 * Fetch payment details
 * @param {String} paymentId - Razorpay payment ID
 */
const getPaymentDetails = async (paymentId) => {
  try {
    // Check if this is a mock payment ID
    if (isDevelopment && paymentId && (paymentId.startsWith('pay_mock') || paymentId.startsWith('rzp_mock'))) {
      console.log('MOCK: Fetching mock payment details for:', paymentId);

      // Return mock payment details
      return {
        success: true,
        data: {
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
        },
        isMock: true
      };
    }

    // For real payment IDs, fetch from Razorpay
    const payment = await razorpay.payments.fetch(paymentId);
    return { success: true, data: payment };
  } catch (error) {
    console.error('Error fetching payment details:', error);

    // In development mode, return mock data as fallback
    if (isDevelopment) {
      console.log('DEVELOPMENT MODE: Returning mock payment details due to error');
      return {
        success: true,
        data: {
          id: paymentId || 'pay_mock_fallback',
          entity: 'payment',
          amount: 10000,
          currency: 'INR',
          status: 'captured',
          order_id: 'order_mock_fallback',
          method: 'card',
          description: 'Fallback Mock Payment',
          email: 'customer@example.com',
          contact: '+919999999999',
          notes: {},
          created_at: Math.floor(Date.now() / 1000)
        },
        isMock: true,
        isFallback: true,
        originalError: error.message
      };
    }

    return { success: false, error: error.message };
  }
};

module.exports = {
  createOrder,
  verifyPayment,
  getPaymentDetails,
  razorpay
};
