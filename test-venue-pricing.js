const mongoose = require('mongoose');
const Venue = require('./models/Venue');

async function testVenuePricing() {
  try {
    await mongoose.connect('mongodb://localhost:27017/rapira');
    console.log('Connected to MongoDB');
    
    // Find our test venue
    const venue = await Venue.findOne({ name: 'Premium Music Hall' });
    
    if (!venue) {
      console.log('❌ Test venue not found');
      return;
    }
    
    console.log('✅ Test venue found!');
    console.log('\n📍 Venue Details:');
    console.log(`Name: ${venue.name}`);
    console.log(`Type: ${venue.venueType}`);
    console.log(`City: ${venue.city}`);
    console.log(`Capacity: ${venue.capacity}`);
    console.log(`Facilities: ${venue.facilities.join(', ')}`);
    
    console.log('\n💰 Pricing Structure:');
    console.log(`Minimum Hours: ${venue.pricing.minimumHours}`);
    console.log(`Admin Commission: ${venue.pricing.adminCommission.percentage}%`);
    console.log(`Advance Amount: ₹${venue.pricing.adminCommission.advanceAmount}`);
    console.log(`Min Ticket Price: ₹${venue.pricing.ticketPricing.minimumPrice}`);
    console.log(`Suggested Ticket Price: ₹${venue.pricing.ticketPricing.suggestedPrice}`);
    
    console.log('\n⏰ Hourly Rates:');
    venue.pricing.hourlyRates.forEach((rateObj, index) => {
      console.log(`Hour ${rateObj.hours}: ₹${rateObj.rate}`);
    });
    
    console.log('\n🧮 Sample Calculations:');
    
    // Test different booking durations
    const testHours = [2, 4, 6, 8];
    
    testHours.forEach(hours => {
      let totalCost = 0;
      
      for (let i = 0; i < hours && i < venue.pricing.hourlyRates.length; i++) {
        totalCost += venue.pricing.hourlyRates[i].rate;
      }
      
      const commission = (totalCost * venue.pricing.adminCommission.percentage) / 100;
      const totalToPay = totalCost + commission + venue.pricing.adminCommission.advanceAmount;
      
      console.log(`\n${hours} hours booking:`);
      console.log(`  Base Cost: ₹${totalCost.toLocaleString('en-IN')}`);
      console.log(`  Commission (${venue.pricing.adminCommission.percentage}%): ₹${commission.toLocaleString('en-IN')}`);
      console.log(`  Advance: ₹${venue.pricing.adminCommission.advanceAmount.toLocaleString('en-IN')}`);
      console.log(`  Total to Pay: ₹${totalToPay.toLocaleString('en-IN')}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

testVenuePricing();
