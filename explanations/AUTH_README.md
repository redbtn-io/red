# Authentication System Documentation

## Overview

Red AI uses a passwordless authentication system with email verification codes. This provides a secure, user-friendly login experience without the complexity of password management.

## Features

- **Passwordless Authentication**: No passwords to remember or manage
- **Email Verification**: 6-digit codes sent via email (10-minute expiration)
- **Unified Login/Signup**: Single flow handles both new and returning users
- **Profile Completion**: New users complete profile with name, DOB, and terms agreement
- **Session Management**: JWT-based sessions with httpOnly cookies (7-day expiration)
- **MongoDB Storage**: User data securely stored in MongoDB

## Setup

### 1. Install Dependencies

Dependencies are already installed:
- `mongoose` - MongoDB ODM
- `nodemailer` - Email sending
- `jsonwebtoken` - JWT token generation/verification

### 2. Configure Environment Variables

Copy `.env.example` to `.env.local` and configure:

```bash
cp .env.example .env.local
```

#### MongoDB Configuration
```env
MONGODB_URI=mongodb://localhost:27017/redbtn
```

#### Email Configuration (SMTP)

**For Gmail:**
1. Enable 2-factor authentication on your Google account
2. Generate an App Password: https://myaccount.google.com/apppasswords
3. Use these settings:
```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-16-char-app-password
```

**For SendGrid:**
```env
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASSWORD=your-sendgrid-api-key
```

**For AWS SES:**
```env
EMAIL_HOST=email-smtp.us-east-1.amazonaws.com
EMAIL_PORT=587
EMAIL_USER=your-smtp-username
EMAIL_PASSWORD=your-smtp-password
```

#### JWT Secret

Generate a secure random secret:
```bash
openssl rand -base64 32
```

Then add to `.env.local`:
```env
JWT_SECRET=your-generated-secret-here
```

### 3. Start MongoDB

Make sure MongoDB is running:
```bash
# If using Docker
docker run -d -p 27017:27017 --name mongodb mongo

# Or if installed locally
mongod
```

### 4. Run the Application

```bash
npm run dev
```

## Authentication Flow

### New User Flow

1. User enters email in login modal
2. System sends 6-digit verification code via email
3. User enters code
4. System creates new user account
5. Profile completion modal appears
6. User enters name, date of birth, agrees to terms
7. Profile saved, user is logged in

### Returning User Flow

1. User enters email in login modal
2. System sends 6-digit verification code via email
3. User enters code
4. User is logged in immediately (no profile modal)

### Session Management

- Sessions last 7 days
- JWT stored in httpOnly cookie for security
- Auto-refresh on page load
- Secure logout clears cookie

## API Endpoints

### POST `/api/auth/request-code`
Request a verification code for login/signup.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Verification code sent to your email"
}
```

### POST `/api/auth/verify-code`
Verify code and create session.

**Request:**
```json
{
  "email": "user@example.com",
  "code": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "isNewUser": false,
  "profileComplete": true,
  "user": {
    "id": "...",
    "email": "user@example.com",
    "name": "John Doe",
    "profileComplete": true
  }
}
```

### POST `/api/auth/complete-profile`
Complete user profile (new users only).

**Request:**
```json
{
  "name": "John Doe",
  "dateOfBirth": "1990-01-01",
  "agreedToTerms": true
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "...",
    "email": "user@example.com",
    "name": "John Doe",
    "dateOfBirth": "1990-01-01T00:00:00.000Z",
    "profileComplete": true
  }
}
```

### GET `/api/auth/me`
Get current authenticated user.

**Response:**
```json
{
  "user": {
    "id": "...",
    "email": "user@example.com",
    "name": "John Doe",
    "dateOfBirth": "1990-01-01T00:00:00.000Z",
    "profileComplete": true,
    "createdAt": "2025-10-10T00:00:00.000Z"
  }
}
```

### POST `/api/auth/logout`
Logout and clear session.

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

## Database Models

### User Model
```typescript
{
  email: string;           // Unique, lowercase, indexed
  name?: string;           // User's full name
  dateOfBirth?: Date;      // Date of birth
  agreedToTerms: boolean;  // Terms acceptance
  profileComplete: boolean; // Profile completion status
  createdAt: Date;         // Auto-generated
  updatedAt: Date;         // Auto-generated
}
```

### AuthCode Model
```typescript
{
  email: string;      // Lowercase, indexed
  code: string;       // 6-digit verification code
  expiresAt: Date;    // TTL: 10 minutes
  createdAt: Date;    // Auto-generated
}
```

**Note:** AuthCode documents auto-delete after expiration using MongoDB TTL index.

## React Hooks

### useAuth()

Access authentication state and methods throughout the app:

```tsx
import { useAuth } from '@/contexts/AuthContext';

function MyComponent() {
  const {
    user,              // Current user or null
    loading,           // Auth loading state
    login,             // Login with email/code
    logout,            // Logout
    requestCode,       // Request verification code
    completeProfile,   // Complete user profile
    refreshUser,       // Refresh user data
  } = useAuth();

  // Check if authenticated
  if (!user) {
    return <div>Please log in</div>;
  }

  return <div>Welcome, {user.name}!</div>;
}
```

## Security Features

- **httpOnly Cookies**: JWT stored in httpOnly cookie (not accessible to JavaScript)
- **CSRF Protection**: SameSite cookie attribute
- **Code Expiration**: Verification codes expire after 10 minutes
- **Single Use**: Codes deleted after successful verification
- **MongoDB TTL**: Expired codes auto-deleted from database
- **Email Validation**: Proper email format validation
- **Secure in Production**: HTTPS-only cookies in production

## Future Enhancements

- OAuth integration (Google, Apple, GitHub)
- Rate limiting for code requests
- Email verification on profile changes
- Two-factor authentication option
- Account deletion and data export
- Magic link authentication (alternative to codes)

## Troubleshooting

### Email not sending
1. Check SMTP credentials in `.env.local`
2. For Gmail, ensure App Password is used (not regular password)
3. Check console for email errors
4. Verify SMTP server allows connections

### MongoDB connection issues
1. Ensure MongoDB is running
2. Check `MONGODB_URI` in `.env.local`
3. Verify MongoDB port (default: 27017)

### JWT errors
1. Ensure `JWT_SECRET` is set in `.env.local`
2. Clear cookies and try again
3. Check JWT expiration (7 days)

### User stuck on profile modal
1. Check MongoDB for user document
2. Verify `profileComplete` field
3. Try logout and re-login
