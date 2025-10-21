# API Endpoints Audit

Complete audit of all API endpoints with usage status and recommendations.

**Total Endpoints:** 35

---

## 🟢 ACTIVELY USED (9 endpoints)

### Authentication Endpoints
Used by LoginModal, CompleteProfileModal, and AuthContext.

| Endpoint | Method | Purpose | Used By |
|----------|--------|---------|---------|
| `/api/auth/me` | GET | Get current user | AuthContext (on mount) |
| `/api/auth/request-code` | POST | Send magic link email | LoginModal |
| `/api/auth/check-session` | POST | Poll for magic link auth | LoginModal (new) |
| `/api/auth/verify-link` | GET | Verify magic link token | Email link click (new) |
| `/api/auth/complete-profile` | POST | Complete user profile | CompleteProfileModal |
| `/api/auth/logout` | POST | Logout user | Header/AuthContext |

### Chat/AI Endpoints
Core functionality for the chat interface.

| Endpoint | Method | Purpose | Used By |
|----------|--------|---------|---------|
| `/api/v1/chat/completions` | POST | OpenAI-compatible chat | page.tsx (main chat) |
| `/api/v1/messages/[id]/reconnect` | GET | Reconnect to active generation | page.tsx (on mount) |
| `/api/v1/messages/[id]/stream` | GET | Stream message generation | page.tsx (SSE) |

---

## 🟡 UTILITY ENDPOINTS (7 endpoints)

These provide supporting functionality but may not be directly called by frontend.

### Logging/Debugging
Used by logs page and internal monitoring.

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/v1/conversations/[id]/logs` | GET | Get conversation logs | Used by /logs page |
| `/api/v1/conversations/[id]/stream` | GET | Stream conversation logs | Used by /logs page |
| `/api/v1/generations/[id]` | GET | Get generation metadata | Internal/debugging |
| `/api/v1/generations/[id]/logs` | GET | Get generation logs | Internal/debugging |
| `/api/v1/generations/[id]/stream` | GET | Stream generation logs | Internal/debugging |
| `/api/v1/logs/stats` | GET | Get logging statistics | Internal/debugging |
| `/api/v1/thoughts` | GET | Get thinking/reasoning | Frontend (thinking toggle) |

---

## 🟠 QUESTIONABLE / UNUSED (19 endpoints)

### Old Authentication (6 endpoints)

| Endpoint | Method | Purpose | Status | Recommendation |
|----------|--------|---------|--------|----------------|
| `/api/auth/verify-code` | POST | Verify 6-digit code | **UNUSED** | ❌ DELETE (replaced by magic links) |

**Action:** Delete - replaced by verify-link and check-session

---

### OAuth 2.0 System (11 endpoints)

**Context:** Full OAuth2 implementation for third-party apps.

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/oauth/authorize` | GET/POST | OAuth authorization screen | Unused |
| `/api/oauth/token` | POST | Exchange code for token | Unused |
| `/api/oauth/userinfo` | GET | Get user info (OAuth) | Unused |
| `/api/oauth/introspect` | POST | Validate access token | Unused |
| `/api/oauth/revoke` | POST | Revoke token | Unused |
| `/api/oauth/clients` | GET/POST | List/create OAuth clients | Unused |
| `/api/oauth/clients/[id]` | GET/PATCH/DELETE | Manage OAuth client | Unused |

**Questions:**
- Are you planning to allow third-party apps to integrate?
- Is this for future expansion or testing?

**Recommendation:**
- ✅ **KEEP** if you plan OAuth integrations (GitHub apps, extensions, etc.)
- ❌ **DELETE** if not planning OAuth (save ~1000 lines of code)

---

