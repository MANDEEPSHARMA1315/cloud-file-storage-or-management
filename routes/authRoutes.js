const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { ensureAuthenticated, ensureGuest } = require('../middleware/auth');

// Public Guest Routes
router.get('/login', ensureGuest, authController.getLogin);
router.post('/login', ensureGuest, authController.postLogin);
router.get('/register', ensureGuest, authController.getRegister);
router.post('/register', ensureGuest, authController.postRegister);

// Logout
router.get('/logout', authController.getLogout);

// Profile and Settings (Protected)
router.get('/profile', ensureAuthenticated, authController.getProfile);
router.post('/profile', ensureAuthenticated, authController.updateProfile);
router.post('/profile/password', ensureAuthenticated, authController.changePassword);
router.post('/profile/quota', ensureAuthenticated, authController.updateStorageQuota);

module.exports = router;

