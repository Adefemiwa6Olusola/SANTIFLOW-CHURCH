// SanctiFlow Email Service
// Sends password reset emails via SMTP (Gmail, Outlook, or any SMTP provider)

import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure transporter from environment variables
// For Gmail: Use an App Password (not your regular password)
//   1. Go to myaccount.google.com → Security → 2-Step Verification → App Passwords
//   2. Generate a password for "Mail"
//   3. Set SMTP_USER=your@gmail.com and SMTP_PASS=the-app-password
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM_NAME = process.env.SMTP_FROM_NAME || 'SanctiFlow';
const FROM_EMAIL = process.env.SMTP_USER || 'noreply@sanctiflow.app';

/**
 * Send a password reset email with a secure token link
 */
export async function sendPasswordResetEmail(toEmail, userName, resetToken, frontendUrl) {
  const resetLink = `${frontendUrl}/reset-password/${resetToken}`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#0f1219; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width:520px; margin:0 auto; padding:40px 20px;">
    
    <!-- Header -->
    <div style="text-align:center; margin-bottom:32px;">
      <div style="display:inline-block; width:48px; height:48px; border-radius:14px; background:linear-gradient(135deg,#f5c842,#e07b39); line-height:48px; font-size:22px; font-weight:900; color:#1a1000; text-align:center;">S</div>
      <h1 style="margin:12px 0 0; font-size:22px; color:#ffffff; font-weight:800; letter-spacing:-0.02em;">SanctiFlow</h1>
    </div>

    <!-- Card -->
    <div style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); border-radius:16px; padding:32px 28px; backdrop-filter:blur(20px);">
      
      <h2 style="margin:0 0 8px; color:#f5c842; font-size:18px; font-weight:700;">Password Reset Request</h2>
      <p style="margin:0 0 20px; color:rgba(255,255,255,0.7); font-size:14px; line-height:1.6;">
        Hi <strong style="color:#ffffff;">${userName || 'there'}</strong>,
      </p>
      <p style="margin:0 0 20px; color:rgba(255,255,255,0.7); font-size:14px; line-height:1.6;">
        We received a request to reset the password for your SanctiFlow account. Click the button below to set a new password:
      </p>

      <!-- CTA Button -->
      <div style="text-align:center; margin:28px 0;">
        <a href="${resetLink}" style="display:inline-block; padding:14px 36px; background:linear-gradient(135deg,#f5c842,#e07b39); color:#1a1000; text-decoration:none; border-radius:10px; font-weight:800; font-size:14px; letter-spacing:0.02em;">
          Reset My Password
        </a>
      </div>

      <p style="margin:0 0 12px; color:rgba(255,255,255,0.5); font-size:12px; line-height:1.5;">
        Or copy and paste this link into your browser:
      </p>
      <p style="margin:0 0 24px; word-break:break-all; color:#a78bfa; font-size:12px; line-height:1.5;">
        ${resetLink}
      </p>

      <!-- Expiry warning -->
      <div style="padding:12px 16px; background:rgba(245,200,66,0.08); border:1px solid rgba(245,200,66,0.15); border-radius:8px; margin-bottom:20px;">
        <p style="margin:0; color:#f5c842; font-size:12px; font-weight:600;">
          ⏰ This link expires in 1 hour and can only be used once.
        </p>
      </div>

      <!-- Security notice -->
      <div style="padding:12px 16px; background:rgba(239,68,68,0.06); border:1px solid rgba(239,68,68,0.12); border-radius:8px;">
        <p style="margin:0; color:#fca5a5; font-size:12px; line-height:1.5;">
          ⚠️ <strong>Didn't request this?</strong> If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged. If you're concerned about unauthorized access to your account, please contact your church administrator.
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align:center; margin-top:24px;">
      <p style="color:rgba(255,255,255,0.2); font-size:11px; margin:0;">
        © ${new Date().getFullYear()} SanctiFlow — AI Church Media OS
      </p>
      <p style="color:rgba(255,255,255,0.15); font-size:10px; margin:6px 0 0;">
        This is an automated message. Please do not reply.
      </p>
    </div>
  </div>
</body>
</html>`;

  const textBody = `
SanctiFlow — Password Reset Request

Hi ${userName || 'there'},

We received a request to reset the password for your SanctiFlow account.

Reset your password here: ${resetLink}

This link expires in 1 hour and can only be used once.

If you didn't request this, you can safely ignore this email. Your password will remain unchanged.

© ${new Date().getFullYear()} SanctiFlow — AI Church Media OS
`;

  const mailOptions = {
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to: toEmail,
    subject: '🔐 SanctiFlow — Password Reset Request',
    text: textBody,
    html: htmlBody,
  };

  // If SMTP is not configured, simulate sending in development/test environment
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('\n==================================================');
    console.log(`[EmailService] (DEVELOPMENT MODE - SMTP NOT CONFIGURED)`);
    console.log(`To: ${toEmail}`);
    console.log(`Subject: 🔐 SanctiFlow — Password Reset Request`);
    console.log(`Link: ${resetLink}`);
    console.log('==================================================\n');
    return { success: true, messageId: `mock-msg-${Date.now()}` };
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[EmailService] Password reset email sent to ${toEmail} (messageId: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[EmailService] Failed to send reset email to ${toEmail}:`, err.message);
    throw new Error(`Email delivery failed: ${err.message}`);
  }
}

