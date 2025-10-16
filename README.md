# 🎯 SmartTasker - AI-Powered Task Management

An intelligent task management application built with Next.js, Firebase, and Google Gemini AI. SmartTasker helps you organize your tasks with AI-powered priority suggestions, real-time updates, and smart notifications.

[![Next.js](https://img.shields.io/badge/Next.js-15.3-black?logo=next.js)](https://nextjs.org/)
[![Firebase](https://img.shields.io/badge/Firebase-11.9-orange?logo=firebase)](https://firebase.google.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## ✨ Features

- 🔐 **Secure Authentication** - Firebase email/password authentication
- 📝 **Smart Task Creation** - Intuitive form with title, description, due date, and priority
- 🤖 **AI Priority Suggestions** - Google Gemini AI automatically suggests task priorities
- 💾 **Real-time Database** - Firestore with instant cross-device synchronization
- 🔔 **Smart Notifications** - Firebase Cloud Messaging for task reminders
- 📅 **Google Calendar Integration** - Automatically sync tasks to your calendar
- 🎨 **Modern UI/UX** - Beautiful, responsive design with Tailwind CSS and shadcn/ui
- 🔍 **Advanced Filtering** - Filter by status and priority, sort by date or priority
- 📱 **Progressive Web App** - Install on any device, works offline
- 🌙 **Dark Mode Support** - Easy on the eyes, day or night

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Firebase project ([Create one here](https://console.firebase.google.com))
- Google Gemini API key ([Get it here](https://makersuite.google.com/app/apikey))

### Installation

```bash
# Clone the repository (if from GitHub)
git clone https://github.com/YOUR_USERNAME/smart-tasker.git
cd smart-tasker

# Install dependencies
npm install

# Set up environment variables
cp .env.local.example .env.local
# Edit .env.local with your Firebase and Gemini credentials

# Run development server
npm run dev
```

Access the app at **http://localhost:9002**

## Google Calendar Integration Setup

⚠️ **Important**: Before using the Google Calendar integration, you need to set up OAuth credentials.

### Quick Setup (5 minutes)

1. **Get Google OAuth credentials** from [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. **Copy environment template**:
   ```bash
   cp .env.local.example .env.local
   ```
3. **Add your credentials** to `.env.local`
4. **Restart dev server**: `npm run dev`
5. **Verify setup**: `npm run check:calendar`

### Detailed Instructions

- 📚 **Full Setup Guide**: See [GOOGLE_CALENDAR_SETUP.md](./GOOGLE_CALENDAR_SETUP.md)
- 🚀 **Quick Reference**: See [SETUP_QUICKSTART.md](./SETUP_QUICKSTART.md)
- 🔧 **Fix Summary**: See [FIX_SUMMARY.md](./FIX_SUMMARY.md)

### Validate Your Setup

Run the automated setup checker:
```bash
npm run check:calendar
```

This will verify that all required environment variables are properly configured.

## Project Structure

```
src/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   │   └── auth/callback/google/  # OAuth callback handler
│   ├── profile/           # Profile page with calendar integration
│   └── actions.ts         # Server actions
├── ai/                    # Genkit AI flows
│   └── flows/
│       ├── connect-google-calendar.ts
│       └── add-google-calendar-event.ts
├── components/            # React components
└── lib/                   # Utilities and configurations
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript type checking
- `npm run check:calendar` - Validate Google Calendar setup
- `npm run genkit:dev` - Start Genkit development server

## 📸 Screenshots

> Add screenshots of your deployed application here

## 🎬 Demo

> **Live Demo:** [Add your deployment URL here]  
> **Test Account:** `demo@smarttasker.com` / `Demo123!`

## 📚 Documentation

- **[PROJECT_STATUS.md](./PROJECT_STATUS.md)** - Complete project overview and feature status
- **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** - Step-by-step deployment instructions
- **[TESTING_GUIDE.md](./TESTING_GUIDE.md)** - Comprehensive testing checklist
- **[GOOGLE_CALENDAR_SETUP.md](./GOOGLE_CALENDAR_SETUP.md)** - Google Calendar integration setup
- **[SETUP_QUICKSTART.md](./SETUP_QUICKSTART.md)** - Quick reference guide

## Environment Variables

Required environment variables (create `.env.local`):

```bash
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Google Calendar OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
```

See `.env.local.example` for a complete template.

## 🏗️ Tech Stack

### Frontend
- **Framework:** Next.js 15.3 with React 18
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS 3.4
- **UI Components:** shadcn/ui (Radix UI)
- **Forms:** React Hook Form + Zod validation
- **Icons:** Lucide React

### Backend & Services
- **Authentication:** Firebase Auth
- **Database:** Firebase Firestore
- **Notifications:** Firebase Cloud Messaging + Web Push
- **AI:** Google Gemini AI via Genkit
- **Calendar:** Google Calendar API

### Development
- **Build Tool:** Turbopack (Next.js)
- **Type Checking:** TypeScript
- **Linting:** ESLint
- **Package Manager:** npm

## 📖 Usage Guide

### Creating Your First Task

1. **Sign up** for a new account or **log in**
2. Click the **"Add Task"** button
3. Fill in the task details:
   - **Title** (required): "Complete project report"
   - **Description**: "Finalize the Q4 analysis and submit to manager"
   - **Due Date & Time**: Select from calendar
   - **Priority**: Choose low, medium, or high
   - **Reminder**: Set when you want to be notified
4. Click **"✨ Suggest with AI"** for automatic priority suggestion
5. Click **"Add Task"** to save

### AI Priority Suggestions

The AI analyzes your task description and suggests appropriate priorities:

- **"urgent"**, **"asap"**, **"critical"** → High priority
- **"important"**, **"soon"**, **"meeting"** → Medium priority
- **"later"**, **"eventually"**, **"maybe"** → Low priority

### Filtering & Organizing

- **Status Filter:** View all, pending, or completed tasks
- **Priority Filter:** Filter by low, medium, or high priority
- **Sort Options:** By creation date, due date, or priority level

### Notifications

Enable browser notifications to receive reminders:
- **On-time:** At the exact due date/time
- **10-min-before:** 10 minutes before due time
- **1-hour-before:** 1 hour before due time

## 🚀 Deployment

### Deploy to Vercel (Recommended)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel
```

See **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** for detailed instructions.

### Other Platforms

- **Firebase App Hosting:** `firebase deploy --only hosting`
- **Netlify:** Connect GitHub repo or use Netlify CLI
- **Docker:** `docker build -t smart-tasker .` (Dockerfile needed)

## 🧪 Testing

Run the comprehensive test suite:

```bash
# Type checking
npm run typecheck

# Linting
npm run lint

# Build test
npm run build
```

See **[TESTING_GUIDE.md](./TESTING_GUIDE.md)** for manual testing checklist.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Firebase for backend infrastructure
- Google Gemini AI for intelligent suggestions
- shadcn/ui for beautiful components
- Vercel for hosting platform
- The Next.js team for an amazing framework

## 📧 Contact

**Developer:** Gautham Krishna  
**Email:** heyitsgautham@gmail.com  
**Project Link:** [https://github.com/YOUR_USERNAME/smart-tasker](https://github.com/YOUR_USERNAME/smart-tasker)

## 🗺️ Roadmap

- [ ] Task categories/tags
- [ ] Subtasks and checklists
- [ ] Collaborative task sharing
- [ ] Task templates
- [ ] Analytics dashboard
- [ ] Dark/light theme toggle
- [ ] Export tasks (PDF, CSV)
- [ ] Voice input for task creation
- [ ] Integration with more calendar services
- [ ] Mobile apps (iOS/Android)

---

**Built with ❤️ using Next.js and Firebase**

````

## Troubleshooting

### "OAuth client was not found" error

This means your Google OAuth credentials are not configured. Follow the setup guide in [GOOGLE_CALENDAR_SETUP.md](./GOOGLE_CALENDAR_SETUP.md).

### Other Issues

Run the setup validator:
```bash
npm run check:calendar
```

This will check your configuration and provide specific guidance on what needs to be fixed.

## Learn More

To get started, take a look at `src/app/page.tsx`.

