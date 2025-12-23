const WebsiteSettings = require('../models/WebsiteSettings');

class MaintenanceService {
  constructor() {
    this.checkInterval = null;
    this.checkIntervalMs = 60000; // Check every minute
  }

  // Start the periodic check for expired maintenance mode
  startPeriodicCheck() {
    console.log('Starting maintenance mode expiration check...');
    
    // Run immediately first time
    this.checkForExpiredMaintenance();
    
    // Then run periodically
    this.checkInterval = setInterval(() => {
      this.checkForExpiredMaintenance();
    }, this.checkIntervalMs);
    
    console.log('Maintenance mode expiration check started (runs every minute)');
  }

  // Stop the periodic check
  stopPeriodicCheck() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('Maintenance mode expiration check stopped');
    }
  }

  // Check for expired maintenance mode and disable it if expired
  async checkForExpiredMaintenance() {
    try {
      const settings = await WebsiteSettings.getSettings();
      
      // Only check if maintenance mode is currently active
      if (settings.isMaintenanceActive()) {
        if (settings.isMaintenanceExpired()) {
          console.log('Maintenance mode has expired. Disabling maintenance mode...');
          
          // Disable maintenance mode
          settings.siteSettings.maintenanceMode = false;
          settings.siteSettings.maintenanceStartTime = null;
          
          await settings.save();
          
          console.log('Maintenance mode has been disabled due to expiration');
          
          // Optionally, you can emit an event or send a notification here
          this.onMaintenanceDisabled(settings);
        }
      }
    } catch (error) {
      console.error('Error checking for expired maintenance:', error);
    }
  }

  // Callback method when maintenance mode is disabled
  onMaintenanceDisabled(settings) {
    console.log('Maintenance mode automatically disabled due to expiration.');
    // Add any additional logic here, such as notifications
  }

  // Enable maintenance mode with start time and duration
  async enableMaintenanceMode(reason, durationMinutes, autoStart = false) {
    try {
      const settings = await WebsiteSettings.getSettings();
      
      settings.siteSettings.maintenanceMode = true;
      settings.siteSettings.maintenanceReason = reason || 'Scheduled maintenance in progress';
      settings.siteSettings.maintenanceStartTime = new Date();
      settings.siteSettings.maintenanceDuration = durationMinutes || 60; // default to 60 minutes
      settings.siteSettings.maintenanceAutoStart = autoStart;
      
      await settings.save();
      
      console.log(`Maintenance mode enabled for ${durationMinutes} minutes starting at ${settings.siteSettings.maintenanceStartTime}`);
      
      return settings;
    } catch (error) {
      console.error('Error enabling maintenance mode:', error);
      throw error;
    }
  }

  // Disable maintenance mode
  async disableMaintenanceMode() {
    try {
      const settings = await WebsiteSettings.getSettings();
      
      if (settings.siteSettings.maintenanceMode) {
        settings.siteSettings.maintenanceMode = false;
        settings.siteSettings.maintenanceStartTime = null;
        
        await settings.save();
        
        console.log('Maintenance mode disabled');
      }
      
      return settings;
    } catch (error) {
      console.error('Error disabling maintenance mode:', error);
      throw error;
    }
  }
}

module.exports = new MaintenanceService();