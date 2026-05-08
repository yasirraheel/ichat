# 🔐 Authentication System Setup Guide

This guide walks you through setting up the email and OTP verification system for ChatNotes.

## 📋 Overview

The authentication system includes:
- **Email & Password Registration** - Secure signup with validation
- **Email & Password Login** - Existing user authentication
- **OTP Verification** - 6-digit code sent via email
- **Firebase Integration** - User data stored securely
- **Password Reset** - Recover forgotten passwords

## 🚀 Quick Setup

### Step 1: Firebase Configuration

#### Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Create a new project"
3. Enter project name and enable Google Analytics (optional)
4. Click "Create project"

#### Enable Authentication
1. Go to **Authentication** → **Get started**
2. Enable **Email/Password** provider
3. Enable **Email link sign-in** (optional)

#### Create Realtime Database
1. Go to **Realtime Database** → **Create Database**
2. Start in **Test Mode** (for development)
3. Choose a region (closest to your users)

#### Get Service Account Key
1. Go to **Project Settings** → **Service Accounts**
2. Select **Firebase Admin SDK** → **Node.js**
3. Click **Generate New Private Key**
4. Save the JSON file securely

#### Update Backend .env
```
FIREBASE_PROJECT_ID=<your_project_id>
FIREBASE_PRIVATE_KEY_ID=<your_private_key_id>
FIREBASE_PRIVATE_KEY=<your_private_key>
FIREBASE_CLIENT_EMAIL=<your_client_email>
FIREBASE_CLIENT_ID=<your_client_id>
FIREBASE_DATABASE_URL=https://<your_project>.firebaseio.com
```

### Step 2: Email Configuration

#### Using Gmail (Recommended for Development)

