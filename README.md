# Cloud-Based File Storage and Management System

A production-grade, secure, and responsive cloud storage web application inspired by Google Drive, built with **Node.js**, **Express.js**, **EJS**, **MongoDB (Mongoose)**, and **AWS S3 (AWS SDK for JavaScript v3)**.

---

## 🌟 Key Features

### 1. User Authentication & Security
- **User Registration & Login**: Validated credential registration with unique email addresses.
- **Bcrypt Password Hashing**: Passwords are cryptographically salted and hashed using bcrypt before persisting to MongoDB.
- **Session Management**: Secure, HTTP-only session cookies with configurable TTL and secret keys.
- **Protected Routes**: Middleware verifies authentication and ownership before accessing, previewing, downloading, or deleting files.

### 2. AWS S3 Cloud Integration (AWS SDK v3)
- **Direct S3 Upload**: Files are received via Multer memory buffers and uploaded directly to your AWS S3 bucket using `PutObjectCommand`.
- **Short-Lived Presigned URLs**: Files are stored in private buckets. Downloads and previews use temporary, cryptographically signed AWS presigned URLs (`GetObjectCommand` via `@aws-sdk/s3-request-presigner`) with a 15-minute expiration (900 seconds).
- **Direct S3 Deletion**: When files are purged from the Trash, `DeleteObjectCommand` removes the physical object from AWS S3.
- **Credential Safety**: AWS secret keys and tokens remain exclusively in backend environment variables and are never leaked to client-side code.
- **Local Fallback Mode**: If AWS credentials are not configured yet, the app gracefully operates using a local disk storage provider in `/public/uploads`, allowing immediate offline testing.

### 3. File & Folder Management
- **Drag-and-Drop Uploads**: Drag multiple files into the modern dropzone with an interactive AJAX progress bar displaying real-time upload percentages.
- **Nested Folder System**: Create custom folders with color tags, navigate through breadcrumb ancestry, and move files across directories.
- **Inline Previews**: Native modal preview for images (`JPG`, `PNG`, `WEBP`, `GIF`, `SVG`) and `PDF` documents using presigned S3 URLs.
- **File Renaming**: Rename files and folders with validation.
- **Search & Sort**: Filter files instantly by name, sort by date (newest/oldest), size (largest/smallest), or name (A-Z/Z-A), and filter by category (Images, Documents, PDFs, Media, Archives).
- **Favorites / Star**: Star important files for quick reference.

### 4. Storage Quota Monitoring
- **Calculated Storage**: Real-time aggregation of bytes consumed across active files.
- **Visual Storage Bar**: Modern percentage meter with dynamic warning coloring (normal &rarr; yellow at &ge;80% &rarr; red at &ge;95%).
- **Warning Banners**: Alert notifications displayed across dashboard and files when approaching or exceeding quota.
- **Trash & Storage Recovery**: Soft delete to Trash with one-click restore; permanent deletion reclaims user storage quota.
- **Quota Testing Simulator**: In **Profile & Settings**, adjust your quota (e.g. 10 MB, 100 MB, 500 MB, 1 GB, 5 GB) to test warning banners and quota restriction handling.

---

## 🏗️ Project Architecture

