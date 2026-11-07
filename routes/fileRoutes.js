const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');
const { ensureAuthenticated } = require('../middleware/auth');
const { upload, handleUploadError } = require('../middleware/upload');

// View Pages (Protected)
router.get('/files', ensureAuthenticated, fileController.getFiles);
router.get('/recent', ensureAuthenticated, fileController.getRecentFiles);
router.get('/trash', ensureAuthenticated, fileController.getTrash);

// File Operations API (Protected)
router.post(
  '/api/files/upload',
  ensureAuthenticated,
  upload.array('files', 10),
  handleUploadError,
  fileController.uploadFiles
);

router.get('/api/files/:id/download', ensureAuthenticated, fileController.downloadFile);
router.get('/api/files/:id/preview', ensureAuthenticated, fileController.previewFile);
router.put('/api/files/:id/rename', ensureAuthenticated, fileController.renameFile);
router.post('/api/files/:id/rename', ensureAuthenticated, fileController.renameFile); // Form support
router.put('/api/files/:id/move', ensureAuthenticated, fileController.moveFile);
router.post('/api/files/:id/move', ensureAuthenticated, fileController.moveFile); // Form support
router.post('/api/files/:id/star', ensureAuthenticated, fileController.toggleStar);
router.delete('/api/files/:id', ensureAuthenticated, fileController.softDeleteFile);
router.post('/api/files/:id/delete', ensureAuthenticated, fileController.softDeleteFile); // Form support
router.post('/api/files/:id/restore', ensureAuthenticated, fileController.restoreFile);
router.delete('/api/files/:id/permanent', ensureAuthenticated, fileController.permanentDeleteFile);
router.post('/api/files/:id/permanent', ensureAuthenticated, fileController.permanentDeleteFile); // Form support
router.post('/api/files/empty-trash', ensureAuthenticated, fileController.emptyTrash);

// Local fallback direct download endpoint (Protected)
router.get('/api/files/download-local/:key', ensureAuthenticated, fileController.downloadLocal);

module.exports = router;

