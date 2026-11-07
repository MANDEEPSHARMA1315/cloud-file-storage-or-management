const express = require('express');
const router = express.Router();
const folderController = require('../controllers/folderController');
const { ensureAuthenticated } = require('../middleware/auth');

// View Page (Protected)
router.get('/folders', ensureAuthenticated, folderController.getFolders);

// Folder Operations API (Protected)
router.post('/api/folders', ensureAuthenticated, folderController.createFolder);
router.put('/api/folders/:id/rename', ensureAuthenticated, folderController.renameFolder);
router.post('/api/folders/:id/rename', ensureAuthenticated, folderController.renameFolder); // Form support
router.delete('/api/folders/:id', ensureAuthenticated, folderController.softDeleteFolder);
router.post('/api/folders/:id/delete', ensureAuthenticated, folderController.softDeleteFolder); // Form support
router.post('/api/folders/:id/restore', ensureAuthenticated, folderController.restoreFolder);
router.delete('/api/folders/:id/permanent', ensureAuthenticated, folderController.permanentDeleteFolder);
router.post('/api/folders/:id/permanent', ensureAuthenticated, folderController.permanentDeleteFolder); // Form support

module.exports = router;