```
cloud-file-storage/
├── app.js                          # Express application entrypoint & middleware setup
├── package.json                    # Project dependencies & scripts
├── test.js                         # Automated verification & test suite
├── .env                            # Active environment variables (git-ignored)
├── .env.example                    # Sample environment template
│
├── config/
│   ├── db.js                       # MongoDB connection via Mongoose
│   └── s3.js                       # AWS SDK v3 S3 client & storage provider
│
├── models/
│   ├── User.js                     # User schema (name, email, bcrypt hash, quota)
│   ├── File.js                     # File schema (originalName, s3Key, mimeType, size)
│   └── Folder.js                   # Folder schema (folderName, owner, parentFolder, color)
│
├── controllers/
│   ├── authController.js           # Login, register, logout, profile & password management
│   ├── dashboardController.js      # Dashboard metrics, storage calculation, categories
│   ├── fileController.js           # Upload, presigned download/preview, rename, move, delete
│   └── folderController.js         # Folder CRUD, nested navigation, soft/permanent delete
│
├── routes/
│   ├── authRoutes.js               # /login, /register, /logout, /profile
│   ├── indexRoutes.js              # / (Landing page), /dashboard
│   ├── fileRoutes.js               # /files, /recent, /trash, /api/files/*
│   └── folderRoutes.js             # /folders, /api/folders/*
│
├── middleware/
│   ├── auth.js                     # ensureAuthenticated, ensureGuest, formatBytes
│   └── upload.js                   # Multer configuration, file size limits & MIME validation
│
├── views/
│   ├── index.ejs                   # Public Landing Page
│   ├── login.ejs                   # Sign In view
│   ├── register.ejs                # Sign Up view
│   ├── dashboard.ejs               # Cloud Dashboard with stats & metrics
│   ├── files.ejs                   # My Files (Grid/List views, breadcrumbs, search)
│   ├── folders.ejs                 # My Folders directory explorer
│   ├── recent.ejs                  # Recent files timeline
│   ├── trash.ejs                   # Trash bin with restore & empty trash
│   ├── profile.ejs                 # Profile, password change & quota simulator
│   └── partials/
│       ├── header.ejs              # HTML5 head, Bootstrap 5.3, FontAwesome 6
│       ├── sidebar.ejs             # Sidebar navigation & storage meter
│       ├── topbar.ejs              # Top navigation, search & user dropdown
│       ├── footer.ejs              # Scripts & Bootstrap bundle
│       ├── modals.ejs              # Upload, New Folder, Rename, Move, Delete, Preview
│       ├── toast.ejs               # Flash alerts & live toast container
│       ├── 404.ejs                 # 404 Not Found page
│       └── error.ejs               # 500 Server Error page
│
└── public/
    ├── css/
    │   └── style.css               # Modern styling, animations & theme rules
    ├── js/
    │   └── main.js                 # Drag-and-drop AJAX upload, modal handlers & preview
    └── uploads/                    # Local storage fallback directory
```

---

## 💻 Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | HTML5, CSS3, JavaScript (ES6+) | UI structure, client-side interactions, AJAX upload |
| **Templating** | EJS (Embedded JavaScript) | Dynamic server-side rendering |
| **CSS Framework** | Bootstrap 5.3.3 & Font Awesome 6.5 | Modern responsive layouts & crisp cloud icons |
| **Backend** | Node.js (v18+) & Express.js | REST APIs, route handling, session authentication |
| **Database** | MongoDB & Mongoose ODM | User profiles, file metadata, folder hierarchies |
| **Cloud Storage** | AWS S3 & AWS SDK v3 | Encrypted object storage, presigned URLs, S3 deletion |
| **Security** | bcryptjs, express-session | Salted password hashing, secure session management |
| **File Handling** | Multer | Multipart/form-data upload handling with size checks |

---

