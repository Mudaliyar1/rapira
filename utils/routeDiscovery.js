const Page = require('../models/Page');

/**
 * Simple route definitions with direct key mapping
 */
const STATIC_ROUTES = {
  // Discover Menu
  discover: {
    home: { path: '/', name: 'Home', icon: 'bi-house-door' },
    about: { path: '/about', name: 'About Us', icon: 'bi-info-circle' },
    content: { path: '/content', name: 'Content Library', icon: 'bi-collection-play' },
    concerts: { path: '/concerts', name: 'Concerts', icon: 'bi-music-note-beamed' },
    daily_concerts: { path: '/daily-concerts', name: 'Daily Concerts', icon: 'bi-calendar-event' },
    artists: { path: '/artists', name: 'Artists', icon: 'bi-people' },
    learning: { path: '/learning', name: 'Learning', icon: 'bi-book' },
    job_portal: { path: '/users/job-portal', name: 'Job Portal', icon: 'bi-briefcase' }
  },

  // Services Menu
  services: {
    team_requirement: { path: '/team-requirement', name: 'Team Requirement', icon: 'bi-people-fill' },
    find_my_artist: { path: '/find-my-artist', name: 'Find My Artist', icon: 'bi-search-heart' },
    subscriptions: { path: '/subscriptions', name: 'Subscriptions', icon: 'bi-star' }
  },

  // Shop Menu
  shop: {
    shop: { path: '/shop', name: 'Shop', icon: 'bi-bag' },
    my_orders: { path: '/orders/my-orders', name: 'My Orders', icon: 'bi-bag-check' }
  },

  // Help & Support Menu
  help: {
    demo: { path: '/demo', name: 'Interactive Demo', icon: 'bi-play-circle' },
    contact: { path: '/contact', name: 'Contact Us', icon: 'bi-envelope' },
    terms_of_service: { path: '/terms-of-service', name: 'Terms of Service', icon: 'bi-file-text' },
    privacy_policy: { path: '/privacy-policy', name: 'Privacy Policy', icon: 'bi-shield-check' },
    refund_policy: { path: '/refund-policy', name: 'Refund Policy', icon: 'bi-arrow-return-left' },
    subscription_policy: { path: '/subscription-policy', name: 'Subscription Policy', icon: 'bi-file-earmark-text' },
    shopping_policy: { path: '/shopping-policy', name: 'Shopping Policy', icon: 'bi-cart-check' },
    event_attending_policy: { path: '/event-attending-policy', name: 'Event Attending Policy', icon: 'bi-ticket-perforated' },
    account_reactivation: { path: '/account-reactivation', name: 'Account Reactivation', icon: 'bi-person-plus' }
  }
};

/**
 * Get all available routes with dynamic pages
 */
async function getAllRoutes() {
  try {
    const routes = {
      discover: { ...STATIC_ROUTES.discover },
      services: { ...STATIC_ROUTES.services },
      shop: { ...STATIC_ROUTES.shop },
      help: { ...STATIC_ROUTES.help }
    };

    // Add dynamic pages
    const dynamicPages = await Page.find({ status: 'published' }).sort({ order: 1, title: 1 });

    dynamicPages.forEach(page => {
      const key = `page_${page.slug}`;
      const route = {
        path: `/pages/${page.slug}`,
        name: page.title,
        icon: 'bi-file-text',
        isDynamic: true,
        pageId: page._id
      };

      // Add to appropriate category
      if (page.featured) {
        routes.discover[key] = route;
      } else {
        routes.help[key] = route;
      }
    });

    return routes;
  } catch (error) {
    console.error('Error getting routes:', error);
    return {
      discover: { ...STATIC_ROUTES.discover },
      services: { ...STATIC_ROUTES.services },
      shop: { ...STATIC_ROUTES.shop },
      help: { ...STATIC_ROUTES.help }
    };
  }
}

/**
 * Get menu configuration for admin interface
 */
async function getMenuConfiguration() {
  const routes = await getAllRoutes();

  return {
    discoverMenu: {
      name: 'Discover',
      icon: 'bi-compass',
      routes: routes.discover
    },
    servicesMenu: {
      name: 'Services',
      icon: 'bi-gear',
      routes: routes.services
    },
    shopMenu: {
      name: 'Shop',
      icon: 'bi-bag',
      routes: routes.shop
    },
    helpSupportMenu: {
      name: 'Help & Support',
      icon: 'bi-question-circle',
      routes: routes.help
    }
  };
}

/**
 * Get navbar-compatible menu settings
 */
function getNavbarMenuSettings(menuSettings) {
  try {
    // Direct mapping for navbar compatibility
    const navbarSettings = {
      discoverMenu: {
        enabled: menuSettings.discoverMenu?.enabled || false,
        items: {}
      },
      servicesMenu: {
        enabled: menuSettings.servicesMenu?.enabled || false,
        items: {}
      },
      shopMenu: {
        enabled: menuSettings.shopMenu?.enabled || false,
        items: {}
      },
      helpSupportMenu: {
        enabled: menuSettings.helpSupportMenu?.enabled || false,
        items: {}
      }
    };

    // Map discover menu items
    if (menuSettings.discoverMenu?.items) {
      const items = menuSettings.discoverMenu.items;
      navbarSettings.discoverMenu.items = {
        home: items.home || false,
        about: items.about || false,
        contentLibrary: items.content || false, // Map content -> contentLibrary
        concerts: items.concerts || false,
        dailyConcerts: items.daily_concerts || false, // Map daily_concerts -> dailyConcerts
        artists: items.artists || false,
        learning: items.learning || false,
        jobPortal: items.job_portal || false // Map job_portal -> jobPortal
      };
    }

    // Map services menu items
    if (menuSettings.servicesMenu?.items) {
      const items = menuSettings.servicesMenu.items;
      navbarSettings.servicesMenu.items = {
        teamRequirement: items.team_requirement || false, // Map team_requirement -> teamRequirement
        findMyArtist: items.find_my_artist || false, // Map find_my_artist -> findMyArtist
        subscriptions: items.subscriptions || false
      };
    }

    // Map shop menu items
    if (menuSettings.shopMenu?.items) {
      const items = menuSettings.shopMenu.items;
      navbarSettings.shopMenu.items = {
        shop: items.shop || false,
        myOrders: items.my_orders || false // Map my_orders -> myOrders
      };
    }

    // Map help menu items
    if (menuSettings.helpSupportMenu?.items) {
      const items = menuSettings.helpSupportMenu.items;
      navbarSettings.helpSupportMenu.items = {
        demo: items.demo || false,
        contact: items.contact || false,
        termsOfService: items.terms_of_service || false, // Map terms_of_service -> termsOfService
        privacyPolicy: items.privacy_policy || false, // Map privacy_policy -> privacyPolicy
        refundPolicy: items.refund_policy || false, // Map refund_policy -> refundPolicy
        subscriptionPolicy: items.subscription_policy || false, // Map subscription_policy -> subscriptionPolicy
        shoppingPolicy: items.shopping_policy || false, // Map shopping_policy -> shoppingPolicy
        eventAttendingPolicy: items.event_attending_policy || false, // Map event_attending_policy -> eventAttendingPolicy
        accountReactivation: items.account_reactivation || false // Map account_reactivation -> accountReactivation
      };
    }

    return navbarSettings;
  } catch (error) {
    console.error('Error processing navbar menu settings:', error);
    return menuSettings; // Return original if processing fails
  }
}

module.exports = {
  getAllRoutes,
  getMenuConfiguration,
  getNavbarMenuSettings,
  STATIC_ROUTES
};
