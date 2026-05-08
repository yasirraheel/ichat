# 🔐 Authentication Quick Reference

## User Flows

### ✅ Sign Up Flow
```
1. User clicks "Create Account"
2. Enters: Name, Email, Password, Confirm Password
3. Accepts Terms & Conditions
4. Form validates all inputs
5. Account created in Firebase
6. OTP sent to email
7. User enters 6-digit code
8. Email marked as verified
9. User logged in ✅
```

### ✅ Login Flow
```
1. User clicks "Sign In"
2. Enters: Email, Password
3. Firebase authenticates
4. Check if email verified
5. User logged in ✅
```

### ✅ OTP Verification Flow
```
1. User enters 6 digits (auto-focus)
2. Timer shows 10 minutes remaining
3. Code verified against backend
4. Can resend after expiration
5. Max 3 attempts before requiring resend
6. On success: Email marked verified ✅
```

## Key Components

### Frontend Components
| Component | File | Purpose |
|-----------|------|---------|
| LoginForm | `LoginForm.jsx` | Email/password login UI |
| SignupForm | `SignupForm.jsx` | Email/password signup UI |
| OTPVerification | `OTPVerification.jsx` | 6-digit code entry |
| Auth (Main) | `Auth.jsx` | Orchestrates auth flow |

### Backend Endpoints
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/auth/send-otp` | Send OTP to email |
| POST | `/api/auth/verify-otp` | Verify 6-digit code |
| POST | `/api/auth/resend-otp` | Resend new OTP |

### Services
| Service | File | Purpose |
|---------|------|---------|
| Auth Service | `authService.js` | Firebase auth methods |
| API Client | `api.js` | HTTP request wrapper |

## Validation Rules

### Email
- ✅ Required
- ✅ Must be valid email format
- ✅ Unique across system

### Password
- ✅ Minimum 6 characters
- ✅ Must match confirmation
- ✅ Stored encrypted in Firebase

### OTP
- ✅ 6 digits only
- ✅ Expires after 10 minutes
- ✅ Maximum 3 attempts

## Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| "Email already exists" | Account registered | Use login or reset password |
| "Invalid email" | Bad format | Check email address |
| "Password too short" | < 6 characters | Use longer password |
| "Passwords don't match" | Mismatch | Re-enter both |
| "OTP expired" | > 10 minutes | Click "Resend Code" |
| "Invalid OTP" | Wrong code | Check email again |
| "Too many attempts" | > 3 wrong tries | Request new OTP |

## Database Structure

### Firebase Users
```
users/
  {uid}/
    uid: "user123"
    email: "user@example.com"
    displayName: "John Doe"
    isVerified: true
    createdAt: "2026-05-06T..."
```

### Firebase OTP
```
otp/
  {email}/
    code: "123456"
    expiresAt: 1715000000000
    attempts: 0
```

## Security Checklist

- ✅ Passwords encrypted by Firebase
- ✅ OTP expires after 10 minutes
- ✅ Limited to 3 verification attempts
- ✅ CORS enabled for frontend only
- ✅ Input validation on frontend & backend
- ✅ No sensitive data in logs
- ✅ HTTPS required in production
- ✅ Session tokens managed by Firebase

## Development vs Production

### Development
- Email: Gmail (app password)
- Database: Firebase Realtime DB
- OTP: 10 minute expiration
- Attempts: 3 max
- CORS: localhost:3000

### Production
- Email: SendGrid (or similar)
- Database: Firebase Realtime DB
- OTP: 5 minute expiration (shorter)
- Attempts: 2 max (stricter)
- CORS: yourdomain.com
- HTTPS: Required
- Rate limiting: Enabled

## Testing Scenarios

### Scenario 1: New User
```
Email: newuser@example.com
Password: Test123!
Expected: Creates account, sends OTP
```

### Scenario 2: Wrong OTP
```
OTP Entered: 000000
Expected: Error message, can retry (2 more attempts)
```

### Scenario 3: OTP Expired
```
Wait: 10 minutes
Expected: Error, must request new OTP
```

### Scenario 4: Existing User
```
Email: existinguser@example.com
Password: Test123!
Expected: Direct login (already verified)
```

## Code Examples

### Send OTP
```javascript
import { sendOTP } from '../services/authService';

const response = await sendOTP('user@example.com');
console.log(response.message); // "OTP sent to your email"
```

### Verify OTP
```javascript
import { verifyOTP } from '../services/authService';

const result = await verifyOTP('user@example.com', '123456');
if (result.success) {
  console.log('Email verified!');
}
```

### Register User
```javascript
import { registerUser } from '../services/authService';

const user = await registerUser('user@example.com', 'password', 'John');
console.log(user.uid); // Firebase UID
```

### Login User
```javascript
import { loginUser } from '../services/authService';

const user = await loginUser('user@example.com', 'password');
console.log(user.uid); // Firebase UID
```

## Browser Support

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome | ✅ Full | Recommended |
| Firefox | ✅ Full | Works great |
| Safari | ✅ Full | iOS 12+ |
| Edge | ✅ Full | Chromium based |
| IE 11 | ❌ No | Use modern browser |

## Performance Tips

1. **OTP Input Auto-focus** - Moves to next field automatically
2. **Email Validation** - Real-time feedback
3. **Password Strength** - Clear requirements shown
4. **Caching** - User session persists
5. **Lazy Loading** - Components load on demand

## Accessibility

- ✅ Keyboard navigation
- ✅ Form labels for screen readers
- ✅ Clear error messages
- ✅ Password visibility toggle
- ✅ Tab order optimized
- ✅ Color contrast WCAG AA

---

**Quick Links:**
- [AUTH_SETUP.md](AUTH_SETUP.md) - Detailed setup guide
- [README.md](README.md) - Full documentation
- [FEATURES.md](FEATURES.md) - Feature roadmap