/**
 * Verify the SMTP connection is working (call on server startup)
 */
export async function verifyEmailConnection() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[EmailService] ⚠ SMTP_USER and SMTP_PASS not configured — password reset emails will not be sent');
    return false;
  }
  try {
    await transporter.verify();
    console.log('[EmailService] ✅ SMTP connection verified — email sending is active');
    return true;
  } catch (err) {
    console.error('[EmailService] ❌ SMTP connection failed:', err.message);
    return false;
  }
}

/**
 * Send an OTP code email to a user for secure verification
 */
export async function sendOtpEmail(toEmail, userName, otpCode, expiryMinutes = 15) {
  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#0f1219; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width:520px; margin:0 auto; padding:40px 20px;">
    
    <!-- Header -->
    <div style="text-align:center; margin-bottom:32px;">
      <div style="display:inline-block; width:48px; height:48px; border-radius:14px; background:linear-gradient(135deg,#f5c842,#e07b39); line-height:48px; font-size:22px; font-weight:900; color:#1a1000; text-align:center;">S</div>
      <h1 style="margin:12px 0 0; font-size:22px; color:#ffffff; font-weight:800; letter-spacing:-0.02em;">SanctiFlow</h1>
    </div>

    <!-- Card -->
    <div style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); border-radius:16px; padding:32px 28px; backdrop-filter:blur(20px);">
      
      <h2 style="margin:0 0 8px; color:#f5c842; font-size:18px; font-weight:700;">Secure Verification Code</h2>
      <p style="margin:0 0 20px; color:rgba(255,255,255,0.7); font-size:14px; line-height:1.6;">
        Hi <strong style="color:#ffffff;">${userName || 'there'}</strong>,
      </p>
      <p style="margin:0 0 20px; color:rgba(255,255,255,0.7); font-size:14px; line-height:1.6;">
        We received a request to verify your identity. Use the one-time verification code (OTP) below to complete your password reset:
      </p>

      <!-- OTP Display -->
      <div style="text-align:center; margin:32px 0; padding:16px; background:rgba(255,255,255,0.04); border:1px dashed rgba(245,200,66,0.3); border-radius:12px;">
        <span style="font-family:'Courier New', Courier, monospace, sans-serif; font-size:36px; font-weight:800; color:#f5c842; letter-spacing:8px; padding-left:8px;">${otpCode}</span>
      </div>

      <!-- Expiry warning -->
      <div style="padding:12px 16px; background:rgba(245,200,66,0.08); border:1px solid rgba(245,200,66,0.15); border-radius:8px; margin-bottom:20px;">
        <p style="margin:0; color:#f5c842; font-size:12px; font-weight:600;">
          ⏰ This code is valid for ${expiryMinutes} minutes and can only be used once.
        </p>
      </div>

      <!-- Security notice -->
      <div style="padding:12px 16px; background:rgba(239,68,68,0.06); border:1px solid rgba(239,68,68,0.12); border-radius:8px;">
        <p style="margin:0; color:#fca5a5; font-size:12px; line-height:1.5;">
          ⚠️ <strong>Never Share This Code:</strong> SanctiFlow representatives will never ask for this code. Do not share it with anyone. If you didn't request a password reset, you can safely ignore this email.
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align:center; margin-top:24px;">
      <p style="color:rgba(255,255,255,0.2); font-size:11px; margin:0;">
        © ${new Date().getFullYear()} SanctiFlow — AI Church Media OS
      </p>
      <p style="color:rgba(255,255,255,0.15); font-size:10px; margin:6px 0 0;">
        This is an automated message. Please do not reply.
      </p>
    </div>
  </div>
</body>
</html>`;

  const textBody = `
SanctiFlow — Secure Verification Code

Hi ${userName || 'there'},

Your one-time verification code (OTP) is: ${otpCode}

This code is valid for ${expiryMinutes} minutes and can only be used once.

⚠️ Never Share This Code: SanctiFlow representatives will never ask for this code. Do not share it with anyone.

If you didn't request this, you can safely ignore this email.

© ${new Date().getFullYear()} SanctiFlow — AI Church Media OS
`;

  const mailOptions = {
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to: toEmail,
    subject: '🔐 SanctiFlow — Secure Verification Code',
    text: textBody,
    html: htmlBody,
  };

  // If SMTP is not configured, simulate sending in development/test environment
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('\n==================================================');
    console.log(`[EmailService] (DEVELOPMENT MODE - SMTP NOT CONFIGURED)`);
    console.log(`To: ${toEmail}`);
    console.log(`Subject: 🔐 SanctiFlow — Secure Verification Code`);
    console.log(`OTP Code: ${otpCode}`);
    console.log('==================================================\n');
    
    // Save to test file so local automated verification tests can read the OTP code
    try {
      const dataDir = path.join(__dirname, '../../data');
      if (fs.existsSync(dataDir)) {
        fs.writeFileSync(path.join(dataDir, 'last_otp_test.json'), JSON.stringify({ email: toEmail, otp: otpCode }), 'utf8');
      }
    } catch (e) {}

    return { success: true, messageId: `mock-otp-${Date.now()}` };
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[EmailService] OTP email sent to ${toEmail} (messageId: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[EmailService] Failed to send OTP email to ${toEmail}:`, err.message);
    throw new Error(`Email delivery failed: ${err.message}`);
  }
}
