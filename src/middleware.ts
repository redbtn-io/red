import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getRateLimitIdentifier, RateLimits } from '@/lib/rate-limit/rate-limit';

// Test bypass token - allows tests to skip rate limiting
const RATE_LIMIT_BYPASS_TOKEN = process.env.RATE_LIMIT_BYPASS_TOKEN || 'test-bypass-rate-limit-2026';

/**
 * Next.js Middleware - runs on all requests
 * Applies rate limiting based on path patterns
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip rate limiting for static files and internal Next.js routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') // Files with extensions (images, etc.)
  ) {
    return NextResponse.next();
  }
  
  // Check for rate limit bypass header (for testing)
  const bypassHeader = request.headers.get('X-RateLimit-Bypass');
  if (bypassHeader === RATE_LIMIT_BYPASS_TOKEN) {
    return NextResponse.next();
  }
  
  // Determine rate limit config based on path
  let rateLimitConfig = RateLimits.STANDARD;
  const identifier = getRateLimitIdentifier(request);
  
  // Auth endpoints - use standard limits (individual endpoints have their own stricter limits)
  if (pathname.startsWith('/api/auth/')) {
    rateLimitConfig = RateLimits.STANDARD;
  }
  // Chat/AI endpoints - moderate limits
  else if (pathname.startsWith('/api/v1/chat') || pathname.startsWith('/api/v1/messages')) {
    rateLimitConfig = RateLimits.CHAT;
  }
  // Other API endpoints - standard limits
  else if (pathname.startsWith('/api/')) {
    rateLimitConfig = RateLimits.STANDARD;
  }
  // Public pages - relaxed limits
  else {
    rateLimitConfig = RateLimits.RELAXED;
  }
  
  // Check rate limit (use in-memory for middleware due to edge runtime)
  const result = await checkRateLimit(identifier, rateLimitConfig, false);
  
  // Create response
  const response = result.success 
    ? NextResponse.next()
    : NextResponse.json(
        { 
          error: 'Too many requests',
          message: 'You have exceeded the rate limit. Please try again later.',
        },
        { status: 429 }
      );
  
  // Add rate limit headers
  response.headers.set('X-RateLimit-Limit', result.limit.toString());
  response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
  response.headers.set('X-RateLimit-Reset', new Date(Date.now() + result.resetMs).toISOString());
  response.headers.set('Retry-After', Math.ceil(result.resetMs / 1000).toString());
  
  return response;
}

/**
 * Configure which paths the middleware runs on
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
