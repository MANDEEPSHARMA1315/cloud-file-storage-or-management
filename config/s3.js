const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const fs = require('fs');
const path = require('path');

// Determine if AWS credentials are validly configured
const isS3Configured = () => {
  const provider = (process.env.STORAGE_PROVIDER || 's3').toLowerCase();
  const keyId = process.env.AWS_ACCESS_KEY_ID || '';
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY || '';
  const bucket = process.env.AWS_BUCKET_NAME || '';

  return (
    provider === 's3' &&
    keyId.trim() !== '' &&
    keyId !== 'your_aws_access_key_id_here' &&
    secretKey.trim() !== '' &&
    secretKey !== 'your_aws_secret_access_key_here' &&
    bucket.trim() !== '' &&
    bucket !== 'my-cloud-storage-bucket-2026'
  );
};

// Local storage fallback directory
const localStorageDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(localStorageDir)) {
  fs.mkdirSync(localStorageDir, { recursive: true });
}

// Instantiate AWS S3 Client (AWS SDK for JavaScript v3)
let s3Client = null;

if (isS3Configured()) {
  s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
  console.log(`[Storage] AWS S3 Client initialized for bucket: ${process.env.AWS_BUCKET_NAME} (${process.env.AWS_REGION})`);
} else {
  console.log(`[Storage] Running in Local Storage Fallback Mode. Files will be saved to /public/uploads.`);
  console.log(`[Storage] To use AWS S3, set real AWS credentials and bucket in .env`);
}

/**
 * Upload file to AWS S3 or Local Storage
 */
const uploadFile = async ({ buffer, key, mimeType, originalName }) => {
  if (isS3Configured() && s3Client) {
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      Metadata: {
        originalname: encodeURIComponent(originalName),
      },
    });
    return await s3Client.send(command);
  } else {
    // Local fallback: write to public/uploads
    const filePath = path.join(localStorageDir, key);
    await fs.promises.writeFile(filePath, buffer);
    return { key, localPath: filePath };
  }
};

/**
 * Generate temporary Presigned URL for File Download (Content-Disposition: attachment)
 */
const getDownloadUrl = async (key, originalName) => {
  const expiresIn = parseInt(process.env.PRESIGNED_URL_EXPIRES_IN, 10) || 900; // 15 mins

  if (isS3Configured() && s3Client) {
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent(originalName)}"`,
    });
    return await getSignedUrl(s3Client, command, { expiresIn });
  } else {
    // Local mode direct download route
    return `/api/files/download-local/${encodeURIComponent(key)}?name=${encodeURIComponent(originalName)}`;
  }
};

/**
 * Generate temporary Presigned URL for File Preview (Content-Disposition: inline)
 */
const getPreviewUrl = async (key, mimeType) => {
  const expiresIn = parseInt(process.env.PRESIGNED_URL_EXPIRES_IN, 10) || 900;

  if (isS3Configured() && s3Client) {
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      ResponseContentType: mimeType,
      ResponseContentDisposition: 'inline',
    });
    return await getSignedUrl(s3Client, command, { expiresIn });
  } else {
    // Local mode direct preview route
    return `/uploads/${encodeURIComponent(key)}`;
  }
};

/**
 * Delete file from AWS S3 or Local Storage
 */
const deleteFile = async (key) => {
  if (isS3Configured() && s3Client) {
    const command = new DeleteObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
    });
    return await s3Client.send(command);
  } else {
    const filePath = path.join(localStorageDir, key);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
    return { deleted: true };
  }
};

module.exports = {
  s3Client,
  isS3Configured,
  uploadFile,
  getDownloadUrl,
  getPreviewUrl,
  deleteFile,
};

