# API Documentation

## Overview

This document describes all API endpoints available in the RedBtn Chat application. All endpoints follow RESTful conventions and return JSON responses unless otherwise specified.

**Base URL (Production)**: `https://chat.redbtn.io`  
**Base URL (Development)**: `http://localhost:3000`

---

## Rate Limiting

All API endpoints are protected by rate limiting to prevent abuse. Rate limits are applied per IP address (or user ID when authenticated).

### Rate Limit Tiers

| Tier | Requests | Window | Applied To |
|------|----------|--------|------------|
| **STRICT** | 5 | 1 minute | Critical auth operations |
| **AUTH** | 10 | 5 minutes | Authentication endpoints |
| **CHAT** | 30 | 1 minute | Chat completions |
| **STANDARD** | 100 | 1 minute | General API endpoints |
| **RELAXED** | 300 | 1 minute | Low-risk operations |

### Rate Limit Headers

All responses include rate limit headers:

```http
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 29
X-RateLimit-Reset: 2024-01-15T12:34:56.789Z
Retry-After: 60
```

### Rate Limit Response (429)

```json
{
  "error": "Too many requests",
  "message": "You have exceeded the rate limit. Please try again later.",
  "retryAfter": 60
}
```

---

## Authentication Endpoints

### POST `/api/auth/request-code`

**Description**: Request a magic link for authentication (email-based login)

**Rate Limit**: AUTH tier (10 req/5min)

**Authentication**: Not required

**Request Body**:
```json
{
  "email": "user@example.com"
}
```

**Success Response** (200):
```json
{
  "success": true,
  "message": "Verification email sent",
  "sessionId": "sess_abc123"
}
```

**Error Response** (400):
```json
{
  "error": "Invalid email address"
}
```

---

### GET `/api/auth/check-session?sessionId=sess_abc123`

**Description**: Poll for authentication status (used by frontend after magic link email sent)

**Rate Limit**: AUTH tier (10 req/5min)

**Authentication**: Not required

**Query Parameters**:
- `sessionId` (required): Session ID returned from request-code

**Success Response** (200):
```json
{
  "authenticated": true,
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "name": "John Doe",
    "profileComplete": true
  }
}
```

**Waiting Response** (200):
```json
{
  "authenticated": false
}
```

---

### GET `/api/auth/verify-link?token=token_abc123`

**Description**: Verify magic link token and authenticate user

**Rate Limit**: AUTH tier (10 req/5min)

**Authentication**: Not required

**Query Parameters**:
- `token` (required): Magic link token from email

**Success Response** (200):
```html
<!DOCTYPE html>
<html>
  <head>
    <title>Authentication Successful</title>
  </head>
  <body>
    <h1>You've been authenticated!</h1>
    <p>You can close this window.</p>
  </body>
</html>
```

**Error Response** (400):
```json
{
  "error": "Invalid or expired token"
}
```

---

### GET `/api/auth/me`

**Description**: Get current authenticated user

**Rate Limit**: STANDARD tier (100 req/min)

**Authentication**: Required (httpOnly cookie)

