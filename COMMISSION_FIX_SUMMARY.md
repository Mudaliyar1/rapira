## Commission Percentage in Venue Edit Requests - FIX SUMMARY

### Problems Identified
1. **Commission percentage not captured**: When a user submitted a venue edit request with a changed commission percentage, it wasn't being saved in the `requestedChanges` object
2. **Admin dashboard not displaying commission**: The admin details page for venue edit requests didn't show commission changes in the "Proposed Changes" section
3. **Admin approval not applying commission**: When admin approved the edit request, the commission wasn't updated on the venue

### Root Cause Analysis

#### Issue 1: Commission Percentage Not Captured in requestedChanges
**File:** `routes/userVenues.js` (POST /:id/edit route, around line 305)

**Problem:** The `pricingData.adminCommission.percentage` was always being set to `defaultCommission` regardless of what the user submitted:
```javascript
// WRONG - always uses default
adminCommission: {
  percentage: defaultCommission,  // ← Bug here
  advanceAmount: parseInt(pricing.adminCommission?.advanceAmount) || 0
}
```

**Solution:** Extract the user-submitted value when commission editing is allowed:
```javascript
// CORRECT - respects user input when allowed
const commissionPercentage = allowUserCommissionEdit 
  ? (parseFloat(pricing.adminCommission?.percentage) || defaultCommission) 
  : defaultCommission;

adminCommission: {
  percentage: commissionPercentage,  // ✅ Uses user value when allowed
  advanceAmount: parseInt(pricing.adminCommission?.advanceAmount) || 0
}
```

#### Issue 2: Admin Dashboard Not Displaying Commission Changes
**File:** `views/admin/venue-edit-requests/details.ejs` (Proposed Changes section)

**Problems:** 
- Referenced old field names: `rate.price` (should be `rate.rate`) and `dailyRate` (doesn't exist in new structure)
- Didn't display `adminCommission.percentage` in the pricing comparison

**Solution:** Updated the pricing display sections to:
1. Use correct field name: `rate.rate` instead of `rate.price`
2. Display admin commission percentage: `editRequest.originalData[field].adminCommission.percentage`
3. Display minimum hours
4. Show updated values in proposed column

#### Issue 3: Apply Changes Logic ✅
**File:** `routes/adminVenueEditRequests.js` (POST /:id/approve route)

**Status:** Already working correctly! The approval route applies all keys from `requestedChanges` to the venue using:
```javascript
Object.keys(updates).forEach(key => {
  if (key !== 'images') {
    venue[key] = updates[key];  // ✅ This correctly applies pricing changes
  }
});
```

### Files Modified

#### 1. `routes/userVenues.js`
- **Lines 301-319:** Fixed commission percentage capture logic
- **Change:** Now correctly uses user-submitted commission value when `allowUserCommissionEdit` is true
- **Impact:** Commission changes are now properly saved in VenueEditRequest.requestedChanges

#### 2. `views/admin/venue-edit-requests/details.ejs`
- **Lines 183-195:** Updated "Original Data" pricing display
  - Fixed field references: `rate.price` → `rate.rate`
  - Added `adminCommission.percentage` display
  - Added `minimumHours` display
  
- **Lines 216-228:** Updated "Proposed Changes" pricing display
  - Same field reference fixes
  - Added commission percentage display with success highlighting
  - Added minimum hours display

### Data Flow After Fix

```
User submits venue edit form
  ↓
pricing[adminCommission][percentage] = 15
  ↓
Route extracts: pricing.adminCommission?.percentage
  ↓
Sets in pricingData: commissionPercentage = 15 (when allowUserCommissionEdit=true)
  ↓
Stored in VenueEditRequest.requestedChanges.pricing.adminCommission.percentage
  ↓
Admin views request details
  ↓
Admin dashboard displays: "Admin Commission: 15%" in Proposed Changes ✅
  ↓
Admin clicks Approve
  ↓
venue.pricing.adminCommission.percentage = 15 applied ✅
  ↓
Venue now reflects new commission percentage
```

### Testing

Created `test-commission-flow.js` to verify:
- ✅ When user is allowed to edit: user's commission value (15%) is captured
- ✅ When commission editing is locked: admin default (10%) is used instead

Both scenarios pass successfully.

### How the Commission System Works

1. **Admin Control:** Admin sets `allowUserCommissionEdit` flag in Website Settings
   - If FALSE: All venues use admin default percentage
   - If TRUE: Venues can customize their own percentages

2. **Venue Edit Form:**
   - Field shows admin default as starting value
   - Input is readonly when `allowUserCommissionEdit` = false
   - Input is editable when `allowUserCommissionEdit` = true

3. **Edit Request Submission:**
   - Commission change is now correctly captured when user submits edit request
   - Stored in VenueEditRequest.requestedChanges

4. **Admin Approval:**
   - Admin sees the commission change in "Proposed Changes" section
   - When approved, commission is applied to the venue

### Verification Checklist

- [x] Commission percentage is captured from form submission
- [x] Commission value is extracted correctly in backend route
- [x] Commission is included in requestedChanges
- [x] VenueEditRequest stores commission data
- [x] Admin dashboard displays commission in proposed changes
- [x] Field names are correct (rate, hourlyRates structure)
- [x] Admin approval applies commission to venue
- [x] Lock/unlock functionality still works (uses default when locked)

All issues are now resolved!
