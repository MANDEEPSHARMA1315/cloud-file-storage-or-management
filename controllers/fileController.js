const File = require('../models/File');
const Folder = require('../models/Folder');
const User = require('../models/User');
const { uploadFile, getDownloadUrl, getPreviewUrl, deleteFile } = require('../config/s3');
const { formatBytes } = require('../middleware/auth');
const path = require('path');
const fs = require('fs');

/**
 * Render My Files Page (with folder navigation, search, sort, filter)
 */
const getFiles = async (req, res) => {
  try {
    const userId = req.user._id;
    const { folderId, category, search, sort, view } = req.query;

    let currentFolder = null;
    let breadcrumbs = [{ name: 'My Files', id: null }];

    // If inside a folder, fetch current folder and breadcrumbs
    if (folderId && folderId !== 'null') {
      currentFolder = await Folder.findOne({ _id: folderId, owner: userId, isTrashed: false });
      if (currentFolder) {
        // Build folder ancestry
        let curr = currentFolder;
        const trail = [];
        while (curr) {
          trail.unshift({ name: curr.folderName, id: curr._id });
          if (curr.parentFolder) {
            curr = await Folder.findOne({ _id: curr.parentFolder, owner: userId, isTrashed: false });
          } else {
            curr = null;
          }
        }
        breadcrumbs = [{ name: 'My Files', id: null }, ...trail];
      }
    }

    // Build query for files
    const fileQuery = {
      owner: userId,
      isTrashed: false,
      folderId: currentFolder ? currentFolder._id : null
    };

    // If searching across files
    if (search && search.trim() !== '') {
      delete fileQuery.folderId; // search globally across files if query given
      fileQuery.originalName = { $regex: search.trim(), $options: 'i' };
    }

    // Sort order
    let sortOption = { uploadedAt: -1 };
    if (sort === 'name-asc') sortOption = { originalName: 1 };
    else if (sort === 'name-desc') sortOption = { originalName: -1 };
    else if (sort === 'date-asc') sortOption = { uploadedAt: 1 };
    else if (sort === 'date-desc') sortOption = { uploadedAt: -1 };
    else if (sort === 'size-desc') sortOption = { fileSize: -1 };
    else if (sort === 'size-asc') sortOption = { fileSize: 1 };

    let files = await File.find(fileQuery).sort(sortOption);

    // Filter by category if requested
    if (category && category !== 'all') {
      files = files.filter(f => f.category === category);
    }

    // Fetch folders in current directory
    const folderQuery = {
      owner: userId,
      isTrashed: false,
      parentFolder: currentFolder ? currentFolder._id : null
    };

    const folders = (search && search.trim() !== '')
      ? await Folder.find({ owner: userId, isTrashed: false, folderName: { $regex: search.trim(), $options: 'i' } })
      : await Folder.find(folderQuery).sort({ folderName: 1 });

    // Fetch all user folders for "Move to folder" modal selection
    const allUserFolders = await Folder.find({ owner: userId, isTrashed: false }).sort({ folderName: 1 });

    res.render('files', {
      title: currentFolder ? `${currentFolder.folderName} - My Files` : 'My Files - Cloud File Storage',
      path: '/files',
      currentFolder,
      breadcrumbs,
      files,
      folders,
      allUserFolders,
      category: category || 'all',
      search: search || '',
      sort: sort || 'date-desc',
      viewMode: view || 'grid',
      formatBytes
    });
  } catch (err) {
    console.error('getFiles error:', err);
    req.flash('error_msg', 'Failed to retrieve files.');
    res.redirect('/dashboard');
  }
};

/**
 * Render Recent Files Page
 */
const getRecentFiles = async (req, res) => {
  try {
    const userId = req.user._id;
    const files = await File.find({ owner: userId, isTrashed: false })
      .sort({ uploadedAt: -1 })
      .limit(30);

    const allUserFolders = await Folder.find({ owner: userId, isTrashed: false }).sort({ folderName: 1 });

    res.render('recent', {
      title: 'Recent Files - Cloud File Storage',
      path: '/recent',
      files,
      allUserFolders,
      formatBytes
    });
  } catch (err) {
    console.error('getRecentFiles error:', err);
    req.flash('error_msg', 'Failed to load recent files.');
    res.redirect('/dashboard');
  }
};

