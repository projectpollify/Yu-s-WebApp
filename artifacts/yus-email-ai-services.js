// services/emailService.js
const { google } = require('googleapis');
const nodemailer = require('nodemailer');
const Email = require('../models/Email');
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    this.oauth2Client = null;
    this.gmail = null;
    this.transporter = null;
    this.initialized = false;
    
    this.initializeGmailAPI();
  }

  async initializeGmailAPI() {
    try {
      // Set up OAuth2 client
      this.oauth2Client = new google.auth.OAuth2(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET,
        'https://developers.google.com/oauthplayground'
      );

      this.oauth2Client.setCredentials({
        refresh_token: process.env.GMAIL_REFRESH_TOKEN
      });

      // Initialize Gmail API
      this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

      // Initialize nodemailer transporter
      const accessToken = await this.oauth2Client.getAccessToken();
      
      this.transporter = nodemailer.createTransporter({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: process.env.GMAIL_USER,
          clientId: process.env.GMAIL_CLIENT_ID,
          clientSecret: process.env.GMAIL_CLIENT_SECRET,
          refreshToken: process.env.GMAIL_REFRESH_TOKEN,
          accessToken: accessToken.token
        }
      });

      this.initialized = true;
      logger.info('Email service initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize email service:', error);
      this.initialized = false;
    }
  }

  async fetchNewEmails() {
    if (!this.initialized) {
      throw new Error('Email service not initialized');
    }

    try {
      // Get messages from last 24 hours
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const query = `after:${Math.floor(yesterday.getTime() / 1000)}`;

      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 100
      });

      const messages = response.data.messages || [];
      const newEmails = [];

      for (const message of messages) {
        const emailData = await this.fetchEmailDetails(message.id);
        
        // Check if email already exists
        const existingEmail = await Email.findOne({ messageId: emailData.messageId });
        
        if (!existingEmail) {
          const email = new Email(emailData);
          await email.save();
          newEmails.push(email);
          
          logger.info(`New email saved: ${email.subject}`, {
            messageId: email.messageId,
            from: email.from.email
          });
        }
      }

      return newEmails;

    } catch (error) {
      logger.error('Error fetching new emails:', error);
      throw error;
    }
  }

  async fetchEmailDetails(messageId) {
    try {
      const response = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full'
      });

      const message = response.data;
      const headers = message.payload.headers;

      // Extract header information
      const getHeader = (name) => {
        const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
        return header ? header.value : null;
      };

      // Parse email addresses
      const parseEmailAddress = (addressString) => {
        if (!addressString) return null;
        
        const match = addressString.match(/^(.+?)\s*<(.+)>$/) || ['', '', addressString];
        return {
          name: match[1].replace(/['"]/g, '').trim() || null,
          email: (match[2] || addressString).trim()
        };
      };

      // Parse multiple email addresses
      const parseEmailAddresses = (addressString) => {
        if (!addressString) return [];
        return addressString.split(',').map(addr => parseEmailAddress(addr.trim()));
      };

      // Extract body content
      let textBody = '';
      let htmlBody = '';
      
      const extractBody = (parts) => {
        if (!parts) return;
        
        for (const part of parts) {
          if (part.mimeType === 'text/plain' && part.body.data) {
            textBody += Buffer.from(part.body.data, 'base64').toString();
          } else if (part.mimeType === 'text/html' && part.body.data) {
            htmlBody += Buffer.from(part.body.data, 'base64').toString();
          } else if (part.parts) {
            extractBody(part.parts);
          }
        }
      };

      if (message.payload.body.data) {
        textBody = Buffer.from(message.payload.body.data, 'base64').toString();
      } else if (message.payload.parts) {
        extractBody(message.payload.parts);
      }

      // Extract attachments
      const attachments = [];
      const extractAttachments = (parts) => {
        if (!parts) return;
        
        for (const part of parts) {
          if (part.filename && part.body.attachmentId) {
            attachments.push({
              filename: part.filename,
              mimeType: part.mimeType,
              size: part.body.size,
              attachmentId: part.body.attachmentId
            });
          } else if (part.parts) {
            extractAttachments(part.parts);
          }
        }
      };

      if (message.payload.parts) {
        extractAttachments(message.payload.parts);
      }

      // Create email object
      const emailData = {
        messageId: message.id,
        threadId: message.threadId,
        from: parseEmailAddress(getHeader('From')),
        to: parseEmailAddresses(getHeader('To')),
        cc: parseEmailAddresses(getHeader('Cc')),
        bcc: parseEmailAddresses(getHeader('Bcc')),
        replyTo: parseEmailAddress(getHeader('Reply-To')),
        subject: getHeader('Subject') || '(No Subject)',
        body: {
          text: textBody,
          html: htmlBody
        },
        snippet: message.snippet,
        receivedAt: new Date(parseInt(message.internalDate)),
        sentAt: new Date(getHeader('Date')),
        attachments: attachments,
        integrations: {
          gmail: {
            labelIds: message.labelIds,
            threadId: message.threadId
          }
        }
      };

      return emailData;

    } catch (error) {
      logger.error(`Error fetching email details for ${messageId}:`, error);
      throw error;
    }
  }

  async sendEmail(emailData) {
    if (!this.initialized) {
      throw new Error('Email service not initialized');
    }

    try {
      const mailOptions = {
        from: `${process.env.GMAIL_FROM_NAME} <${process.env.GMAIL_USER}>`,
        to: emailData.to,
        cc: emailData.cc,
        bcc: emailData.bcc,
        subject: emailData.subject,
        text: emailData.text,
        html: emailData.html,
        attachments: emailData.attachments
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      logger.info('Email sent successfully', {
        messageId: result.messageId,
        to: emailData.to,
        subject: emailData.subject
      });

      return result;

    } catch (error) {
      logger.error('Error sending email:', error);
      throw error;
    }
  }

  async downloadAttachment(messageId, attachmentId, filename) {
    if (!this.initialized) {
      throw new Error('Email service not initialized');
    }

    try {
      const response = await this.gmail.users.messages.attachments.get({
        userId: 'me',
        messageId: messageId,
        id: attachmentId
      });

      const data = Buffer.from(response.data.data, 'base64');
      
      // Save file locally (you might want to use cloud storage instead)
      const fs = require('fs').promises;
      const path = require('path');
      const uploadDir = path.join(__dirname, '../uploads/attachments');
      
      // Ensure directory exists
      await fs.mkdir(uploadDir, { recursive: true });
      
      const filePath = path.join(uploadDir, `${Date.now()}_${filename}`);
      await fs.writeFile(filePath, data);

      return filePath;

    } catch (error) {
      logger.error('Error downloading attachment:', error);
      throw error;
    }
  }

  async markAsRead(messageId) {
    if (!this.initialized) {
      throw new Error('Email service not initialized');
    }

    try {
      await this.gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          removeLabelIds: ['UNREAD']
        }
      });

    } catch (error) {
      logger.error('Error marking email as read:', error);
      throw error;
    }
  }

  async archiveEmail(messageId) {
    if (!this.initialized) {
      throw new Error('Email service not initialized');
    }

    try {
      await this.gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          removeLabelIds: ['INBOX']
        }
      });

    } catch (error) {
      logger.error('Error archiving email:', error);
      throw error;
    }
  }

  async createLabel(labelName) {
    if (!this.initialized) {
      throw new Error('Email service not initialized');
    }

    try {
      const response = await this.gmail.users.labels.create({
        userId: 'me',
        requestBody: {
          name: labelName,
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show'
        }
      });

      return response.data;

    } catch (error) {
      logger.error('Error creating label:', error);
      throw error;
    }
  }
}

