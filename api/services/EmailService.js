import nodemailer from 'nodemailer';
import ejs from 'ejs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Template directory resolution supporting standard server & serverless bundling
const TEMPLATE_DIR = path.resolve(__dirname, '../templates/emails');

class EmailService {
  constructor() {
    this.transporter = null;
    this.dynamicTransporter = null;
  }

  /**
   * Get or initialize Nodemailer transporter
   */
  async getTransporter() {
    const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
    const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

    if (smtpUser && smtpPass) {
      if (!this.transporter) {
        this.transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || 'smtp.gmail.com',
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
        });
      }
      return this.transporter;
    }

    if (!this.dynamicTransporter) {
      console.log('[EMAIL SERVICE] No SMTP_USER configured. Generating temporary Ethereal SMTP account...');
      try {
        const testAccount = await nodemailer.createTestAccount();
        this.dynamicTransporter = nodemailer.createTransport({
          host: testAccount.smtp.host,
          port: testAccount.smtp.port,
          secure: testAccount.smtp.secure,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
        console.log(`[EMAIL SERVICE] Temporary Ethereal account generated: ${testAccount.user}`);
      } catch (err) {
        console.error('[EMAIL SERVICE] Failed to generate temporary Ethereal account:', err);
      }
    }
    return this.dynamicTransporter;
  }

  /**
   * Render an EJS email template with provided variables
   * @param {string} templateName - Base name of template without .ejs extension
   * @param {object} data - Dynamic variable payload
   * @returns {Promise<string>} Rendered HTML string
   */
  async renderTemplate(templateName, data = {}) {
    const templatePath = path.join(TEMPLATE_DIR, `${templateName}.ejs`);
    
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Email template '${templateName}' not found at path: ${templatePath}`);
    }

    const defaultData = {
      companyName: 'SGU Smart-Bite',
      supportEmail: process.env.SUPPORT_EMAIL || 'smartbite.sgu@gmail.com',
      currentYear: new Date().getFullYear(),
      ...data,
    };

    return new Promise((resolve, reject) => {
      ejs.renderFile(templatePath, defaultData, { root: TEMPLATE_DIR }, (err, str) => {
        if (err) return reject(err);
        resolve(str);
      });
    });
  }

  /**
   * Universal Send Email method
   */
  async sendEmail({ to, subject, template, data = {}, text = '', html = null, attachments = [] }) {
    if (!to) {
      throw new Error('Recipient email address (to) is required.');
    }

    let emailHtml = html;
    if (template) {
      emailHtml = await this.renderTemplate(template, data);
    }

    const activeTransporter = await this.getTransporter();
    const fromEmail = process.env.SMTP_USER || process.env.EMAIL_USER || activeTransporter?.options?.auth?.user || 'smartbite.sgu@gmail.com';
    const fromHeader = `"SGU Smart-Bite" <${fromEmail}>`;

    if (activeTransporter) {
      try {
        const mailOptions = {
          from: fromHeader,
          to: Array.isArray(to) ? to.join(', ') : to,
          subject,
          text: text || '',
          html: emailHtml,
          attachments,
        };

        const info = await activeTransporter.sendMail(mailOptions);
        console.log(`[EMAIL SERVICE] Email sent successfully to ${to}. MessageId: ${info.messageId}`);
        
        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
          console.log(`[EMAIL SERVICE] Ethereal Preview URL: ${previewUrl}`);
        }
        return { success: true, messageId: info.messageId, previewUrl };
      } catch (err) {
        console.error(`[EMAIL SERVICE ERROR] Failed to send email to ${to}:`, err);
        throw err;
      }
    } else {
      console.log(`[EMAIL SERVICE SIMULATION] Simulated email send to: ${to} | Subject: ${subject}`);
      return { simulated: true, to };
    }
  }

  /**
   * Helper: Send Digital Receipt / Order Confirmation
   */
  async sendOrderConfirmation(toEmail, order, items = []) {
    const totalVal = parseFloat(order.total) || 0;
    const subtotalVal = totalVal / 1.05;
    const gstVal = totalVal - subtotalVal;
    
    const subtotal = subtotalVal.toFixed(2);
    const gst = gstVal.toFixed(2);
    const total = totalVal.toFixed(2);

    const shopName = items[0]?.stallName || items[0]?.stallname || order.stallName || order.stallname || 'SGU Food Court';
    const paymentMethod = order.payment === 'Online UPI' ? 'UPI' : 'CASH';
    const customerName = order.customerName || order.customername || 'STUDENT';
    const itemCount = items.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const now = order.timestamp || new Date().toISOString();
    const dateFormatted = new Date(now).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    const itemsText = items.map(item => `   - ${item.quantity || 1}x ${item.name} (₹${item.price} each) - Stall: ${item.stallName || item.stallname || shopName}`).join('\n');

    const emailBodyText = `
RECEIPT
==================================================
ORDERS #${order.id}

PREPARED BY
${shopName.toUpperCase()}
Hours: 10 AM-10:45 PM

--------------------------------------------------
${itemCount} ${itemCount === 1 ? 'ITEM' : 'ITEMS'}
--------------------------------------------------
${itemsText}

--------------------------------------------------
Subtotal                : ₹${subtotal}
GST                     : ₹${gst}
--------------------------------------------------
TOTAL (GST INCLUDED)    : ₹${total}
PAYMENT                 : ${paymentMethod.toUpperCase()}

Thank you for dining with us!
==================================================
`;

    return this.sendEmail({
      to: toEmail,
      subject: `Your SGU Food Court Digital Receipt - #${order.id}`,
      template: 'order-confirmation',
      data: {
        order,
        items,
        shopName,
        paymentMethod,
        customerName,
        subtotal,
        gst,
        total,
        dateFormatted,
      },
      text: emailBodyText,
    });
  }

  /**
   * Helper: Send Password Reset Email
   */
  async sendPasswordReset(toEmail, { actionLink, userName }) {
    return this.sendEmail({
      to: toEmail,
      subject: 'Reset your Smart-Bite Password',
      template: 'password-reset',
      data: {
        actionLink,
        resetLink: actionLink,
        userName,
      },
      text: `Hello!\nClick the link below to reset your SGU Smart-Bite password:\n${actionLink}\n\nIf you did not request a password reset, please ignore this email.`,
    });
  }

  /**
   * Helper: Send Welcome Email
   */
  async sendWelcome(toEmail, { userName, loginLink }) {
    return this.sendEmail({
      to: toEmail,
      subject: 'Welcome to SGU Smart-Bite!',
      template: 'welcome',
      data: { userName, loginLink },
    });
  }

  /**
   * Helper: Send OTP Email
   */
  async sendOTP(toEmail, { otp, userName, expiryMinutes = 10 }) {
    return this.sendEmail({
      to: toEmail,
      subject: `Your SGU Smart-Bite Verification Code: ${otp}`,
      template: 'otp',
      data: { otp, userName, expiryMinutes },
    });
  }

  /**
   * Helper: Send Email Verification
   */
  async sendVerification(toEmail, { verificationLink, userName }) {
    return this.sendEmail({
      to: toEmail,
      subject: 'Verify your SGU Smart-Bite Email Address',
      template: 'email-verification',
      data: { verificationLink, userName },
    });
  }

  /**
   * Helper: Send Contact Form Notification
   */
  async sendContactForm(toEmail, { senderName, senderEmail, subject, message }) {
    return this.sendEmail({
      to: toEmail,
      subject: `Contact Form: ${subject || 'New Message'}`,
      template: 'contact-form',
      data: { senderName, senderEmail, subject, message },
    });
  }

  /**
   * Helper: Send General Notification
   */
  async sendNotification(toEmail, { title, userName, message, actionUrl, actionText }) {
    return this.sendEmail({
      to: toEmail,
      subject: title || 'SGU Smart-Bite Notification',
      template: 'notification',
      data: { title, userName, message, actionUrl, actionText },
    });
  }

  /**
   * Helper: Send Admin Alert
   */
  async sendAdminEmail(toEmail, { subject, message }) {
    return this.sendEmail({
      to: toEmail,
      subject: `[ADMIN ALERT] ${subject}`,
      template: 'admin-email',
      data: { subject, message },
    });
  }

  /**
   * Helper: Send Invitation Email
   */
  async sendInvitation(toEmail, { inviteeName, role, stallName, inviteLink }) {
    return this.sendEmail({
      to: toEmail,
      subject: 'Invitation to join SGU Smart-Bite Platform',
      template: 'invitation',
      data: { inviteeName, role, stallName, inviteLink },
    });
  }
}

export const emailService = new EmailService();
export default emailService;
