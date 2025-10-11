# Rate Limiting Adjustment - Auth Endpoints

## Issue
Auth rate limiting was too strict, causing legitimate users to be blocked when trying to log in.

## Problem
There was a **double rate limiting** issue:
1. **Middleware** applied AUTH tier (10 req/5min) to ALL `/api/auth/*` routes
2. **Individual endpoints** (like `/api/auth/request-code`) applied their own AUTH tier rate limits

This meant users hitting the auth endpoints were being rate limited twice, making it extremely difficult to authenticate.

## Changes Made

### 1. Increased AUTH Tier Limit
**File**: `src/lib/rate-limit/rate-limit.ts`

**Before**:
```typescript
AUTH: { limit: 10, windowSeconds: 300 } // 10 requests per 5 minutes
```

**After**:
```typescript
AUTH: { limit: 20, windowSeconds: 180 } // 20 requests per 3 minutes
```

**Impact**: 
- Users can now request magic links up to **20 times in 3 minutes** (up from 10 in 5 minutes)
- More reasonable for legitimate use cases (typos, multiple devices, etc.)
- Shorter window means faster reset for blocked users

### 2. Removed Double Rate Limiting in Middleware
**File**: `src/middleware.ts`

**Before**:
```typescript
// Auth endpoints - strictest limits
if (pathname.startsWith('/api/auth/')) {
  rateLimitConfig = RateLimits.AUTH;
}
```

**After**:
```typescript
// Auth endpoints - use standard limits (individual endpoints have their own stricter limits)
if (pathname.startsWith('/api/auth/')) {
  rateLimitConfig = RateLimits.STANDARD;
}
```

**Impact**:
- Middleware now applies STANDARD tier (100 req/min) to auth endpoints
- Individual auth endpoints still apply their own stricter AUTH tier (30 req/5min)
- Eliminates the double-limiting issue

## New Rate Limiting Behavior

### Auth Endpoint Flow
When a user calls `/api/auth/request-code`:

1. **Middleware Check**: 100 requests/minute (STANDARD tier)
2. **Endpoint Check**: 20 requests/3 minutes (AUTH tier)

The endpoint-specific limit is the controlling factor, but users won't hit an artificial wall from middleware.

### Current Rate Limit Tiers

| Tier | Limit | Window | Applied To |
|------|-------|--------|------------|
| **STRICT** | 5 req | 1 min | Sensitive operations (unused) |
| **AUTH** | 20 req | 3 min | Auth endpoints (individual) |
| **CHAT** | 30 req | 1 min | Chat completions |
| **STANDARD** | 100 req | 1 min | General API, auth middleware |
| **RELAXED** | 300 req | 1 min | Public pages |

## Testing

### Test Auth Rate Limiting
```bash
# This should work for 20 requests, then return 429
for i in {1..25}; do
  curl -X POST https://chat.redbtn.io/api/auth/request-code \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com"}' \
    -w "\nRequest $i: Status %{http_code}\n"
  sleep 1
done
```

Expected behavior:
- Requests 1-20: Success (200)
- Requests 21+: Rate limited (429)
- After 3 minutes: Rate limit resets

## Benefits

✅ **More User-Friendly**: Legitimate users won't hit artificial limits  
✅ **Still Protected**: 20 requests per 3 minutes prevents abuse  
✅ **No Double Limiting**: Middleware and endpoints work together properly  
✅ **Consistent Experience**: Users can retry typos without being blocked  
✅ **Faster Reset**: 3-minute window means quicker recovery from rate limits  

## Monitoring

Watch for:
- 429 responses on `/api/auth/*` endpoints
- Multiple requests from same IP in short time
- Patterns of abuse (automated requests)

If abuse is detected, consider:
- Lowering AUTH tier limit (but not below 20/5min)
- Adding CAPTCHA for repeated failures
- Implementing exponential backoff on client

## Rollback

If needed, revert by:

```typescript
// In rate-limit.ts
AUTH: { limit: 10, windowSeconds: 300 }

// In middleware.ts
if (pathname.startsWith('/api/auth/')) {
  rateLimitConfig = RateLimits.AUTH;
}
```

---

**Date**: October 11, 2025  
**Status**: ✅ Complete  
**Impact**: Low risk, improves UX
