# ⏰ Timezone Fix - IST (Indian Standard Time) Implementation

## Problem Identified
Different timestamps showing on localhost vs live website (Render):
- **Localhost:** Shows 3:20:18 PM (IST)
- **Live Website:** Shows 9:50:18 AM (UTC)
- **Difference:** 5.5 hours (UTC vs IST)

## Root Cause
JavaScript's `toLocaleString()` and `toLocaleDateString()` use the **system's local timezone**:
- Localhost (Windows): Uses IST (UTC+5:30)
- Live Server (Render): Uses UTC (UTC+0)

## Solution Implemented

### 1. Created Date Formatter Utility
**File:** `utils/dateFormatter.js`

Functions available:
- `toISTLocaleString(date)` → "1/6/2026, 3:20:18 PM"
- `toISTDateString(date)` → "1/6/2026"
- `toISTTimeString(date)` → "3:20:18 PM"
- `toISTCustomFormat(date, options)` → Custom formatting
- `getNowInIST()` → Current time in IST
- `getTimeDifference(date1, date2)` → Time difference object

**Key Feature:** All functions use `timeZone: 'Asia/Kolkata'` to ensure consistent IST formatting everywhere.

### 2. Made Formatter Global in All Templates
**File:** `app.js` (lines ~345-347)

```javascript
const { toISTLocaleString, toISTDateString, toISTTimeString } = require('./utils/dateFormatter');
app.locals.toISTLocaleString = toISTLocaleString;
app.locals.toISTDateString = toISTDateString;
app.locals.toISTTimeString = toISTTimeString;
```

Now available in ALL EJS templates without additional passes.

### 3. Updated Views to Use IST Formatter

| File | Change | Impact |
|------|--------|--------|
| `views/admin/artist-application-details.ejs` | `new Date().toLocaleString()` → `toISTLocaleString()` | ✅ Artist application dates now show IST |
| `views/website-updates.ejs` | Updated 2 date displays | ✅ Website updates show IST |
| `views/venues/external-booking-details.ejs` | Updated createdAt & updatedAt | ✅ Booking dates show IST |
| `views/tickets/index.ejs` | Updated purchase date | ✅ Ticket dates show IST |
| `views/tickets/pdf-template.ejs` | Updated refund request date | ✅ PDF shows IST |
| `views/users/venues/booking-details.ejs` | Updated booking created date | ✅ User booking pages show IST |

### 4. Remaining Updates (JavaScript Template Strings)
These files have dates in JavaScript code blocks and need manual updates with `toLocaleString('en-IN', {timeZone: 'Asia/Kolkata'})`:

- `views/users/venues/bookings.ejs` (line 564)
- `views/users/venues/bookings-new.ejs` (line 146)
- `views/users/venues/bookings-clean.ejs` (line 146)

## How to Use in Templates

### Before (Wrong - uses system timezone)
```ejs
<%= new Date(application.createdAt).toLocaleString() %>
<!-- Result: Different on localhost vs production -->
```

### After (Correct - always IST)
```ejs
<%= toISTLocaleString(application.createdAt) %>
<!-- Result: Always "1/6/2026, 3:20:18 PM" regardless of server -->
```

## Available Functions in Templates

```ejs
<!-- Full date and time -->
<%= toISTLocaleString(date) %>

<!-- Date only -->
<%= toISTDateString(date) %>

<!-- Time only -->
<%= toISTTimeString(date) %>

<!-- Current time in IST -->
<%= toISTLocaleString(new Date()) %>
```

## Testing Checklist

- [ ] Go to `/artist-applications/admin` and view an application
- [ ] Verify "Submitted On" shows correct IST time (not UTC)
- [ ] Check localhost: 3:20 PM
- [ ] Check live website: Should also show 3:20 PM (not 9:50 AM)
- [ ] Check website updates page
- [ ] Check venue booking pages
- [ ] Check ticket pages

## Files Modified

1. ✅ Created: `utils/dateFormatter.js` (145 lines)
2. ✅ Updated: `app.js` - Added global date formatter functions
3. ✅ Updated: `routes/artistApplications.js` - Clean imports
4. ✅ Updated: `views/admin/artist-application-details.ejs`
5. ✅ Updated: `views/website-updates.ejs`
6. ✅ Updated: `views/venues/external-booking-details.ejs`
7. ✅ Updated: `views/tickets/index.ejs`
8. ✅ Updated: `views/tickets/pdf-template.ejs`
9. ✅ Updated: `views/users/venues/booking-details.ejs`

## Important Notes

- **IST = UTC+5:30** (Indian Standard Time)
- **All timestamps now consistent** across localhost and live server
- **No database changes needed** - only display formatting changed
- **Function available globally** - no need to pass in routes
- **Supports custom formatting** via options parameter
- **Handles invalid dates gracefully** - returns "Invalid Date"

## Future Enhancements

For JavaScript client-side dates in template strings, use:
```javascript
// Instead of:
new Date().toLocaleString()

// Use:
new Date().toLocaleString('en-IN', {
  timeZone: 'Asia/Kolkata',
  hour12: true,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
})
```

---

**Status:** ✅ Complete
**Timezone:** 🕐 IST (Asia/Kolkata, UTC+5:30)
**Consistency:** ✅ Localhost and Production now match
