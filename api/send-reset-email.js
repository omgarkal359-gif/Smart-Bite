// 1. Import our tools
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

export default async function handler(request, response) {
  // Only allow our React app to "POST" data to this file
  if (request.method !== 'POST') {
    return response.status(405).send('Not Allowed');
  }
  
  // Grab the email address the student typed into the frontend
  const { email } = request.body;

  if (!email) {
    return response.status(400).json({ error: 'Email is required' });
  }

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://hmdewtmtxgfyunyypcon.supabase.co';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    // 2. Connect to Supabase using Admin / Service Role Key
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // 3. Generate secure reset recovery link
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email.trim(),
      options: { 
        redirectTo: `${request.headers.origin || 'https://smart-bite-rosy.vercel.app'}/reset-password` 
      }
    }).catch(err => ({ error: err }));

    const actionLink = data?.properties?.action_link || `${request.headers.origin || 'https://smart-bite-rosy.vercel.app'}/reset-password`;

    // 4. Set up Gmail / SMTP Transporter using Nodemailer
    const emailUser = process.env.EMAIL_USER || process.env.SMTP_USER || 'smartbite.sgu@gmail.com';
    const emailPass = process.env.EMAIL_PASS || process.env.SMTP_PASS || '';

    if (emailPass) {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: emailUser,
          pass: emailPass,
        },
      });

      // 5. Design the email
      const emailContent = {
        from: `"SGU Smart-Bite" <${emailUser}>`,
        to: email.trim(),
        subject: 'Reset your Smart-Bite Password',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #0B132B; color: #FFFFFF; border-radius: 16px;">
            <h2 style="color: #E4002B; text-align: center;">SGU Smart-Bite</h2>
            <p style="font-size: 14px; text-align: center; color: #CBD5E1;">Hello!</p>
            <p style="font-size: 14px; text-align: center; color: #CBD5E1;">Click the link below to reset your SGU Smart-Bite password:</p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${actionLink}" style="background: #E4002B; color: #FFFFFF; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: bold; display: inline-block;">Reset Password</a>
            </div>
            <p style="font-size: 12px; color: #94A3B8; text-align: center;">If you did not request a password reset, please ignore this email.</p>
          </div>
        `
      };

      // 6. Send it and return response!
      await transporter.sendMail(emailContent);
    }

    return response.status(200).json({ success: true });
  } catch (err) {
    console.error('Error sending reset email:', err);
    // Anti-enumeration security: return success even if error occurs
    return response.status(200).json({ success: true });
  }
}
