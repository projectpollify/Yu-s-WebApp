# Yus Montessori School Management System

## Project Structure
```
Yuswebapp/
├── backend/            # Backend application
│   ├── models/         # Database models
│   ├── routes/         # API endpoints
│   ├── services/       # Business logic & AI services
│   ├── config/         # Configuration files
│   ├── server.js       # Main server file
│   └── package.json
├── frontend/           # React frontend application
│   ├── src/
│   │   ├── components/ # React components
│   │   ├── pages/      # Page components
│   │   ├── services/   # API services
│   │   └── styles/     # CSS files
│   └── package.json
├── artifacts/          # Original documents
├── .env               # Environment variables
├── package.json       # Root package.json for scripts
└── README.md          # This file
```

## Quick Start

### 1. Install Dependencies
```bash
# Install all dependencies (root, backend, and frontend)
npm run install:all
```

### 2. Configure Gmail & AI
Edit `.env` file with your credentials:
- Gmail OAuth2 credentials
- OpenAI API key
- MongoDB connection

See `gmail-setup-guide.md` for detailed instructions.

### 3. Test Gmail Connection
```bash
cd backend && node services/test-gmail-connection.js
```

### 4. Start the Application
```bash
# From root directory - starts both backend and frontend
npm run dev

# Or run separately:
npm run backend  # Backend on port 5001
npm run frontend # Frontend on port 3000
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

## Deployment
- Backend can be deployed to Heroku, Railway, or AWS
- Frontend can be deployed to Vercel, Netlify, or AWS S3
- Database: MongoDB Atlas for production