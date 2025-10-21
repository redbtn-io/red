# Rate Limiting System

This project implements a comprehensive rate limiting system to protect API endpoints from abuse and ensure fair usage.

## Features

- ✅ **Automatic Rate Limiting** via Next.js middleware
- ✅ **Multiple Rate Limit Tiers** for different endpoint types
- ✅ **IP-based & User-based** identification
- ✅ **In-memory storage** (development) + **Redis support** (production)
- ✅ **Standard HTTP headers** (X-RateLimit-*, Retry-After)
- ✅ **Per-route customization** for granular control

## Architecture

### Storage Backends

**Development (In-Memory)**
- Uses Map-based in-memory storage
- Automatic cleanup of expired entries
- **Perfect for single-server development**
- No external dependencies

**Production (Redis)**
- Distributed rate limiting across multiple servers
- Persistent across server restarts
- Atomic operations using Redis transactions
- **Automatic fallback to in-memory if Redis fails**

To enable Redis, set the environment variable:
```bash
REDIS_URL=redis://localhost:6379
```

## Rate Limit Tiers

| Tier | Limit | Window | Use Case |
|------|-------|--------|----------|
| **STRICT** | 5 req | 60s | Sensitive operations (not currently used) |
| **AUTH** | 10 req | 300s | Authentication endpoints (magic links, login) |
| **CHAT** | 30 req | 60s | Chat/AI completion endpoints |
| **STANDARD** | 100 req | 60s | General authenticated API endpoints |
| **RELAXED** | 300 req | 60s | Public read-only endpoints |

## Implementation

### 1. Global Middleware (Automatic)

The middleware runs on **all requests** and applies rate limiting based on path patterns:

```typescript
// src/middleware.ts
// Automatically applies to all routes
// Note: Uses in-memory storage only (middleware runs in edge runtime)
```

**Path-based Rules:**
- `/api/auth/*` → AUTH tier (10 req / 5 min)
- `/api/v1/chat/*` → CHAT tier (30 req / min)
- `/api/v1/messages/*` → CHAT tier (30 req / min)
- `/api/*` → STANDARD tier (100 req / min)
- Other pages → RELAXED tier (300 req / min)

**⚠️ Important:** Middleware rate limiting uses **in-memory storage only** because Next.js middleware runs in the edge runtime which doesn't support Redis. For distributed rate limiting, use per-route rate limiting in API routes (see below).

### 2. Per-Route Rate Limiting (Optional)

For additional control, use the helper functions in specific API routes:

**Option A: Manual Check**
```typescript
import { rateLimitAPI, RateLimits } from '@/lib/rate-limit-helpers';

export async function POST(request: NextRequest) {
  // Check rate limit
  const rateLimitResult = await rateLimitAPI(request, RateLimits.STRICT);
  if (rateLimitResult) return rateLimitResult; // Returns 429 if exceeded
  
  // Your API logic here...
  return NextResponse.json({ success: true });
}
```

**Option B: Higher-Order Function**
```typescript
import { withRateLimit } from '@/lib/rate-limit-helpers';
import { RateLimits } from '@/lib/rate-limit';

export const POST = withRateLimit(
  async (request: NextRequest) => {
    // Your API logic here...
    return NextResponse.json({ success: true });
  },
  RateLimits.STRICT
);
```

**Option C: User-based Rate Limiting**
```typescript
import { withRateLimit } from '@/lib/rate-limit-helpers';
import { RateLimits } from '@/lib/rate-limit';
import { getUserFromRequest } from '@/lib/auth';

export const POST = withRateLimit(
  async (request: NextRequest) => {
    // Your API logic here...
    return NextResponse.json({ success: true });
  },
  RateLimits.STANDARD,
  async (request) => {
    const user = await getUserFromRequest(request);
    return user?.id;
  }
);
```

## Response Headers

All rate-limited responses include standard headers:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 2025-10-11T12:34:56.789Z
Retry-After: 45
```

When rate limit is exceeded (429 response):
```json
{
  "error": "Too many requests",
  "message": "You have exceeded the rate limit. Please try again later.",
  "retryAfter": 45
}
```

## Identifier Strategy

The system identifies clients in this order:

1. **User ID** (if authenticated) - `user:123`
2. **IP Address** (fallback) - `ip:192.168.1.1`

IP detection works with reverse proxies using these headers:
- `x-forwarded-for` (standard proxy header)
- `x-real-ip` (nginx)
- `cf-connecting-ip` (Cloudflare)

## Custom Rate Limits

To create custom rate limits:

```typescript
import { RateLimitConfig } from '@/lib/rate-limit';

