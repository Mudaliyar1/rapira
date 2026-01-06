/**
 * Date Formatting Utility for Indian Standard Time (IST)
 * Ensures consistent date/time display across localhost and live server
 * IST = UTC+5:30
 */

const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Format date to IST locale string
 * @param {Date|string} date - Date object or ISO string
 * @returns {string} Formatted date in IST timezone
 * Example: "1/6/2026, 3:20:18 PM"
 */
function toISTLocaleString(date) {
  try {
    const dateObj = new Date(date);
    return dateObj.toLocaleString('en-IN', {
      timeZone: IST_TIMEZONE,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid Date';
  }
}

/**
 * Format date to IST date string only
 * @param {Date|string} date - Date object or ISO string
 * @returns {string} Formatted date in IST timezone (date only)
 * Example: "1/6/2026"
 */
function toISTDateString(date) {
  try {
    const dateObj = new Date(date);
    return dateObj.toLocaleDateString('en-IN', {
      timeZone: IST_TIMEZONE,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid Date';
  }
}

/**
 * Format date to IST time string only
 * @param {Date|string} date - Date object or ISO string
 * @returns {string} Formatted time in IST timezone (time only)
 * Example: "3:20:18 PM"
 */
function toISTTimeString(date) {
  try {
    const dateObj = new Date(date);
    return dateObj.toLocaleTimeString('en-IN', {
      timeZone: IST_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  } catch (error) {
    console.error('Error formatting time:', error);
    return 'Invalid Time';
  }
}

/**
 * Format date with custom options for IST
 * @param {Date|string} date - Date object or ISO string
 * @param {object} options - Custom formatting options
 * @returns {string} Formatted date in IST timezone
 */
function toISTCustomFormat(date, options = {}) {
  try {
    const dateObj = new Date(date);
    const defaultOptions = {
      timeZone: IST_TIMEZONE,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    };
    
    const mergedOptions = { ...defaultOptions, ...options };
    return dateObj.toLocaleString('en-IN', mergedOptions);
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid Date';
  }
}

/**
 * Get current date in IST
 * @returns {string} Current date/time in IST locale format
 */
function getNowInIST() {
  return toISTLocaleString(new Date());
}

/**
 * Calculate time difference between two dates (in IST)
 * @param {Date|string} date1 - First date
 * @param {Date|string} date2 - Second date
 * @returns {object} Difference object with days, hours, minutes, seconds
 */
function getTimeDifference(date1, date2) {
  try {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffMs = Math.abs(d2 - d1);
    
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const diffSeconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    
    return { days: diffDays, hours: diffHours, minutes: diffMinutes, seconds: diffSeconds };
  } catch (error) {
    console.error('Error calculating time difference:', error);
    return null;
  }
}

module.exports = {
  toISTLocaleString,
  toISTDateString,
  toISTTimeString,
  toISTCustomFormat,
  getNowInIST,
  getTimeDifference,
  IST_TIMEZONE
};