1. **Enable 2-Factor Authentication**
   - Go to [Google Account](https://myaccount.google.com)
   - Navigate to **Security** section
   - Enable **2-Step Verification**

2. **Generate App Password**
   - Go to [App Passwords](https://myaccount.google.com/apppasswords)
   - Select **Mail** and **Windows Computer** (or your device)
   - Click **Generate**
   - Copy the 16-character password

3. **Update Backend .env**
   ```
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASSWORD=<16_character_app_password>
   ```

#### Using SendGrid (Production)

1. **Create SendGrid Account**
   - Sign up at [sendgrid.com](https://sendgrid.com)
   - Create an API key

2. **Update Backend**
   ```javascript
   // In backend/config/email.js
   const transporter = nodemailer.createTransport({
     host: 'smtp.sendgrid.net',
     port: 587,
     auth: {
       user: 'apikey',
       pass: process.env.SENDGRID_API_KEY,
     },
   });
   ```

### Step 3: Update Frontend .env

```
VITE_FIREBASE_API_KEY=<your_web_api_key>
VITE_FIREBASE_AUTH_DOMAIN=<your_project>.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=<your_project_id>
VITE_FIREBASE_STORAGE_BUCKET=<your_project>.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=<your_sender_id>
VITE_FIREBASE_APP_ID=<your_app_id>
VITE_API_URL=http://localhost:5000
```

To get these values:
1. Go to Firebase Console → Your Project
2. Click **Project Settings** (gear icon)
3. Scroll to **Your apps** section
4. Click the web app or create one
5. Copy the config values

## 🔄 Authentication Flow

```
1. User Signs Up
   ↓
2. Frontend validates email/password
   ↓
3. Firebase creates user account
   ↓
4. Backend sends OTP via email
   ↓
5. User enters 6-digit code
   ↓
6. Backend verifies OTP
   ↓
7. User marked as verified
   ↓
8. User logged in ✅
```

## 📧 OTP Email Template

Users receive a professional email with:
- ChatNotes branding
- 6-digit verification code
- Expiration time (10 minutes)
- Security notice

Sample email:
```
📱 ChatNotes - Email Verification

Your verification code is:

  6 4 2 1 8 5

This code will expire in 10 minutes.
If you didn't request this code, please ignore this email.
```

## 🔐 Security Features

### Frontend Security
- ✅ Password strength validation (min 6 characters)
- ✅ Password confirmation check
- ✅ Email format validation
- ✅ OTP input validation
- ✅ Rate limiting (built-in Firebase)

### Backend Security
- ✅ Input validation with express-validator
- ✅ OTP expiration (10 minutes)
- ✅ Attempt limiting (3 attempts max)
- ✅ CORS enabled
- ✅ Error handling

### Firebase Security
- ✅ Firebase Authentication rules
- ✅ Encrypted passwords
- ✅ User data isolation
- ✅ Automatic session management

## 📁 File Structure

```
Authentication Components:
frontend/src/components/auth/
├── LoginForm.jsx          # Email/password login
├── SignupForm.jsx         # Email/password signup
└── OTPVerification.jsx    # OTP verification

Authentication Services:
frontend/src/services/
├── authService.js         # Firebase auth methods
└── api.js                 # API client

Backend Authentication:
backend/
├── routes/auth.js         # Auth endpoints
├── config/firebase.js     # Firebase admin init
└── server.js              # Server configuration
```

## 🔗 API Endpoints

### Send OTP
```
POST /api/auth/send-otp
Body: { email: "user@example.com" }
Response: { success: true, message: "OTP sent" }
```

### Verify OTP
```
POST /api/auth/verify-otp
Body: { email: "user@example.com", code: "123456" }
Response: { success: true, message: "Email verified" }
```

### Resend OTP
```
POST /api/auth/resend-otp
Body: { email: "user@example.com" }
Response: { success: true, message: "New OTP sent" }
```

## 🧪 Testing

### Test with Firebase Emulator (Optional)

```bash
# Install Firebase tools
npm install -g firebase-tools

# Start emulator
firebase emulators:start

# Set FIREBASE_DATABASE_URL to emulator in .env
FIREBASE_DATABASE_URL=http://localhost:9000
```

### Manual Testing

1. **Sign Up**
   - Go to http://localhost:3000
   - Click "Create New Account"
   - Fill form with valid email
   - Should show OTP screen

2. **Verify OTP**
   - Check console for OTP code
   - Enter code in form
   - Should log in successfully

3. **Login Existing User**
   - Use registered email/password
   - Should log in directly

## ⚙️ Environment Variables Summary

### Frontend (.env)
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_API_URL=http://localhost:5000
```

### Backend (.env)
```
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=
FIREBASE_CLIENT_ID=
FIREBASE_DATABASE_URL=
EMAIL_USER=
EMAIL_PASSWORD=
```

## 🐛 Common Issues

### Issue: "Firebase initialization error"
**Solution:**
- Check FIREBASE_PROJECT_ID in .env
- Ensure service account JSON is valid
- Verify database URL format

### Issue: "Email not sending"
**Solution:**
- Verify Gmail app password is correct
- Check EMAIL_USER is your Gmail address
- Ensure 2FA is enabled on Gmail
- Check email in Gmail "less secure apps" settings

### Issue: "OTP always invalid"
**Solution:**
- Check email in server logs for actual OTP
- Verify OTP hasn't expired (10 minutes)
- Maximum 3 attempts before requiring resend

### Issue: "CORS errors"
**Solution:**
- Check FRONTEND_URL in backend .env
- Ensure both dev servers running
- Clear browser cache

## 📚 Additional Resources

- [Firebase Auth Docs](https://firebase.google.com/docs/auth)
- [Firebase Realtime DB](https://firebase.google.com/docs/database)
- [Express Validator](https://express-validator.github.io/docs/)
- [Nodemailer Guide](https://nodemailer.com/)

## 🔄 Next Steps

1. Configure Firebase and Gmail
2. Update .env files
3. Run `npm install-all`
4. Start with `npm run dev`
5. Test signup and login flows
6. Deploy to production

---

**Questions?** Check the main README.md or FEATURES.md for more info.