/**
 * Render Trash Page
 */
const getTrash = async (req, res) => {
  try {
    const userId = req.user._id;
    const trashedFiles = await File.find({ owner: userId, isTrashed: true }).sort({ trashedAt: -1 });
    const trashedFolders = await Folder.find({ owner: userId, isTrashed: true }).sort({ trashedAt: -1 });

    res.render('trash', {
      title: 'Trash - Cloud File Storage',
      path: '/trash',
      files: trashedFiles,
      folders: trashedFolders,
      formatBytes
    });
  } catch (err) {
    console.error('getTrash error:', err);
    req.flash('error_msg', 'Failed to load trash items.');
    res.redirect('/dashboard');
  }
};

/**
 * Handle File Upload (Single or Multiple)
 * Uploads to AWS S3, stores metadata in MongoDB, updates user storage quota
 */
const uploadFiles = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = req.user;
    const folderId = req.body.folderId && req.body.folderId !== 'null' ? req.body.folderId : null;

    if (!req.files || req.files.length === 0) {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(400).json({ success: false, message: 'No files were selected for upload.' });
      }
      req.flash('error_msg', 'No files were selected.');
      return res.redirect('back');
    }

    // Calculate total size of newly uploaded files
    const incomingBytes = req.files.reduce((acc, file) => acc + file.size, 0);

    // Quota validation
    if (user.storageUsed + incomingBytes > user.storageQuota) {
      const msg = `Upload exceeded storage quota. You need ${formatBytes(incomingBytes)}, but only have ${formatBytes(Math.max(0, user.storageQuota - user.storageUsed))} available.`;
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(400).json({ success: false, message: msg });
      }
      req.flash('error_msg', msg);
      return res.redirect('back');
    }

    const uploadedRecords = [];

    for (const file of req.files) {
      // Generate clean stored filename and S3 key
      const timestamp = Date.now();
      const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storedName = `${timestamp}-${sanitizedName}`;
      const s3Key = `users/${userId}/${storedName}`;

      // Upload to AWS S3 (or local disk fallback)
      await uploadFile({
        buffer: file.buffer,
        key: s3Key,
        mimeType: file.mimetype || 'application/octet-stream',
        originalName: file.originalname
      });

      // Save file metadata in MongoDB
      const fileRecord = new File({
        originalName: file.originalname,
        storedName,
        mimeType: file.mimetype || 'application/octet-stream',
        fileSize: file.size,
        s3Key,
        owner: userId,
        folderId: folderId || null
      });

      await fileRecord.save();
      uploadedRecords.push(fileRecord);
    }

    // Update user's used storage
    user.storageUsed += incomingBytes;
    await user.save();

    const successMsg = `Successfully uploaded ${uploadedRecords.length} file${uploadedRecords.length > 1 ? 's' : ''}!`;

    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.json({
        success: true,
        message: successMsg,
        files: uploadedRecords
      });
    }

    req.flash('success_msg', successMsg);
    res.redirect('back');
  } catch (err) {
    console.error('uploadFiles error:', err);
    const msg = `Upload error: ${err.message}`;
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(500).json({ success: false, message: msg });
    }
    req.flash('error_msg', msg);
    res.redirect('back');
  }
};

/**
 * Generate Secure Temporary Presigned URL for File Download
 */
const downloadFile = async (req, res) => {
  try {
    const fileId = req.params.id;
    const file = await File.findOne({ _id: fileId, owner: req.user._id });

    if (!file) {
      req.flash('error_msg', 'File not found or access denied.');
      return res.redirect('/files');
    }

    const presignedDownloadUrl = await getDownloadUrl(file.s3Key, file.originalName);
    res.redirect(presignedDownloadUrl);
  } catch (err) {
    console.error('downloadFile error:', err);
    req.flash('error_msg', 'Could not generate download link.');
    res.redirect('/files');
  }
};

