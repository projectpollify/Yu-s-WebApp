const { google } = require('googleapis');
const { OpenAI } = require('openai');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');

// Waitlist Schema
const waitlistSchema = new mongoose.Schema({
  parentName: String,
  parentEmail: { type: String, required: true },
  parentPhone: String,
  childName: { type: String, required: true },
  childBirthDate: Date,
  preferredStartDate: String,
  programType: String,
  emailId: String,
  receivedDate: { type: Date, default: Date.now },
  status: { type: String, enum: ['pending', 'contacted', 'enrolled', 'withdrawn'], default: 'pending' },
  priority: { type: String, enum: ['urgent', 'normal', 'low'], default: 'normal' },
  notes: String
});

const Waitlist = mongoose.model('Waitlist', waitlistSchema);

// Enhanced Email Schema
const emailSchema = new mongoose.Schema({
  messageId: { type: String, unique: true },
  threadId: String,
  from: String,
  to: String,
  subject: String,
  body: String,
  received: { type: Date, default: Date.now },
  processed: { type: Boolean, default: false },
  category: { 
    type: String, 
    enum: ['waitlist', 'inquiry', 'payment', 'absence', 'urgent', 'general'],
    default: 'general'
  },
  urgency: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
  extractedData: mongoose.Schema.Types.Mixed,
  aiResponse: String,
  folderLabel: String,
  requiresAction: Boolean,
  actionTaken: String
});

const Email = mongoose.model('Email', emailSchema);

