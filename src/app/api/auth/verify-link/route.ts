import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/database/mongodb';
import User, { AccountLevel } from '@/lib/database/models/auth/User';
import { auth, generateToken } from '@/lib/auth/auth';
import { peekMagicLink } from 'red-auth';

/**
 * GET /api/auth/verify-link?token=xxx
 * Verify magic link and authenticate the session (powered by redAuth)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');

    if (!token) {
      return new NextResponse(renderPage('❌', 'Invalid Link', 'This link is invalid or missing.'),
        { status: 400, headers: { 'Content-Type': 'text/html' } });
    }

    // Peek at magic link via redAuth (non-destructive)
    const conn = await auth.getConnection();
    const peekResult = await peekMagicLink(token, conn);

    if (!peekResult) {
      return new NextResponse(renderPage('⏰', 'Link Expired', 'This link has expired or has already been used. Please request a new one.'),
        { status: 401, headers: { 'Content-Type': 'text/html' } });
    }

    // Find or create user in app's User model
    await connectToDatabase();
    let user = await User.findOne({ email: peekResult.email });

    if (!user) {
      user = await User.create({
        email: peekResult.email,
        profileComplete: false,
        agreedToTerms: false,
        accountLevel: AccountLevel.FREE,
      });
    }

    // Create JWT and verify+consume the magic link (stores JWT for polling)
    const jwt = generateToken({
      userId: user._id.toString(),
      email: user.email,
      accountLevel: user.accountLevel,
    });
    await auth.verifyMagicLinkToken(token, jwt);

    console.log('[Auth] Sign in link verified:', peekResult.email);

    return new NextResponse(renderPage('✅', 'Successfully Signed In!', 'Your browser has been authenticated.', true),
      { status: 200, headers: { 'Content-Type': 'text/html' } });
  } catch (error) {
    console.error('[Auth] Verify link error:', error);
    return new NextResponse(renderPage('⚠️', 'Something Went Wrong', 'There was an error verifying your link. Please try again.'),
      { status: 500, headers: { 'Content-Type': 'text/html' } });
  }
}

function renderPage(icon: string, title: string, message: string, autoClose = false): string {
  return `<!DOCTYPE html><html><head><title>${title} - redbtn</title>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:linear-gradient(135deg,#0a0a0a 0%,#1a1a1a 100%);color:#fff}.container{text-align:center;padding:40px;max-width:500px;margin:0 auto}.icon{font-size:64px;margin-bottom:20px${autoClose ? ';animation:bounce .5s' : ''}}${autoClose ? '@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-20px)}}' : ''}h1{font-size:24px;margin:20px 0}p{font-size:16px;color:#999;line-height:1.6}.closing{color:#ef4444;font-weight:700;margin-top:20px}</style>
${autoClose ? '<script>setTimeout(()=>{window.close();setTimeout(()=>{document.querySelector(".closing").textContent="You can close this tab now."},500)},2000)</script>' : ''}
</head><body><div class="container"><div class="icon">${icon}</div><h1>${title}</h1><p>${message}</p>${autoClose ? '<p class="closing">This tab will close automatically...</p>' : ''}</div></body></html>`;
}