const customLimit: RateLimitConfig = {
  limit: 50,        // 50 requests
  windowSeconds: 120 // per 2 minutes
};
```

## Testing Rate Limits

**Development Test:**
```bash
# Send 15 requests quickly to auth endpoint
for i in {1..15}; do
  curl -X POST http://localhost:3000/api/auth/request-code \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","sessionId":"test"}' &
done
```

After 10 requests (AUTH limit), you'll get:
```json
{
  "error": "Too many requests",
  "message": "You have exceeded the rate limit. Please try again later.",
  "retryAfter": 280
}
```

## Production Setup

### With Redis (Recommended)

1. **Install ioredis:**
```bash
npm install ioredis
```

2. **Set environment variable:**
```bash
REDIS_URL=redis://your-redis-host:6379
```

3. **That's it!** The system automatically uses Redis when available.

### Without Redis

The system works perfectly with in-memory storage for single-server deployments. No additional setup needed.

## Monitoring

To monitor rate limit usage, check the response headers:

```typescript
// In your API client
const response = await fetch('/api/endpoint');
const limit = response.headers.get('X-RateLimit-Limit');
const remaining = response.headers.get('X-RateLimit-Remaining');
const reset = response.headers.get('X-RateLimit-Reset');

console.log(`${remaining}/${limit} requests remaining until ${reset}`);
```

## Bypass for Testing

To bypass rate limiting in tests:

1. **Environment variable:**
```bash
DISABLE_RATE_LIMIT=true
```

2. **Modify middleware:**
```typescript
// src/middleware.ts
export async function middleware(request: NextRequest) {
  if (process.env.DISABLE_RATE_LIMIT === 'true') {
    return NextResponse.next();
  }
  // ... rest of middleware
}
```

## Files

- `src/lib/rate-limit.ts` - Core rate limiting logic
- `src/lib/rate-limit-helpers.ts` - API route helpers
- `src/middleware.ts` - Global middleware with path-based rules

## Examples

### Currently Implemented

✅ **Auth Endpoints** (`/api/auth/request-code`)
- Uses AUTH tier (10 requests / 5 minutes)
- Prevents email spam and brute force attacks

### Recommended Additions

Consider adding explicit rate limiting to:

1. **Expensive Operations:**
```typescript
// src/app/api/v1/chat/completions/route.ts
const rateLimitResult = await rateLimitAPI(request, RateLimits.CHAT, user.id);
```

2. **User-specific Limits:**
```typescript
// Different limits for free vs paid users
const limit = user.isPaid ? RateLimits.RELAXED : RateLimits.STANDARD;
```

3. **Admin Bypass:**
```typescript
// Skip rate limiting for admins
if (user.accountLevel === 0) {
  // Skip rate limit check
} else {
  const rateLimitResult = await rateLimitAPI(request, RateLimits.STANDARD);
  if (rateLimitResult) return rateLimitResult;
}
```

## Troubleshooting

**Issue: Rate limits trigger too quickly**
- Check if you're behind a proxy - the IP might always be `127.0.0.1`
- Solution: Ensure your reverse proxy sets `X-Forwarded-For` header

**Issue: Rate limits don't work across servers**
- In-memory storage only works on single server
- Solution: Set up Redis for distributed rate limiting

**Issue: Redis connection errors**
- Check `REDIS_URL` environment variable
- System automatically falls back to in-memory storage

## Security Best Practices

1. ✅ **Use AUTH tier for authentication** - Prevents brute force
2. ✅ **Use user ID when possible** - More accurate than IP
3. ✅ **Monitor 429 responses** - Detect abuse patterns
4. ✅ **Set Retry-After headers** - Help clients back off properly
5. ✅ **Use Redis in production** - Ensure consistent limits across servers

## Future Enhancements

- [ ] Rate limit dashboard/admin panel
- [ ] Per-user custom limits (stored in database)
- [ ] Whitelist/blacklist IP addresses
- [ ] Exponential backoff for repeat offenders
- [ ] GraphQL/WebSocket rate limiting
- [ ] Cost-based rate limiting (weight expensive operations more)
