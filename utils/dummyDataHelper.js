const DummyDataGenerator = require('./dummyDataGenerator');
const WebsiteSettings = require('../models/WebsiteSettings');

class DummyDataHelper {
  constructor() {
    this.generator = new DummyDataGenerator();
    this.cache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
  }

  async isDummyDataEnabled() {
    try {
      const settings = await WebsiteSettings.getSettings();
      return settings.adminSettings && settings.adminSettings.showDummyData;
    } catch (error) {
      console.error('Error checking dummy data setting:', error);
      return false;
    }
  }

  async getDummyDataCount() {
    try {
      const settings = await WebsiteSettings.getSettings();
      return (settings.adminSettings && settings.adminSettings.dummyDataCount) || 10;
    } catch (error) {
      console.error('Error getting dummy data count:', error);
      return 10;
    }
  }

  getCachedDummyData(type) {
    const cacheKey = `dummy_${type}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < this.cacheExpiry) {
      return cached.data;
    }
    
    return null;
  }

  setCachedDummyData(type, data) {
    const cacheKey = `dummy_${type}`;
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
  }

  async generateDummyData(type, count = null) {
    // Check cache first
    const cached = this.getCachedDummyData(type);
    if (cached) {
      return cached;
    }

    // Get count from settings if not provided
    if (!count) {
      count = await this.getDummyDataCount();
    }

    let dummyData = [];

    switch (type) {
      case 'users':
        dummyData = this.generator.generateUsers(count);
        break;
      case 'artists':
        dummyData = this.generator.generateArtists(Math.floor(count * 0.7));
        break;
      case 'concerts':
        dummyData = this.generator.generateConcerts(Math.floor(count * 0.8));
        break;
      case 'tickets':
        dummyData = this.generator.generateTickets(count * 2);
        break;
      case 'content':
        dummyData = this.generator.generateContent(count);
        break;
      case 'pages':
        dummyData = this.generator.generatePages(5);
        break;
      case 'teamRoles':
        dummyData = this.generator.generateTeamRoles(Math.floor(count * 0.6));
        break;
      case 'subscriptions':
        dummyData = this.generator.generateSubscriptions(count);
        break;
      case 'contactMessages':
        dummyData = this.generator.generateContactMessages(Math.floor(count * 1.2));
        break;
      default:
        console.warn(`Unknown dummy data type: ${type}`);
        return [];
    }

    // Cache the generated data
    this.setCachedDummyData(type, dummyData);
    return dummyData;
  }

  async mergeWithDummyData(realData, type, options = {}) {
    const isDummyEnabled = await this.isDummyDataEnabled();
    
    if (!isDummyEnabled) {
      return {
        data: realData,
        totalCount: realData.length,
        realCount: realData.length,
        dummyCount: 0,
        hasDummyData: false
      };
    }

    try {
      const dummyData = await this.generateDummyData(type, options.count);
      
      // Merge real and dummy data
      const mergedData = [...realData];
      
      // Add dummy data with clear indicators
      const markedDummyData = dummyData.map(item => ({
        ...item,
        isDummy: true,
        _dummyIndicator: '🔧 DUMMY'
      }));

      // Insert dummy data at random positions or append based on options
      if (options.shuffle) {
        // Randomly insert dummy data
        markedDummyData.forEach(dummyItem => {
          const randomIndex = Math.floor(Math.random() * (mergedData.length + 1));
          mergedData.splice(randomIndex, 0, dummyItem);
        });
      } else {
        // Append dummy data at the end
        mergedData.push(...markedDummyData);
      }

      return {
        data: mergedData,
        totalCount: mergedData.length,
        realCount: realData.length,
        dummyCount: dummyData.length,
        hasDummyData: true
      };
    } catch (error) {
      console.error(`Error merging dummy data for ${type}:`, error);
      return {
        data: realData,
        totalCount: realData.length,
        realCount: realData.length,
        dummyCount: 0,
        hasDummyData: false
      };
    }
  }

  // Helper method to add dummy data indicators to templates
  getDummyDataBadge() {
    return '<span class="badge bg-warning text-dark ms-2" title="This is dummy data for testing purposes">🔧 DUMMY</span>';
  }

  // Helper method to filter out dummy data (for operations that shouldn't affect dummy data)
  filterRealData(data) {
    return data.filter(item => !item.isDummy);
  }

  // Clear cache
  clearCache() {
    this.cache.clear();
  }

  // Get cache stats
  getCacheStats() {
    const stats = {
      totalEntries: this.cache.size,
      entries: []
    };

    for (const [key, value] of this.cache.entries()) {
      stats.entries.push({
        key,
        dataCount: value.data.length,
        age: Date.now() - value.timestamp,
        expired: (Date.now() - value.timestamp) > this.cacheExpiry
      });
    }

    return stats;
  }
}

// Export singleton instance
module.exports = new DummyDataHelper();
