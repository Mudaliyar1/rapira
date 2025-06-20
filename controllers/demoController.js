/**
 * Demo Controller
 * Handles all demo-related routes and functionality
 */

// Demo home page
exports.demoHome = (req, res) => {
  const currentUser = req.session.user || null;
  res.render('demo', {
    title: 'Interactive Demo - Rapira',
    description: 'Try out Rapira features with our interactive demo. Learn how to become an artist, create concerts, purchase tickets, and more.',
    path: '/demo',
    currentUser,
    layout: 'layouts/demo' // Use the demo layout
  });
};

// Artist demo
exports.artistDemo = (req, res) => {
  // Sample artist data
  const artistData = {
    name: 'Demo Artist',
    genre: 'Hip-Hop/Rap',
    bio: 'This is a demo artist profile. Here you can see how artist profiles look and function on Rapira.',
    location: 'Mumbai, India',
    followers: 1250,
    verified: true,
    socialLinks: {
      instagram: 'https://instagram.com/demo',
      twitter: 'https://twitter.com/demo',
      youtube: 'https://youtube.com/demo',
      spotify: 'https://spotify.com/artist/demo'
    },
    profileImage: '/images/default-profile.png',
    bannerImage: '/images/default-banner.jpg'
  };

  // Sample content
  const content = [
    {
      id: 'demo1',
      title: 'Demo Song',
      type: 'song',
      description: 'This is a demo song to showcase how content appears on artist profiles.',
      thumbnailUrl: '/images/default-thumbnail.jpg',
      youtubeUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      releaseDate: new Date(),
      views: 1250
    },
    {
      id: 'demo2',
      title: 'Demo Music Video',
      type: 'video',
      description: 'This is a demo music video to showcase how videos appear on artist profiles.',
      thumbnailUrl: '/images/default-thumbnail.jpg',
      youtubeUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      releaseDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      views: 3450
    }
  ];

  // Sample upcoming concerts
  const upcomingConcerts = [
    {
      id: 'concert1',
      title: 'Demo Concert 2023',
      venue: 'Demo Venue',
      city: 'Mumbai',
      date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
      time: '7:00 PM',
      price: 500,
      isPaid: true,
      posterImage: '/images/default-concert.jpg',
      description: 'This is a demo concert to showcase how concerts appear on artist profiles.'
    }
  ];

  res.render('demos/artist-demo', {
    title: 'Artist Demo - Rapira',
    description: 'Try out the artist features on Rapira with this interactive demo.',
    path: '/demo/artist',
    artist: artistData,
    content: content,
    upcomingConcerts: upcomingConcerts,
    layout: 'layouts/demo' // Use the demo layout
  });
};

// Concert creation demo
exports.concertDemo = (req, res) => {
  res.render('demos/concert-demo', {
    title: 'Concert Creation Demo - Rapira',
    description: 'Learn how to create and manage concerts on Rapira with this interactive demo.',
    path: '/demo/concert',
    layout: 'layouts/demo' // Use the demo layout
  });
};

// Ticket purchase demo
exports.ticketDemo = (req, res) => {
  // Sample concert data
  const concert = {
    id: 'demo-concert',
    title: 'Demo Concert 2023',
    artist: {
      name: 'Demo Artist',
      profileImage: '/images/default-profile.png'
    },
    venue: 'Demo Venue',
    address: '123 Demo Street, Mumbai, India',
    city: 'Mumbai',
    date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
    time: '7:00 PM',
    price: 500,
    isPaid: true,
    posterImage: '/images/default-concert.jpg',
    description: 'This is a demo concert to showcase the ticket purchasing process on Rapira.',
    ticketsAvailable: 100,
    ticketsSold: 50
  };

  res.render('demos/ticket-demo', {
    title: 'Ticket Purchase Demo - Rapira',
    description: 'Learn how to purchase tickets for concerts on Rapira with this interactive demo.',
    path: '/demo/ticket',
    concert: concert,
    layout: 'layouts/demo' // Use the demo layout
  });
};

// Content sharing demo
exports.contentDemo = (req, res) => {
  res.render('demos/content-demo', {
    title: 'Content Sharing Demo - Rapira',
    description: 'Learn how to share your music and videos on Rapira with this interactive demo.',
    path: '/demo/content',
    layout: 'layouts/demo' // Use the demo layout
  });
};

// Subscription demo
exports.subscriptionDemo = (req, res) => {
  // Sample subscription plans
  const subscriptionPlans = [
    {
      id: 'basic',
      name: 'Basic Plan',
      price: 99,
      duration: 30, // days
      features: [
        'Access to exclusive content',
        'Early ticket access',
        '5% discount on concert tickets',
        'Ad-free experience'
      ],
      recommended: false
    },
    {
      id: 'premium',
      name: 'Premium Plan',
      price: 299,
      duration: 30, // days
      features: [
        'All Basic Plan features',
        'Priority customer support',
        '15% discount on concert tickets',
        'Exclusive artist meet & greet opportunities',
        'Monthly exclusive content'
      ],
      recommended: true
    },
    {
      id: 'annual',
      name: 'Annual Plan',
      price: 2499,
      duration: 365, // days
      features: [
        'All Premium Plan features',
        '20% discount on concert tickets',
        'Free merchandise with select concerts',
        'Quarterly exclusive content drops',
        'VIP access to select events'
      ],
      recommended: false
    }
  ];

  res.render('demos/subscription-demo', {
    title: 'Subscription Demo - Rapira',
    description: 'Learn about subscription plans on Rapira with this interactive demo.',
    path: '/demo/subscription',
    subscriptionPlans: subscriptionPlans,
    layout: 'layouts/demo' // Use the demo layout
  });
};

// Process demo form submissions (for all demo forms)
exports.processDemoForm = (req, res) => {
  const demoType = req.params.demoType;

  // Simulate form processing
  setTimeout(() => {
    res.json({
      success: true,
      message: 'Demo form processed successfully!',
      demoType: demoType,
      data: req.body
    });
  }, 1500); // Simulate processing delay
};
