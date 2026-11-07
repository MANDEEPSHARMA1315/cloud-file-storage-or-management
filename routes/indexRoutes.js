const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { ensureAuthenticated } = require('../middleware/auth');

// Landing Page (Public)
router.get('/', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/dashboard');
  }
  res.render('index', {
    title: 'Cloud-Based File Storage and Management System',
    path: '/'
  });
});

// Dashboard (Protected)
router.get('/dashboard', ensureAuthenticated, dashboardController.getDashboard);

module.exports = router;

