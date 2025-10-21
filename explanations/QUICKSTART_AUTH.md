# 🚀 Quick Start Guide - Authentication Setup

## Prerequisites
- Node.js installed
- MongoDB running
- Email SMTP credentials (Gmail recommended for testing)

## Step-by-Step Setup

### 1. Copy Environment File
```bash
cd /home/alpha/code/@redbtn/webapp
cp .env.example .env.local
```

### 2. Configure Email (Gmail Example)

#### Get Gmail App Password:
1. Go to https://myaccount.google.com/apppasswords
2. Sign in to your Google account
3. Enter app name: "Red AI"
4. Click "Create"
5. Copy the 16-character password

#### Edit .env.local:
```env
# MongoDB
MONGODB_URI=mongodb://localhost:27017/redbtn

# Gmail SMTP
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=xxxx xxxx xxxx xxxx  # Your 16-char app password

# JWT Secret (generate a random string)
JWT_SECRET=use-openssl-rand-base64-32-to-generate-this

# Environment
NODE_ENV=development
```

### 3. Generate JWT Secret
```bash
openssl rand -base64 32
```
Copy the output and paste it as JWT_SECRET in .env.local

### 4. Start MongoDB

**Using Docker:**
```bash
docker run -d -p 27017:27017 --name mongodb mongo
```

**Or if installed locally:**
```bash
mongod
```

### 5. Start the App
```bash
npm run dev
```

### 6. Test Authentication!

1. Open http://localhost:3000
2. Login modal appears automatically
3. Enter your email
4. Check your email for 6-digit code
5. Enter the code
6. If new user: complete profile with name, DOB, agree to terms
7. You're logged in!

## Testing Different Scenarios

### Test New User Signup
- Use an email you haven't used before
- Complete the full profile flow
- Check MongoDB to see the user document

### Test Returning User Login
- Use the same email again
- Should skip profile completion
- Log in directly after code verification

### Test Session Persistence
- Refresh the page - should stay logged in
- Close browser and reopen - should stay logged in

### Test Logout
- Click user icon in header (top right)
- Click "Logout"
- Should show login modal again

## Verify MongoDB Data

```bash
# Connect to MongoDB
mongosh

# Switch to database
use redbtn

# View users
db.users.find().pretty()

# View auth codes (if any active)
db.authcodes.find().pretty()
```

## Troubleshooting

### "Failed to send verification code"
- ✅ Check EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASSWORD in .env.local
- ✅ For Gmail, make sure you're using App Password, not regular password
- ✅ Enable "Less secure app access" if needed (not recommended, use App Password instead)

### "MongoDB connection error"
- ✅ Make sure MongoDB is running: `docker ps` or `ps aux | grep mongod`
- ✅ Check MONGODB_URI in .env.local
- ✅ Try: `mongosh mongodb://localhost:27017` to test connection

### Code expired or invalid
- ✅ Codes expire after 10 minutes
- ✅ Request a new code
- ✅ Check email spam folder

### Profile modal won't close
- ✅ Make sure you filled all required fields
- ✅ Agreed to terms checkbox must be checked
- ✅ Date of birth must be selected

## Next Steps

Once authentication is working:
1. ✅ Add user profile page
2. ✅ Save chat history to MongoDB per user
3. ✅ Add rate limiting
4. ✅ Add OAuth providers (Google, Apple)
5. ✅ Add user preferences/settings

## Support

Check the detailed documentation:
- `AUTH_README.md` - Complete authentication docs
- `AUTH_IMPLEMENTATION_COMPLETE.md` - Implementation summary

---

**Ready to test!** 🎉
