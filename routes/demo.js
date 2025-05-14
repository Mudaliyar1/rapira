const express = require('express');
const router = express.Router();
const demoController = require('../controllers/demoController');

// Demo home page
router.get('/', demoController.demoHome);

// Artist demo
router.get('/artist', demoController.artistDemo);

// Concert creation demo
router.get('/concert', demoController.concertDemo);

// Ticket purchase demo
router.get('/ticket', demoController.ticketDemo);

// Content sharing demo
router.get('/content', demoController.contentDemo);

// Subscription demo
router.get('/subscription', demoController.subscriptionDemo);

// Process demo form submissions
router.post('/process/:demoType', demoController.processDemoForm);

module.exports = router;
