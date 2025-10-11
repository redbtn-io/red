# Account Levels Documentation

## Overview

Red AI uses an account level system to control user permissions and access. This allows for role-based access control (RBAC) for different features and administrative functions.

## Account Levels

### Level 0: Administrator (ADMIN)
- Full access to all features
- Can access admin-only API endpoints
- Can manage other users
- Visual "ADMIN" badge in UI
- Default for first user or manually assigned

### Level 1: Regular User (USER)
- Standard user access (default)
- Access to chat and personal features
- Cannot access admin endpoints
- This is the default level for all new signups

### Future Levels (Examples)
You can add more levels as needed:
- Level 2: Premium User
- Level 3: Enterprise User
- Level 4: Read-only User
- etc.

## Implementation

### Database Schema

```typescript
// User model includes accountLevel field
{
  accountLevel: {
    type: Number,
    default: 1,           // Regular user by default
    enum: [0, 1],         // Add more levels as needed
    index: true           // Indexed for fast queries
  }
}
```

### Enum Definition

```typescript
export enum AccountLevel {
  ADMIN = 0,      // Administrator
  USER = 1,       // Regular user (default)
  // Add future levels here:
  // PREMIUM = 2,
  // ENTERPRISE = 3,
}
```

## Usage

### Frontend - Check if User is Admin

```tsx
import { useAuth } from '@/contexts/AuthContext';

function MyComponent() {
  const { user, isAdmin } = useAuth();

  if (isAdmin) {
    return <AdminPanel />;
  }

  return <UserPanel />;
}
```

### Frontend - Check Account Level Directly

```tsx
import { useAuth } from '@/contexts/AuthContext';
import { AccountLevel } from '@/lib/models/User';

function MyComponent() {
  const { user } = useAuth();

  if (user?.accountLevel === AccountLevel.ADMIN) {
    // Admin-specific logic
  }

  if (user?.accountLevel === AccountLevel.USER) {
    // Regular user logic
  }
}
```

### Backend - Protect Admin Routes

```typescript
import { getUserFromRequest, requireAdmin } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  
  // Require admin access
  try {
    requireAdmin(user);
  } catch (error) {
    return NextResponse.json(
      { error: 'Admin access required' },
      { status: 403 }
    );
  }

  // Admin-only logic here
  return NextResponse.json({ success: true });
}
```

### Backend - Check Admin Status

```typescript
import { getUserFromRequest, isAdmin } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request);
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isAdmin(user)) {
    // Admin can do extra things
  } else {
    // Regular user logic
  }
}
```

## Creating an Admin User

### Method 1: Direct Database Modification

```bash
# Connect to MongoDB
mongosh

# Switch to your database
use redbtn

# Update a user to be admin
db.users.updateOne(
  { email: "admin@example.com" },
  { $set: { accountLevel: 0 } }
)

# Verify
db.users.findOne({ email: "admin@example.com" })
```

### Method 2: Admin API Endpoint (Future)

Create an endpoint to promote users (requires existing admin):

```typescript
// /api/admin/users/promote/route.ts
export async function POST(request: NextRequest) {
  const admin = getUserFromRequest(request);
  requireAdmin(admin);
  
  const { userId, accountLevel } = await request.json();
  
  await User.findByIdAndUpdate(userId, { accountLevel });
  
  return NextResponse.json({ success: true });
}
```

## UI Features

### Admin Badge
Admins see a red "ADMIN" badge in the header dropdown:
- Visible only to admin users
- Styled with `bg-red-500/20` and `border-red-500/50`
- Located next to their name

### Future UI Features
- Admin dashboard link
- User management panel
- System settings
- Analytics and monitoring

## Security Considerations

### JWT Token
- Account level is included in JWT payload
- Token is signed and cannot be tampered with
- Tokens expire after 7 days

### Database Validation
- Account level is validated by MongoDB enum
- Indexed for fast permission checks
- Cannot be set to invalid values

### API Protection
```typescript
// Always verify on the backend
const user = getUserFromRequest(request);
requireAdmin(user);  // Throws error if not admin
```

### Best Practices
1. **Never trust frontend checks alone** - Always validate on backend
2. **Use requireAdmin()** helper for admin routes
3. **Log admin actions** for audit trail
4. **Limit admin users** to minimum necessary
5. **Regular security audits** of admin access

## Example Admin Features

### Admin-Only API Endpoints

```typescript
// /api/admin/users/route.ts - List all users
// /api/admin/stats/route.ts - System statistics
// /api/admin/logs/route.ts - System logs
// /api/admin/users/[id]/route.ts - User management
```

### Admin Dashboard Page

```tsx
// app/admin/page.tsx
'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AdminDashboard() {
  const { user, isAdmin, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAdmin) {
      router.push('/');
    }
  }, [loading, isAdmin, router]);

  if (loading) return <div>Loading...</div>;
  if (!isAdmin) return null;

  return (
    <div>
      <h1>Admin Dashboard</h1>
      {/* Admin features here */}
    </div>
  );
}
```

## Adding New Account Levels

### 1. Update the Enum

```typescript
// src/lib/models/User.ts
export enum AccountLevel {
  ADMIN = 0,
  USER = 1,
  PREMIUM = 2,      // New level
  ENTERPRISE = 3,   // New level
}
```

### 2. Update Validation

The enum validation will automatically include new levels:
```typescript
enum: Object.values(AccountLevel)
```

### 3. Add Helper Methods (Optional)

```typescript
userSchema.methods.isPremium = function(): boolean {
  return this.accountLevel === AccountLevel.PREMIUM;
};
```

### 4. Update UI Logic

```tsx
if (user?.accountLevel === AccountLevel.PREMIUM) {
  return <PremiumFeatures />;
}
```

## Migration

For existing users without accountLevel:
```javascript
// MongoDB migration
db.users.updateMany(
  { accountLevel: { $exists: false } },
  { $set: { accountLevel: 1 } }  // Set to regular user
)
```

## Testing

### Test Admin Access
1. Create a user account
2. Update in MongoDB: `db.users.updateOne({email: "test@example.com"}, {$set: {accountLevel: 0}})`
3. Logout and login again (to refresh JWT)
4. Verify "ADMIN" badge appears in header
5. Test accessing admin-only endpoint

### Test Regular User
1. Create a new account (default level 1)
2. Try accessing admin endpoint - should get 403
3. Verify no "ADMIN" badge in header

## Summary

- ✅ Account levels added to User schema
- ✅ Default level: 1 (Regular User)
- ✅ Admin level: 0
- ✅ Indexed for performance
- ✅ Helper methods for checking levels
- ✅ JWT includes account level
- ✅ Frontend `isAdmin` property
- ✅ Backend `requireAdmin()` helper
- ✅ Admin badge in UI
- ✅ Example admin endpoint
- ✅ Extensible for future levels

**Account levels are now fully integrated!** 🎉
