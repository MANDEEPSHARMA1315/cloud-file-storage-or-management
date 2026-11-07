const File = require('../models/File');
const Folder = require('../models/Folder');
const User = require('../models/User');
const { formatBytes } = require('../middleware/auth');

/**
 * Render Main Dashboard
 */
const getDashboard = async (req, res) => {
  try {
    const userId = req.user._id;

    // Fetch non-trashed files and folders for current user
    const files = await File.find({ owner: userId, isTrashed: false }).sort({ uploadedAt: -1 });
    const folders = await Folder.find({ owner: userId, isTrashed: false }).sort({ createdAt: -1 });

    // Recent files (up to 8)
    const recentFiles = files.slice(0, 8);

    // Compute metrics
    const totalFiles = files.length;
    const totalFolders = folders.length;

    // Categorize files
    const categories = {
      image: { count: 0, size: 0, label: 'Images', icon: 'fa-file-image', color: 'primary' },
      document: { count: 0, size: 0, label: 'Documents', icon: 'fa-file-lines', color: 'info' },
      pdf: { count: 0, size: 0, label: 'PDFs', icon: 'fa-file-pdf', color: 'danger' },
      video: { count: 0, size: 0, label: 'Videos', icon: 'fa-file-video', color: 'warning' },
      audio: { count: 0, size: 0, label: 'Audio', icon: 'fa-file-audio', color: 'success' },
      archive: { count: 0, size: 0, label: 'Archives', icon: 'fa-file-zipper', color: 'secondary' },
      other: { count: 0, size: 0, label: 'Other', icon: 'fa-file', color: 'dark' }
    };

    let calculatedStorageUsed = 0;

    files.forEach(file => {
      calculatedStorageUsed += file.fileSize;
      const cat = file.category || 'other';
      if (categories[cat]) {
        categories[cat].count += 1;
        categories[cat].size += file.fileSize;
      } else {
        categories.other.count += 1;
        categories.other.size += file.fileSize;
      }
    });

    // Sync storageUsed in User record if needed
    if (req.user.storageUsed !== calculatedStorageUsed) {
      await User.findByIdAndUpdate(userId, { storageUsed: calculatedStorageUsed });
      req.user.storageUsed = calculatedStorageUsed;
    }

    const quota = req.user.storageQuota || 524288000;
    const storageUsed = calculatedStorageUsed;
    const storagePercentage = quota > 0 ? Math.min(Math.round((storageUsed / quota) * 100), 100) : 0;
    const remainingStorage = Math.max(0, quota - storageUsed);

    res.render('dashboard', {
      title: 'Dashboard - Cloud File Storage',
      path: '/dashboard',
      stats: {
        totalFiles,
        totalFolders,
        storageUsed,
        storageQuota: quota,
        remainingStorage,
        storagePercentage,
        formattedUsed: formatBytes(storageUsed),
        formattedQuota: formatBytes(quota),
        formattedRemaining: formatBytes(remainingStorage),
        isNearQuota: storagePercentage >= 80,
        isQuotaExceeded: storageUsed >= quota
      },
      categories,
      recentFiles,
      recentFolders: folders.slice(0, 4),
      formatBytes
    });
  } catch (err) {
    console.error('Dashboard render error:', err);
    req.flash('error_msg', 'Failed to load dashboard data.');
    res.render('dashboard', {
      title: 'Dashboard - Cloud File Storage',
      path: '/dashboard',
      stats: {
        totalFiles: 0,
        totalFolders: 0,
        storageUsed: 0,
        storageQuota: 524288000,
        remainingStorage: 524288000,
        storagePercentage: 0,
        formattedUsed: '0 B',
        formattedQuota: '500 MB',
        formattedRemaining: '500 MB',
        isNearQuota: false,
        isQuotaExceeded: false
      },
      categories: {},
      recentFiles: [],
      recentFolders: [],
      formatBytes
    });
  }
};

module.exports = {
  getDashboard
};

