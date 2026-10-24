const express = require('express');
const router = express.Router();
const { createOrder } = require('../utils/paymentService');
const { isLoggedIn } = require('../middleware/auth');

// GET /razorpay-test - Show the test page
router.get('/', isLoggedIn, async (req, res) => {
    try {
        // Create a Razorpay order for ₹1 (100 paise)
        const orderResult = await createOrder({
            amount: 1, // ₹1
            receipt: 'test_' + Date.now(),
            notes: {
                type: 'razorpay_test',
                userId: req.session.user.id
            }
        });

        if (!orderResult.success) {
            return res.send(`
        <!DOCTYPE html>
        <html><head><title>Razorpay Test - Error</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
        </head><body style="background:#121212;color:#fff;" class="p-5">
        <div class="container"><div class="alert alert-danger">
        <h4>Failed to create Razorpay order</h4>
        <p>${orderResult.error || 'Unknown error'}</p>
        <p>Make sure RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are set in your .env file.</p>
        </div></div></body></html>
      `);
        }

        // Render standalone test page (no layout)
        res.render('razorpay-test', {
            layout: false,
            order: orderResult.data,
            keyId: process.env.RAZORPAY_KEY_ID,
            currentUser: req.session.user
        });
    } catch (error) {
        console.error('Razorpay test error:', error);
        res.status(500).send(`
      <!DOCTYPE html>
      <html><head><title>Razorpay Test - Error</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
      </head><body style="background:#121212;color:#fff;" class="p-5">
      <div class="container"><div class="alert alert-danger">
      <h4>Server Error</h4><pre>${error.message}</pre>
      </div></div></body></html>
    `);
    }
});

module.exports = router;