## ⚙️ Installation & Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.0.0 or higher recommended)
- [MongoDB](https://www.mongodb.com/) (Local Community Server or MongoDB Atlas free cloud cluster)
- Optional: An [AWS Account](https://aws.amazon.com/) with an S3 Bucket and IAM credentials (the app automatically falls back to local storage if AWS credentials are not yet supplied).

### 1. Clone or Open the Workspace
```bash
cd "cloud file storage"
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Edit `.env` to supply your configuration:
```ini
PORT=3000
NODE_ENV=development
SESSION_SECRET=your_random_secret_session_key_here

# MongoDB Connection String
# Local MongoDB:
MONGODB_URI=mongodb://127.0.0.1:27017/cloud_storage
# OR MongoDB Atlas:
# MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/cloud_storage?retryWrites=true&w=majority

# Storage Provider: 's3' for AWS S3, or 'local' for local offline fallback
STORAGE_PROVIDER=s3

# AWS S3 Settings (Required when STORAGE_PROVIDER=s3)
AWS_REGION=us-east-1
AWS_BUCKET_NAME=your-s3-bucket-name
AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
AWS_SECRET_ACCESS_KEY=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# User Storage Quota (Default: 500 MB = 524288000 bytes)
DEFAULT_STORAGE_QUOTA=524288000
MAX_FILE_SIZE_MB=50
PRESIGNED_URL_EXPIRES_IN=900
```

---

## ☁️ AWS S3 Bucket Configuration Guide

To enable live AWS S3 storage, follow these steps in the [AWS Management Console](https://console.aws.amazon.com/):

### Step 1: Create an S3 Bucket
1. Go to **Amazon S3** &rarr; click **Create bucket**.
2. Enter a unique bucket name (e.g. `my-company-cloud-storage-2026`).
3. Select your preferred AWS Region (e.g. `us-east-1` or `eu-west-1`).
4. **Block Public Access settings for this bucket**: Keep **"Block all public access" ENABLED (Checked)**. This guarantees all files remain private. Access is granted solely through our server-generated presigned URLs.
5. Click **Create bucket**.

### Step 2: Configure Bucket CORS (Cross-Origin Resource Sharing)
Under your bucket's **Permissions** tab &rarr; scroll to **Cross-origin resource sharing (CORS)** &rarr; click **Edit** and paste:
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"]
  }
]
```

### Step 3: Create an IAM User with S3 Permissions
1. Go to the **IAM Console** &rarr; **Users** &rarr; click **Create user** (e.g. `cloud-storage-app-user`).
2. Select **Attach policies directly** &rarr; **Create policy** &rarr; JSON editor:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::your-s3-bucket-name/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": "arn:aws:s3:::your-s3-bucket-name"
    }
  ]
}
```
3. Complete user creation and navigate to **Security credentials** &rarr; **Create access key** (Application running outside AWS).
4. Copy the **Access Key ID** and **Secret Access Key** into your `.env` file.

---

## 🍃 MongoDB Setup Instructions

### Option A: Local MongoDB
1. Ensure the MongoDB service is running on your machine:
   - On Windows: Open Services &rarr; check that `MongoDB Server` is running, or execute `mongod` in a terminal.
2. In `.env`:
   ```ini
   MONGODB_URI=mongodb://127.0.0.1:27017/cloud_storage
   ```

### Option B: MongoDB Atlas (Free Cloud Database)
1. Sign up at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) and create a free M0 cluster.
2. Under **Network Access**, add IP Address `0.0.0.0/0` (Allow access from anywhere).
3. Under **Database Access**, create a database user and password.
4. Click **Connect** &rarr; **Drivers** &rarr; copy the connection string and paste it into `.env`:
   ```ini
   MONGODB_URI=mongodb+srv://admin:YourSecurePassword@cluster0.mongodb.net/cloud_storage?retryWrites=true&w=majority
   ```

---

## 🧪 Testing the Application

### 1. Run Automated Unit Tests
A built-in test suite verifies model validations, bcrypt hashing, S3 SDK methods, virtual category classification, and Express route loading:
```bash
npm test
```
*Expected output: `--- TEST SUMMARY: 6 PASSED, 0 FAILED --- ALL INTEGRITY TESTS PASSED SUCCESSFULLY! 🚀`*

### 2. Start the Development Server
```bash
npm start
```
Open your browser at:
```
http://localhost:3000
```

### 3. Manual Feature Walkthrough Checklist
1. **Landing Page**: Visit `http://localhost:3000` to inspect features, architecture details, and CTAs.
2. **Registration**: Go to `/register` and create an account (e.g. `Alex Morgan`, `alex@example.com`, `Password123!`).
3. **Dashboard**: Verify the storage usage meter shows `0 B of 500 MB (0%)` and category cards are zeroed out.
4. **Create Folder**: Click **New Folder**, name it "Work Documents", select a color theme, and submit.
5. **Drag-and-Drop Upload**: Click **Upload Files**, drag an image or PDF file into the dropzone. Observe the AJAX upload progress bar animate from 0% to 100%.
6. **Preview**: Click the Eye icon on an image or PDF to inspect the modal viewer powered by an S3 presigned URL.
7. **Download**: Click the Download icon to receive the file via a signed Content-Disposition attachment URL.
8. **Rename**: Click the 3-dots menu &rarr; **Rename** to rename the file.
9. **Move to Folder**: Move the file into your "Work Documents" folder.
10. **Trash & Recovery**: Delete the file &rarr; navigate to **Trash** (`/trash`) &rarr; click **Restore** or **Delete Forever**.
11. **Quota Warning Test**: In **Profile & Settings** (`/profile`), select `10 MB (Strict Test)` under Storage Quota Simulator &rarr; click **Apply Quota**. Return to Dashboard and observe the yellow storage warning banner when usage exceeds 80%.

