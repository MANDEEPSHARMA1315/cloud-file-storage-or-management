const multer = require('multer');
const path = require('path');

// Configure Multer to use in-memory storage for efficient S3 streaming
const storage = multer.memoryStorage();

// Disallowed dangerous executable extensions
const BLOCKED_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.sh', '.bash', '.vbs', '.msi', '.com', '.scr',
  '.pif', '.application', '.gadget', '.hta', '.cpl', '.msc', '.jar', '.php',
  '.jsp', '.asp', '.aspx', '.cgi', '.pl'
];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (BLOCKED_EXTENSIONS.includes(ext)) {
    return cb(
      new Error(`Security Restriction: Executable file types (${ext}) are not permitted for upload.`),
      false
    );
  }

  // Accept all other document, image, audio, video, archive and data formats
  cb(null, true);
};

const maxFileSizeMB = parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 50;

const upload = multer({
  storage,
  limits: {
    fileSize: maxFileSizeMB * 1024 * 1024, // in bytes
    files: 10 // Allow up to 10 files in a single batch
  },
  fileFilter
});

// Middleware wrapper to handle Multer errors gracefully
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const msg = `File is too large. Maximum allowed size is ${maxFileSizeMB} MB.`;
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(400).json({ success: false, message: msg });
      }
      req.flash('error_msg', msg);
      return res.redirect('back');
    }
    const msg = `Upload Error: ${err.message}`;
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(400).json({ success: false, message: msg });
    }
    req.flash('error_msg', msg);
    return res.redirect('back');
  } else if (err) {
    const msg = err.message || 'File upload failed';
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(400).json({ success: false, message: msg });
    }
    req.flash('error_msg', msg);
    return res.redirect('back');
  }
  next();
};

module.exports = {
  upload,
  handleUploadError
};

