# Project Structure Reorganization

This document explains the new organized structure of the `/lib` and `/components` directories.

## Overview

The codebase has been reorganized into logical subdirectories for better maintainability, discoverability, and scalability.

---

## `/lib` Directory Structure

### 📁 `lib/auth/`
**Authentication & Authorization**
- `auth.ts` - JWT token generation, user authentication
- `oauth.ts` - OAuth2 utilities (token generation, client verification)
- `oauthMiddleware.ts` - OAuth scope validation middleware
- `index.ts` - Barrel export

**Import:**
```typescript
import { getUserFromRequest, requireAdmin } from '@/lib/auth';
// Or specific file:
import { getUserFromRequest } from '@/lib/auth/auth';
```

---

### 📁 `lib/database/`
**Database Connections & Models**

#### `lib/database/`
- `mongodb.ts` - MongoDB connection utility
- `index.ts` - Barrel export

#### `lib/database/models/auth/`
**Authentication Models**
- `User.ts` - User accounts with profile data
- `AuthCode.ts` - Magic link tokens
- `AuthSession.ts` - Cross-device authentication sessions
- `index.ts` - Barrel export

#### `lib/database/models/oauth/`
**OAuth2 Models**
- `OAuthClient.ts` - OAuth client applications
- `OAuthAccessToken.ts` - OAuth access tokens
- `OAuthAuthorizationCode.ts` - OAuth authorization codes
- `index.ts` - Barrel export

**Import:**
```typescript
import connectToDatabase from '@/lib/database';
import { User, AuthCode, AccountLevel } from '@/lib/database/models/auth';
import { OAuthClient, OAuthAccessToken } from '@/lib/database/models/oauth';
```

---

### 📁 `lib/email/`
**Email Functionality**
- `email.ts` - Nodemailer setup, magic link emails

**Import:**
```typescript
import { sendMagicLinkEmail, generateMagicToken } from '@/lib/email/email';
```

---

### 📁 `lib/rate-limit/`
**Rate Limiting System**
- `rate-limit.ts` - Core rate limiting logic (Redis + in-memory)
- `rate-limit-helpers.ts` - API route helpers
- `index.ts` - Barrel export

**Import:**
```typescript
import { checkRateLimit, RateLimits } from '@/lib/rate-limit';
// Or:
import { rateLimitAPI, withRateLimit } from '@/lib/rate-limit';
```

---

### 📁 `lib/storage/`
**Client-Side Storage Utilities**
- `conversation.ts` - Conversation localStorage management
- `generation-storage.ts` - Active generation tracking
- `index.ts` - Barrel export

**Import:**
```typescript
import { conversationStorage, generationStorage } from '@/lib/storage';
```

---

### 📁 `lib/api/`
**API Utilities**
- `api-helpers.ts` - OpenAI-compatible API helpers
- `logging-client.ts` - SSE logging stream client
- `thinking.ts` - DeepSeek thinking utilities
- `index.ts` - Barrel export

**Import:**
```typescript
import { generateCompletionId, extractUserMessage } from '@/lib/api';
// Or:
import { LoggingClient } from '@/lib/api/logging-client';
```

---

### 📄 `lib/red.ts`
**Red AI Instance**
- Singleton Red AI instance for API routes
- Kept at root level for easy access

**Import:**
```typescript
import { red, getRed } from '@/lib/red';
```

---

## `/components` Directory Structure

### 📁 `components/auth/`
**Authentication Components**
- `LoginModal.tsx` - Email magic link login
- `CompleteProfileModal.tsx` - New user profile completion

**Import:**
```typescript
import { LoginModal } from '@/components/auth/LoginModal';
import { CompleteProfileModal } from '@/components/auth/CompleteProfileModal';
```

---

### 📁 `components/chat/`
**Chat Interface Components**
- `ChatInput.tsx` - Message input with file upload
- `Messages.tsx` - Message list with markdown rendering
- `Sidebar.tsx` - Conversation sidebar

**Import:**
```typescript
import { ChatInput } from '@/components/chat/ChatInput';
import { Messages } from '@/components/chat/Messages';
import { Sidebar } from '@/components/chat/Sidebar';
```

---

### 📁 `components/logging/`
**Logging & Debugging Components**
- `LogViewer.tsx` - Real-time log viewer
- `LogFilters.tsx` - Log filtering controls
- `LogStats.tsx` - Log statistics display
- `logStyles.ts` - Shared log styling

**Import:**
```typescript
import { LogViewer } from '@/components/logging/LogViewer';
import { LogFilters } from '@/components/logging/LogFilters';
import { LogStats } from '@/components/logging/LogStats';
```

---

### 📁 `components/layout/`
**Layout Components**
- `Header.tsx` - App header with logo and actions
- `SetVh.tsx` - Viewport height fix for mobile

**Import:**
```typescript
import { Header } from '@/components/layout/Header';
import SetVh from '@/components/layout/SetVh';
```

---

### 📁 `components/ui/`
**Generic UI Components**
- `Modal.tsx` - Reusable modal component
- `LoadingStates.tsx` - Loading indicators and skeletons

**Import:**
```typescript
import { ConfirmModal } from '@/components/ui/Modal';
import { LoadingStateContainer } from '@/components/ui/LoadingStates';
```

---

## Migration Complete ✅

All import paths have been automatically updated throughout the codebase. The restructuring provides:

- ✅ **Logical grouping** - Related files together
- ✅ **Better discoverability** - Know where to find things
- ✅ **Scalability** - Easy to add new files
- ✅ **Cleaner imports** - Barrel exports for convenience
- ✅ **No breaking changes** - All imports updated automatically

---

## Adding New Files

### Adding a new lib utility:
```bash
# Add to appropriate subdirectory
touch src/lib/auth/new-auth-helper.ts

# Export from index.ts
echo "export * from './new-auth-helper';" >> src/lib/auth/index.ts

# Use it
import { newHelper } from '@/lib/auth';
```

### Adding a new component:
```bash
# Add to appropriate subdirectory
touch src/components/chat/NewChatFeature.tsx

# Import it
import { NewChatFeature } from '@/components/chat/NewChatFeature';
```

---

## Directory Sizes

- **lib/auth/** - 3 files (authentication & OAuth)
- **lib/database/** - 1 file + 6 models
- **lib/email/** - 1 file
- **lib/rate-limit/** - 2 files
- **lib/storage/** - 2 files
- **lib/api/** - 3 files
- **components/auth/** - 2 components
- **components/chat/** - 3 components
- **components/logging/** - 4 files
- **components/layout/** - 2 components
- **components/ui/** - 2 components
