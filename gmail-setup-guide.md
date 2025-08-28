# Gmail Inbox Connection Guide

## Quick Setup (10 minutes)

### Step 1: Enable Gmail API
1. Go to https://console.cloud.google.com/
2. Click "Select a Project" → "New Project"
3. Name it "Yus-School-Email"
4. Once created, select the project
5. Click "Enable APIs and Services"
6. Search for "Gmail API" and click Enable

### Step 2: Create OAuth Credentials
1. Go to "Credentials" in the left menu
2. Click "Create Credentials" → "OAuth client ID"
3. If prompted, configure consent screen:
   - Choose "External" 
   - App name: "Yus School Email System"
   - User support email: info@yusmontessori.com
   - Add your email to test users
4. For OAuth client:
   - Application type: "Web application"
   - Name: "Yus Email Client"
   - Authorized redirect URIs: Add `https://developers.google.com/oauthplayground`
5. Click Create
6. **SAVE THESE:**
   - Client ID: (looks like: 123456-abc.apps.googleusercontent.com)
   - Client Secret: (looks like: GOCSPX-xxxxxxxxxxxxx)

### Step 3: Get Refresh Token
1. Go to https://developers.google.com/oauthplayground
2. Click the gear icon (⚙️) → Check "Use your own OAuth credentials"
3. Enter your Client ID and Client Secret from Step 2
4. In the left panel, find "Gmail API v1" and select:
   - `https://www.googleapis.com/auth/gmail.modify`
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/gmail.labels`
5. Click "Authorize APIs"
6. Sign in with info@yusmontessori.com
7. Click "Exchange authorization code for tokens"
8. **COPY THE REFRESH TOKEN** (important!)

### Step 4: Get OpenAI API Key
1. Go to https://platform.openai.com/api-keys
2. Click "Create new secret key"
3. Name it "Yus School"
4. Copy the key (starts with sk-)
5. Add payment method if needed ($5 should last months)

### Step 5: Configure the App
Create a `.env` file in the artifacts folder with your credentials: