// 1. Import our tools
import { createClient } from '@supabase/supabase-js';
import emailService from './services/EmailService.js';
import { config } from './config.js';


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
    const supabaseUrl = config.SUPABASE_URL;
    const serviceRoleKey = config.SUPABASE_SERVICE_ROLE_KEY || config.SUPABASE_ANON_KEY;

    // 2. Connect to Supabase using Admin / Service Role Key
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // 3. Generate secure reset recovery link
    const { data } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email.trim(),
      options: { 
        redirectTo: `${request.headers.origin || 'https://smart-bite-rosy.vercel.app'}/reset-password` 
      }
    }).catch(err => ({ error: err }));

    const actionLink = data?.properties?.action_link || `${request.headers.origin || 'https://smart-bite-rosy.vercel.app'}/reset-password`;

    // 4. Send email using centralized EmailService
    await emailService.sendPasswordReset(email.trim(), { actionLink });

    return response.status(200).json({ success: true });
  } catch (err) {
    console.error('Error sending reset email:', err);
    // Anti-enumeration security: return success even if error occurs
    return response.status(200).json({ success: true });
  }
}