/**
 * Generate Secure Temporary Presigned URL for File Preview (Images & PDFs)
 */
const previewFile = async (req, res) => {
  try {
    const fileId = req.params.id;
    const file = await File.findOne({ _id: fileId, owner: req.user._id });

    if (!file) {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(404).json({ success: false, message: 'File not found' });
      }
      req.flash('error_msg', 'File not found.');
      return res.redirect('/files');
    }

    const previewUrl = await getPreviewUrl(file.s3Key, file.mimeType);

    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.json({
        success: true,
        url: previewUrl,
        file: {
          id: file._id,
          name: file.originalName,
          mimeType: file.mimeType,
          category: file.category,
          size: file.formattedSize,
          date: file.uploadedAt
        }
      });
    }

    res.redirect(previewUrl);
  } catch (err) {
    console.error('previewFile error:', err);
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(500).json({ success: false, message: 'Failed to generate preview URL' });
    }
    req.flash('error_msg', 'Preview unavailable.');
    res.redirect('/files');
  }
};

/**
 * Rename File
 */
const renameFile = async (req, res) => {
  try {
    const fileId = req.params.id;
    const { newName } = req.body;

    if (!newName || newName.trim() === '') {
      return res.status(400).json({ success: false, message: 'File name cannot be empty.' });
    }

    const file = await File.findOne({ _id: fileId, owner: req.user._id });
    if (!file) {
      return res.status(404).json({ success: false, message: 'File not found.' });
    }

    // Preserve extension if user did not provide one
    const originalExt = path.extname(file.originalName);
    let finalName = newName.trim();
    if (!path.extname(finalName) && originalExt) {
      finalName += originalExt;
    }

    file.originalName = finalName;
    await file.save();

    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.json({ success: true, message: 'File renamed successfully.', file });
    }

    req.flash('success_msg', 'File renamed successfully.');
    res.redirect('back');
  } catch (err) {
    console.error('renameFile error:', err);
    res.status(500).json({ success: false, message: 'Failed to rename file.' });
  }
};

/**
 * Move File to Folder
 */
const moveFile = async (req, res) => {
  try {
    const fileId = req.params.id;
    const { targetFolderId } = req.body;

    const file = await File.findOne({ _id: fileId, owner: req.user._id });
    if (!file) {
      return res.status(404).json({ success: false, message: 'File not found.' });
    }

    let folderRef = null;
    if (targetFolderId && targetFolderId !== 'null' && targetFolderId !== 'root') {
      const folder = await Folder.findOne({ _id: targetFolderId, owner: req.user._id });
      if (!folder) {
        return res.status(404).json({ success: false, message: 'Target folder not found.' });
      }
      folderRef = folder._id;
    }

    file.folderId = folderRef;
    await file.save();

    res.json({ success: true, message: 'File moved successfully.' });
  } catch (err) {
    console.error('moveFile error:', err);
    res.status(500).json({ success: false, message: 'Failed to move file.' });
  }
};

/**
 * Toggle Star / Favorite on File
 */
const toggleStar = async (req, res) => {
  try {
    const fileId = req.params.id;
    const file = await File.findOne({ _id: fileId, owner: req.user._id });

    if (!file) {
      return res.status(404).json({ success: false, message: 'File not found.' });
    }

    file.isStarred = !file.isStarred;
    await file.save();

    res.json({ success: true, isStarred: file.isStarred });
  } catch (err) {
    console.error('toggleStar error:', err);
    res.status(500).json({ success: false, message: 'Failed to star file.' });
  }
};

/**
 * Soft Delete File (Move to Trash)
 */
const softDeleteFile = async (req, res) => {
  try {
    const fileId = req.params.id;
    const file = await File.findOne({ _id: fileId, owner: req.user._id });

    if (!file) {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(404).json({ success: false, message: 'File not found.' });
      }
      req.flash('error_msg', 'File not found.');
      return res.redirect('back');
    }

    file.isTrashed = true;
    file.trashedAt = new Date();
    await file.save();

    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.json({ success: true, message: 'File moved to Trash.' });
    }

    req.flash('success_msg', 'File moved to Trash.');
    res.redirect('back');
  } catch (err) {
    console.error('softDeleteFile error:', err);
    res.status(500).json({ success: false, message: 'Failed to move file to trash.' });
  }
};

