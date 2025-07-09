// RAPIRA Website Chatbot - Static Knowledge Base
class RapiraChatbot {
  constructor() {
    this.isOpen = false;
    this.knowledgeBase = this.initializeKnowledgeBase();
    this.init();
  }

  init() {
    this.createChatbotHTML();
    this.attachEventListeners();
  }

  initializeKnowledgeBase() {
    return {
      // Website Information
      'what is rapira': 'RAPIRA is a digital entertainment platform by Valrein company that connects artists, event organizers, and users. It features artist portfolios, ticket purchasing, subscriptions, merchandise shopping, and email notifications for bookings/refunds.',
      
      'about rapira': 'RAPIRA is an Indian rap music platform where artists can showcase their music, organize concerts, and connect with fans. Users can discover artists, book tickets, purchase merchandise, and access exclusive content.',

      // Main Navigation & Pages
      'main pages': 'RAPIRA has several main sections: Discover (<a href="/" target="_blank">Home</a>, <a href="/about" target="_blank">About Us</a>, <a href="/content" target="_blank">Content Library</a>, <a href="/concerts" target="_blank">Concerts</a>, <a href="/daily-concerts" target="_blank">Daily Concerts</a>, <a href="/artists" target="_blank">Artists</a>, <a href="/learning" target="_blank">Learning</a>), Services (<a href="/team-requirement" target="_blank">Team Requirement</a>, <a href="/find-my-artist" target="_blank">Find My Artist</a>, <a href="/subscriptions" target="_blank">Subscriptions</a>), Shop (<a href="/shop" target="_blank">Shop</a>, <a href="/orders/my-orders" target="_blank">My Orders</a>), and Help & Support (<a href="/demo" target="_blank">Demo</a>, <a href="/contact" target="_blank">Contact</a>, Policies).',

      'discover menu': 'The Discover menu includes: <a href="/" target="_blank">Home page</a>, <a href="/about" target="_blank">About Us</a>, <a href="/content" target="_blank">Content Library</a>, <a href="/concerts" target="_blank">Concerts</a>, <a href="/daily-concerts" target="_blank">Daily Concerts</a>, <a href="/artists" target="_blank">Artists gallery</a>, and <a href="/learning" target="_blank">Learning modules</a>.',

      'services menu': 'The Services menu includes: <a href="/team-requirement" target="_blank">Team Requirement</a> (for hiring team members), <a href="/find-my-artist" target="_blank">Find My Artist</a> (for booking artists), and <a href="/subscriptions" target="_blank">Subscriptions</a> (premium plans).',

      'shop menu': 'The Shop menu includes: <a href="/shop" target="_blank">Shop</a> (merchandise store) and <a href="/orders/my-orders" target="_blank">My Orders</a> (order history and tracking).',

      'help menu': 'The Help & Support menu includes: <a href="/demo" target="_blank">Interactive Demo</a>, <a href="/contact" target="_blank">Contact Us</a>, <a href="/terms-of-service" target="_blank">Terms of Service</a>, <a href="/privacy-policy" target="_blank">Privacy Policy</a>, <a href="/refund-policy" target="_blank">Refund Policy</a>, <a href="/subscription-policy" target="_blank">Subscription Policy</a>, and <a href="/shopping-policy" target="_blank">Shopping Policy</a>.',

      // User Features
      'user features': 'Users can: <a href="/auth/register" target="_blank">register and login</a>, create profiles, browse <a href="/concerts" target="_blank">concerts</a> by location/date, book free or paid tickets, purchase <a href="/subscriptions" target="_blank">subscriptions</a> for discounts, access <a href="/content" target="_blank">content library</a>, shop <a href="/shop" target="_blank">merchandise</a>, and <a href="/contact" target="_blank">contact support</a>.',

      'how to register': 'To register on RAPIRA: Click the <a href="/auth/register" target="_blank">Register button</a>, fill in your details (name, email, password), and submit. All users are automatically set as "Fan" account type.',

      'how to book tickets': 'To book tickets: Browse <a href="/concerts" target="_blank">concerts</a>, select an event, choose ticket quantity, provide attendee details, and complete payment through Razorpay. You\'ll receive email confirmation with QR codes.',

      'subscription benefits': 'Subscriptions offer discounts on ticket purchases, access to exclusive content, and special offers. Different plans have varying discount percentages and durations. <a href="/subscriptions" target="_blank">View subscription plans</a>.',

      // Artist Features
      'artist features': 'Artists can: create detailed profiles, upload songs/videos/content, submit concerts for approval, manage ticket sales, track analytics, complete <a href="/learning" target="_blank">learning modules</a>, and handle bookings.',

      'become artist': 'To become an artist: Apply through the <a href="/artist-applications/apply" target="_blank">artist application system</a>, provide your details and portfolio, wait for admin approval, then access the artist dashboard to manage your profile and content.',

      'artist dashboard': 'The artist dashboard includes: profile management, content upload, concert creation, ticket management, analytics, <a href="/learning" target="_blank">learning modules</a>, and booking requests. <a href="/auth/login" target="_blank">Login</a> to access your dashboard.',

      // Concert & Events
      'concerts': 'RAPIRA features regular concerts and daily concerts. Users can browse by location, date, and artist. Concerts can be free or paid, and require admin approval before going live. <a href="/concerts" target="_blank">Browse concerts</a>.',

      'daily concerts': 'Daily Concerts are special events that happen regularly. They\'re featured separately from regular concerts and can be browsed on the <a href="/daily-concerts" target="_blank">dedicated Daily Concerts page</a>.',

      'concert booking': 'Concert booking involves: selecting an event, choosing ticket quantity, providing attendee information, making payment, and receiving confirmation with QR codes for entry. Start by browsing <a href="/concerts" target="_blank">available concerts</a>.',

      // Shopping & Merchandise
      'merchandise': 'RAPIRA has a complete eCommerce system for artist merchandise including clothing, accessories, and collectibles. Features include cart, checkout, order tracking, and reviews. <a href="/shop" target="_blank">Browse merchandise</a>.',

      'how to shop': 'To shop: Browse the <a href="/shop" target="_blank">Shop page</a>, select products, choose size/quantity, add to cart, proceed to checkout, provide shipping details, and complete payment.',

      'order tracking': 'Track your orders in <a href="/orders/my-orders" target="_blank">"My Orders"</a> section. You can view order status, expected delivery dates, and contact support for order-related queries.',

      // Payment & Refunds
      'payment methods': 'RAPIRA uses Razorpay for secure payments. Accepted methods include credit/debit cards, UPI, net banking, and digital wallets.',

      'refund policy': 'Refunds are available for event cancellations, significant rescheduling, or venue changes. Refunds cannot be requested after concert dates have passed. For completed events, you can delete tickets for storage purposes. <a href="/refund-policy" target="_blank">Read full refund policy</a>.',

      'ticket deletion': 'For completed concerts, you can delete tickets from your account to manage storage and keep your ticket list organized. This is permanent and cannot be undone.',

      // Policies
      'privacy policy': 'Our Privacy Policy outlines how we collect, use, and protect your personal information. <a href="/privacy-policy" target="_blank">View the full policy</a>.',

      'terms of service': 'Our Terms of Service outline the rules for using RAPIRA platform. Users must be at least 13 years old. <a href="/terms-of-service" target="_blank">View full terms</a>.',

      'subscription policy': 'The Subscription Policy covers subscription plans, billing, cancellation, and management. <a href="/subscription-policy" target="_blank">View details</a>.',

      'shopping policy': 'The Shopping Policy covers merchandise purchases, returns, exchanges, shipping, and customer support. <a href="/shopping-policy" target="_blank">View details</a>.',

      // Technical Support
      'contact support': 'Contact us at: Email: vijaymudaliyar224@gmail.com, Phone: +91 123 456 7890, Hours: Monday-Friday, 9:00 AM - 6:00 PM IST.',

      'demo': 'Try our Interactive Demo to learn how to use RAPIRA features including artist registration, concert creation, ticket booking, and more. Access it from the Help menu.',

      // Learning & Team
      'learning modules': 'RAPIRA offers learning modules for skill development, available to artists for improving their craft and platform knowledge.',

      'team requirement': 'The Team Requirement feature allows event organizers to post job openings and hire team members for events and projects.',

      'find my artist': 'Find My Artist helps users discover and book artists for events. Browse by location, genre, and availability.',

      // Admin Features
      'admin features': 'Admins can manage users, approve concerts, handle refunds, create subscriptions, monitor platform activity, manage content, and configure website settings.',

      // Additional Features
      'content library': 'The Content Library contains music, videos, and other media uploaded by artists. You can browse, search, and enjoy content from various rap artists on the platform. <a href="/content" target="_blank">Explore content library</a>.',

      'daily concerts': 'Daily Concerts are special recurring events featured separately from regular concerts. <a href="/daily-concerts" target="_blank">Check the Daily Concerts page</a> for ongoing and upcoming daily events.',

      'learning modules': 'Learning modules help artists improve their skills and knowledge. Artists can access educational content to enhance their craft and platform understanding. <a href="/learning" target="_blank">Access learning modules</a>.',

      'team requirement': 'Team Requirement allows event organizers to post job openings and hire team members for events and projects. You can browse available roles and apply for positions. <a href="/team-requirement" target="_blank">Browse team requirements</a>.',

      'find my artist': 'Find My Artist helps you discover and book artists for your events. Search by location, genre, availability, and book artists directly through the platform. <a href="/find-my-artist" target="_blank">Find artists</a>.',

      'interactive demo': 'Try our Interactive Demo to learn RAPIRA features hands-on. It includes demos for artist registration, concert creation, ticket booking, content upload, and subscription purchase. <a href="/demo" target="_blank">Start demo</a>.',

      'about us': 'Learn more about RAPIRA, our mission, team, and vision on the About Us page. We\'re dedicated to connecting rap artists with fans and creating opportunities in the hip-hop community. <a href="/about" target="_blank">Read about us</a>.',

      'faq': 'Check our FAQ page for answers to frequently asked questions about using RAPIRA, account management, payments, and platform features. <a href="/faq" target="_blank">View FAQ</a>.',

      'website features': 'RAPIRA offers 25+ specialized modules including user management, artist portfolios, concert booking, content library, merchandise shopping, subscriptions, learning modules, team hiring, and comprehensive admin tools.',

      'mobile features': 'RAPIRA is mobile-responsive and works on all devices. Access all features including ticket booking, content viewing, shopping, and artist management from your mobile device.',

      'security': 'RAPIRA uses secure authentication, encrypted payments through Razorpay, and follows best practices for data protection. Your personal and payment information is safe with us.',

      // Navigation Help
      'navigation': 'RAPIRA navigation includes: Discover menu (<a href="/" target="_blank">Home</a>, <a href="/about" target="_blank">About</a>, <a href="/content" target="_blank">Content</a>, <a href="/concerts" target="_blank">Concerts</a>, <a href="/artists" target="_blank">Artists</a>, <a href="/learning" target="_blank">Learning</a>), Services (<a href="/team-requirement" target="_blank">Team Requirement</a>, <a href="/find-my-artist" target="_blank">Find My Artist</a>, <a href="/subscriptions" target="_blank">Subscriptions</a>), Shop (<a href="/shop" target="_blank">Products</a>, <a href="/orders/my-orders" target="_blank">Orders</a>), and Help & Support (<a href="/demo" target="_blank">Demo</a>, <a href="/contact" target="_blank">Contact</a>, Policies).',

      'menu': 'The main menu has four sections: Discover (explore content and events), Services (professional services), Shop (merchandise), and Help & Support (assistance and policies). All sections are accessible from the top navigation bar.',

      // Account Management
      'profile': 'Manage your profile in the user dashboard. Update personal information, profile picture, social links, and account preferences. <a href="/auth/login" target="_blank">Login</a> to access your profile.',

      'password': 'Change your password in the user profile settings. For forgotten passwords, use the <a href="/auth/forgot-password" target="_blank">"Forgot Password"</a> link on the <a href="/auth/login" target="_blank">login page</a>.',

      'account types': 'RAPIRA has three account types: Fan (regular users), Artist (content creators), and Admin (platform managers). All new registrations default to Fan accounts.',

      // Common Questions
      'how does it work': 'RAPIRA works as a platform connecting rap artists and fans. Artists create profiles, upload content, and organize concerts. Fans discover artists, book tickets, purchase merchandise, and access exclusive content through subscriptions.',

      'is it free': 'RAPIRA is free to join! You can register, browse artists, view free content, and book free concerts without cost. Paid features include premium subscriptions, paid concert tickets, and merchandise purchases.',

      'age requirement': 'You must be at least 13 years old to use RAPIRA platform, as stated in our Terms of Service.',

      'supported devices': 'RAPIRA works on all devices including desktop computers, laptops, tablets, and smartphones. The website is fully responsive and optimized for mobile use.',

      'languages': 'RAPIRA currently supports English. We may add more languages in the future based on user demand.',

      'countries': 'RAPIRA is primarily focused on the Indian rap music scene, but users from other countries can also join and participate.',

      'artist verification': 'Artists go through an application and verification process. Submit your artist application with portfolio details, and our admin team will review and approve qualified artists.',

      'concert approval': 'All concerts require admin approval before going live. Artists submit concert details, and admins review for quality and compliance before approval.',

      'ticket types': 'RAPIRA supports both free and paid concerts. Paid tickets are processed through secure Razorpay payment gateway with multiple payment options.',

      'qr codes': 'All tickets include QR codes for easy verification at events. Show your QR code at the venue for quick entry.',

      'email notifications': 'RAPIRA sends email notifications for ticket bookings, concert updates, refund confirmations, and important platform announcements.',

      'social media': 'Connect with RAPIRA on social media platforms. Links are available in the website footer for Instagram, Twitter, YouTube, and Spotify.',

      // Default responses
      'default': 'I can help you with questions about RAPIRA website features, pages, policies, and how to use the platform. Please ask about specific topics like registration, booking tickets, artist features, shopping, or policies.',

      'greeting': 'Hello! I\'m the RAPIRA assistant. I can help you with questions about our platform, features, and how to use the website. What would you like to know?',

      'goodbye': 'Thank you for using RAPIRA! If you have more questions about our platform, feel free to ask anytime or contact our support team.',

      'unknown': 'I can only answer questions about the RAPIRA website and its features. Please ask about topics like: user registration, booking tickets, artist features, shopping, subscriptions, policies, or how to use specific pages.'
    };
  }