### Example/Template Endpoints (2 endpoints)

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/admin/example` | GET | Example admin endpoint | Template |
| `/api/protected/example` | GET | Example OAuth-protected endpoint | Template |

**Recommendation:** ❌ DELETE (templates/examples)

---

### Additional API Endpoints (6 endpoints)

| Endpoint | Method | Purpose | Status | Recommendation |
|----------|--------|---------|--------|----------------|
| `/api/health` | GET | Health check | Maybe used | ✅ KEEP (monitoring) |
| `/api/v1/conversations/[id]/cleanup-generation` | POST | Clean up stale generation | Internal | ✅ KEEP (cleanup) |
| `/api/v1/conversations/[id]/generation-state` | GET | Get generation state | Internal | ✅ KEEP (state tracking) |
| `/api/v1/conversations/[id]/messages` | GET | Get all messages | Internal | ✅ KEEP (resync) |
| `/api/v1/conversations/[id]/status` | GET | Check conversation status | Internal | ✅ KEEP (reconnect) |
| `/api/v1/conversations/[id]/title` | POST | Generate conversation title | Background | ✅ KEEP (auto-titling) |
| `/api/v1/models` | GET | List available models | OpenAI-compatible | ✅ KEEP (compatibility) |
| `/api/v1/models/[id]` | GET | Get model details | OpenAI-compatible | ✅ KEEP (compatibility) |

---

## 📊 Summary

| Category | Count | Status |
|----------|-------|--------|
| **Active** | 9 | ✅ Keep |
| **Utility** | 7 | ✅ Keep |
| **Old Auth** | 1 | ❌ Delete |
| **OAuth** | 11 | ❓ Decide |
| **Examples** | 2 | ❌ Delete |
| **Other API** | 6 | ✅ Keep |
| **TOTAL** | 35 | |

---

## 🎯 Recommended Actions

### 1. Delete Immediately (3 endpoints)
```bash
rm src/app/api/auth/verify-code/route.ts
rm src/app/api/admin/example/route.ts
rm src/app/api/protected/example/route.ts
```
**Impact:** None - unused template files  
**Savings:** ~200 lines of code

---

### 2. OAuth Decision (11 endpoints)

**Option A: Keep OAuth** (if planning integrations)
- Add rate limiting to OAuth endpoints
- Document OAuth flow
- Test with real clients

**Option B: Delete OAuth** (if not planning integrations)
```bash
rm -rf src/app/api/oauth/
rm src/lib/auth/oauth.ts
rm src/lib/auth/oauthMiddleware.ts
rm src/lib/database/models/oauth/
```
**Impact:** None currently - unused  
**Savings:** ~1500 lines of code + 3 database models

---

### 3. Add Rate Limiting to Critical Endpoints

These should have explicit rate limiting (beyond middleware):

```typescript
// Already done ✅
/api/auth/request-code

// Should add 🔴
/api/v1/chat/completions          // Expensive AI calls
/api/oauth/token                  // If keeping OAuth
/api/oauth/authorize              // If keeping OAuth
```

---

## 🤔 Questions to Answer

1. **OAuth System:**
   - Do you plan to allow third-party apps to integrate with your AI?
   - Will you build browser extensions or mobile apps that need OAuth?
   - Is this for future use or just testing?

2. **Logging System:**
   - Are you actively using the /logs page?
   - Do you need all the logging endpoints?

3. **Unused Code:**
   - Should we clean up old 6-digit verification code?
   - Delete example endpoints?

---

## 💡 My Recommendation

**Minimal Cleanup (Safe):**
```bash
# Delete definitely unused
rm src/app/api/auth/verify-code/route.ts
rm src/app/api/admin/example/route.ts  
rm src/app/api/protected/example/route.ts

# Update AuthContext to remove requestCode() and login() methods
```

**Aggressive Cleanup (If not using OAuth):**
```bash
# Delete OAuth system entirely
rm -rf src/app/api/oauth/
rm src/lib/auth/oauth.ts
rm src/lib/auth/oauthMiddleware.ts
rm -rf src/lib/database/models/oauth/
```

**Result:** 9 core endpoints + 7 utility endpoints = **16 endpoints total**

---

## 📈 Final Endpoint Count Goals

**Current:** 35 endpoints  
**After Minimal Cleanup:** 32 endpoints  
**After OAuth Removal:** 21 endpoints  
**Core Necessary:** 16 endpoints  

---

## Next Steps

1. **Decide on OAuth:** Keep or delete?
2. **Run cleanup script** for unused endpoints
3. **Add rate limiting** to expensive endpoints
4. **Update documentation** to reflect current API

What would you like to do?
