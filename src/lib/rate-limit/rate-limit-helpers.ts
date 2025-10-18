import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getRateLimitIdentifier, RateLimitConfig } from './rate-limit';

/**
 * API Route helper to check rate limit and return response
 * Use this inside API routes for custom rate limiting
 * 
 * @example
 * ```ts
 * export async function POST(request: NextRequest) {
 *   const rateLimitResult = await rateLimitAPI(request, RateLimits.STRICT);
 *   if (rateLimitResult) return rateLimitResult;
 *   
 *   // Your API logic here...
 * }
 * ```
 */
export async function rateLimitAPI(
  request: NextRequest,
  config: RateLimitConfig,
  userId?: string
): Promise<NextResponse | null> {
  const identifier = getRateLimitIdentifier(request, userId);
  const result = await checkRateLimit(identifier, config);
  
  if (!result.success) {
    const response = NextResponse.json(
      {
        error: 'Too many requests',
        message: 'You have exceeded the rate limit. Please try again later.',
        retryAfter: Math.ceil(result.resetMs / 1000),
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
  
  // Success - return null (no response, continue with API logic)
  return null;
}

/**
 * Higher-order function to wrap API routes with rate limiting
 * 
 * @example
 * ```ts
 * export const POST = withRateLimit(
 *   async (request: NextRequest) => {
 *     // Your API logic here...
 *     return NextResponse.json({ success: true });
 *   },
 *   RateLimits.STRICT
 * );
 * ```
 */
export function withRateLimit(
  handler: (request: NextRequest, ...args: unknown[]) => Promise<NextResponse>,
  config: RateLimitConfig,
  getUserId?: (request: NextRequest) => Promise<string | undefined>
) {
  return async (request: NextRequest, ...args: unknown[]) => {
    const userId = getUserId ? await getUserId(request) : undefined;
    const rateLimitResult = await rateLimitAPI(request, config, userId);
    
    if (rateLimitResult) {
      return rateLimitResult;
    }
    
    return handler(request, ...args);
  };
}