---

## 📡 REST API Reference

| Endpoint | Method | Description | Auth Required |
|---|---|---|---|
| `/register` | POST | Register new user account | Guest |
| `/login` | POST | Authenticate user session | Guest |
| `/logout` | GET | Terminate active user session | Yes |
| `/api/files/upload` | POST | Upload files to AWS S3 & MongoDB | Yes |
| `/api/files/:id/download` | GET | Generate presigned download URL | Yes |
| `/api/files/:id/preview` | GET | Generate presigned inline preview URL | Yes |
| `/api/files/:id/rename` | PUT/POST | Rename a file | Yes |
| `/api/files/:id/move` | PUT/POST | Move file to target folder | Yes |
| `/api/files/:id/star` | POST | Toggle favorite star on a file | Yes |
| `/api/files/:id` | DELETE/POST | Move file to Trash (Soft delete) | Yes |
| `/api/files/:id/restore` | POST | Restore file from Trash | Yes |
| `/api/files/:id/permanent` | DELETE/POST | Purge file permanently from S3 & DB | Yes |
| `/api/files/empty-trash` | POST | Empty entire trash bin | Yes |
| `/api/folders` | POST | Create a new folder | Yes |
| `/api/folders/:id/rename` | PUT/POST | Rename a folder | Yes |
| `/api/folders/:id` | DELETE/POST | Move folder to Trash | Yes |
| `/api/folders/:id/restore` | POST | Restore folder from Trash | Yes |
| `/api/folders/:id/permanent` | DELETE/POST | Permanently delete folder | Yes |
| `/profile` | POST | Update name and email | Yes |
| `/profile/password` | POST | Update password (bcrypt) | Yes |
| `/profile/quota` | POST | Adjust storage quota (MB) | Yes |

---

## 🚀 Deployment Instructions

### Deploy to Render / Railway / Heroku
1. Push your repository to GitHub.
2. In your cloud provider dashboard (e.g. Render, Railway, AWS Elastic Beanstalk), create a new **Web Service**.
3. Set the Environment:
   - Build Command: `npm install`
   - Start Command: `node app.js`
4. Add all environment variables from `.env` into the hosting provider's Environment Variables settings (`MONGODB_URI`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_BUCKET_NAME`, `AWS_REGION`, `SESSION_SECRET`, `NODE_ENV=production`).
5. Deploy service.

### Security Best Practices Implemented
- AWS credentials stored exclusively server-side.
- S3 Buckets maintained with "Block Public Access" enabled.
- Presigned URLs time out automatically after 15 minutes.
- Passwords salted and hashed with bcrypt.
- Strict MIME type and executable file extension blocking.
- User ownership verification on every file/folder request.

---

## 📄 License
This project is open-source and available under the MIT License.

