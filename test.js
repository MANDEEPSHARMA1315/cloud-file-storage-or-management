/**
 * Automated Verification & Unit Test Suite
 * Tests application models, S3 integration module, security hashing, and route setup.
 */

const assert = require('assert');
const bcrypt = require('bcryptjs');

async function runTests() {
  console.log('--- STARTING AUTOMATED APPLICATION TESTS ---');
  let passed = 0;
  let failed = 0;

  // Test 1: Load S3 configuration module
  try {
    const s3Module = require('./config/s3');
    assert.strictEqual(typeof s3Module.uploadFile, 'function', 'uploadFile should be a function');
    assert.strictEqual(typeof s3Module.getDownloadUrl, 'function', 'getDownloadUrl should be a function');
    assert.strictEqual(typeof s3Module.getPreviewUrl, 'function', 'getPreviewUrl should be a function');
    assert.strictEqual(typeof s3Module.deleteFile, 'function', 'deleteFile should be a function');
    console.log('✅ Test 1 Passed: S3 module exports valid storage functions.');
    passed++;
  } catch (err) {
    console.error('❌ Test 1 Failed:', err.message);
    failed++;
  }

  // Test 2: User model schema & bcrypt password hashing
  try {
    const User = require('./models/User');
    const testPassword = 'Password123!';
    const user = new User({
      name: 'Test Cloud User',
      email: 'test@cloudstorage.com',
      password: testPassword
    });

    await user.validate();
    // Simulate pre-save hook
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);

    const isMatch = await user.comparePassword(testPassword);
    const isWrong = await user.comparePassword('WrongPassword');

    assert.strictEqual(isMatch, true, 'Valid password should match hashed password');
    assert.strictEqual(isWrong, false, 'Invalid password should not match');
    assert.strictEqual(user.storageQuota, 524288000, 'Default quota should be 500 MB (524288000 bytes)');
    console.log('✅ Test 2 Passed: User model schema, default quota, and bcrypt password hashing succeed.');
    passed++;
  } catch (err) {
    console.error('❌ Test 2 Failed:', err.message);
    failed++;
  }

  // Test 3: File model schema & category virtuals
  try {
    const File = require('./models/File');
    const imageFile = new File({
      originalName: 'holiday_photo.jpg',
      storedName: '12345-holiday_photo.jpg',
      mimeType: 'image/jpeg',
      fileSize: 2097152, // 2 MB
      s3Key: 'users/123/12345-holiday_photo.jpg',
      owner: '507f191e810c19729de860ea'
    });

    assert.strictEqual(imageFile.category, 'image', 'holiday_photo.jpg should have image category');
    assert.strictEqual(imageFile.formattedSize, '2 MB', '2097152 bytes should format to 2 MB');

    const pdfFile = new File({
      originalName: 'invoice_2026.pdf',
      storedName: '12345-invoice_2026.pdf',
      mimeType: 'application/pdf',
      fileSize: 1048576, // 1 MB
      s3Key: 'users/123/12345-invoice_2026.pdf',
      owner: '507f191e810c19729de860ea'
    });
    assert.strictEqual(pdfFile.category, 'pdf', 'invoice_2026.pdf should have pdf category');
    assert.strictEqual(pdfFile.formattedSize, '1 MB', '1048576 bytes should format to 1 MB');

    console.log('✅ Test 3 Passed: File model category detection & size formatting work accurately.');
    passed++;
  } catch (err) {
    console.error('❌ Test 3 Failed:', err.message);
    failed++;
  }

  // Test 4: Folder model schema
  try {
    const Folder = require('./models/Folder');
    const folder = new Folder({
      folderName: 'Important Documents',
      owner: '507f191e810c19729de860ea',
      color: '#4f46e5'
    });
    await folder.validate();
    assert.strictEqual(folder.folderName, 'Important Documents');
    assert.strictEqual(folder.color, '#4f46e5');
    console.log('✅ Test 4 Passed: Folder model validation succeeds.');
    passed++;
  } catch (err) {
    console.error('❌ Test 4 Failed:', err.message);
    failed++;
  }

  // Test 5: Storage formatBytes helper
  try {
    const { formatBytes } = require('./middleware/auth');
    assert.strictEqual(formatBytes(0), '0 B');
    assert.strictEqual(formatBytes(1024), '1 KB');
    assert.strictEqual(formatBytes(1048576), '1 MB');
    assert.strictEqual(formatBytes(1073741824), '1 GB');
    console.log('✅ Test 5 Passed: Storage formatBytes helper returns accurate human-readable strings.');
    passed++;
  } catch (err) {
    console.error('❌ Test 5 Failed:', err.message);
    failed++;
  }

  // Test 6: Verify Express app loading without crashing
  try {
    // Override listening for test run
    const app = require('./app');
    assert.ok(app, 'Express app should be instantiated and exported');
    console.log('✅ Test 6 Passed: Express app and all route definitions load properly.');
    passed++;
  } catch (err) {
    console.error('❌ Test 6 Failed:', err.message);
    failed++;
  }

  console.log(`\n--- TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ---`);
  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('ALL INTEGRITY TESTS PASSED SUCCESSFULLY! 🚀');
    process.exit(0);
  }
}

runTests();