/**
 * Restore File from Trash
 */
const restoreFile = async (req, res) => {
  try {
    const fileId = req.params.id;
    const file = await File.findOne({ _id: fileId, owner: req.user._id, isTrashed: true });

    if (!file) {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(404).json({ success: false, message: 'File not found in trash.' });
      }
      req.flash('error_msg', 'File not found.');
      return res.redirect('/trash');
    }

    file.isTrashed = false;
    file.trashedAt = null;
    await file.save();

    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.json({ success: true, message: 'File restored.' });
    }

    req.flash('success_msg', 'File restored successfully.');
    res.redirect('/trash');
  } catch (err) {
    console.error('restoreFile error:', err);
    res.status(500).json({ success: false, message: 'Failed to restore file.' });
  }
};

/**
 * Permanently Delete File from AWS S3 and MongoDB
 */
const permanentDeleteFile = async (req, res) => {
  try {
    const fileId = req.params.id;
    const file = await File.findOne({ _id: fileId, owner: req.user._id });

    if (!file) {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(404).json({ success: false, message: 'File not found.' });
      }
      req.flash('error_msg', 'File not found.');
      return res.redirect('/trash');
    }

    // 1. Delete from AWS S3
    await deleteFile(file.s3Key);

    // 2. Adjust User storageUsed
    const user = req.user;
    user.storageUsed = Math.max(0, user.storageUsed - file.fileSize);
    await user.save();

    // 3. Remove metadata from MongoDB
    await File.findByIdAndDelete(file._id);

    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.json({ success: true, message: 'File permanently deleted from AWS S3 and database.' });
    }

    req.flash('success_msg', 'File permanently deleted.');
    res.redirect('/trash');
  } catch (err) {
    console.error('permanentDeleteFile error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete file permanently.' });
  }
};

/**
 * Empty Entire Trash for User
 */
const emptyTrash = async (req, res) => {
  try {
    const userId = req.user._id;

    // Find all trashed files
    const trashedFiles = await File.find({ owner: userId, isTrashed: true });

    let reclaimedBytes = 0;
    for (const file of trashedFiles) {
      await deleteFile(file.s3Key);
      reclaimedBytes += file.fileSize;
      await File.findByIdAndDelete(file._id);
    }

    // Delete trashed folders
    await Folder.deleteMany({ owner: userId, isTrashed: true });

    // Update user storage
    const user = req.user;
    user.storageUsed = Math.max(0, user.storageUsed - reclaimedBytes);
    await user.save();

    req.flash('success_msg', `Trash emptied! Reclaimed ${formatBytes(reclaimedBytes)} of storage.`);
    res.redirect('/trash');
  } catch (err) {
    console.error('emptyTrash error:', err);
    req.flash('error_msg', 'Failed to empty trash.');
    res.redirect('/trash');
  }
};

/**
 * Stream/Download local file handler for Local Fallback Mode
 */
const downloadLocal = (req, res) => {
  try {
    const key = decodeURIComponent(req.params.key);
    const downloadName = req.query.name || 'download';
    const filePath = path.join(__dirname, '..', 'public', 'uploads', key);

    if (!fs.existsSync(filePath)) {
      return res.status(404).send('File not found on server');
    }

    res.download(filePath, downloadName);
  } catch (err) {
    console.error('downloadLocal error:', err);
    res.status(500).send('Download failed');
  }
};

module.exports = {
  getFiles,
  getRecentFiles,
  getTrash,
  uploadFiles,
  downloadFile,
  previewFile,
  renameFile,
  moveFile,
  toggleStar,
  softDeleteFile,
  restoreFile,
  permanentDeleteFile,
  emptyTrash,
  downloadLocal
};

