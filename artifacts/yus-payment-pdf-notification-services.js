// services/paymentService.js
const Stripe = require('stripe');
const Payment = require('../models/Payment');
const Student = require('../models/Student');
const User = require('../models/User');
const logger = require('../utils/logger');
const notificationService = require('./notificationService');

class PaymentService {
  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }

  async createPaymentIntent(paymentData) {
    try {
      const { studentId, amount, currency = 'cad', description, metadata = {} } = paymentData;

      // Create Stripe Payment Intent
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency.toLowerCase(),
        description: description,
        metadata: {
          studentId: studentId.toString(),
          schoolSystem: 'yus-montessori',
          ...metadata
        },
        automatic_payment_methods: {
          enabled: true
        }
      });

      logger.info('Payment intent created', {
        paymentIntentId: paymentIntent.id,
        studentId,
        amount
      });

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id
      };

    } catch (error) {
      logger.error('Error creating payment intent:', error);
      throw error;
    }
  }

  async confirmPayment(paymentIntentId, paymentId) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      const payment = await Payment.findById(paymentId);

      if (!payment) {
        throw new Error('Payment record not found');
      }

      if (paymentIntent.status === 'succeeded') {
        // Update payment record
        payment.status = 'completed';
        payment.transactions.push({
          transactionId: paymentIntent.id,
          processor: 'stripe',
          processedAt: new Date(),
          amount: paymentIntent.amount / 100,
          fee: paymentIntent.charges.data[0]?.balance_transaction?.fee / 100 || 0,
          netAmount: (paymentIntent.amount - (paymentIntent.charges.data[0]?.balance_transaction?.fee || 0)) / 100,
          status: 'succeeded',
          processorResponse: paymentIntent
        });

        await payment.save();

        // Generate receipt
        await this.generateReceipt(payment);

        // Send confirmation email
        await notificationService.sendPaymentConfirmation(payment);

        logger.info('Payment confirmed successfully', {
          paymentId: payment._id,
          studentId: payment.studentId,
          amount: payment.amount
        });

        return payment;

      } else {
        throw new Error(`Payment failed with status: ${paymentIntent.status}`);
      }

    } catch (error) {
      logger.error('Error confirming payment:', error);
      throw error;
    }
  }

  async processRecurringPayments() {
    try {
      const overduePayments = await Payment.find({
        'recurring.isRecurring': true,
        'recurring.active': true,
        'recurring.nextPaymentDate': { $lte: new Date() },
        status: 'pending'
      });

      const results = {
        processed: 0,
        failed: 0,
        errors: []
      };

      for (const payment of overduePayments) {
        try {
          await this.processRecurringPayment(payment);
          results.processed++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            paymentId: payment._id,
            error: error.message
          });
          logger.error(`Failed to process recurring payment ${payment._id}:`, error);
        }
      }

      logger.info('Recurring payments processed', results);
      return results;

    } catch (error) {
      logger.error('Error processing recurring payments:', error);
      throw error;
    }
  }

  async processRecurringPayment(payment) {
    try {
      const student = await Student.findById(payment.studentId);
      const parent = await User.findById(payment.parentId);

      if (!student || !parent) {
        throw new Error('Student or parent not found');
      }

      // Create new payment intent for recurring payment
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(payment.amount * 100),
        currency: payment.currency.toLowerCase(),
        customer: parent.stripeCustomerId, // Assuming you store Stripe customer ID
        payment_method: payment.recurring.subscriptionId, // Assuming you store payment method
        description: `Recurring ${payment.description}`,
        confirm: true,
        metadata: {
          studentId: student._id.toString(),
          parentId: parent._id.toString(),
          originalPaymentId: payment._id.toString()
        }
      });

      if (paymentIntent.status === 'succeeded') {
        // Update payment
        payment.status = 'completed';
        payment.transactions.push({
          transactionId: paymentIntent.id,
          processor: 'stripe',
          processedAt: new Date(),
          amount: paymentIntent.amount / 100,
          status: 'succeeded'
        });

        // Set next payment date
        const nextDate = new Date(payment.recurring.nextPaymentDate);
        switch (payment.recurring.frequency) {
          case 'weekly':
            nextDate.setDate(nextDate.getDate() + 7);
            break;
          case 'bi-weekly':
            nextDate.setDate(nextDate.getDate() + 14);
            break;
          case 'monthly':
            nextDate.setMonth(nextDate.getMonth() + 1);
            break;
          case 'quarterly':
            nextDate.setMonth(nextDate.getMonth() + 3);
            break;
          case 'semi-annual':
            nextDate.setMonth(nextDate.getMonth() + 6);
            break;
          case 'annual':
            nextDate.setFullYear(nextDate.getFullYear() + 1);
            break;
        }
        payment.recurring.nextPaymentDate = nextDate;
        payment.recurring.failedAttempts = 0;

        await payment.save();

        // Create next payment record
        await this.createNextRecurringPayment(payment);

        logger.info('Recurring payment processed successfully', {
          paymentId: payment._id,
          nextPaymentDate: nextDate
        });

      } else {
        // Handle failed payment
        payment.recurring.failedAttempts++;
        
        if (payment.recurring.failedAttempts >= payment.recurring.maxFailedAttempts) {
          payment.recurring.active = false;
          await notificationService.sendRecurringPaymentFailed(payment);
        }
        
        await payment.save();
        throw new Error(`Recurring payment failed: ${paymentIntent.status}`);
      }

    } catch (error) {
      logger.error('Error processing recurring payment:', error);
      throw error;
    }
  }

  async createNextRecurringPayment(originalPayment) {
    try {
      const newPayment = new Payment({
        studentId: originalPayment.studentId,
        parentId: originalPayment.parentId,
        amount: originalPayment.amount,
        currency: originalPayment.currency,
        type: originalPayment.type,
        description: originalPayment.description,
        dueDate: originalPayment.recurring.nextPaymentDate,
        academicYear: originalPayment.academicYear,
        recurring: originalPayment.recurring,
        createdBy: originalPayment.createdBy
      });

      await newPayment.save();
      return newPayment;

    } catch (error) {
      logger.error('Error creating next recurring payment:', error);
      throw error;
    }
  }

  async processRefund(paymentId, amount, reason) {
    try {
      const payment = await Payment.findById(paymentId);
      
      if (!payment || payment.status !== 'completed') {
        throw new Error('Payment not found or not eligible for refund');
      }

      const lastTransaction = payment.transactions.find(t => t.status === 'succeeded');
      
      if (!lastTransaction) {
        throw new Error('No successful transaction found for refund');
      }

      // Process refund through Stripe
      const refund = await this.stripe.refunds.create({
        payment_intent: lastTransaction.transactionId,
        amount: amount ? Math.round(amount * 100) : undefined, // Partial or full refund
        reason: reason || 'requested_by_customer',
        metadata: {
          paymentId: payment._id.toString(),
          refundReason: reason
        }
      });

      // Update payment record
      payment.refunds.push({
        refundId: refund.id,
        amount: refund.amount / 100,
        reason: reason,
        processedAt: new Date(),
        status: refund.status
      });

      if (refund.amount === lastTransaction.amount * 100) {
        payment.status = 'refunded';
      }

      await payment.save();

      logger.info('Refund processed successfully', {
        paymentId: payment._id,
        refundId: refund.id,
        amount: refund.amount / 100
      });

      return refund;

    } catch (error) {
      logger.error('Error processing refund:', error);
      throw error;
    }
  }

  async generateReceipt(payment) {
    try {
      const pdfService = require('./pdfService');
      const receiptData = await this.prepareReceiptData(payment);
      
      const receiptPath = await pdfService.generateReceipt(receiptData);
      
      payment.receipts.push({
        receiptNumber: `REC-${payment.invoiceNumber}`,
        generatedAt: new Date(),
        filePath: receiptPath
      });

      await payment.save();
      return receiptPath;

    } catch (error) {
      logger.error('Error generating receipt:', error);
      throw error;
    }
  }

  async prepareReceiptData(payment) {
    const student = await Student.findById(payment.studentId).populate('parents.userId');
    const parent = student.parents.find(p => p.userId._id.equals(payment.parentId));

    return {
      receiptNumber: `REC-${payment.invoiceNumber}`,
      invoiceNumber: payment.invoiceNumber,
      paymentDate: payment.transactions[0]?.processedAt || payment.updatedAt,
      student: {
        name: student.fullName,
        studentId: student.studentId,
        class: student.enrollment.className
      },
      parent: {
        name: parent.userId.fullName,
        email: parent.userId.email,
        address: parent.userId.address
      },
      payment: {
        description: payment.description,
        amount: payment.amount,
        currency: payment.currency,
        type: payment.type,
        paymentMethod: payment.paymentMethod
      },
      school: {
        name: process.env.SCHOOL_NAME,
        address: process.env.SCHOOL_ADDRESS,
        phone: process.env.SCHOOL_PHONE,
        email: process.env.SCHOOL_EMAIL,
        website: process.env.SCHOOL_WEBSITE
      },
      tax: payment.tax
    };
  }

  async sendPaymentReminders() {
    try {
      const overduePayments = await Payment.findOverdue();
      const dueSoonPayments = await Payment.findDueSoon(7); // Due in next 7 days

      const results = {
        overdueSent: 0,
        dueSoonSent: 0,
        errors: []
      };

      // Send overdue payment reminders
      for (const payment of overduePayments) {
        try {
          await notificationService.sendOverduePaymentReminder(payment);
          
          payment.reminders.push({
            type: 'overdue',
            sentDate: new Date(),
            method: 'email',
            recipient: payment.parentId.email,
            successful: true
          });
          
          await payment.save();
          results.overdueSent++;
          
        } catch (error) {
          results.errors.push({
            paymentId: payment._id,
            type: 'overdue',
            error: error.message
          });
        }
      }

      // Send due soon reminders
      for (const payment of dueSoonPayments) {
        try {
          await notificationService.sendPaymentDueReminder(payment);
          
          payment.reminders.push({
            type: 'first-notice',
            sentDate: new Date(),
            method: 'email',
            recipient: payment.parentId.email,
            successful: true
          });
          
          await payment.save();
          results.dueSoonSent++;
          
        } catch (error) {
          results.errors.push({
            paymentId: payment._id,
            type: 'due-soon',
            error: error.message
          });
        }
      }

      logger.info('Payment reminders sent', results);
      return results;

    } catch (error) {
      logger.error('Error sending payment reminders:', error);
      throw error;
    }
  }

  async getPaymentAnalytics(dateRange) {
    try {
      const { startDate, endDate } = dateRange;
      
      const payments = await Payment.find({
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      });

      const analytics = {
        totalRevenue: 0,
        totalPayments: payments.length,
        completedPayments: 0,
        pendingPayments: 0,
        overduePayments: 0,
        refundedAmount: 0,
        paymentsByType: {},
        monthlyRevenue: {},
        averagePaymentAmount: 0
      };

      payments.forEach(payment => {
        // Total revenue from completed payments
        if (payment.status === 'completed') {
          analytics.totalRevenue += payment.totalDue;
          analytics.completedPayments++;
        }

        // Count by status
        if (payment.status === 'pending') {
          if (payment.dueDate < new Date()) {
            analytics.overduePayments++;
          } else {
            analytics.pendingPayments++;
          }
        }

        // Refunded amounts
        if (payment.refunds.length > 0) {
          analytics.refundedAmount += payment.refunds.reduce((sum, refund) => sum + refund.amount, 0);
        }

        // Payments by type
        if (!analytics.paymentsByType[payment.type]) {
          analytics.paymentsByType[payment.type] = { count: 0, amount: 0 };
        }
        analytics.paymentsByType[payment.type].count++;
        if (payment.status === 'completed') {
          analytics.paymentsByType[payment.type].amount += payment.totalDue;
        }

        // Monthly revenue
        const monthKey = payment.createdAt.toISOString().substring(0, 7); // YYYY-MM
        if (!analytics.monthlyRevenue[monthKey]) {
          analytics.monthlyRevenue[monthKey] = 0;
        }
        if (payment.status === 'completed') {
          analytics.monthlyRevenue[monthKey] += payment.totalDue;
        }
      });

      analytics.averagePaymentAmount = analytics.completedPayments > 0 
        ? analytics.totalRevenue / analytics.completedPayments 
        : 0;

      return analytics;

    } catch (error) {
      logger.error('Error generating payment analytics:', error);
      throw error;
    }
  }
}

