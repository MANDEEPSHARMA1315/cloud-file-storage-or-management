const User = require('../models/User');

/**
 * Middleware to protect routes that require user authentication
 */
const ensureAuthenticated = async (req, res, next) => {
  try {
    if (req.session && req.session.userId) {
      const user = await User.findById(req.session.userId);
      if (user) {
        req.user = user;
        res.locals.currentUser = user;
        
        // Calculate storage warning
        const quota = user.storageQuota || 524288000;
        const used = user.storageUsed || 0;
        const percentage = Math.min(Math.round((used / quota) * 100), 100);
        
        res.locals.storageInfo = {
          used,
          quota,
          percentage,
          isNearQuota: percentage >= 80,
          isQuotaExceeded: used >= quota,
          formattedUsed: formatBytes(used),
          formattedQuota: formatBytes(quota)
        };
        
        return next();
      }
    }

    // Check if this is an API call or regular web page request
    if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
      return res.status(401).json({ success: false, message: 'Authentication required. Please log in.' });
    }

    req.flash('error_msg', 'Please log in to access this page');
    res.redirect('/login');
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.redirect('/login');
  }
};

/**
 * Middleware to prevent logged-in users from accessing login/register
 */
const ensureGuest = (req, res, next) => {
  if (req.session && req.session.userId) {
    return res.redirect('/dashboard');
  }
  next();
};

/**
 * Helper function to format bytes to human-readable strings
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

module.exports = {
  ensureAuthenticated,
  ensureGuest,
  formatBytes
};