class EnhancedEmailAI {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    this.gmail = null;
    this.initializeGmail();
  }

  async initializeGmail() {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.GMAIL_REFRESH_TOKEN
    });

    this.gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  }

  // Main monitoring function
  async monitorInbox() {
    try {
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: 'is:unread',
        maxResults: 20
      });

      if (response.data.messages) {
        for (const message of response.data.messages) {
          await this.processEmail(message.id, message.threadId);
        }
      }
    } catch (error) {
      console.error('Error monitoring inbox:', error);
    }
  }

  // Process individual email
  async processEmail(messageId, threadId) {
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
      const existing = await Email.findOne({ messageId });
      if (existing) return;

      // AI Analysis
      const analysis = await this.analyzeEmailWithAI(from, subject, body);

      // Save email record
      const emailDoc = new Email({
        messageId,
        threadId,
        from,
        subject,
        body: body.substring(0, 2000),
        category: analysis.category,
        urgency: analysis.urgency,
        extractedData: analysis.extractedData,
        requiresAction: analysis.requiresAction,
        aiResponse: analysis.suggestedResponse,
        folderLabel: analysis.folderLabel,
        processed: true
      });
      await emailDoc.save();

      // Process based on category
      if (analysis.category === 'waitlist' && analysis.extractedData) {
        await this.saveWaitlistEntry(analysis.extractedData, messageId);
      }

      // Apply Gmail label
      await this.applyLabel(messageId, analysis.folderLabel);

      // Mark urgent emails
      if (analysis.urgency === 'high') {
        await this.markAsImportant(messageId);
      }

      // Auto-respond if appropriate
      if (analysis.shouldAutoRespond && analysis.suggestedResponse) {
        await this.sendAutoResponse(from, subject, analysis.suggestedResponse);
      }

    } catch (error) {
      console.error('Error processing email:', error);
    }
  }

  // Enhanced AI analysis
  async analyzeEmailWithAI(from, subject, body) {
    try {
      const prompt = `
        Analyze this school email and provide detailed categorization and data extraction.
        
        From: ${from}
        Subject: ${subject}
        Body: ${body}
        
        Tasks:
        1. Categorize: waitlist, inquiry, payment, absence, urgent, or general
        2. Urgency level: high, medium, or low
        3. Extract structured data if it's a waitlist form
        4. Determine folder/label: Waitlist, Urgent, Payments, General, or Archive
        5. Should auto-respond: yes/no
        6. Suggested response if auto-respond is yes
        
        For waitlist emails, extract:
        - Parent name
        - Parent email
        - Parent phone
        - Child name
        - Child birth date
        - Preferred start date
        - Program type (Full Day, Half Day, etc.)
        
        Respond in JSON format:
        {
          "category": "string",
          "urgency": "high|medium|low",
          "requiresAction": boolean,
          "folderLabel": "string",
          "shouldAutoRespond": boolean,
          "suggestedResponse": "string or null",
          "extractedData": {
            "parentName": "string",
            "parentEmail": "string",
            "parentPhone": "string",
            "childName": "string",
            "childBirthDate": "string",
            "preferredStartDate": "string",
            "programType": "string"
          } or null
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
        urgency: 'medium',
        requiresAction: true,
        folderLabel: 'General',
        shouldAutoRespond: false,
        suggestedResponse: null,
        extractedData: null
      };
    }
  }

  // Save waitlist entry to database
  async saveWaitlistEntry(data, emailId) {
    try {
      const waitlistEntry = new Waitlist({
        parentName: data.parentName,
        parentEmail: data.parentEmail,
        parentPhone: data.parentPhone,
        childName: data.childName,
        childBirthDate: data.childBirthDate ? new Date(data.childBirthDate) : null,
        preferredStartDate: data.preferredStartDate,
        programType: data.programType,
        emailId: emailId,
        status: 'pending'
      });
      
      await waitlistEntry.save();
      console.log(`Waitlist entry saved for ${data.childName}`);
    } catch (error) {
      console.error('Error saving waitlist entry:', error);
    }
  }

  // Apply Gmail label
  async applyLabel(messageId, labelName) {
    try {
      // First, get or create the label
      const labels = await this.gmail.users.labels.list({ userId: 'me' });
      let label = labels.data.labels.find(l => l.name === labelName);
      
      if (!label) {
        // Create label if it doesn't exist
        const newLabel = await this.gmail.users.labels.create({
          userId: 'me',
          requestBody: {
            name: labelName,
            labelListVisibility: 'labelShow',
            messageListVisibility: 'show'
          }
        });
        label = newLabel.data;
      }

      // Apply label to message
      await this.gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          addLabelIds: [label.id],
          removeLabelIds: ['UNREAD']
        }
      });
    } catch (error) {
      console.error('Error applying label:', error);
    }
  }

  // Mark as important
  async markAsImportant(messageId) {
    try {
      await this.gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          addLabelIds: ['IMPORTANT', 'STARRED']
        }
      });
    } catch (error) {
      console.error('Error marking as important:', error);
    }
  }

  // Send auto response
  async sendAutoResponse(to, originalSubject, responseText) {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: process.env.GMAIL_USER,
          clientId: process.env.GMAIL_CLIENT_ID,
          clientSecret: process.env.GMAIL_CLIENT_SECRET,
          refreshToken: process.env.GMAIL_REFRESH_TOKEN
        }
      });

      await transporter.sendMail({
        from: process.env.GMAIL_USER,
        to: to,
        subject: `Re: ${originalSubject}`,
        html: `
          <p>${responseText}</p>
          <br>
          <p><small>This is an automated response from Yus Montessori School. 
          A staff member will follow up with you shortly if needed.</small></p>
        `
      });
    } catch (error) {
      console.error('Error sending auto response:', error);
    }
  }

  // Extract email body
  extractBody(payload) {
    let body = '';
    
    const extractFromPart = (part) => {
      if (part.body?.data) {
        body += Buffer.from(part.body.data, 'base64').toString('utf-8');
      }
      if (part.parts) {
        part.parts.forEach(extractFromPart);
      }
    };
    
    extractFromPart(payload);
    return body;
  }

  // Get waitlist statistics
  async getWaitlistStats() {
    const total = await Waitlist.countDocuments();
    const pending = await Waitlist.countDocuments({ status: 'pending' });
    const byProgram = await Waitlist.aggregate([
      { $group: { _id: '$programType', count: { $sum: 1 } } }
    ]);
    
    return { total, pending, byProgram };
  }

  // Start monitoring
  startMonitoring() {
    console.log('Starting enhanced email monitoring...');
    this.monitorInbox();
    setInterval(() => {
      this.monitorInbox();
    }, 3 * 60 * 1000); // Check every 3 minutes
  }
}

module.exports = EnhancedEmailAI;