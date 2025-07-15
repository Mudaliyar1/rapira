---
type: "agent_requested"
description: "Example description"
---
# Admin Dashboard Search & Filter Implementation Plan

## Status Overview
✅ **Completed:**
1. Users Management - Full search & filter functionality
2. Artists Management - Full search & filter functionality  
3. User Roles Management - Full search & filter functionality
4. Artist Applications - Enhanced with comprehensive filters
5. Artist Upgrades - Enhanced with comprehensive filters

## 🔄 **Remaining Sections to Implement:**

### Concert Management
6. **Concerts** - `/admin/concerts`
   - Search: Concert name, artist name, venue, city
   - Filters: Status (upcoming/past/cancelled), Date range, Artist level, Venue type
   - Sort: Date, name, artist, ticket sales

7. **Pending Concerts** - `/admin/concerts/pending`
   - Search: Concert name, artist name, venue
   - Filters: Submission date range, Artist level
   - Sort: Submission date, artist name

8. **Tickets** - `/admin/tickets`
   - Search: User name, email, concert name
   - Filters: Status (active/used/refunded), Purchase date range, Price range
   - Sort: Purchase date, price, concert date

9. **Refund Requests** - `/admin/refunds`
   - Search: User name, email, concert name, reason
   - Filters: Status (pending/approved/rejected), Request date range, Amount range
   - Sort: Request date, amount, status

10. **Daily Concerts** - `/admin/daily-concerts`
    - Search: Concert name, artist name, venue
    - Filters: Date range, Status, Artist level
    - Sort: Date, time, artist name

### Content Management
11. **Content** - `/admin/content`
    - Search: Title, artist name, description
    - Filters: Type (audio/video/image), Status (published/draft), Upload date range
    - Sort: Upload date, title, artist, views

12. **Pages** - `/admin/pages`
    - Search: Page title, slug, content
    - Filters: Status (published/draft), Page type, Last modified date
    - Sort: Created date, title, last modified

13. **Learning Modules** - `/admin/learning`
    - Search: Module title, description, category
    - Filters: Difficulty level, Category, Status (active/inactive)
    - Sort: Created date, title, difficulty

### Booking Management
14. **Team Roles** - `/admin/team-roles`
    - Search: Role name, description
    - Filters: Status (active/inactive), Permission level
    - Sort: Name, created date

15. **Team Bookings** - `/admin/team-bookings`
    - Search: Team member name, event name, client
    - Filters: Status, Date range, Team member role
    - Sort: Booking date, event date, team member

16. **Featured Artists** - `/admin/featured-artists`
    - Search: Artist name, genre
    - Filters: Featured status, Artist level, Date range
    - Sort: Featured date, artist name, level

17. **Role Slots** - `/admin/role-slots`
    - Search: Role name, event name
    - Filters: Status (open/filled/closed), Event date range
    - Sort: Event date, role name, status

18. **Artist Bookings** - `/admin/artist-bookings`
    - Search: Artist name, event name, venue
    - Filters: Status, Date range, Artist level, Booking type
    - Sort: Booking date, event date, artist name

### Subscription Management
19. **Subscription Plans** - `/admin/subscription-plans`
    - Search: Plan name, description
    - Filters: Status (active/inactive), Price range, Plan type
    - Sort: Price, name, created date

20. **User Subscriptions** - `/admin/user-subscriptions`
    - Search: User name, email, plan name
    - Filters: Status (active/expired/cancelled), Plan type, Date range
    - Sort: Start date, end date, user name

### Communication
21. **Contact Messages** - `/admin/contact-messages`
    - Search: Name, email, subject, message content
    - Filters: Status (new/read/replied), Date range, Message type
    - Sort: Received date, name, status

## Implementation Pattern for Each Section

### 1. Route Enhancement (Backend)
```javascript
// Add search parameters
const { search, filter1, filter2, sortBy, sortOrder } = req.query;

// Build query with filters
let query = {};
if (filter1 && filter1 !== 'all') query.field1 = filter1;

// Apply sorting
let sortOptions = { createdAt: -1 };
if (sortBy) sortOptions = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

// Execute query and apply text search
let results = await Model.find(query).sort(sortOptions).populate('relations');
if (search) {
  results = results.filter(item => /* search logic */);
}

// Get statistics
const stats = {
  total: await Model.countDocuments(),
  filtered: results.length,
  // ... other stats
};

// Render with search params and stats
res.render('view', { results, searchParams, stats });
```

### 2. View Enhancement (Frontend)
```html
<!-- Search & Filter Section -->
<div class="glass-card-dark border border-secondary mb-4">
  <div class="card-header">
    <h5>Search & Filter [Section Name]</h5>
  </div>
  <div class="card-body">
    <form method="GET" action="/admin/[route]">
      <!-- Search input -->
      <!-- Filter dropdowns -->
      <!-- Sort options -->
      <button type="submit" class="btn btn-primary">Search</button>
    </form>
  </div>
</div>

<!-- Statistics Section -->
<div class="glass-card-dark mb-4" id="statsSection" style="display: none;">
  <!-- Stats display -->
</div>

<!-- Results Table with Export -->
<div class="glass-card-dark">
  <div class="card-header">
    <h5>Results <span class="badge bg-info">{{ filtered }} results</span></h5>
    <button id="export">Export</button>
  </div>
  <!-- Table content -->
</div>
```

### 3. Export Route
```javascript
router.get('/admin/[route]/export', isLoggedIn, isAdmin, async (req, res) => {
  // Same filtering logic as main route
  // Generate CSV content
  // Send file download
});
```

### 4. JavaScript Enhancement
```javascript
// Stats toggle
// Export functionality  
// Search highlighting
// Empty state handling
```

## Next Steps
1. Implement each section following the pattern above
2. Test search and filter functionality
3. Verify export functionality
4. Ensure responsive design
5. Add proper error handling

## Files to Modify per Section
- `routes/[sectionRoute].js` - Add search/filter logic
- `views/admin/[sectionView].ejs` - Add search UI
- Add export routes where needed