  createChatbotHTML() {
    const chatbotHTML = `
      <!-- Chatbot Toggle Button -->
      <div id="chatbot-toggle" class="chatbot-toggle">
        <i class="bi bi-chat-dots"></i>
      </div>

      <!-- Chatbot Container -->
      <div id="chatbot-container" class="chatbot-container">
        <div class="chatbot-header">
          <div class="chatbot-title">
            <i class="bi bi-robot me-2"></i>
            RAPIRA Assistant
          </div>
          <button id="chatbot-close" class="chatbot-close">
            <i class="bi bi-x"></i>
          </button>
        </div>
        
        <div id="chatbot-messages" class="chatbot-messages">
          <div class="message bot-message">
            <div class="message-content">
              Hello! I'm the RAPIRA assistant. I can help you with questions about our platform, features, and how to use the website. What would you like to know?
            </div>
          </div>
        </div>
        
        <div class="chatbot-input-container">
          <input type="text" id="chatbot-input" placeholder="Ask about RAPIRA features..." maxlength="200">
          <button id="chatbot-send">
            <i class="bi bi-send"></i>
          </button>
        </div>
        
        <div class="chatbot-suggestions">
          <button class="suggestion-btn" data-question="what is rapira">What is RAPIRA?</button>
          <button class="suggestion-btn" data-question="how to book tickets">Book tickets</button>
          <button class="suggestion-btn" data-question="become artist">Become artist</button>
          <button class="suggestion-btn" data-question="main pages">Main pages</button>
          <button class="suggestion-btn" data-question="how to shop">How to shop</button>
          <button class="suggestion-btn" data-question="contact support">Contact support</button>
          <button class="suggestion-btn" data-question="refund policy">Refund policy</button>
          <button class="suggestion-btn" data-question="demo">Try demo</button>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', chatbotHTML);
  }

  attachEventListeners() {
    const toggle = document.getElementById('chatbot-toggle');
    const close = document.getElementById('chatbot-close');
    const input = document.getElementById('chatbot-input');
    const send = document.getElementById('chatbot-send');
    const suggestions = document.querySelectorAll('.suggestion-btn');

    toggle.addEventListener('click', () => this.toggleChatbot());
    close.addEventListener('click', () => this.closeChatbot());
    send.addEventListener('click', () => this.sendMessage());
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.sendMessage();
    });

    suggestions.forEach(btn => {
      btn.addEventListener('click', () => {
        const question = btn.getAttribute('data-question');
        this.handleUserMessage(question);
      });
    });
  }

  toggleChatbot() {
    const container = document.getElementById('chatbot-container');
    this.isOpen = !this.isOpen;
    
    if (this.isOpen) {
      container.style.display = 'flex';
      document.getElementById('chatbot-toggle').style.display = 'none';
      document.getElementById('chatbot-input').focus();
    } else {
      container.style.display = 'none';
      document.getElementById('chatbot-toggle').style.display = 'flex';
    }
  }

  closeChatbot() {
    this.isOpen = false;
    document.getElementById('chatbot-container').style.display = 'none';
    document.getElementById('chatbot-toggle').style.display = 'flex';
  }

  sendMessage() {
    const input = document.getElementById('chatbot-input');
    const message = input.value.trim();
    
    if (message) {
      this.handleUserMessage(message);
      input.value = '';
    }
  }

  handleUserMessage(message) {
    this.addMessage(message, 'user');
    
    setTimeout(() => {
      const response = this.generateResponse(message.toLowerCase());
      this.addMessage(response, 'bot');
    }, 500);
  }

  generateResponse(message) {
    // Check for exact matches first
    if (this.knowledgeBase[message]) {
      return this.knowledgeBase[message];
    }

    // Check for partial matches
    for (const [key, value] of Object.entries(this.knowledgeBase)) {
      if (message.includes(key) || key.includes(message)) {
        return value;
      }
    }

    // Check for common keywords
    if (message.includes('hello') || message.includes('hi') || message.includes('hey')) {
      return this.knowledgeBase['greeting'];
    }

    if (message.includes('bye') || message.includes('goodbye') || message.includes('thanks')) {
      return this.knowledgeBase['goodbye'];
    }

    if (message.includes('register') || message.includes('signup') || message.includes('sign up')) {
      return this.knowledgeBase['how to register'];
    }

    if (message.includes('ticket') && (message.includes('book') || message.includes('buy'))) {
      return this.knowledgeBase['how to book tickets'];
    }

    if (message.includes('artist') && (message.includes('become') || message.includes('join'))) {
      return this.knowledgeBase['become artist'];
    }

    if (message.includes('shop') || message.includes('merchandise') || message.includes('buy')) {
      return this.knowledgeBase['how to shop'];
    }

    if (message.includes('refund') || message.includes('cancel')) {
      return this.knowledgeBase['refund policy'];
    }

    if (message.includes('contact') || message.includes('support') || message.includes('help')) {
      return this.knowledgeBase['contact support'];
    }

    if (message.includes('payment') || message.includes('pay')) {
      return this.knowledgeBase['payment methods'];
    }

    if (message.includes('content') || message.includes('library') || message.includes('music') || message.includes('video')) {
      return this.knowledgeBase['content library'];
    }

    if (message.includes('daily concert') || message.includes('daily event')) {
      return this.knowledgeBase['daily concerts'];
    }

    if (message.includes('learn') || message.includes('education') || message.includes('skill')) {
      return this.knowledgeBase['learning modules'];
    }

    if (message.includes('team') || message.includes('hire') || message.includes('job')) {
      return this.knowledgeBase['team requirement'];
    }

    if (message.includes('find artist') || message.includes('book artist')) {
      return this.knowledgeBase['find my artist'];
    }

    if (message.includes('demo') || message.includes('tutorial') || message.includes('how to use')) {
      return this.knowledgeBase['interactive demo'];
    }

    if (message.includes('about') || message.includes('company') || message.includes('mission')) {
      return this.knowledgeBase['about us'];
    }

    if (message.includes('faq') || message.includes('question') || message.includes('frequently asked')) {
      return this.knowledgeBase['faq'];
    }

    if (message.includes('feature') || message.includes('what can') || message.includes('capabilities')) {
      return this.knowledgeBase['website features'];
    }

    if (message.includes('mobile') || message.includes('phone') || message.includes('app')) {
      return this.knowledgeBase['mobile features'];
    }

    if (message.includes('security') || message.includes('safe') || message.includes('secure')) {
      return this.knowledgeBase['security'];
    }

    if (message.includes('navigation') || message.includes('menu') || message.includes('navigate')) {
      return this.knowledgeBase['navigation'];
    }

    if (message.includes('profile') || message.includes('account settings') || message.includes('personal info')) {
      return this.knowledgeBase['profile'];
    }

    if (message.includes('password') || message.includes('forgot password') || message.includes('change password')) {
      return this.knowledgeBase['password'];
    }

    if (message.includes('account type') || message.includes('user type') || message.includes('fan') || message.includes('admin')) {
      return this.knowledgeBase['account types'];
    }

    if (message.includes('subscription') || message.includes('premium') || message.includes('plan')) {
      return this.knowledgeBase['subscription benefits'];
    }

    if (message.includes('concert') && !message.includes('daily')) {
      return this.knowledgeBase['concerts'];
    }

    if (message.includes('order') || message.includes('track order') || message.includes('my order')) {
      return this.knowledgeBase['order tracking'];
    }

    if (message.includes('policy') || message.includes('terms') || message.includes('privacy')) {
      return 'RAPIRA has several policies: <a href="/privacy-policy" target="_blank">Privacy Policy</a> (data protection), <a href="/terms-of-service" target="_blank">Terms of Service</a> (usage rules), <a href="/refund-policy" target="_blank">Refund Policy</a> (ticket refunds), <a href="/subscription-policy" target="_blank">Subscription Policy</a> (subscription terms), and <a href="/shopping-policy" target="_blank">Shopping Policy</a> (merchandise policies). You can find all policies in the Help & Support menu.';
    }

    if (message.includes('how does') || message.includes('how it works') || message.includes('explain')) {
      return this.knowledgeBase['how does it work'];
    }

    if (message.includes('free') || message.includes('cost') || message.includes('price') || message.includes('money')) {
      return this.knowledgeBase['is it free'];
    }

    if (message.includes('age') || message.includes('old') || message.includes('requirement')) {
      return this.knowledgeBase['age requirement'];
    }

    if (message.includes('device') || message.includes('computer') || message.includes('laptop') || message.includes('tablet')) {
      return this.knowledgeBase['supported devices'];
    }

    if (message.includes('language') || message.includes('hindi') || message.includes('english')) {
      return this.knowledgeBase['languages'];
    }

    if (message.includes('country') || message.includes('india') || message.includes('location')) {
      return this.knowledgeBase['countries'];
    }

    if (message.includes('verification') || message.includes('verify') || message.includes('approved')) {
      return this.knowledgeBase['artist verification'];
    }

    if (message.includes('approval') || message.includes('approve') || message.includes('admin review')) {
      return this.knowledgeBase['concert approval'];
    }

    if (message.includes('ticket type') || message.includes('free ticket') || message.includes('paid ticket')) {
      return this.knowledgeBase['ticket types'];
    }

    if (message.includes('qr') || message.includes('qr code') || message.includes('entry')) {
      return this.knowledgeBase['qr codes'];
    }

    if (message.includes('email') || message.includes('notification') || message.includes('alert')) {
      return this.knowledgeBase['email notifications'];
    }

    if (message.includes('social') || message.includes('instagram') || message.includes('twitter') || message.includes('youtube')) {
      return this.knowledgeBase['social media'];
    }

    // Default response for unrecognized queries
    return this.knowledgeBase['unknown'];
  }

  addMessage(content, type) {
    const messagesContainer = document.getElementById('chatbot-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}-message`;

    messageDiv.innerHTML = `
      <div class="message-content">
        ${content}
      </div>
    `;

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Add click event listeners to links in the message
    const links = messageDiv.querySelectorAll('a');
    links.forEach(link => {
      link.addEventListener('click', (e) => {
        // Links will open in new tab due to target="_blank"
        // Optional: Add analytics or tracking here
      });
    });
  }
}

// Initialize chatbot when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new RapiraChatbot();
});
