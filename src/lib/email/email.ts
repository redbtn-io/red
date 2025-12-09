import nodemailer from 'nodemailer';
import crypto from 'crypto';

// Create reusable transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_PORT === '465', // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Changed from EMAIL_PASSWORD to EMAIL_PASS
  },
});

/**
 * Generate a secure random token for sign in links
 */
export function generateMagicToken(): string {
  // Generate 32-byte random token, base64url encoded
  const buffer = crypto.randomBytes(32);
  return buffer.toString('base64url');
}

/**
 * Send sign in link email
 */
export async function sendMagicLinkEmail(
  email: string,
  token: string,
  baseUrl: string
): Promise<void> {
  const magicLink = `${baseUrl}/api/auth/verify-link?token=${token}`;
  const fromAddress = process.env.EMAIL_FROM || process.env.EMAIL_USER;
  console.log('[Email] Generated magic link:', magicLink);
  const mailOptions = {
    from: `"Red AI" <${fromAddress}>`,
    to: email,
    subject: 'Sign in to Red AI',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .container {
              background-color: #ffffff;
              border-radius: 8px;
              padding: 40px;
              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }
            .logo {
              text-align: center;
              margin-bottom: 30px;
            }
            .logo h1 {
              color: #ef4444;
              font-size: 32px;
              margin: 0;
            }
            .button-container {
              text-align: center;
              margin: 40px 0;
            }
            .button {
              display: inline-block;
              padding: 16px 40px;
              background-color: #ef4444;
              color: #ffffff;
              text-decoration: none;
              border-radius: 8px;
              font-weight: bold;
              font-size: 18px;
              transition: background-color 0.2s;
            }
            .button:hover {
              background-color: #dc2626;
            }
            .message {
              font-size: 16px;
              color: #666;
              margin: 20px 0;
              text-align: center;
            }
            .link-fallback {
              font-size: 14px;
              color: #999;
              margin-top: 20px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              word-break: break-all;
            }
            .warning {
              font-size: 14px;
              color: #999;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <h1>🔴 Red AI</h1>
            </div>
            
            <p class="message">
              Click the button below to sign in to Red AI:
            </p>
            
            <div class="button-container">
              <a href="${magicLink}" class="button">Sign In to Red AI</a>
            </div>
            
            <p class="message">
              This link will expire in <strong>10 minutes</strong>.
            </p>
            
            <p class="message">
              You can open this link on any device. Your original browser will be automatically signed in.
            </p>
            
            <div class="link-fallback">
              <p><strong>Or copy and paste this link:</strong></p>
              <p>${magicLink}</p>
            </div>
            
            <div class="warning">
              <p>
                <strong>Security tip:</strong> If you didn't request this sign in link, you can safely ignore this email.
              </p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
Sign In to Red AI

Click this link to sign in:
${magicLink}

This link will expire in 10 minutes.

You can open this link on any device. Your original browser will be automatically signed in.

If you didn't request this sign in link, you can safely ignore this email.
    `.trim(),
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('[Email] Sign in link sent to:', email);
  } catch (error) {
    console.error('[Email] Failed to send sign in link:', error);
    throw new Error('Failed to send sign in link email');
  }
}

/**
 * Verify email configuration on startup
 */
export async function verifyEmailConfig(): Promise<boolean> {
  try {
    await transporter.verify();
    console.log('[Email] SMTP configuration verified');
    return true;
  } catch (error) {
    console.error('[Email] SMTP configuration error:', error);
    return false;
  }
}
