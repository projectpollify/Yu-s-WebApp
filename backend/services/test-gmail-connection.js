require('dotenv').config();
const { google } = require('googleapis');

async function testGmailConnection() {
  console.log('Testing Gmail Connection...\n');
  
  // Check if credentials are set
  if (!process.env.GMAIL_CLIENT_ID || process.env.GMAIL_CLIENT_ID === 'paste-your-client-id-here') {
    console.error('❌ Gmail Client ID not set in .env file');
    return;
  }
  
  if (!process.env.GMAIL_CLIENT_SECRET || process.env.GMAIL_CLIENT_SECRET === 'paste-your-client-secret-here') {
    console.error('❌ Gmail Client Secret not set in .env file');
    return;
  }
  
  if (!process.env.GMAIL_REFRESH_TOKEN || process.env.GMAIL_REFRESH_TOKEN === 'paste-your-refresh-token-here') {
    console.error('❌ Gmail Refresh Token not set in .env file');
    return;
  }
  
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'paste-your-openai-key-here') {
    console.error('⚠️  OpenAI API Key not set - AI features will be disabled');
  }
  
  try {
    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );

    // Set credentials
    oauth2Client.setCredentials({
      refresh_token: process.env.GMAIL_REFRESH_TOKEN
    });

    // Initialize Gmail API
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    // Test: Get user profile
    console.log('Fetching Gmail profile...');
    const profile = await gmail.users.getProfile({ userId: 'me' });
    console.log('✅ Connected to Gmail:', profile.data.emailAddress);
    console.log('📊 Total messages:', profile.data.messagesTotal);
    
    // Test: List recent messages
    console.log('\nFetching recent messages...');
    const messages = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 5,
      q: 'is:unread'
    });
    
    if (messages.data.messages) {
      console.log(`✅ Found ${messages.data.messages.length} unread messages`);
      
      // Get details of first message
      if (messages.data.messages.length > 0) {
        const msg = await gmail.users.messages.get({
          userId: 'me',
          id: messages.data.messages[0].id
        });
        
        const headers = msg.data.payload.headers;
        const subject = headers.find(h => h.name === 'Subject')?.value;
        const from = headers.find(h => h.name === 'From')?.value;
        
        console.log('\nFirst unread message:');
        console.log('  From:', from);
        console.log('  Subject:', subject);
      }
    } else {
      console.log('✅ No unread messages');
    }
    
    console.log('\n🎉 Gmail connection successful!');
    console.log('The email monitoring system is ready to use.');
    console.log('\nNext steps:');
    console.log('1. Restart the server to activate monitoring');
    console.log('2. The system will check for new emails every 3 minutes');
    console.log('3. Waitlist emails will be automatically processed');
    
  } catch (error) {
    console.error('\n❌ Connection failed:', error.message);
    
    if (error.message.includes('invalid_grant')) {
      console.log('\n⚠️  Your refresh token may have expired.');
      console.log('Please get a new refresh token from:');
      console.log('https://developers.google.com/oauthplayground');
    } else if (error.message.includes('Invalid Credentials')) {
      console.log('\n⚠️  Check that your Client ID and Secret are correct');
    }
  }
}

// Run the test
testGmailConnection();