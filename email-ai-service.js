const { google } = require('googleapis');
const { OpenAI } = require('openai');
const nodemailer = require('nodemailer');
const { Email } = require('./models-combined');

class EmailAIService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    this.gmail = null;
    this.transporter = null;
    this.initializeServices();
  }

  async initializeServices() {
    // Initialize Gmail API
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.GMAIL_REFRESH_TOKEN
    });

    this.gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Initialize email transporter for sending
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: process.env.GMAIL_USER,
        clientId: process.env.GMAIL_CLIENT_ID,
        clientSecret: process.env.GMAIL_CLIENT_SECRET,
        refreshToken: process.env.GMAIL_REFRESH_TOKEN
      }
    });
  }

  // Monitor inbox for new emails
  async checkInbox() {
    try {
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: 'is:unread',
        maxResults: 10
      });

      if (response.data.messages) {
        for (const message of response.data.messages) {
          await this.processEmail(message.id);
        }
      }
    } catch (error) {
      console.error('Error checking inbox:', error);
    }
  }

  // Process individual email with AI
  async processEmail(messageId) {
    try {
      const email = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId
      });

      const headers = email.data.payload.headers;
      const from = headers.find(h => h.name === 'From')?.value || '';
      const subject = headers.find(h => h.name === 'Subject')?.value || '';
      const body = this.extractBody(email.data.payload);

      // Check if already processed
      const existingEmail = await Email.findOne({ messageId });
      if (existingEmail) return;

      // Categorize and analyze with AI
      const analysis = await this.analyzeEmail(from, subject, body);

      // Save to database
      const emailDoc = new Email({
        messageId,
        from,
        subject,
        body,
        category: analysis.category,
        requiresAction: analysis.requiresAction,
        aiResponse: analysis.suggestedResponse,
        processed: true
      });
      await emailDoc.save();

      // Auto-respond if appropriate
      if (analysis.shouldAutoRespond && analysis.suggestedResponse) {
        await this.sendResponse(from, subject, analysis.suggestedResponse);
        emailDoc.actionTaken = 'auto-responded';
        await emailDoc.save();
      }

      // Mark as read
      await this.gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          removeLabelIds: ['UNREAD']
        }
      });

    } catch (error) {
      console.error('Error processing email:', error);
    }
  }

  // AI analysis of email content
  async analyzeEmail(from, subject, body) {
    try {
      const prompt = `
        Analyze this school email and provide:
        1. Category: inquiry, payment, absence, general, or urgent
        2. Whether it requires immediate action
        3. Whether to auto-respond
        4. Suggested response if auto-respond is appropriate
        
        From: ${from}
        Subject: ${subject}
        Body: ${body}
        
        Respond in JSON format:
        {
          "category": "string",
          "requiresAction": boolean,
          "shouldAutoRespond": boolean,
          "suggestedResponse": "string or null"
        }
      `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error('AI analysis error:', error);
      return {
        category: 'general',
        requiresAction: true,
        shouldAutoRespond: false,
        suggestedResponse: null
      };
    }
  }

  // Send automated response
  async sendResponse(to, originalSubject, responseText) {
    try {
      await this.transporter.sendMail({
        from: process.env.GMAIL_USER,
        to: to,
        subject: `Re: ${originalSubject}`,
        text: responseText,
        html: `<p>${responseText}</p><br><p><small>This is an automated response. A staff member will follow up if needed.</small></p>`
      });
    } catch (error) {
      console.error('Error sending response:', error);
    }
  }

  // Extract email body
  extractBody(payload) {
    let body = '';
    
    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body.data) {
          body += Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
      }
    } else if (payload.body?.data) {
      body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
    }
    
    return body.substring(0, 1000); // Limit to 1000 chars for AI processing
  }

  // Start monitoring (run every 5 minutes)
  startMonitoring() {
    this.checkInbox(); // Initial check
    setInterval(() => {
      this.checkInbox();
    }, 5 * 60 * 1000); // Every 5 minutes
  }
}

module.exports = EmailAIService;