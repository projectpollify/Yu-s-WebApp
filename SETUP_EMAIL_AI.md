# AI Email Monitoring System Setup

## Features
✅ **Automatic Waitlist Processing**
- Extracts child name, parent info, birth date, program type from emails
- Stores data in MongoDB database
- Updates waitlist status (pending → contacted → enrolled)

✅ **Smart Email Categorization**
- Sorts emails into: Waitlist, Urgent, Payments, General
- Applies Gmail labels automatically
- Marks urgent emails with star

✅ **AI-Powered Responses**
- Auto-responds to simple inquiries
- Generates suggested responses for complex emails
- Maintains professional communication

## Setup Instructions

### 1. Gmail API Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Gmail API
4. Create OAuth 2.0 credentials
5. Add https://developers.google.com/oauthplayground to redirect URIs
6. Get your Client ID and Client Secret

### 2. Get Gmail Refresh Token
1. Go to [OAuth Playground](https://developers.google.com/oauthplayground)
2. Select Gmail API v1 scopes:
   - https://www.googleapis.com/auth/gmail.modify
   - https://www.googleapis.com/auth/gmail.send
3. Authorize with your school Gmail account
4. Exchange authorization code for tokens
5. Copy the refresh token

### 3. OpenAI API Key
1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Create an API key
3. Add billing (usage is ~$0.002 per email)

### 4. Environment Variables
Create a `.env` file in the artifacts folder:

```env
# Database
MONGODB_URI=mongodb://localhost:27017/yus-school

# Gmail OAuth2
GMAIL_USER=info@yusmontessori.com
GMAIL_CLIENT_ID=your-client-id-here
GMAIL_CLIENT_SECRET=your-client-secret-here
GMAIL_REFRESH_TOKEN=your-refresh-token-here
GMAIL_REDIRECT_URI=https://developers.google.com/oauthplayground

# OpenAI
OPENAI_API_KEY=your-openai-api-key-here

# JWT Secret
JWT_SECRET=your-secret-key-here
```

### 5. Start the System

```bash
# Install MongoDB locally or use MongoDB Atlas

# Start backend (from artifacts folder)
node server.js

# In another terminal, start frontend
cd client && npm start
```

## How It Works

### Email Processing Flow:
1. **Monitors Inbox** - Checks for unread emails every 3 minutes
2. **AI Analysis** - GPT analyzes email content and extracts data
3. **Data Storage** - Waitlist info saved to database
4. **Organization** - Applies Gmail labels (Waitlist, Urgent, etc.)
5. **Auto-Response** - Sends acknowledgment for waitlist applications

### Dashboard Features:
- View all waitlist applications
- Update status (pending → contacted → enrolled)
- Filter by status or program type
- See statistics and trends

### Example Waitlist Email Format:
```
Subject: YUS Montessori Wait List from [Parent Name]

Mother/Father's Name: [Parent Name]
Email: [parent@email.com]
Phone: [123-456-7890]
Child's Full Name: [Child Name]
Child's Date of Birth: [01/01/2022]
Preferred Start Date: [September 2025]
Select: [Full Day 8:30am - 3:30pm]
```

## Testing Without Real Gmail

For testing, you can:
1. Use sample data in the database
2. Manually add waitlist entries through the API
3. Skip email monitoring (system works without credentials)

## Security Notes
- Never commit `.env` file to git
- Keep API keys secure
- Regularly rotate credentials
- Monitor OpenAI usage/costs

## Support
- MongoDB issues: Check connection string and that MongoDB is running
- Gmail API: Verify scopes and refresh token
- OpenAI: Check API key and billing status