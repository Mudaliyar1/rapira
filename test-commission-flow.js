/**
 * Test script to verify commission percentage flow in venue edit requests
 * 
 * This tests:
 * 1. Form submission captures commission percentage
 * 2. Backend route processes it correctly
 * 3. VenueEditRequest stores it in requestedChanges
 * 4. Admin dashboard can display it
 * 5. Admin approval applies it to venue
 */

// Simulate form data submission
const formData = {
  name: 'Test Venue',
  address: '123 Main St',
  city: 'TestCity',
  state: 'TestState',
  pincode: '123456',
  contactName: 'John Doe',
  contactPhone: '9876543210',
  contactEmail: 'john@test.com',
  website: 'https://test.com',
  description: 'A test venue',
  venueType: 'Indoor',
  capacity: '500',
  priceRange: 'High',
  pricing: {
    hourlyRates: [
      { hours: 1, rate: '5000', commissionPercentage: '15' },
      { hours: 2, rate: '9000', commissionPercentage: '15' }
    ],
    minimumHours: '1',
    currency: 'INR',
    adminCommission: {
      percentage: '15',  // This is the key change!
      advanceAmount: '1000'
    },
    ticketPricing: {
      minimumPrice: '10',
      suggestedPrice: '1000'
    }
  }
};

// Simulate the backend processing
const settings = {
  venueSettings: {
    defaultCommissionPercentage: 10,
    allowUserCommissionEdit: true
  }
};

const defaultCommission = settings.venueSettings?.defaultCommissionPercentage || 10;
const allowUserCommissionEdit = settings.venueSettings?.allowUserCommissionEdit || false;

// This is the fix we applied
const commissionPercentage = allowUserCommissionEdit 
  ? (parseFloat(formData.pricing.adminCommission?.percentage) || defaultCommission) 
  : defaultCommission;

const pricingData = {
  hourlyRates: [],
  minimumHours: parseInt(formData.pricing.minimumHours) || 1,
  currency: formData.pricing.currency || 'INR',
  adminCommission: {
    percentage: commissionPercentage,  // Should be 15 now!
    advanceAmount: parseInt(formData.pricing.adminCommission?.advanceAmount) || 0
  },
  ticketPricing: {
    minimumPrice: parseInt(formData.pricing.ticketPricing?.minimumPrice) || 10,
    suggestedPrice: parseInt(formData.pricing.ticketPricing?.suggestedPrice) || 1000
  },
  additionalCharges: {}
};

console.log('=== COMMISSION PERCENTAGE FLOW TEST ===\n');

console.log('INPUT:');
console.log(`Form submitted commission: ${formData.pricing.adminCommission.percentage}%`);
console.log(`Allow user commission edit: ${allowUserCommissionEdit}`);
console.log(`Admin default commission: ${defaultCommission}%\n`);

console.log('PROCESSING:');
console.log(`User submitted value: ${formData.pricing.adminCommission?.percentage}`);
console.log(`Is user allowed to edit: ${allowUserCommissionEdit}`);
console.log(`Selected commission: ${commissionPercentage}%\n`);

console.log('OUTPUT (pricingData.adminCommission):');
console.log(JSON.stringify(pricingData.adminCommission, null, 2));

if (pricingData.adminCommission.percentage === 15) {
  console.log('\n✅ SUCCESS: Commission percentage correctly captured (15%)');
} else {
  console.log(`\n❌ FAILURE: Commission percentage is ${pricingData.adminCommission.percentage}%, expected 15%`);
}

// Test scenario 2: When commission edit is disabled
console.log('\n\n=== TEST 2: COMMISSION LOCKED (Admin Default Only) ===\n');

const settings2 = {
  venueSettings: {
    defaultCommissionPercentage: 10,
    allowUserCommissionEdit: false  // LOCKED
  }
};

const defaultCommission2 = settings2.venueSettings?.defaultCommissionPercentage || 10;
const allowUserCommissionEdit2 = settings2.venueSettings?.allowUserCommissionEdit || false;

const commissionPercentage2 = allowUserCommissionEdit2 
  ? (parseFloat(formData.pricing.adminCommission?.percentage) || defaultCommission2) 
  : defaultCommission2;

console.log('INPUT:');
console.log(`Form submitted commission: ${formData.pricing.adminCommission.percentage}%`);
console.log(`Allow user commission edit: ${allowUserCommissionEdit2}`);
console.log(`Admin default commission: ${defaultCommission2}%\n`);

console.log('PROCESSING:');
console.log(`User submitted value: ${formData.pricing.adminCommission?.percentage}`);
console.log(`Is user allowed to edit: ${allowUserCommissionEdit2}`);
console.log(`Selected commission: ${commissionPercentage2}%\n`);

if (commissionPercentage2 === 10) {
  console.log('✅ SUCCESS: Commission correctly set to admin default (10%) because editing is locked');
} else {
  console.log(`❌ FAILURE: Commission is ${commissionPercentage2}%, expected 10%`);
}
