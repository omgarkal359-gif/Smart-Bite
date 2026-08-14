import nodemailer from 'nodemailer';
import { config } from '../config.js';

const transporter = nodemailer.createTransport({
  host: config.SMTP_HOST || 'smtp.ethereal.email',
  port: config.SMTP_PORT || 587,
  secure: config.SMTP_SECURE,
  auth: {
    user: config.SMTP_USER || '',
    pass: config.SMTP_PASS || '',
  },
});

let dynamicTransporter = null;
let etherealInitPromise = null;

// Bootstrap Ethereal transporter asynchronously on startup to avoid blocking API threads
export function initSmtp() {
  if (config.SMTP_USER && config.SMTP_PASS) return Promise.resolve();

  console.log('[RECEIPT SMTP] No SMTP_USER configured. Bootstrapping Ethereal SMTP test account asynchronously...');
  etherealInitPromise = nodemailer.createTestAccount()
    .then(testAccount => {
      dynamicTransporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
      console.log(`[RECEIPT SMTP] Ethereal test account initialized: ${testAccount.user}`);
    })
    .catch(err => {
      console.error('[RECEIPT SMTP] Failed to generate temporary Ethereal account on startup:', err);
    });
  return etherealInitPromise;
}

async function getTransporter() {
  if (config.SMTP_USER && config.SMTP_PASS) {
    return transporter;
  }
  if (etherealInitPromise) {
    await etherealInitPromise;
  }
  return dynamicTransporter;
}

export async function sendReceiptEmail(toEmail, order, items) {
  const itemsText = items.map(item => `   - ${item.quantity}x ${item.name} (₹${item.price} each) - Stall: ${item.stallName || item.stallname}`).join('\n');
  
  const totalVal = parseFloat(order.total) || 0;
  const subtotalVal = totalVal / 1.05;
  const gstVal = totalVal - subtotalVal;
  
  const subtotal = subtotalVal.toFixed(2);
  const gst = gstVal.toFixed(2);
  const total = totalVal.toFixed(2);

  const shopName = items[0]?.stallName || items[0]?.stallname || 'SGU Food Court';
  const paymentMethod = order.payment === 'Online UPI' ? 'UPI' : 'CASH';
  const itemCount = items.reduce((sum, item) => sum + (item.quantity || 1), 0);
  const now = new Date().toISOString();

  const itemsHtml = items.map(item => `
    <tr>
      <td style="padding-top: 4px; padding-bottom: 4px; text-align: left; vertical-align: top; text-transform: uppercase;">
        ${item.name}
      </td>
      <td style="padding-top: 4px; padding-bottom: 4px; text-align: center; vertical-align: top; width: 40px;">
        ${item.quantity || 1}
      </td>
      <td style="padding-top: 4px; padding-bottom: 4px; text-align: right; vertical-align: top; width: 80px;">
        ₹${((item.price || 0) * (item.quantity || 1)).toFixed(2)}
      </td>
    </tr>
  `).join('');

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

  const emailBodyHtml = `
    <div style="background-color: #f3f4f6; padding: 30px 15px; font-family: 'Courier New', Courier, monospace; min-height: 100%;">
      <div style="background-color: #ffffff; max-width: 380px; width: 100%; padding: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border-top: 5px dashed #000000; border-bottom: 5px dashed #000000; margin: 0 auto; color: #000000; box-sizing: border-box;">
        
        <div style="text-align: center; margin-bottom: 15px;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; line-height: 1.2;">SGU FOOD COURT</h1>
          <h2 style="margin: 5px 0 0 0; font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">STALL: ${shopName.toUpperCase()}</h2>
          <p style="margin: 5px 0 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">HOURS: 10 AM-10:45 PM</p>
        </div>
        
        <div style="border-bottom: 2px dashed #000000; margin: 15px 0;"></div>
        
        <div style="font-size: 12px; font-weight: bold; margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-weight: 900; text-transform: uppercase;">ORDER ID:</span>
            <span style="font-weight: 900;">${order.id.toUpperCase()}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-weight: 900; text-transform: uppercase;">DATE:</span>
            <span>${new Date(order.timestamp || now).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }).toUpperCase()}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-weight: 900; text-transform: uppercase;">CUSTOMER:</span>
            <span>${order.customerName ? order.customerName.toUpperCase() : (order.customername ? order.customername.toUpperCase() : 'STUDENT')}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-weight: 900; text-transform: uppercase;">PAYMENT:</span>
            <span style="font-weight: 900;">${paymentMethod.toUpperCase()}</span>
          </div>
        </div>
        
        <div style="border-bottom: 2px dashed #000000; margin: 15px 0;"></div>
        
        <div style="margin-bottom: 15px;">
          <div style="font-size: 12px; font-weight: 900; display: flex; justify-content: space-between; padding-bottom: 8px; border-bottom: 1px dashed #000000;">
            <span>ITEM DESCRIPTION</span>
            <span style="text-align: center; width: 40px;">QTY</span>
            <span style="text-align: right; width: 80px;">AMOUNT</span>
          </div>
          <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; font-family: 'Courier New', Courier, monospace; font-size: 12px; font-weight: bold; margin-top: 8px;">
            ${itemsHtml}
          </table>
        </div>
        
        <div style="border-bottom: 2px dashed #000000; margin: 15px 0;"></div>
        
        <div style="font-size: 12px; font-weight: bold; margin-bottom: 15px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-weight: 900; text-transform: uppercase;">SUBTOTAL:</span>
            <span>₹${subtotal}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-weight: 900; text-transform: uppercase;">GST (5.0%):</span>
            <span>₹${gst}</span>
          </div>
          
          <div style="border-bottom: 1px solid #000000; margin: 8px 0;"></div>
          
          <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 900; margin-top: 8px;">
            <span style="font-weight: 900; text-transform: uppercase;">TOTAL (INCL. GST):</span>
            <span>₹${total}</span>
          </div>
        </div>
        
        <div style="border-bottom: 2px dashed #000000; margin: 15px 0;"></div>
        
        <div style="text-align: center; margin-top: 15px;">
          <p style="margin: 0; font-size: 11px; font-weight: 900; letter-spacing: 1px;">*** THANK YOU FOR YOUR VISIT ***</p>
          <p style="margin: 3px 0 0 0; font-size: 9px; font-weight: bold;">SGU SMARTBITE DIGITAL RECEIPT</p>
        </div>
        
        <div style="text-align: center; margin-top: 20px;">
          <div style="display: inline-block; font-size: 20px; font-weight: 300; letter-spacing: 1px; transform: scaleY(1.3); line-height: 1;">
            ||| | || |||| | | ||| || ||| || ||
          </div>
          <div style="font-size: 9px; letter-spacing: 2px; text-transform: uppercase; margin-top: 5px;">*SGU-ORDER-${order.id}*</div>
        </div>
        
      </div>
    </div>
  `;

  const activeTransporter = await getTransporter();
  if (activeTransporter) {
    try {
      const fromEmail = config.SMTP_USER || activeTransporter.options.auth.user;
      const info = await activeTransporter.sendMail({
        from: `"SGU Food Court" <${fromEmail}>`,
        to: toEmail,
        subject: `Your SGU Food Court Digital Receipt - #${order.id}`,
        text: emailBodyText,
        html: emailBodyHtml,
      });
      console.log(`[RECEIPT SMTP] Receipt sent to ${toEmail} successfully.`);
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log(`[RECEIPT SMTP] Preview URL (Click to view): ${previewUrl}`);
      }
      return { success: true, previewUrl };
    } catch (err) {
      console.error('[RECEIPT SMTP] Failed to send email via nodemailer:', err);
      throw err;
    }
  } else {
    console.log(`[RECEIPT SMTP] No SMTP_USER and failed to generate temporary Ethereal account. Simulating email send to: ${toEmail}`);
    return { simulated: true, toEmail };
  }
}

