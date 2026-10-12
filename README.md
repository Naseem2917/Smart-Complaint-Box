# 🗳️ Smart Complaint Box

> AI-Powered Complaint Management System built with React, TypeScript & Firebase

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript)
![Firebase](https://img.shields.io/badge/Firebase-12-FFCA28?logo=firebase)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?logo=tailwindcss)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite)

## 🌐 Live Demo

**[https://smart-complaint-box-2025.web.app](https://smart-complaint-box-2025.web.app)**

---

## ✨ Features

### 👤 User Features
- **📝 Submit Complaints** - Easy complaint submission with image upload
- **🤖 AI Auto-Detection** - Real-time AI analysis while typing (2-second debounce)
- **🧠 Smart Category & Priority** - AI automatically suggests category and priority
- **🚫 Gibberish Detection** - AI detects invalid text and warns users
- **📊 Real-time Tracking** - Track complaint status live
- **🕵️ Anonymous Submission** - Option to submit anonymously
- **📜 Complaint History** - View all your past complaints
- **🔔 Status Notifications** - Get updates on your complaints

### 🆕 Group Complaints (Petition System)
- **✍️ Create Petitions** - Start a group complaint for common issues
- **🔗 Share Links** - Share 7-day valid links via WhatsApp and other apps
- **👥 Collect Signatures** - Other students can sign to support
- **💥 Dhamaka Badge** - Complaints with 10+ signatures get highlighted
- **🔒 One Sign Per User** - Each user can only sign once
- **📈 Progress Tracking** - See how close to Dhamaka status

### 🔐 Admin Features
- **📈 Dashboard** - Comprehensive overview of all complaints
- **⚡ Priority Management** - AI-suggested priority levels
- **📊 Analytics** - Interactive charts and insights (Recharts)
- **📝 Admin Notes** - Add internal notes to complaints
- **👤 Assignment** - Assign complaints to team members
- **🔒 Password Protected** - Secure admin access
- **📋 Category Management** - Add/edit categories with icon picker (30+ emojis)
- **💥 Group Complaints View** - See all petitions with expandable supporter lists

### 🎨 UI/UX Features
- **🌙 Dark Mode** - Eye-friendly dark theme (system-aware)
- **📱 Responsive Design** - Works on all devices
- **✨ Smooth Animations** - Framer Motion powered transitions
- **🎨 Modern UI** - Clean, glassmorphic design
- **📦 Collapsible Sections** - Category & Priority in one expandable card

---

## 🛠️ Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19 | Frontend Framework |
| TypeScript | 5.9 | Type Safety |
| Vite | 7 | Build Tool & Dev Server |
| Tailwind CSS | 3.4 | Utility-first Styling |
| Firebase Auth | 12 | Google Authentication |
| Firestore | 12 | NoSQL Database |
| Framer Motion | 12 | Animations |
| Recharts | 3.6 | Analytics Charts |
| Lucide React | - | Beautiful Icons |
| date-fns | 4 | Date Formatting |
| Google Gemini API | - | AI Analysis |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (recommended: 20+)
- npm or yarn
- Firebase account
- Google AI API key (for Gemini)

### Installation

```bash
# Clone the repository
git clone https://github.com/naseem-2917/Smart-Complaint-Box.git

# Navigate to project
cd Smart-Complaint-Box

# Install dependencies
npm install

# Start development server
npm run dev
```

### Environment Setup

Create a `.env` file in the root directory:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_GEMINI_API_KEY=your_gemini_api_key
```

### Firebase Setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Authentication** → Google Sign-In
3. Create **Firestore Database** (Start in test mode)
4. Update your `.env` file with Firebase config
5. Deploy security rules from `firestore.rules`

---

## 📁 Project Structure

```
Smart-Complaint-Box/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── common/          # Buttons, Cards, Inputs, etc.
│   │   └── layout/          # Header, Footer, Sidebar
│   ├── context/             # React Context providers
│   │   ├── AuthContext      # Authentication state
│   │   └── NotificationContext # Toast notifications
│   ├── pages/               # Page components
│   │   ├── auth/            # Login, Signup, Profile
│   │   ├── user/            # Dashboard, Submit, History
│   │   │   ├── SubmitComplaintPage    # AI-powered submission
│   │   │   ├── CreateGroupComplaintPage  # Start petitions
│   │   │   └── SignGroupComplaintPage    # Sign petitions
│   │   └── admin/           # Admin panel & analytics
│   │       ├── AdminDashboardPage     # Overview
│   │       ├── AdminCategoriesPage    # Manage categories
│   │       └── AdminGroupComplaintsPage # Manage petitions
│   ├── services/            # Firebase & API services
│   │   ├── ai.ts            # AI analysis (Gemini)
│   │   ├── complaints.ts    # Complaint CRUD operations
│   │   ├── groupComplaints.ts # Petition system
│   │   ├── categories.ts    # Category management
│   │   └── firebase.ts      # Firebase configuration
│   ├── utils/               # Utility functions
│   │   └── imageCompressor.ts # Client-side image compression
│   └── types/               # TypeScript type definitions
├── public/                  # Static assets
└── dist/                    # Production build
```

---

## 🔑 Admin Access

1. Navigate to `/admin` in the app
2. Login with your Google account
3. Enter admin password: `admin@123`

> ⚠️ **Note:** Change the default admin password in production!

---

## 📱 Features Breakdown

| Feature | Description |
|---------|-------------|
| 🤖 AI Analysis | Auto-categorizes & prioritizes with gibberish detection |
| 📸 Image Compression | Client-side compression (800px, 50% quality) |
| ⏱️ Real-time Updates | Live status updates via Firestore |
| 💥 Group Complaints | Petition system with Dhamaka highlighting |
| 📊 Analytics Dashboard | Visual charts with Recharts |
| 🌙 Dark Mode | System-aware dark/light theme |
| 📱 Mobile First | Responsive design for all devices |
| 🔒 Secure | Firebase Auth + Firestore security rules |
| ✨ Animations | Smooth transitions with Framer Motion |
| 🎨 Icon Picker | 30+ emoji icons for categories |

---

## 🖼️ Image Handling

Images are compressed client-side before storage:
- **Max Width:** 800px (maintains aspect ratio)
- **Format:** JPEG
- **Quality:** 50%
- **Storage:** Base64 in Firestore (no Firebase Storage required)

---

## 💥 Group Complaints System

The petition/group complaint system allows students to:
1. **Create** a complaint with title, description, category, priority
2. **Share** a unique link (valid for 7 days)
3. **Collect** signatures from other students
4. **Achieve Dhamaka** status at 10+ signatures

Admins see:
- Total petitions and signature counts
- Filter by All/Dhamaka/Pending/Resolved
- Expandable supporter list (names & emails)
- Status management dropdown

---

## 📜 Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

---

## 🚀 Deployment

### Firebase Hosting

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize hosting
firebase init hosting

# Build & Deploy
npm run build
firebase deploy
```

---

## 📄 License

MIT License - feel free to use for your projects!

---

## 👥 Authors & Team

This project was built collaboratively by:

- **Naseem** — [@Naseem2917](https://github.com/Naseem2917/)
- **Ankit Shrivastava** — [@shrivastavaankit-2006](https://github.com/shrivastavaankit-2006/)
- **Shani** — [@shani0136](https://github.com/shani0136/)

---

<div align="center">

⭐ **Star this repo if you found it helpful!**

Made with ❤️ using React + TypeScript + Gemini AI

</div>