module.exports = new PaymentService();

// =============================================================================

// services/pdfService.js
const PDFLib = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class PDFService {
  constructor() {
    this.uploadsDir = path.join(__dirname, '../uploads/receipts');
    this.ensureDirectoryExists();
  }

  async ensureDirectoryExists() {
    try {
      await fs.mkdir(this.uploadsDir, { recursive: true });
    } catch (error) {
      logger.error('Error creating uploads directory:', error);
    }
  }

  async generateReceipt(receiptData) {
    try {
      const pdfDoc = await PDFLib.PDFDocument.create();
      const page = pdfDoc.addPage([612, 792]); // Letter size

      // Load fonts
      const helveticaFont = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
      const helveticaBoldFont = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);

      const { width, height } = page.getSize();
      let yPosition = height - 50;

      // Helper function to draw text
      const drawText = (text, x, y, options = {}) => {
        page.drawText(text, {
          x: x,
          y: y,
          size: options.size || 12,
          font: options.bold ? helveticaBoldFont : helveticaFont,
          color: PDFLib.rgb(0, 0, 0),
          ...options
        });
      };

      // School header
      drawText(receiptData.school.name, 50, yPosition, { size: 20, bold: true });
      yPosition -= 25;
      drawText(receiptData.school.address, 50, yPosition, { size: 10 });
      yPosition -= 15;
      drawText(`Phone: ${receiptData.school.phone} | Email: ${receiptData.school.email}`, 50, yPosition, { size: 10 });
      yPosition -= 40;

      // Receipt title and number
      drawText('PAYMENT RECEIPT', width / 2 - 80, yPosition, { size: 18, bold: true });
      yPosition -= 30;
      
      drawText(`Receipt Number: ${receiptData.receiptNumber}`, 50, yPosition, { bold: true });
      drawText(`Invoice Number: ${receiptData.invoiceNumber}`, 350, yPosition, { bold: true });
      yPosition -= 20;
      
      drawText(`Payment Date: ${receiptData.paymentDate.toLocaleDateString()}`, 50, yPosition);
      yPosition -= 40;

      // Student and parent information
      drawText('STUDENT INFORMATION', 50, yPosition, { size: 14, bold: true });
      yPosition -= 20;
      drawText(`Student Name: ${receiptData.student.name}`, 50, yPosition);
      yPosition -= 15;
      drawText(`Student ID: ${receiptData.student.studentId}`, 50, yPosition);
      yPosition -= 15;
      if (receiptData.student.class) {
        drawText(`Class: ${receiptData.student.class}`, 50, yPosition);
        yPosition -= 15;
      }
      yPosition -= 20;

      drawText('PARENT/GUARDIAN INFORMATION', 50, yPosition, { size: 14, bold: true });
      yPosition -= 20;
      drawText(`Name: ${receiptData.parent.name}`, 50, yPosition);
      yPosition -= 15;
      drawText(`Email: ${receiptData.parent.email}`, 50, yPosition);
      yPosition -= 15;
      
      if (receiptData.parent.address) {
        const address = receiptData.parent.address;
        const fullAddress = `${address.street || ''}, ${address.city || ''}, ${address.province || ''} ${address.postalCode || ''}`.replace(/,\s*,/g, ',').replace(/^,\s*|,\s*$/g, '');
        if (fullAddress) {
          drawText(`Address: ${fullAddress}`, 50, yPosition);
          yPosition -= 15;
        }
      }
      yPosition -= 30;

      // Payment details
      drawText('PAYMENT DETAILS', 50, yPosition, { size: 14, bold: true });
      yPosition -= 20;
      
      // Draw table header
      const tableY = yPosition;
      drawText('Description', 50, tableY, { bold: true });
      drawText('Type', 300, tableY, { bold: true });
      drawText('Amount', 450, tableY, { bold: true });
      yPosition -= 20;
      
      // Draw line
      page.drawLine({
        start: { x: 50, y: yPosition + 5 },
        end: { x: 550, y: yPosition + 5 },
        thickness: 1,
        color: PDFLib.rgb(0, 0, 0)
      });
      yPosition -= 10;

      // Payment details row
      drawText(receiptData.payment.description, 50, yPosition);
      drawText(receiptData.payment.type.toUpperCase(), 300, yPosition);
      drawText(`${receiptData.payment.amount.toFixed(2)} ${receiptData.payment.currency.toUpperCase()}`, 450, yPosition);
      yPosition -= 30;

      // Total
      page.drawLine({
        start: { x: 400, y: yPosition + 10 },
        end: { x: 550, y: yPosition + 10 },
        thickness: 1,
        color: PDFLib.rgb(0, 0, 0)
      });
      drawText('TOTAL PAID:', 400, yPosition, { bold: true });
      drawText(`${receiptData.payment.amount.toFixed(2)} ${receiptData.payment.currency.toUpperCase()}`, 500, yPosition, { bold: true });
      yPosition -= 40;

      // Payment method
      drawText(`Payment Method: ${receiptData.payment.paymentMethod.replace('-', ' ').toUpperCase()}`, 50, yPosition);
      yPosition -= 40;

      // Tax information (if applicable)
      if (receiptData.tax && receiptData.tax.eligible) {
        drawText('TAX INFORMATION', 50, yPosition, { size: 14, bold: true });
        yPosition -= 20;
        drawText(`Tax Year: ${receiptData.tax.taxYear}`, 50, yPosition);
        yPosition -= 15;
        if (receiptData.tax.receiptNumber) {
          drawText(`Tax Receipt Number: ${receiptData.tax.receiptNumber}`, 50, yPosition);
          yPosition -= 15;
        }
        drawText('This receipt may be eligible for tax deductions. Please consult your tax advisor.', 50, yPosition, { size: 10 });
        yPosition -= 30;
      }

      // Footer
      yPosition = 100;
      drawText('Thank you for choosing Yus Montessori School!', 50, yPosition, { size: 12, bold: true });
      yPosition -= 20;
      drawText('If you have any questions about this receipt, please contact us:', 50, yPosition, { size: 10 });
      yPosition -= 15;
      drawText(`Email: ${receiptData.school.email} | Phone: ${receiptData.school.phone}`, 50, yPosition, { size: 10 });
      
      // Watermark
      drawText('PAID', width / 2 - 50, height / 2, { 
        size: 72, 
        color: PDFLib.rgb(0.9, 0.9, 0.9) 
      });

      // Save PDF
      const pdfBytes = await pdfDoc.save();
      const filename = `receipt_${receiptData.receiptNumber}_${Date.now()}.pdf`;
      const filePath = path.join(this.uploadsDir, filename);
      
      await fs.writeFile(filePath, pdfBytes);

      logger.info('Receipt PDF generated successfully', {
        receiptNumber: receiptData.receiptNumber,
        filePath: filePath
      });

      return filePath;

    } catch (error) {
      logger.error('Error generating receipt PDF:', error);
      throw error;
    }
  }

  async generateTaxReceipt(taxData) {
    try {
      const pdfDoc = await PDFLib.PDFDocument.create();
      const page = pdfDoc.addPage([612, 792]);

      const helveticaFont = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
      const helveticaBoldFont = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);

      const { width, height } = page.getSize();
      let yPosition = height - 50;

      const drawText = (text, x, y, options = {}) => {
        page.drawText(text, {
          x: x,
          y: y,
          size: options.size || 12,
          font: options.bold ? helveticaBoldFont : helveticaFont,
          color: PDFLib.rgb(0, 0, 0),
          ...options
        });
      };

      // School header
      drawText(taxData.school.name, 50, yPosition, { size: 20, bold: true });
      yPosition -= 25;
      drawText(taxData.school.address, 50, yPosition, { size: 10 });
      yPosition -= 40;

      // Tax receipt title
      drawText('OFFICIAL TAX RECEIPT FOR CHILDCARE EXPENSES', width / 2 - 150, yPosition, { size: 16, bold: true });
      yPosition -= 30;

      drawText(`Receipt Number: ${taxData.receiptNumber}`, 50, yPosition, { bold: true });
      drawText(`Tax Year: ${taxData.taxYear}`, 350, yPosition, { bold: true });
      yPosition -= 30;

      // Child information
      drawText('CHILD INFORMATION', 50, yPosition, { size: 14, bold: true });
      yPosition -= 20;
      drawText(`Child's Name: ${taxData.child.name}`, 50, yPosition);
      yPosition -= 15;
      drawText(`Date of Birth: ${taxData.child.dateOfBirth.toLocaleDateString()}`, 50, yPosition);
      yPosition -= 30;

      // Parent information
      drawText('PARENT/GUARDIAN INFORMATION', 50, yPosition, { size: 14, bold: true });
      yPosition -= 20;
      drawText(`Name: ${taxData.parent.name}`, 50, yPosition);
      yPosition -= 15;
      drawText(`Address: ${taxData.parent.fullAddress}`, 50, yPosition);
      yPosition -= 30;

      // Payment summary
      drawText('CHILDCARE EXPENSES SUMMARY', 50, yPosition, { size: 14, bold: true });
      yPosition -= 20;

      // Table headers
      drawText('Period', 50, yPosition, { bold: true });
      drawText('Amount Paid', 300, yPosition, { bold: true });
      yPosition -= 20;

      page.drawLine({
        start: { x: 50, y: yPosition + 5 },
        end: { x: 450, y: yPosition + 5 },
        thickness: 1
      });
      yPosition -= 15;

      // Payment details
      let totalAmount = 0;
      taxData.payments.forEach(payment => {
        drawText(`${payment.periodStart.toLocaleDateString()} - ${payment.periodEnd.toLocaleDateString()}`, 50, yPosition);
        drawText(`${payment.amount.toFixed(2)}`, 300, yPosition);
        totalAmount += payment.amount;
        yPosition -= 15;
      });

      yPosition -= 10;
      page.drawLine({
        start: { x: 250, y: yPosition + 5 },
        end: { x: 450, y: yPosition + 5 },
        thickness: 2
      });
      yPosition -= 15;

      drawText('TOTAL ELIGIBLE EXPENSES:', 200, yPosition, { bold: true });
      drawText(`${totalAmount.toFixed(2)}`, 300, yPosition, { bold: true });
      yPosition -= 40;

      // Legal text
      drawText('CERTIFICATION', 50, yPosition, { size: 14, bold: true });
      yPosition -= 20;
      
      const certificationText = [
        'I certify that the childcare services for which the fees shown above were paid',
        'were provided at the above address and that a receipt has been issued for the',
        'total amount paid. The services were provided to enable the parent(s) or',
        'guardian(s) to be employed, carry on business, attend school, or carry on research.'
      ];

      certificationText.forEach(line => {
        drawText(line, 50, yPosition, { size: 10 });
        yPosition -= 12;
      });

      yPosition -= 30;

      // Signature area
      drawText('_______________________________', 50, yPosition);
      drawText('Date: _______________', 350, yPosition);
      yPosition -= 20;
      drawText('Authorized Signature', 50, yPosition, { size: 10 });
      yPosition -= 15;
      drawText(taxData.school.name, 50, yPosition, { size: 10 });

      // Footer
      yPosition = 50;
      drawText('This receipt is valid for Canada Revenue Agency (CRA) tax purposes.', 50, yPosition, { size: 10 });

      // Save PDF
      const pdfBytes = await pdfDoc.save();
      const filename = `tax_receipt_${taxData.receiptNumber}_${taxData.taxYear}.pdf`;
      const filePath = path.join(this.uploadsDir, filename);
      
      await fs.writeFile(filePath, pdfBytes);

      logger.info('Tax receipt PDF generated successfully', {
        receiptNumber: taxData.receiptNumber,
        taxYear: taxData.taxYear,
        filePath: filePath
      });

      return filePath;

    } catch (error) {
      logger.error('Error generating tax receipt PDF:', error);
      throw error;
    }
  }

  async generateStudentReport(studentData) {
    try {
      const pdfDoc = await PDFLib.PDFDocument.create();
      const page = pdfDoc.addPage([612, 792]);

      // Implementation for student progress reports
      // This would include Montessori observations, portfolio items, etc.
      
      const pdfBytes = await pdfDoc.save();
      const filename = `student_report_${studentData.studentId}_${Date.now()}.pdf`;
      const filePath = path.join(this.uploadsDir, filename);
      
      await fs.writeFile(filePath, pdfBytes);
      return filePath;

    } catch (error) {
      logger.error('Error generating student report PDF:', error);
      throw error;
    }
  }
}