**Success Response** (200):
```json
{
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "name": "John Doe",
    "dateOfBirth": "1990-01-01",
    "profileComplete": true,
    "accountLevel": 1,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Error Response** (401):
```json
{
  "error": "Unauthorized"
}
```

---

### POST `/api/auth/complete-profile`

**Description**: Complete user profile after first login

**Rate Limit**: AUTH tier (10 req/5min)

**Authentication**: Required

**Request Body**:
```json
{
  "name": "John Doe",
  "dateOfBirth": "1990-01-01",
  "agreedToTerms": true
}
```

**Success Response** (200):
```json
{
  "success": true,
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "name": "John Doe",
    "dateOfBirth": "1990-01-01",
    "profileComplete": true,
    "accountLevel": 1
  }
}
```

**Error Response** (400):
```json
{
  "error": "Missing required fields: name, dateOfBirth, agreedToTerms"
}
```

---

### POST `/api/auth/logout`

**Description**: Log out current user (clears httpOnly cookie)

**Rate Limit**: STANDARD tier (100 req/min)

**Authentication**: Required

**Success Response** (200):
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## OAuth Endpoints

### GET `/api/oauth/google`

**Description**: Initiate Google OAuth flow

**Rate Limit**: AUTH tier (10 req/5min)

**Authentication**: Not required

**Redirects to**: Google OAuth consent screen

---

### GET `/api/oauth/google/callback`

**Description**: Handle Google OAuth callback

**Rate Limit**: AUTH tier (10 req/5min)

**Authentication**: Not required (OAuth flow)

**Query Parameters**:
- `code`: OAuth authorization code from Google
- `state`: CSRF protection state parameter

**Redirects to**: Application home page on success

---

### GET `/api/oauth/github`

**Description**: Initiate GitHub OAuth flow

**Rate Limit**: AUTH tier (10 req/5min)

**Authentication**: Not required

**Redirects to**: GitHub OAuth consent screen

---

### GET `/api/oauth/github/callback`

**Description**: Handle GitHub OAuth callback

**Rate Limit**: AUTH tier (10 req/5min)

**Authentication**: Not required (OAuth flow)

**Redirects to**: Application home page on success

---

### GET `/api/oauth/discord`

**Description**: Initiate Discord OAuth flow

**Rate Limit**: AUTH tier (10 req/5min)

**Authentication**: Not required

**Redirects to**: Discord OAuth consent screen

---

### GET `/api/oauth/discord/callback`

**Description**: Handle Discord OAuth callback

**Rate Limit**: AUTH tier (10 req/5min)

**Authentication**: Not required (OAuth flow)

**Redirects to**: Application home page on success

---

### GET `/api/oauth/twitter`

**Description**: Initiate Twitter (X) OAuth flow

**Rate Limit**: AUTH tier (10 req/5min)

**Authentication**: Not required

**Redirects to**: Twitter OAuth consent screen

---

### GET `/api/oauth/twitter/callback`

**Description**: Handle Twitter OAuth callback

**Rate Limit**: AUTH tier (10 req/5min)

**Authentication**: Not required (OAuth flow)

**Redirects to**: Application home page on success

---

### GET `/api/oauth/facebook`

**Description**: Initiate Facebook OAuth flow

**Rate Limit**: AUTH tier (10 req/5min)

**Authentication**: Not required

**Redirects to**: Facebook OAuth consent screen

---

### GET `/api/oauth/facebook/callback`

**Description**: Handle Facebook OAuth callback

**Rate Limit**: AUTH tier (10 req/5min)

**Authentication**: Not required (OAuth flow)

**Redirects to**: Application home page on success

---

### POST `/api/oauth/unlink`

**Description**: Unlink OAuth provider from account

**Rate Limit**: AUTH tier (10 req/5min)

**Authentication**: Required

**Request Body**:
```json
{
  "provider": "google"
}
```

**Success Response** (200):
```json
{
  "success": true,
  "message": "OAuth provider unlinked successfully"
}
```

---

## Chat Endpoints

### POST `/api/v1/chat/completions`

**Description**: Generate chat completions (streaming or non-streaming)

**Rate Limit**: CHAT tier (30 req/min)

**Authentication**: Required

**Request Body**:
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Hello, how are you?"
    }
  ],
  "stream": true,
  "model": "Red",
  "conversationId": "conv_abc123",
  "messageId": "msg_xyz789"
}
```

**Streaming Response** (200):
```
Content-Type: text/event-stream

data: {"type":"init","messageId":"msg_xyz789","conversationId":"conv_abc123"}

data: {"type":"status","action":"Thinking","description":"Processing your request"}

data: {"type":"content","content":"Hello!"}

data: {"type":"content","content":" How can I help you?"}

data: {"type":"complete","metadata":{"model":"deepseek-chat","tokens":{"input":10,"output":5,"total":15}}}

data: [DONE]
```

**Non-Streaming Response** (200):
```json
{
  "id": "comp_abc123",
  "object": "chat.completion",
  "created": 1705329600,
  "model": "Red",
  "conversationId": "conv_abc123",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help you?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 5,
    "total_tokens": 15
  }
}
```

---

### GET `/api/conversations/:conversationId`

**Description**: Get conversation history

**Rate Limit**: STANDARD tier (100 req/min)

**Authentication**: Required

**Success Response** (200):
```json
{
  "conversationId": "conv_abc123",
  "messages": [
    {
      "id": "msg_1",
      "role": "user",
      "content": "Hello",
      "timestamp": "2024-01-01T00:00:00.000Z"
    },
    {
      "id": "msg_2",
      "role": "assistant",
      "content": "Hi there!",
      "timestamp": "2024-01-01T00:00:01.000Z"
    }
  ]
}
```

