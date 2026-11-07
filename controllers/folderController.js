const Folder = require('../models/Folder');
const File = require('../models/File');
const { formatBytes } = require('../middleware/auth');

/**
 * Render Folders Explorer Page
 */
const getFolders = async (req, res) => {
  try {
    const userId = req.user._id;

    // Fetch all non-trashed folders
    const folders = await Folder.find({ owner: userId, isTrashed: false }).sort({ createdAt: -1 });

    // Aggregate file count and total size for each folder
    const folderStats = await Promise.all(
      folders.map(async (folder) => {
        const files = await File.find({ owner: userId, folderId: folder._id, isTrashed: false });
        const totalSize = files.reduce((acc, f) => acc + f.fileSize, 0);
        return {
          ...folder.toObject(),
          fileCount: files.length,
          totalSize,
          formattedSize: formatBytes(totalSize)
        };
      })
    );

    res.render('folders', {
      title: 'My Folders - Cloud File Storage',
      path: '/folders',
      folders: folderStats,
      formatBytes
    });
  } catch (err) {
    console.error('getFolders error:', err);
    req.flash('error_msg', 'Failed to load folders.');
    res.redirect('/dashboard');
  }
};

/**
 * Create a New Folder
 */
const createFolder = async (req, res) => {
  try {
    const { folderName, parentFolderId, color } = req.body;
    const userId = req.user._id;

    if (!folderName || folderName.trim() === '') {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(400).json({ success: false, message: 'Folder name is required.' });
      }
      req.flash('error_msg', 'Folder name cannot be blank.');
      return res.redirect('back');
    }

    // Check duplicate in same directory
    const existing = await Folder.findOne({
      owner: userId,
      parentFolder: parentFolderId && parentFolderId !== 'null' ? parentFolderId : null,
      folderName: folderName.trim(),
      isTrashed: false
    });

    if (existing) {
      const msg = 'A folder with this name already exists here.';
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(400).json({ success: false, message: msg });
      }
      req.flash('error_msg', msg);
      return res.redirect('back');
    }

    const newFolder = new Folder({
      folderName: folderName.trim(),
      owner: userId,
      parentFolder: parentFolderId && parentFolderId !== 'null' ? parentFolderId : null,
      color: color || '#4f46e5'
    });

    await newFolder.save();

    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.json({ success: true, message: 'Folder created successfully.', folder: newFolder });
    }

    req.flash('success_msg', `Folder "${newFolder.folderName}" created successfully.`);
    res.redirect('back');
  } catch (err) {
    console.error('createFolder error:', err);
    const msg = 'Failed to create folder.';
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(500).json({ success: false, message: msg });
    }
    req.flash('error_msg', msg);
    res.redirect('back');
  }
};

/**
 * Rename Folder
 */
const renameFolder = async (req, res) => {
  try {
    const folderId = req.params.id;
    const { folderName, color } = req.body;

    if (!folderName || folderName.trim() === '') {
      return res.status(400).json({ success: false, message: 'Folder name cannot be empty.' });
    }

    const folder = await Folder.findOne({ _id: folderId, owner: req.user._id });
    if (!folder) {
      return res.status(404).json({ success: false, message: 'Folder not found.' });
    }

    folder.folderName = folderName.trim();
    if (color) folder.color = color;
    await folder.save();

    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.json({ success: true, message: 'Folder renamed successfully.', folder });
    }

    req.flash('success_msg', 'Folder renamed successfully.');
    res.redirect('back');
  } catch (err) {
    console.error('renameFolder error:', err);
    res.status(500).json({ success: false, message: 'Failed to rename folder.' });
  }
};

/**
 * Soft Delete Folder (Move folder and its files to trash)
 */
const softDeleteFolder = async (req, res) => {
  try {
    const folderId = req.params.id;
    const folder = await Folder.findOne({ _id: folderId, owner: req.user._id });

    if (!folder) {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(404).json({ success: false, message: 'Folder not found.' });
      }
      req.flash('error_msg', 'Folder not found.');
      return res.redirect('back');
    }

    folder.isTrashed = true;
    folder.trashedAt = new Date();
    await folder.save();

    // Also trash all files directly in this folder
    await File.updateMany(
      { owner: req.user._id, folderId: folder._id },
      { $set: { isTrashed: true, trashedAt: new Date() } }
    );

    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.json({ success: true, message: 'Folder moved to Trash.' });
    }

    req.flash('success_msg', `Folder "${folder.folderName}" moved to Trash.`);
    res.redirect('back');
  } catch (err) {
    console.error('softDeleteFolder error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete folder.' });
  }
};

/**
 * Restore Folder from Trash
 */
const restoreFolder = async (req, res) => {
  try {
    const folderId = req.params.id;
    const folder = await Folder.findOne({ _id: folderId, owner: req.user._id, isTrashed: true });

    if (!folder) {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(404).json({ success: false, message: 'Folder not found in trash.' });
      }
      req.flash('error_msg', 'Folder not found in trash.');
      return res.redirect('/trash');
    }

    folder.isTrashed = false;
    folder.trashedAt = null;
    await folder.save();

    // Restore files that were inside this folder
    await File.updateMany(
      { owner: req.user._id, folderId: folder._id, isTrashed: true },
      { $set: { isTrashed: false, trashedAt: null } }
    );

    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.json({ success: true, message: 'Folder and contents restored.' });
    }

    req.flash('success_msg', `Folder "${folder.folderName}" restored.`);
    res.redirect('/trash');
  } catch (err) {
    console.error('restoreFolder error:', err);
    res.status(500).json({ success: false, message: 'Failed to restore folder.' });
  }
};

/**
 * Permanently Delete Folder
 */
const permanentDeleteFolder = async (req, res) => {
  try {
    const folderId = req.params.id;
    const folder = await Folder.findOne({ _id: folderId, owner: req.user._id });

    if (!folder) {
      return res.status(404).json({ success: false, message: 'Folder not found.' });
    }

    // Unlink any files in this folder to root or keep them trashed
    await File.updateMany({ owner: req.user._id, folderId: folder._id }, { $set: { folderId: null } });
    await Folder.findByIdAndDelete(folderId);

    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.json({ success: true, message: 'Folder permanently deleted.' });
    }

    req.flash('success_msg', 'Folder permanently removed.');
    res.redirect('/trash');
  } catch (err) {
    console.error('permanentDeleteFolder error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete folder permanently.' });
  }
};

module.exports = {
  getFolders,
  createFolder,
  renameFolder,
  softDeleteFolder,
  restoreFolder,
  permanentDeleteFolder
};