module.exports = new PDFService();

// =============================================================================

// services/notificationService.js
const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

class NotificationService {
  constructor() {
    this.emailTransporter = null;
    this.initializeEmailService();
  }

  async initializeEmailService() {
    try {
      this.emailTransporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });

      logger.info('Notification service initialized');
    } catch (error) {
      logger.error('Failed to initialize notification service:', error);
    }
  }

  async sendEmail(emailOptions) {
    try {
      const mailOptions = {
        from: `${process.env.SCHOOL_NAME} <${process.env.SMTP_USER}>`,
        ...emailOptions
      };

      const result = await this.emailTransporter.sendMail(mailOptions);
      
      logger.info('Email sent successfully', {
        to: emailOptions.to,
        subject: emailOptions.subject,
        messageId: result.messageId
      });

      return result;

    } catch (error) {
      logger.error('Error sending email:', error);
      throw error;
    }
  }

  async sendPaymentConfirmation(payment) {
    try {
      const Student = require('../models/Student');
      const User = require('../models/User');
      
      const student = await Student.findById(payment.studentId);
      const parent = await User.findById(payment.parentId);

      if (!student || !parent) {
        throw new Error('Student or parent not found');
      }

      const emailOptions = {
        to: parent.email,
        subject: `Payment Confirmation - ${student.fullName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2c5530;">Payment Confirmation</h2>
            
            <p>Dear ${parent.firstName},</p>
            
            <p>Thank you for your payment. We have successfully received your payment for ${student.fullName}.</p>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <h3>Payment Details</h3>
              <p><strong>Student:</strong> ${student.fullName}</p>
              <p><strong>Amount:</strong> ${payment.amount.toFixed(2)} ${payment.currency.toUpperCase()}</p>
              <p><strong>Description:</strong> ${payment.description}</p>
              <p><strong>Payment Date:</strong> ${new Date().toLocaleDateString()}</p>
              <p><strong>Invoice Number:</strong> ${payment.invoiceNumber}</p>
            </div>
            
            <p>A detailed receipt will be emailed to you shortly.</p>
            
            <p>If you have any questions about this payment, please don't hesitate to contact us.</p>
            
            <p>Best regards,<br>
            ${process.env.SCHOOL_NAME}<br>
            ${process.env.SCHOOL_EMAIL}<br>
            ${process.env.SCHOOL_PHONE}</p>
          </div>
        `
      };

      return await this.sendEmail(emailOptions);

    } catch (error) {
      logger.error('Error sending payment confirmation:', error);
      throw error;
    }
  }

  async sendOverduePaymentReminder(payment) {
    try {
      const Student = require('../models/Student');
      const User = require('../models/User');
      
      const student = await Student.findById(payment.studentId);
      const parent = await User.findById(payment.parentId);

      const daysOverdue = Math.floor((Date.now() - payment.dueDate.getTime()) / (1000 * 60 * 60 * 24));

      const emailOptions = {
        to: parent.email,
        subject: `Payment Overdue - ${student.fullName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc3545;">Payment Overdue Notice</h2>
            
            <p>Dear ${parent.firstName},</p>
            
            <p>This is a friendly reminder that a payment for ${student.fullName} is now overdue by ${daysOverdue} days.</p>
            
            <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <h3>Payment Details</h3>
              <p><strong>Student:</strong> ${student.fullName}</p>
              <p><strong>Amount Due:</strong> ${payment.totalDue.toFixed(2)} ${payment.currency.toUpperCase()}</p>
              <p><strong>Description:</strong> ${payment.description}</p>
              <p><strong>Due Date:</strong> ${payment.dueDate.toLocaleDateString()}</p>
              <p><strong>Days Overdue:</strong> ${daysOverdue}</p>
            </div>
            
            <p>Please make this payment as soon as possible to avoid any late fees or service interruptions.</p>
            
            <p>If you have already made this payment, please disregard this notice. If you're experiencing financial difficulties, please contact us to discuss payment options.</p>
            
            <p>You can make your payment online through our parent portal or contact our office.</p>
            
            <p>Best regards,<br>
            ${process.env.SCHOOL_NAME}<br>
            ${process.env.SCHOOL_EMAIL}<br>
            ${process.env.SCHOOL_PHONE}</p>
          </div>
        `
      };

      return await this.sendEmail(emailOptions);

    } catch (error) {
      logger.error('Error sending overdue payment reminder:', error);
      throw error;
    }
  }

  async sendPaymentDueReminder(payment) {
    try {
      const Student = require('../models/Student');
      const User = require('../models/User');
      
      const student = await Student.findById(payment.studentId);
      const parent = await User.findById(payment.parentId);

      const daysUntilDue = Math.floor((payment.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

      const emailOptions = {
        to: parent.email,
        subject: `Payment Due Soon - ${student.fullName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2c5530;">Payment Due Reminder</h2>
            
            <p>Dear ${parent.firstName},</p>
            
            <p>This is a friendly reminder that a payment for ${student.fullName} is due in ${daysUntilDue} days.</p>
            
            <div style="background-color: #e8f4fd; border: 1px solid #bee5eb; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <h3>Payment Details</h3>
              <p><strong>Student:</strong> ${student.fullName}</p>
              <p><strong>Amount Due:</strong> ${payment.totalDue.toFixed(2)} ${payment.currency.toUpperCase()}</p>
              <p><strong>Description:</strong> ${payment.description}</p>
              <p><strong>Due Date:</strong> ${payment.dueDate.toLocaleDateString()}</p>
            </div>
            
            <p>You can make your payment online through our parent portal or contact our office if you have any questions.</p>
            
            <p>Thank you for your prompt attention to this matter.</p>
            
            <p>Best regards,<br>
            ${process.env.SCHOOL_NAME}<br>
            ${process.env.SCHOOL_EMAIL}<br>
            ${process.env.SCHOOL_PHONE}</p>
          </div>
        `
      };

      return await this.sendEmail(emailOptions);

    } catch (error) {
      logger.error('Error sending payment due reminder:', error);
      throw error;
    }
  }

  async sendRecurringPaymentFailed(payment) {
    try {
      const Student = require('../models/Student');
      const User = require('../models/User');
      
      const student = await Student.findById(payment.studentId);
      const parent = await User.findById(payment.parentId);

      const emailOptions = {
        to: parent.email,
        subject: `Recurring Payment Failed - ${student.fullName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc3545;">Recurring Payment Failed</h2>
            
            <p>Dear ${parent.firstName},</p>
            
            <p>We were unable to process your recurring payment for ${student.fullName} after multiple attempts. Your automatic payment has been suspended.</p>
            
            <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <h3>Payment Information</h3>
              <p><strong>Student:</strong> ${student.fullName}</p>
              <p><strong>Amount:</strong> ${payment.amount.toFixed(2)} ${payment.currency.toUpperCase()}</p>
              <p><strong>Description:</strong> ${payment.description}</p>
              <p><strong>Failed Attempts:</strong> ${payment.recurring.failedAttempts}</p>
            </div>
            
            <p>This could be due to:</p>
            <ul>
              <li>Expired or changed payment method</li>
              <li>Insufficient funds</li>
              <li>Bank security restrictions</li>
            </ul>
            
            <p>Please log into your parent portal to update your payment method and make this payment manually. You can also contact our office for assistance.</p>
            
            <p>Best regards,<br>
            ${process.env.SCHOOL_NAME}<br>
            ${process.env.SCHOOL_EMAIL}<br>
            ${process.env.SCHOOL_PHONE}</p>
          </div>
        `
      };

      return await this.sendEmail(emailOptions);

    } catch (error) {
      logger.error('Error sending recurring payment failed notification:', error);
      throw error;
    }
  }

  async sendWelcomeEmail(user, tempPassword = null) {
    try {
      const emailOptions = {
        to: user.email,
        subject: `Welcome to ${process.env.SCHOOL_NAME}!`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2c5530;">Welcome to ${process.env.SCHOOL_NAME}!</h2>
            
            <p>Dear ${user.firstName},</p>
            
            <p>Welcome to our school community! We're excited to have you and your family join us.</p>
            
            <p>Your account has been created and you now have access to our parent portal where you can:</p>
            <ul>
              <li>View your child's progress and observations</li>
              <li>Manage payments and view receipts</li>
              <li>Communicate with teachers</li>
              <li>Update your contact information</li>
              <li>Access school announcements and newsletters</li>
            </ul>
            
            ${tempPassword ? `
            <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <h3>Login Information</h3>
              <p><strong>Email:</strong> ${user.email}</p>
              <p><strong>Temporary Password:</strong> ${tempPassword}</p>
              <p><em>Please change your password after your first login.</em></p>
            </div>
            ` : ''}
            
            <p>If you have any questions or need assistance, please don't hesitate to contact us.</p>
            
            <p>We look forward to supporting your child's learning journey!</p>
            
            <p>Best regards,<br>
            The Team at ${process.env.SCHOOL_NAME}<br>
            ${process.env.SCHOOL_EMAIL}<br>
            ${process.env.SCHOOL_PHONE}</p>
          </div>
        `
      };

      return await this.sendEmail(emailOptions);

    } catch (error) {
      logger.error('Error sending welcome email:', error);
      throw error;
    }
  }

  async sendNewsletterEmail(newsletter, recipients) {
    try {
      const results = [];

      for (const recipient of recipients) {
        try {
          const emailOptions = {
            to: recipient,
            subject: newsletter.subject,
            html: newsletter.content.html,
            text: newsletter.content.text
          };

          if (newsletter.attachments && newsletter.attachments.length > 0) {
            emailOptions.attachments = newsletter.attachments.map(att => ({
              filename: att.originalName,
              path: att.path
            }));
          }

          const result = await this.sendEmail(emailOptions);
          results.push({ recipient, status: 'sent', messageId: result.messageId });

        } catch (error) {
          results.push({ recipient, status: 'failed', error: error.message });
          logger.error(`Failed to send newsletter to ${recipient}:`, error);
        }
      }

      return results;

    } catch (error) {
      logger.error('Error sending newsletter emails:', error);
      throw error;
    }
  }
}

module.exports = new NotificationService();