---

### DELETE `/api/conversations/:conversationId`

**Description**: Delete a conversation

**Rate Limit**: STANDARD tier (100 req/min)

**Authentication**: Required

**Success Response** (200):
```json
{
  "success": true,
  "message": "Conversation deleted"
}
```

---

### GET `/api/conversations`

**Description**: List all conversations for current user

**Rate Limit**: STANDARD tier (100 req/min)

**Authentication**: Required

**Success Response** (200):
```json
{
  "conversations": [
    {
      "id": "conv_1",
      "title": "Chat about AI",
      "lastMessage": "How does machine learning work?",
      "timestamp": "2024-01-01T00:00:00.000Z",
      "messageCount": 12
    }
  ]
}
```

---

## Logging Endpoints

### POST `/api/logs`

**Description**: Create new log entry

**Rate Limit**: STANDARD tier (100 req/min)

**Authentication**: Required (admin only, accountLevel: 0)

**Request Body**:
```json
{
  "level": "info",
  "message": "User logged in",
  "source": "auth-service",
  "metadata": {
    "userId": "user_123",
    "ip": "192.168.1.1"
  }
}
```

**Success Response** (200):
```json
{
  "success": true,
  "logId": "log_abc123"
}
```

---

### GET `/api/logs`

**Description**: Query logs with filters

**Rate Limit**: STANDARD tier (100 req/min)

**Authentication**: Required (admin only)

**Query Parameters**:
- `level`: Filter by log level (error, warn, info, debug)
- `source`: Filter by source
- `search`: Text search in message
- `startDate`: ISO date string
- `endDate`: ISO date string
- `limit`: Number of results (default: 100, max: 1000)
- `offset`: Pagination offset

**Success Response** (200):
```json
{
  "logs": [
    {
      "id": "log_1",
      "level": "info",
      "message": "User logged in",
      "source": "auth-service",
      "timestamp": "2024-01-01T00:00:00.000Z",
      "metadata": {
        "userId": "user_123"
      }
    }
  ],
  "total": 156,
  "offset": 0,
  "limit": 100
}
```

---

### GET `/api/logs/stats`

**Description**: Get log statistics

**Rate Limit**: STANDARD tier (100 req/min)

**Authentication**: Required (admin only)

**Success Response** (200):
```json
{
  "total": 1234,
  "byLevel": {
    "error": 45,
    "warn": 123,
    "info": 890,
    "debug": 176
  },
  "bySource": {
    "auth-service": 456,
    "chat-service": 778
  },
  "recentErrors": 12,
  "last24Hours": 567
}
```

---

### DELETE `/api/logs/:logId`

**Description**: Delete specific log entry

**Rate Limit**: STANDARD tier (100 req/min)

**Authentication**: Required (admin only)

**Success Response** (200):
```json
{
  "success": true,
  "message": "Log deleted"
}
```

---

### DELETE `/api/logs`

**Description**: Bulk delete logs (with filters)

**Rate Limit**: STRICT tier (5 req/min)

**Authentication**: Required (admin only)

**Query Parameters**:
- `level`: Filter by log level
- `source`: Filter by source
- `before`: Delete logs before this date
- `olderThan`: Delete logs older than N days

**Success Response** (200):
```json
{
  "success": true,
  "deletedCount": 234
}
```

---

### GET `/api/logs/sources`

**Description**: Get list of all log sources

**Rate Limit**: STANDARD tier (100 req/min)

**Authentication**: Required (admin only)

**Success Response** (200):
```json
{
  "sources": [
    "auth-service",
    "chat-service",
    "api-gateway",
    "database"
  ]
}
```

---

### GET `/api/logs/export`

**Description**: Export logs as CSV or JSON

**Rate Limit**: STRICT tier (5 req/min)

**Authentication**: Required (admin only)

**Query Parameters**:
- Same filters as GET `/api/logs`
- `format`: Export format (csv or json)

**Success Response** (200):
```csv
Content-Type: text/csv

id,level,message,source,timestamp
log_1,info,User logged in,auth-service,2024-01-01T00:00:00.000Z
```

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "Invalid request",
  "message": "Detailed error message",
  "code": "INVALID_REQUEST"
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

### 403 Forbidden
```json
{
  "error": "Forbidden",
  "message": "Insufficient permissions"
}
```

### 404 Not Found
```json
{
  "error": "Not found",
  "message": "Resource not found"
}
```

