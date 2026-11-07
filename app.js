require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const morgan = require('morgan');
const mongoose = require('mongoose');
const connectDB = require('./config/db');

// Initialize Express App
const app = express();

// Connect to MongoDB
connectDB();

// View Engine Setup (EJS)
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// HTTP Request Logger
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Method Override for RESTful forms
app.use(methodOverride('_method'));

// Static Files
app.use(express.static(path.join(__dirname, 'public')));

// Session Configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'cloud_file_storage_secret_key_default',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24 // 24 hours
    }
  })
);

// Flash Messages
app.use(flash());

// Global Template Variables Middleware
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.currentUser = null;
  res.locals.storageInfo = null;
  res.locals.currentPath = req.path;
  res.locals.storageProvider = process.env.STORAGE_PROVIDER || 's3';
  res.locals.isDbConnected = mongoose.connection.readyState === 1;
  next();
});

// Import Routes
const indexRoutes = require('./routes/indexRoutes');
const authRoutes = require('./routes/authRoutes');
const fileRoutes = require('./routes/fileRoutes');
const folderRoutes = require('./routes/folderRoutes');

// Mount Routes
app.use('/', indexRoutes);
app.use('/', authRoutes);
app.use('/', fileRoutes);
app.use('/', folderRoutes);

// 404 Page Handler
app.use((req, res) => {
  res.status(404).render('partials/404', {
    title: '404 - Page Not Found',
    path: req.path
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Application Error:', err);
  const status = err.status || 500;
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(status).json({
      success: false,
      message: err.message || 'Internal Server Error'
    });
  }
  res.status(status).render('partials/error', {
    title: 'Error - Something Went Wrong',
    status,
    message: err.message || 'Internal Server Error',
    path: req.path
  });
});

// Start Server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`  Cloud File Storage System running on port ${PORT}`);
  console.log(`  Local URL: http://localhost:${PORT}`);
  console.log(`  Storage Mode: ${process.env.STORAGE_PROVIDER || 's3'}`);
  console.log(`====================================================`);
});

module.exports = app;

