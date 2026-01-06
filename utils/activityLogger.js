const UserActivityLog = require('../models/UserActivityLog');

/**
 * Helper function to log user activities
 */
class ActivityLogger {
  /**
   * Log a user activity
   * @param {Object} options - Activity options
   * @param {String} options.userId - User ID who performed/affected by the activity
   * @param {String} options.activityType - Type of activity
   * @param {String} options.description - Human-readable description
   * @param {String} options.oldValue - Previous value (for changes)
   * @param {String} options.newValue - New value (for changes)
   * @param {String} options.ipAddress - IP address
   * @param {String} options.userAgent - User agent string
   * @param {String} options.performedBy - Admin user ID if admin made the change
   * @param {Object} options.metadata - Additional data
   */
  static async log({
    userId,
    activityType,
    description,
    oldValue = null,
    newValue = null,
    ipAddress = null,
    userAgent = null,
    performedBy = null,
    metadata = {}
  }) {
    try {
      return await UserActivityLog.logActivity({
        user: userId,
        activityType,
        description,
        oldValue: oldValue ? String(oldValue) : null,
        newValue: newValue ? String(newValue) : null,
        ipAddress,
        userAgent,
        performedBy,
        metadata
      });
    } catch (error) {
      console.error('Error in ActivityLogger.log:', error);
      return null;
    }
  }

  /**
   * Log name change
   */
  static async logNameChange(userId, oldName, newName, req, performedBy = null) {
    return await this.log({
      userId,
      activityType: 'name_change',
      description: `Name changed from "${oldName}" to "${newName}"`,
      oldValue: oldName,
      newValue: newName,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
      performedBy
    });
  }

  /**
   * Log email change
   */
  static async logEmailChange(userId, oldEmail, newEmail, req, performedBy = null) {
    return await this.log({
      userId,
      activityType: 'email_change',
      description: `Email changed from "${oldEmail}" to "${newEmail}"`,
      oldValue: oldEmail,
      newValue: newEmail,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
      performedBy
    });
  }

  /**
   * Log password change
   */
  static async logPasswordChange(userId, req, performedBy = null) {
    return await this.log({
      userId,
      activityType: 'password_change',
      description: 'Password was changed',
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
      performedBy
    });
  }

  /**
   * Log phone change
   */
  static async logPhoneChange(userId, oldPhone, newPhone, req, performedBy = null) {
    return await this.log({
      userId,
      activityType: 'phone_change',
      description: `Phone changed from "${oldPhone || 'none'}" to "${newPhone || 'none'}"`,
      oldValue: oldPhone || 'none',
      newValue: newPhone || 'none',
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
      performedBy
    });
  }

  /**
   * Log city change
   */
  static async logCityChange(userId, oldCity, newCity, req, performedBy = null) {
    return await this.log({
      userId,
      activityType: 'city_change',
      description: `City changed from "${oldCity || 'none'}" to "${newCity || 'none'}"`,
      oldValue: oldCity || 'none',
      newValue: newCity || 'none',
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
      performedBy
    });
  }

  /**
   * Log bio change
   */
  static async logBioChange(userId, oldBio, newBio, req, performedBy = null) {
    return await this.log({
      userId,
      activityType: 'bio_change',
      description: 'Bio was updated',
      oldValue: oldBio ? oldBio.substring(0, 100) : 'none',
      newValue: newBio ? newBio.substring(0, 100) : 'none',
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
      performedBy
    });
  }

  /**
   * Log profile image change
   */
  static async logProfileImageChange(userId, oldImage, newImage, req, performedBy = null) {
    return await this.log({
      userId,
      activityType: 'profile_image_change',
      description: 'Profile picture was updated',
      oldValue: oldImage || 'none',
      newValue: newImage || 'none',
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
      performedBy
    });
  }

  /**
   * Log profile update (general)
   */
  static async logProfileUpdate(userId, changes, req, performedBy = null) {
    const changedFields = Object.keys(changes).join(', ');
    return await this.log({
      userId,
      activityType: 'profile_update',
      description: `Profile updated: ${changedFields}`,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
      performedBy,
      metadata: changes
    });
  }

  /**
   * Log login
   */
  static async logLogin(userId, req, success = true) {
    return await this.log({
      userId,
      activityType: success ? 'login' : 'failed_login',
      description: success ? 'User logged in' : 'Failed login attempt',
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent')
    });
  }

  /**
   * Log logout
   */
  static async logLogout(userId, req) {
    return await this.log({
      userId,
      activityType: 'logout',
      description: 'User logged out',
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent')
    });
  }

  /**
   * Log role change
   */
  static async logRoleChange(userId, oldRole, newRole, req, performedBy) {
    return await this.log({
      userId,
      activityType: 'role_change',
      description: `Role changed from "${oldRole}" to "${newRole}"`,
      oldValue: oldRole,
      newValue: newRole,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
      performedBy
    });
  }

  /**
   * Get user's activity history
   */
  static async getUserHistory(userId, limit = 50) {
    return await UserActivityLog.getUserHistory(userId, limit);
  }

  /**
   * Get activity by type
   */
  static async getUserActivityByType(userId, activityType, limit = 20) {
    return await UserActivityLog.getUserActivityByType(userId, activityType, limit);
  }
}

module.exports = ActivityLogger;
