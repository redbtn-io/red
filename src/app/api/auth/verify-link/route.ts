import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import AuthCode from '@/lib/models/AuthCode';
import AuthSession from '@/lib/models/AuthSession';
import User, { AccountLevel } from '@/lib/models/User';

/**
 * GET /api/auth/verify-link?token=xxx
 * Verify magic link and authenticate the session
 * This page auto-closes after verification
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');

    if (!token) {
      return new NextResponse(
        `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Invalid Link - Red AI</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                display: flex;
                align-items: center;
                justify-center;
                min-height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
                color: white;
              }
              .container {
                text-align: center;
                padding: 40px;
                max-width: 500px;
              }
              .icon { font-size: 64px; margin-bottom: 20px; }
              h1 { font-size: 24px; margin: 20px 0; }
              p { font-size: 16px; color: #999; line-height: 1.6; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="icon">❌</div>
              <h1>Invalid Link</h1>
              <p>This magic link is invalid or missing.</p>
            </div>
          </body>
        </html>
        `,
        {
          status: 400,
          headers: { 'Content-Type': 'text/html' },
        }
      );
    }

    await connectToDatabase();

    // Find the auth code
    const authCode = await AuthCode.findOne({
      token,
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!authCode) {
      return new NextResponse(
        `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Expired Link - Red AI</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                display: flex;
                align-items: center;
                justify-center;
                min-height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
                color: white;
              }
              .container {
                text-align: center;
                padding: 40px;
                max-width: 500px;
              }
              .icon { font-size: 64px; margin-bottom: 20px; }
              h1 { font-size: 24px; margin: 20px 0; }
              p { font-size: 16px; color: #999; line-height: 1.6; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="icon">⏰</div>
              <h1>Link Expired</h1>
              <p>This magic link has expired or has already been used. Please request a new one.</p>
            </div>
          </body>
        </html>
        `,
        {
          status: 401,
          headers: { 'Content-Type': 'text/html' },
        }
      );
    }

    // Mark token as used
    await AuthCode.updateOne({ _id: authCode._id }, { used: true });

    // Find or create user
    let user = await User.findOne({ email: authCode.email });
    const isNewUser = !user;

    if (!user) {
      user = await User.create({
        email: authCode.email,
        profileComplete: false,
        agreedToTerms: false,
        accountLevel: AccountLevel.USER,
      });
    }

    // Update the auth session to mark it as authenticated
    await AuthSession.findOneAndUpdate(
      { sessionId: authCode.sessionId },
      {
        authenticated: true,
        userId: user._id.toString(),
        isNewUser,
        profileComplete: user.profileComplete,
      }
    );

    console.log('[Auth] Magic link verified:', authCode.email, 'sessionId:', authCode.sessionId);

    // Return success page that auto-closes
    return new NextResponse(
      `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Sign In Successful - Red AI</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-center;
              min-height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
              color: white;
            }
            .container {
              text-align: center;
              padding: 40px;
              max-width: 500px;
            }
            .icon { font-size: 64px; margin-bottom: 20px; animation: bounce 0.5s; }
            @keyframes bounce {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-20px); }
            }
            h1 { font-size: 24px; margin: 20px 0; }
            p { font-size: 16px; color: #999; line-height: 1.6; }
            .closing { color: #ef4444; font-weight: bold; margin-top: 20px; }
          </style>
          <script>
            // Auto-close after 2 seconds
            setTimeout(() => {
              window.close();
              // If window.close() doesn't work (some browsers restrict it), show message
              setTimeout(() => {
                document.querySelector('.closing').textContent = 'You can close this tab now.';
              }, 500);
            }, 2000);
          </script>
        </head>
        <body>
          <div class="container">
            <div class="icon">✅</div>
            <h1>Successfully Signed In!</h1>
            <p>Your browser has been authenticated.</p>
            <p class="closing">This tab will close automatically...</p>
          </div>
        </body>
      </html>
      `,
      {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      }
    );
  } catch (error) {
    console.error('[Auth] Verify link error:', error);
    return new NextResponse(
      `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Error - Red AI</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-center;
              min-height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
              color: white;
            }
            .container {
              text-align: center;
              padding: 40px;
              max-width: 500px;
            }
            .icon { font-size: 64px; margin-bottom: 20px; }
            h1 { font-size: 24px; margin: 20px 0; }
            p { font-size: 16px; color: #999; line-height: 1.6; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">⚠️</div>
            <h1>Something Went Wrong</h1>
            <p>There was an error verifying your magic link. Please try again.</p>
          </div>
        </body>
      </html>
      `,
      {
        status: 500,
        headers: { 'Content-Type': 'text/html' },
      }
    );
  }
}
