const mongoose = require('mongoose');

// Dummy data generator for admin dashboard
class DummyDataGenerator {
  constructor() {
    this.firstNames = [
      'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan',
      'Shaurya', 'Atharv', 'Advik', 'Pranav', 'Rishabh', 'Aryan', 'Kabir', 'Ansh', 'Kian', 'Rudra',
      'Aadhya', 'Saanvi', 'Ananya', 'Diya', 'Pihu', 'Prisha', 'Inaya', 'Anvi', 'Riya', 'Navya',
      'Kavya', 'Anika', 'Myra', 'Sara', 'Pari', 'Fatima', 'Ira', 'Heer', 'Zara', 'Kiara'
    ];

    this.lastNames = [
      'Sharma', 'Verma', 'Gupta', 'Singh', 'Kumar', 'Agarwal', 'Jain', 'Bansal', 'Sinha', 'Roy',
      'Mehta', 'Shah', 'Patel', 'Joshi', 'Malhotra', 'Arora', 'Kapoor', 'Chopra', 'Saxena', 'Tiwari',
      'Pandey', 'Mishra', 'Agrawal', 'Goel', 'Mittal', 'Goyal', 'Jindal', 'Bhatia', 'Sethi', 'Khanna'
    ];

    this.cities = [
      'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune', 'Ahmedabad',
      'Jaipur', 'Lucknow', 'Kanpur', 'Nagpur', 'Indore', 'Thane', 'Bhopal', 'Visakhapatnam',
      'Patna', 'Vadodara', 'Ghaziabad', 'Ludhiana', 'Agra', 'Nashik', 'Faridabad', 'Meerut'
    ];

    this.rapperNames = [
      'MC Flow', 'Rap King', 'Beat Master', 'Lyric Lord', 'Hip Hop Hero', 'Rhythm Rebel',
      'Verse Viper', 'Mic Magician', 'Sound Storm', 'Word Warrior', 'Beat Beast', 'Rap Rocket',
      'Flow Fighter', 'Lyric Legend', 'Hip Hop Hawk', 'Rhythm Rider', 'Verse Villain', 'Mic Monster'
    ];

    this.concertTitles = [
      'Mumbai Rap Battle', 'Delhi Hip Hop Night', 'Bangalore Beat Fest', 'Chennai Cypher',
      'Kolkata Rap Revolution', 'Pune Poetry Slam', 'Hyderabad Hip Hop', 'Jaipur Jam Session',
      'Lucknow Lyric Lab', 'Indore Indie Night', 'Rap Royale', 'Beat Battle Bonanza',
      'Freestyle Friday', 'Cypher Sunday', 'Mic Drop Monday', 'Wordplay Wednesday'
    ];

    this.contentTitles = [
      'How to Write Better Rap Lyrics', 'Understanding Hip Hop Culture', 'Beat Making Basics',
      'Freestyle Techniques', 'Recording Your First Track', 'Building Your Rap Career',
      'Social Media for Artists', 'Live Performance Tips', 'Collaboration Strategies',
      'Music Production 101', 'Finding Your Unique Style', 'Industry Networking'
    ];

    this.teamRoles = [
      'Lead Rapper', 'Backup Vocalist', 'Beat Producer', 'Lyricist', 'Hype Man',
      'DJ', 'Sound Engineer', 'Video Director', 'Social Media Manager', 'Tour Manager'
    ];

    this.subscriptionPlans = [
      { name: 'Basic', price: 299, features: ['Access to basic content', 'Monthly newsletter'] },
      { name: 'Premium', price: 599, features: ['All basic features', 'Exclusive content', 'Live sessions'] },
      { name: 'Pro', price: 999, features: ['All premium features', 'One-on-one mentoring', 'Studio access'] }
    ];
  }

  generateRandomName() {
    const firstName = this.firstNames[Math.floor(Math.random() * this.firstNames.length)];
    const lastName = this.lastNames[Math.floor(Math.random() * this.lastNames.length)];
    return `${firstName} ${lastName}`;
  }

  generateRandomEmail(name) {
    const domain = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'][Math.floor(Math.random() * 4)];
    return `${name.toLowerCase().replace(' ', '.')}${Math.floor(Math.random() * 999)}@${domain}`;
  }

  generateRandomPhone() {
    return `+91${Math.floor(Math.random() * 9000000000) + 1000000000}`;
  }

  generateRandomCity() {
    return this.cities[Math.floor(Math.random() * this.cities.length)];
  }