### 429 Too Many Requests
```json
{
  "error": "Too many requests",
  "message": "You have exceeded the rate limit. Please try again later.",
  "retryAfter": 60
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error",
  "message": "An unexpected error occurred"
}
```

---

## WebSocket Events (Streaming)

### Event Types

**init**
```json
{
  "type": "init",
  "messageId": "msg_123",
  "conversationId": "conv_456"
}
```

**status**
```json
{
  "type": "status",
  "action": "Thinking",
  "description": "Processing your request"
}
```

**content**
```json
{
  "type": "content",
  "content": "Hello!"
}
```

**thinking_chunk**
```json
{
  "type": "thinking_chunk",
  "content": "Let me analyze this..."
}
```

**thinking**
```json
{
  "type": "thinking",
  "content": "Complete thinking process..."
}
```

**tool_status**
```json
{
  "type": "tool_status",
  "status": "running",
  "action": "Searching database"
}
```

**complete**
```json
{
  "type": "complete",
  "metadata": {
    "model": "deepseek-chat",
    "tokens": {
      "input": 100,
      "output": 50,
      "total": 150
    }
  }
}
```

**error**
```json
{
  "type": "error",
  "error": "Generation failed: timeout"
}
```

---

## Environment Variables

Required environment variables for API functionality:

```bash
# Database
MONGODB_URI=mongodb://localhost:27017/redbtn

# JWT Authentication
JWT_SECRET=your-secret-key

# Email (Nodemailer)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Base URL (for magic links)
BASE_URL=https://chat.redbtn.io

# Rate Limiting (optional)
REDIS_URL=redis://localhost:6379

# OAuth Providers (optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
TWITTER_CLIENT_ID=
TWITTER_CLIENT_SECRET=
FACEBOOK_CLIENT_ID=
FACEBOOK_CLIENT_SECRET=
```

---

## SDK Examples

### JavaScript/TypeScript

```typescript
// Initialize client
const client = {
  baseUrl: 'https://chat.redbtn.io',
  token: null as string | null,

  async login(email: string) {
    const res = await fetch(`${this.baseUrl}/api/auth/request-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
      credentials: 'include'
    });
    return res.json();
  },

  async chat(message: string, stream = true) {
    const res = await fetch(`${this.baseUrl}/api/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        messages: [{ role: 'user', content: message }],
        stream
      })
    });

    if (stream) {
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;
            
            const event = JSON.parse(data);
            console.log('Event:', event);
          }
        }
      }
    } else {
      return res.json();
    }
  }
};

// Usage
await client.login('user@example.com');
// User clicks magic link in email
await client.chat('Hello!', true);
```

### Python

```python
import requests
import json

class RedBtnClient:
    def __init__(self, base_url='https://chat.redbtn.io'):
        self.base_url = base_url
        self.session = requests.Session()
    
    def login(self, email):
        res = self.session.post(
            f'{self.base_url}/api/auth/request-code',
            json={'email': email}
        )
        return res.json()
    
    def chat(self, message, stream=True):
        res = self.session.post(
            f'{self.base_url}/api/v1/chat/completions',
            json={
                'messages': [{'role': 'user', 'content': message}],
                'stream': stream
            },
            stream=stream
        )
        
        if stream:
            for line in res.iter_lines():
                if line:
                    line = line.decode('utf-8')
                    if line.startswith('data: '):
                        data = line[6:]
                        if data == '[DONE]':
                            break
                        event = json.loads(data)
                        yield event
        else:
            return res.json()

# Usage
client = RedBtnClient()
client.login('user@example.com')
# User clicks magic link in email

for event in client.chat('Hello!', stream=True):
    if event['type'] == 'content':
        print(event['content'], end='', flush=True)
```

---

## Changelog

### Version 1.0.0 (Current)

**Added**:
- Magic link authentication system
- OAuth support (Google, GitHub, Discord, Twitter, Facebook)
- Comprehensive rate limiting with Redis support
- Streaming chat completions
- Conversation management
- Admin logging system
- Profile completion flow

**Removed**:
- Old 6-digit verification code system
- Example endpoints (`/api/admin/example`, `/api/protected/example`)

---

## Support

For API support or questions:
- Documentation: https://chat.redbtn.io/docs
- GitHub Issues: https://github.com/redbtn/chat/issues
- Email: support@redbtn.io
