# Yus Montessori School Management System

## Project Structure
```
Yuswebapp/
├── artifacts/           # Original project documents and templates
├── client/             # React frontend application
│   ├── src/
│   │   ├── components/ # Login, Dashboard, etc.
│   │   ├── pages/      # Students, Payments, Waitlist, Emails
│   │   ├── services/   # API communication
│   │   └── styles/     # CSS files
│   └── package.json
├── server.js           # Main backend server
├── email-ai-enhanced.js # AI email monitoring system
├── models-combined.js  # Database models
├── routes-*.js        # API route handlers
├── package.json       # Backend dependencies
├── .env               # Environment variables (your credentials)
└── test-gmail-connection.js # Gmail connection tester
```

## Quick Start

### 1. Install Dependencies
```bash
# Backend dependencies (already installed)
npm install

# Frontend dependencies (already installed)
cd client && npm install && cd ..
```

### 2. Configure Gmail & AI
Edit `.env` file with your credentials:
- Gmail OAuth2 credentials
- OpenAI API key
- MongoDB connection

See `gmail-setup-guide.md` for detailed instructions.

### 3. Test Gmail Connection
```bash
node test-gmail-connection.js
```

### 4. Start the Application
```bash
# Terminal 1 - Backend
node server.js

# Terminal 2 - Frontend
cd client && npm start
```

### 5. Access the Application
- Frontend: http://localhost:3000
- Backend API: http://localhost:5001
- Login: admin@yusmontessori.edu / admin123

## Features
- 🔐 Secure login system
- 📧 AI-powered email monitoring
- 📋 Automated waitlist management
- 💰 Payment tracking
- 👨‍👩‍👧‍👦 Student management
- 📊 Dashboard with statistics

## AI Email Features
- Monitors inbox every 3 minutes
- Extracts waitlist applications automatically
- Categorizes emails (Urgent, Waitlist, Payments, etc.)
- Auto-responds to simple inquiries
- Applies Gmail labels for organization