export async function sendPasswordResetEmail(toEmail, actionLink) {
  const activeTransporter = await getTransporter();
  const fromEmail = config.SMTP_USER || (activeTransporter ? activeTransporter.options.auth.user : '');

  const emailBodyText = `
Click the link below to reset your SGU Smart-Bite password:
${actionLink}
`;

  const emailBodyHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #0B132B; color: #FFFFFF; border-radius: 16px;">
      <h2 style="color: #E4002B; text-align: center;">SGU Smart-Bite</h2>
      <p style="font-size: 14px; text-align: center; color: #CBD5E1;">Hello!</p>
      <p style="font-size: 14px; text-align: center; color: #CBD5E1;">Click the link below to reset your SGU Smart-Bite password:</p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${actionLink}" style="background: #E4002B; color: #FFFFFF; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: bold; display: inline-block;">Reset Password</a>
      </div>
      <p style="font-size: 12px; color: #94A3B8; text-align: center;">If you did not request a password reset, please ignore this email.</p>
    </div>
  `;

  if (activeTransporter) {
    try {
      const info = await activeTransporter.sendMail({
        from: `"SGU Smart-Bite" <${fromEmail}>`,
        to: toEmail,
        subject: 'Reset your Smart-Bite Password',
        text: emailBodyText,
        html: emailBodyHtml
      });
      console.log(`[RESET SMTP] Password reset email sent to ${toEmail} successfully.`);
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log(`[RESET SMTP] Preview URL (Click to view): ${previewUrl}`);
      }
      return { success: true, previewUrl };
    } catch (err) {
      console.error('[RESET SMTP] Failed to send reset email via nodemailer:', err);
      throw err;
    }
  } else {
    console.log(`[RESET SMTP] No SMTP configured. Simulating password reset email to: ${toEmail}`);
    return { simulated: true, toEmail };
  }
}