  generateRandomDate(daysBack = 365) {
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * daysBack));
    return date;
  }

  generateUsers(count = 10) {
    const users = [];
    for (let i = 0; i < count; i++) {
      const name = this.generateRandomName();
      const user = {
        _id: new mongoose.Types.ObjectId(),
        name,
        email: this.generateRandomEmail(name),
        phone: this.generateRandomPhone(),
        city: this.generateRandomCity(),
        role: Math.random() > 0.8 ? 'artist' : 'user',
        isVerified: Math.random() > 0.3,
        createdAt: this.generateRandomDate(),
        isDummy: true
      };
      users.push(user);
    }
    return users;
  }

  generateArtists(count = 10) {
    const artists = [];
    for (let i = 0; i < count; i++) {
      const name = this.generateRandomName();
      const stageName = this.rapperNames[Math.floor(Math.random() * this.rapperNames.length)];
      const artist = {
        _id: new mongoose.Types.ObjectId(),
        name,
        email: this.generateRandomEmail(name),
        stageName,
        phone: this.generateRandomPhone(),
        city: this.generateRandomCity(),
        bio: `${stageName} is a rising hip-hop artist from ${this.generateRandomCity()}. Known for powerful lyrics and unique flow.`,
        genre: ['Hip Hop', 'Rap', 'Trap'][Math.floor(Math.random() * 3)],
        experience: Math.floor(Math.random() * 10) + 1,
        socialMedia: {
          instagram: `@${stageName.toLowerCase().replace(' ', '_')}`,
          youtube: `${stageName} Official`,
          spotify: stageName
        },
        isVerified: Math.random() > 0.5,
        createdAt: this.generateRandomDate(),
        isDummy: true
      };
      artists.push(artist);
    }
    return artists;
  }

  generateConcerts(count = 10) {
    const concerts = [];
    for (let i = 0; i < count; i++) {
      const title = this.concertTitles[Math.floor(Math.random() * this.concertTitles.length)];
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + Math.floor(Math.random() * 90));
      
      const concert = {
        _id: new mongoose.Types.ObjectId(),
        title,
        description: `Join us for an amazing ${title} featuring top local artists and emerging talent.`,
        venue: `${this.generateRandomCity()} Convention Center`,
        city: this.generateRandomCity(),
        date: futureDate,
        time: `${Math.floor(Math.random() * 4) + 18}:00`,
        ticketPrice: Math.floor(Math.random() * 1500) + 500,
        totalSeats: Math.floor(Math.random() * 500) + 100,
        bookedSeats: Math.floor(Math.random() * 50),
        status: ['upcoming', 'live', 'completed'][Math.floor(Math.random() * 3)],
        isPaid: Math.random() > 0.3,
        createdAt: this.generateRandomDate(30),
        isDummy: true
      };
      concerts.push(concert);
    }
    return concerts;
  }

  generateTickets(count = 10) {
    const tickets = [];
    for (let i = 0; i < count; i++) {
      const ticket = {
        _id: new mongoose.Types.ObjectId(),
        ticketId: `TKT${Date.now()}${i}`,
        concertTitle: this.concertTitles[Math.floor(Math.random() * this.concertTitles.length)],
        userName: this.generateRandomName(),
        userEmail: this.generateRandomEmail('user'),
        quantity: Math.floor(Math.random() * 4) + 1,
        totalAmount: Math.floor(Math.random() * 3000) + 500,
        status: ['confirmed', 'pending', 'cancelled', 'refunded'][Math.floor(Math.random() * 4)],
        paymentStatus: ['paid', 'pending', 'failed'][Math.floor(Math.random() * 3)],
        bookingDate: this.generateRandomDate(60),
        isDummy: true
      };
      tickets.push(ticket);
    }
    return tickets;
  }

  generateContent(count = 10) {
    const content = [];
    for (let i = 0; i < count; i++) {
      const title = this.contentTitles[Math.floor(Math.random() * this.contentTitles.length)];
      const contentItem = {
        _id: new mongoose.Types.ObjectId(),
        title,
        description: `Learn about ${title.toLowerCase()} with this comprehensive guide for aspiring hip-hop artists.`,
        type: ['article', 'video', 'podcast', 'tutorial'][Math.floor(Math.random() * 4)],
        category: ['Education', 'Entertainment', 'News', 'Tutorial'][Math.floor(Math.random() * 4)],
        author: this.generateRandomName(),
        duration: Math.floor(Math.random() * 60) + 5,
        views: Math.floor(Math.random() * 10000),
        likes: Math.floor(Math.random() * 1000),
        isPublished: Math.random() > 0.2,
        isFeatured: Math.random() > 0.7,
        createdAt: this.generateRandomDate(90),
        isDummy: true
      };
      content.push(contentItem);
    }
    return content;
  }

  generatePages(count = 5) {
    const pages = [];
    const pageTypes = ['About Us', 'Privacy Policy', 'Terms of Service', 'FAQ', 'Contact'];
    
    for (let i = 0; i < Math.min(count, pageTypes.length); i++) {
      const title = pageTypes[i];
      const page = {
        _id: new mongoose.Types.ObjectId(),
        title,
        slug: title.toLowerCase().replace(/\s+/g, '-'),
        content: `<h1>${title}</h1><p>This is the ${title.toLowerCase()} page content. Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>`,
        metaTitle: title,
        metaDescription: `${title} page for RAPIRA platform`,
        published: Math.random() > 0.2,
        showInNavigation: Math.random() > 0.5,
        order: i + 1,
        createdAt: this.generateRandomDate(30),
        isDummy: true
      };
      pages.push(page);
    }
    return pages;
  }

  generateTeamRoles(count = 10) {
    const roles = [];
    for (let i = 0; i < count; i++) {
      const roleName = this.teamRoles[Math.floor(Math.random() * this.teamRoles.length)];
      const role = {
        _id: new mongoose.Types.ObjectId(),
        title: roleName,
        description: `Looking for a talented ${roleName.toLowerCase()} to join our hip-hop collective.`,
        requirements: ['Experience in hip-hop', 'Good communication skills', 'Team player'],
        location: this.generateRandomCity(),
        budget: Math.floor(Math.random() * 50000) + 10000,
        duration: `${Math.floor(Math.random() * 6) + 1} months`,
        status: ['open', 'filled', 'closed'][Math.floor(Math.random() * 3)],
        applicants: Math.floor(Math.random() * 20),
        postedBy: this.generateRandomName(),
        createdAt: this.generateRandomDate(45),
        isDummy: true
      };
      roles.push(role);
    }
    return roles;
  }

  generateSubscriptions(count = 10) {
    const subscriptions = [];
    for (let i = 0; i < count; i++) {
      const plan = this.subscriptionPlans[Math.floor(Math.random() * this.subscriptionPlans.length)];
      const subscription = {
        _id: new mongoose.Types.ObjectId(),
        userName: this.generateRandomName(),
        userEmail: this.generateRandomEmail('subscriber'),
        planName: plan.name,
        planPrice: plan.price,
        status: ['active', 'expired', 'cancelled', 'pending'][Math.floor(Math.random() * 4)],
        startDate: this.generateRandomDate(180),
        endDate: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)), // 30 days from now
        paymentMethod: ['card', 'upi', 'netbanking'][Math.floor(Math.random() * 3)],
        autoRenewal: Math.random() > 0.4,
        isDummy: true
      };
      subscriptions.push(subscription);
    }
    return subscriptions;
  }

  generateContactMessages(count = 10) {
    const messages = [];
    const subjects = [
      'Technical Support', 'Billing Inquiry', 'Feature Request', 'Bug Report',
      'General Question', 'Partnership Proposal', 'Artist Application', 'Feedback'
    ];

    for (let i = 0; i < count; i++) {
      const name = this.generateRandomName();
      const subject = subjects[Math.floor(Math.random() * subjects.length)];
      const message = {
        _id: new mongoose.Types.ObjectId(),
        name,
        email: this.generateRandomEmail(name),
        subject,
        message: `Hello, I am writing regarding ${subject.toLowerCase()}. Please provide assistance with this matter.`,
        status: ['new', 'in-progress', 'resolved', 'closed'][Math.floor(Math.random() * 4)],
        priority: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
        createdAt: this.generateRandomDate(30),
        isDummy: true
      };
      messages.push(message);
    }
    return messages;
  }

  generateAllDummyData(count = 10) {
    return {
      users: this.generateUsers(count),
      artists: this.generateArtists(Math.floor(count * 0.7)),
      concerts: this.generateConcerts(Math.floor(count * 0.8)),
      tickets: this.generateTickets(count * 2),
      content: this.generateContent(count),
      pages: this.generatePages(5),
      teamRoles: this.generateTeamRoles(Math.floor(count * 0.6)),
      subscriptions: this.generateSubscriptions(count),
      contactMessages: this.generateContactMessages(Math.floor(count * 1.2))
    };
  }
}

module.exports = DummyDataGenerator;
