const User = require('../models/User');
const File = require('../models/File');
const Folder = require('../models/Folder');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

/**
 * Render Login Page
 */
const getLogin = (req, res) => {
  res.render('login', {
    title: 'Sign In - Cloud File Storage',
    path: '/login'
  });
};

/**
 * Render Registration Page
 */
const getRegister = (req, res) => {
  res.render('register', {
    title: 'Create Account - Cloud File Storage',
    path: '/register'
  });
};

/**
 * Handle Registration
 */
const postRegister = async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      req.flash('error_msg', 'Database connection error: MongoDB is not connected. Please ensure MongoDB service is running locally or set MONGODB_URI in your .env file.');
      return res.redirect('/register');
    }

    const { name, email, password, confirmPassword } = req.body;

    const errors = [];
    if (!name || !email || !password) {
      errors.push('Please fill in all required fields.');
    }
    if (password && password.length < 6) {
      errors.push('Password must be at least 6 characters.');
    }
    if (password !== confirmPassword) {
      errors.push('Passwords do not match.');
    }

    if (errors.length > 0) {
      req.flash('error_msg', errors.join(' '));
      return res.render('register', {
        title: 'Create Account - Cloud File Storage',
        path: '/register',
        name,
        email
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      req.flash('error_msg', 'An account with this email address already exists.');
      return res.render('register', {
        title: 'Create Account - Cloud File Storage',
        path: '/register',
        name,
        email
      });
    }

    // Create user
    const newUser = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password
    });

    await newUser.save();

    // Auto login after registration
    req.session.userId = newUser._id;
    req.flash('success_msg', `Welcome to Cloud Storage, ${newUser.name}! Your account has been created.`);
    res.redirect('/dashboard');
  } catch (err) {
    console.error('Registration error:', err);
    req.flash('error_msg', 'Registration failed. Please check your details and try again.');
    res.redirect('/register');
  }
};

/**
 * Handle Login
 */
const postLogin = async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      req.flash('error_msg', 'Database connection error: MongoDB is not connected. Please ensure MongoDB service is running locally or set MONGODB_URI in your .env file.');
      return res.redirect('/login');
    }

    const { email, password } = req.body;

    if (!email || !password) {
      req.flash('error_msg', 'Please provide both email and password.');
      return res.redirect('/login');
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      const totalUsers = await User.countDocuments();
      if (totalUsers === 0) {
        req.flash('error_msg', 'No accounts found in database. Please click "Create an account" below to register first!');
        return res.redirect('/login');
      }
      req.flash('error_msg', 'Invalid email address or password.');
      return res.redirect('/login');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      req.flash('error_msg', 'Invalid email address or password.');
      return res.redirect('/login');
    }

    // Set user session
    req.session.userId = user._id;
    req.flash('success_msg', `Welcome back, ${user.name}!`);
    res.redirect('/dashboard');
  } catch (err) {
    console.error('Login error:', err);
    req.flash('error_msg', 'An error occurred during sign in. Please try again.');
    res.redirect('/login');
  }
};

/**
 * Handle Logout
 */
const getLogout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
};

/**
 * Render Profile & Settings Page
 */
const getProfile = async (req, res) => {
  try {
    const user = req.user;
    const fileCount = await File.countDocuments({ owner: user._id, isTrashed: false });
    const folderCount = await Folder.countDocuments({ owner: user._id, isTrashed: false });
    const trashedCount = await File.countDocuments({ owner: user._id, isTrashed: true });

    res.render('profile', {
      title: 'Profile & Settings - Cloud File Storage',
      path: '/profile',
      user,
      stats: {
        fileCount,
        folderCount,
        trashedCount
      }
    });
  } catch (err) {
    console.error('Profile render error:', err);
    req.flash('error_msg', 'Could not load profile details.');
    res.redirect('/dashboard');
  }
};

/**
 * Update Profile Information
 */
const updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body;
    const user = req.user;

    if (!name || !email) {
      req.flash('error_msg', 'Name and email are required.');
      return res.redirect('/profile');
    }

    // Check email uniqueness if modified
    if (email.toLowerCase() !== user.email.toLowerCase()) {
      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing) {
        req.flash('error_msg', 'This email is already registered by another account.');
        return res.redirect('/profile');
      }
      user.email = email.toLowerCase().trim();
    }

    user.name = name.trim();
    await user.save();

    req.flash('success_msg', 'Profile information updated successfully.');
    res.redirect('/profile');
  } catch (err) {
    console.error('Update profile error:', err);
    req.flash('error_msg', 'Failed to update profile.');
    res.redirect('/profile');
  }
};

/**
 * Change Password
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;
    const user = req.user;

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      req.flash('error_msg', 'Please fill in all password fields.');
      return res.redirect('/profile');
    }

    if (newPassword.length < 6) {
      req.flash('error_msg', 'New password must be at least 6 characters.');
      return res.redirect('/profile');
    }

    if (newPassword !== confirmNewPassword) {
      req.flash('error_msg', 'New passwords do not match.');
      return res.redirect('/profile');
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      req.flash('error_msg', 'Incorrect current password.');
      return res.redirect('/profile');
    }

    user.password = newPassword;
    await user.save();

    req.flash('success_msg', 'Password successfully changed.');
    res.redirect('/profile');
  } catch (err) {
    console.error('Change password error:', err);
    req.flash('error_msg', 'Failed to change password.');
    res.redirect('/profile');
  }
};

/**
 * Adjust Storage Quota (Useful for testing quota warnings & limits)
 */
const updateStorageQuota = async (req, res) => {
  try {
    const { quotaMB } = req.body;
    const parsedMB = parseInt(quotaMB, 10);
    
    if (isNaN(parsedMB) || parsedMB <= 0) {
      req.flash('error_msg', 'Please enter a valid quota in MB.');
      return res.redirect('/profile');
    }

    const user = req.user;
    user.storageQuota = parsedMB * 1024 * 1024;
    await user.save();

    req.flash('success_msg', `Storage quota updated to ${parsedMB} MB.`);
    res.redirect('/profile');
  } catch (err) {
    console.error('Quota update error:', err);
    req.flash('error_msg', 'Failed to update storage quota.');
    res.redirect('/profile');
  }
};

module.exports = {
  getLogin,
  getRegister,
  postRegister,
  postLogin,
  getLogout,
  getProfile,
  updateProfile,
  changePassword,
  updateStorageQuota
};

