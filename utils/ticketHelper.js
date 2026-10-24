/**
 * Helper functions for ticket-related operations
 */

/**
 * Check if a concert date has passed
 * @param {Date} concertDate - The date of the concert
 * @returns {boolean} - True if the concert date has passed, false otherwise
 */
function isConcertDatePassed(concertDate) {
  if (!concertDate) {
    return false;
  }
  
  // Convert to date object if it's not already
  const concertDateObj = new Date(concertDate);
  const now = new Date();
  
  // Compare dates (ignore time for simplicity, just compare date part)
  const concertDateOnly = new Date(concertDateObj.getFullYear(), concertDateObj.getMonth(), concertDateObj.getDate());
  const currentDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  return concertDateOnly < currentDateOnly;
}

/**
 * Check if a concert date has passed including time
 * @param {Date} concertDate - The date of the concert
 * @param {string} concertTime - The time of the concert in HH:MM format
 * @returns {boolean} - True if the concert date and time has passed, false otherwise
 */
function isConcertPassed(concertDate, concertTime) {
  if (!concertDate) {
    return false;
  }
  
  // Create a date object with the concert date and time
  const concertDateTime = new Date(concertDate);
  
  if (concertTime) {
    // Parse the concert time (assuming format HH:MM)
    const [hours, minutes] = concertTime.split(':').map(Number);
    concertDateTime.setHours(hours, minutes, 0, 0);
  }
  
  const now = new Date();
  return concertDateTime < now;
}

module.exports = {
  isConcertDatePassed,
  isConcertPassed
};