module.exports = new EmailService();

// =============================================================================

// services/aiService.js
const OpenAI = require('openai');
const Email = require('../models/Email');
const Student = require('../models/Student');
const User = require('../models/User');
const logger = require('../utils/logger');

class AIService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.model = process.env.OPENAI_MODEL || 'gpt-4';
    this.maxTokens = parseInt(process.env.OPENAI_MAX_TOKENS) || 2000;
    this.temperature = parseFloat(process.env.OPENAI_TEMPERATURE) || 0.7;
  }

  async processEmail(email) {
    try {
      const prompt = this.generateEmailAnalysisPrompt(email);
      
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are an AI assistant for Yus Montessori School. Analyze emails and provide structured responses to help school administrators manage communications efficiently.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        response_format: { type: 'json_object' }
      });

      const analysis = JSON.parse(response.choices[0].message.content);
      
      // Update email with AI analysis
      await email.markAsProcessed({
        ...analysis,
        processingVersion: '1.0'
      });

      logger.info('Email processed by AI', {
        messageId: email.messageId,
        category: analysis.category,
        priority: analysis.priority,
        confidence: analysis.confidence
      });

      return analysis;

    } catch (error) {
      logger.error('Error processing email with AI:', error);
      
      // Save error to email record
      email.errors.push({
        type: 'processing',
        message: error.message,
        stack: error.stack
      });
      await email.save();
      
      throw error;
    }
  }

  generateEmailAnalysisPrompt(email) {
    return `
Analyze the following email for Yus Montessori School and provide a JSON response with the requested information:

FROM: ${email.from.name} <${email.from.email}>
SUBJECT: ${email.subject}
RECEIVED: ${email.receivedAt.toISOString()}

BODY:
${email.body.text || email.body.html}

Please analyze this email and return a JSON object with the following structure:

{
  "category": "enrollment-inquiry|parent-question|payment-inquiry|schedule-request|complaint|compliment|urgent|vendor|spam|newsletter|administrative|tour-request|general|unclassified",
  "confidence": 0.85,
  "sentiment": "positive|neutral|negative",
  "sentimentScore": 0.2,
  "priority": "low|normal|high|urgent",
  "priorityReason": "Brief explanation of priority level",
  "intents": [
    {
      "intent": "schedule_tour",
      "confidence": 0.9,
      "entities": [
        {
          "entity": "preferred_date",
          "value": "next week",
          "confidence": 0.8
        }
      ]
    }
  ],
  "extractedInfo": {
    "childName": "John Smith",
    "childAge": 4,
    "parentName": "Jane Smith",
    "phoneNumber": "+1-604-555-0123",
    "preferredTourDate": "2024-03-15T14:00:00Z",
    "startDate": "2024-09-01T00:00:00Z",
    "questions": ["What is the curriculum like?", "How much is tuition?"],
    "concerns": ["Child has food allergies"],
    "requestedActions": ["Schedule a tour", "Send enrollment information"]
  },
  "suggestedResponse": {
    "template": "tour_request_response",
    "customizedText": "Thank you for your interest in Yus Montessori School...",
    "confidence": 0.8,
    "requiresReview": true
  }
}

Guidelines:
- Be accurate in categorization
- Extract all relevant information from the email
- Suggest appropriate responses based on the email type
- Consider urgency indicators like "urgent", "ASAP", complaints, etc.
- Look for Montessori-specific terms and interests
- Identify parent concerns and questions clearly
- Suggest follow-up actions when appropriate
`;
  }

  async generateNewsletterContent(contentSources, type = 'monthly') {
    try {
      const prompt = this.generateNewsletterPrompt(contentSources, type);
      
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a newsletter writer for Yus Montessori School. Create engaging, warm, and informative content that connects with parents and celebrates children\'s learning journey.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: this.maxTokens,
        temperature: this.temperature
      });

      const content = response.choices[0].message.content;
      
      logger.info('Newsletter content generated by AI', {
        type: type,
        contentLength: content.length
      });

      return content;

    } catch (error) {
      logger.error('Error generating newsletter content:', error);
      throw error;
    }
  }

  generateNewsletterPrompt(contentSources, type) {
    let prompt = `Create a ${type} newsletter for Yus Montessori School. The newsletter should be warm, engaging, and celebrate the children's learning journey while keeping parents informed about school activities.

Content to include:`;

    contentSources.forEach(source => {
      switch (source.type) {
        case 'recent-photos':
          prompt += `\n- Recent classroom photos and activities: ${JSON.stringify(source.data)}`;
          break;
        case 'upcoming-events':
          prompt += `\n- Upcoming events: ${JSON.stringify(source.data)}`;
          break;
        case 'achievements':
          prompt += `\n- Student achievements and milestones: ${JSON.stringify(source.data)}`;
          break;
        case 'announcements':
          prompt += `\n- Important announcements: ${JSON.stringify(source.data)}`;
          break;
        case 'classroom-updates':
          prompt += `\n- Classroom updates: ${JSON.stringify(source.data)}`;
          break;
      }
    });

    prompt += `

Please create a newsletter that:
1. Has a warm, welcoming tone appropriate for a Montessori school
2. Celebrates children's natural curiosity and learning
3. Includes practical information for parents
4. Uses age-appropriate Montessori terminology
5. Maintains a balance between informative and engaging content
6. Includes clear sections with appropriate headings
7. Ends with a warm closing and contact information

Format the newsletter in HTML with appropriate styling for email distribution.`;

    return prompt;
  }

  async generateEmailResponse(email, template = null) {
    try {
      const prompt = this.generateResponsePrompt(email, template);
      
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a customer service representative for Yus Montessori School. Generate professional, helpful, and warm email responses that reflect the Montessori philosophy and school values.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: this.maxTokens,
        temperature: this.temperature
      });

      const generatedResponse = response.choices[0].message.content;
      
      logger.info('Email response generated by AI', {
        messageId: email.messageId,
        template: template,
        responseLength: generatedResponse.length
      });

      return generatedResponse;

    } catch (error) {
      logger.error('Error generating email response:', error);
      throw error;
    }
  }

  generateResponsePrompt(email, template) {
    let prompt = `Generate a professional email response for Yus Montessori School to the following email:

FROM: ${email.from.name} <${email.from.email}>
SUBJECT: ${email.subject}
ORIGINAL MESSAGE:
${email.body.text || email.body.html}

CONTEXT:
- Category: ${email.aiProcessing.category}
- Priority: ${email.aiProcessing.priority}
- Sentiment: ${email.aiProcessing.sentiment}`;

    if (email.aiProcessing.extractedInfo) {
      prompt += `\n- Extracted Info: ${JSON.stringify(email.aiProcessing.extractedInfo, null, 2)}`;
    }

    if (template) {
      prompt += `\n\nPlease use the "${template}" template as a starting point.`;
    }

    prompt += `

Generate an email response that:
1. Addresses the sender's questions and concerns
2. Maintains a warm, professional tone
3. Reflects Montessori values and philosophy
4. Provides helpful information and next steps
5. Includes appropriate school contact information
6. Uses proper email formatting
7. Is personalized based on the extracted information

The response should be complete and ready to send, including appropriate subject line.`;

    return prompt;
  }

  async analyzePredictiveInsights(type, data) {
    try {
      let prompt;
      
      switch (type) {
        case 'waitlist-conversion':
          prompt = this.generateWaitlistAnalysisPrompt(data);
          break;
        case 'payment-patterns':
          prompt = this.generatePaymentAnalysisPrompt(data);
          break;
        case 'enrollment-trends':
          prompt = this.generateEnrollmentAnalysisPrompt(data);
          break;
        default:
          throw new Error(`Unknown analysis type: ${type}`);
      }

      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a data analyst for Yus Montessori School. Provide insights and predictions based on school data to help with strategic planning and operations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: this.maxTokens,
        temperature: 0.3, // Lower temperature for analytical tasks
        response_format: { type: 'json_object' }
      });

      const analysis = JSON.parse(response.choices[0].message.content);
      
      logger.info(`AI analysis completed for ${type}`, {
        type: type,
        dataPoints: Array.isArray(data) ? data.length : 1
      });

      return analysis;

    } catch (error) {
      logger.error(`Error in AI analysis for ${type}:`, error);
      throw error;
    }
  }

  generateWaitlistAnalysisPrompt(waitlistData) {
    return `Analyze the following waitlist data for Yus Montessori School and provide insights:

WAITLIST DATA:
${JSON.stringify(waitlistData, null, 2)}

Please analyze this data and return a JSON object with:
{
  "conversionPredictions": [
    {
      "waitlistId": "...",
      "likelihood": 85,
      "factors": ["high engagement", "tour completed", "sibling enrolled"],
      "recommendedAction": "Contact within 1 week",
      "expectedConversionDate": "2024-04-15"
    }
  ],
  "overallInsights": {
    "totalWaitlist": 25,
    "highLikelihood": 8,
    "mediumLikelihood": 12,
    "lowLikelihood": 5,
    "averageConversionRate": 65,
    "seasonalTrends": "Spring enrollment typically increases"
  },
  "recommendations": [
    "Focus follow-up efforts on high-likelihood families",
    "Schedule group information sessions",
    "Create targeted content for different program levels"
  ]
}`;
  }

  generatePaymentAnalysisPrompt(paymentData) {
    return `Analyze payment patterns for Yus Montessori School:

PAYMENT DATA:
${JSON.stringify(paymentData, null, 2)}

Return insights in JSON format about payment trends, risk factors, and recommendations.`;
  }

  generateEnrollmentAnalysisPrompt(enrollmentData) {
    return `Analyze enrollment trends for Yus Montessori School:

ENROLLMENT DATA:
${JSON.stringify(enrollmentData, null, 2)}

Return insights in JSON format about enrollment patterns, capacity planning, and growth opportunities.`;
  }
}

module.exports = new AIService();