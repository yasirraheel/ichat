import express from 'express';
import { body, validationResult } from 'express-validator';
import nodemailer from 'nodemailer';
import { createHash, randomBytes, randomUUID } from 'crypto';
import pool from '../config/db.js';

const router = express.Router();
const APP_NAME = process.env.APP_NAME || 'ChatNotes';
const APP_TAGLINE = process.env.APP_TAGLINE || 'Secure Real-time Chat App';

const normalizeEmail = (email) => email.trim().toLowerCase();
const hashPassword = (password) => createHash('sha256').update(password).digest('hex');
const mapUserRow = (user) => ({
  uid: user.uid,
  email: user.email,
  displayName: user.displayName,
  avatarUrl: user.avatarUrl || null,
  isVerified: !!user.isVerified,
  createdAt: user.createdAt,
});

const getTransporter = () => {
  const canSendEmail = Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
  );
  
  if (!canSendEmail) return { canSendEmail: false, transporter: null };

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return { canSendEmail: true, transporter };
};

router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('displayName').trim().isLength({ min: 2 }),
    body('avatarUrl').optional({ nullable: true }).isString(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const email = normalizeEmail(req.body.email);
    const { password, displayName, avatarUrl } = req.body;

    try {
      const [existingUsers] = await pool.query('SELECT email FROM users WHERE email = ?', [email]);
      if (existingUsers.length > 0) {
        return res.status(409).json({ success: false, message: 'Email already registered' });
      }

      const uid = randomUUID();
      const pHash = hashPassword(password);
      const isVerified = false;

      await pool.query(
        'INSERT INTO users (uid, email, displayName, passwordHash, avatarUrl, isVerified) VALUES (?, ?, ?, ?, ?, ?)',
        [uid, email, displayName.trim(), pHash, avatarUrl || null, isVerified]
      );

      res.json({
        success: true,
        user: mapUserRow({
          uid,
          email,
          displayName: displayName.trim(),
          avatarUrl: avatarUrl || null,
          isVerified,
          createdAt: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
);

router.post(
  '/login',
  [body('email').isEmail().normalizeEmail(), body('password').isLength({ min: 1 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const email = normalizeEmail(req.body.email);
    const { password } = req.body;
    
    try {
      const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
      const user = users[0];

      if (!user || user.passwordHash !== hashPassword(password)) {
        return res.status(401).json({ success: false, message: 'Invalid email or password' });
      }

      if (!user.isVerified) {
        return res.status(403).json({
          success: false,
          code: 'EMAIL_NOT_VERIFIED',
          message: 'Please verify your email first',
          user: mapUserRow(user),
        });
      }

      const token = randomBytes(24).toString('hex');
      await pool.query('INSERT INTO sessions (token, email) VALUES (?, ?)', [token, email]);

      res.json({
        success: true,
        token,
        user: mapUserRow(user),
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
);

router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    const [sessions] = await pool.query('SELECT email FROM sessions WHERE token = ?', [token]);
    if (sessions.length === 0) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const email = sessions[0].email;
    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      await pool.query('DELETE FROM sessions WHERE token = ?', [token]);
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const user = users[0];
    res.json({
      success: true,
      user: mapUserRow(user),
    });
  } catch (error) {
    console.error('Me error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.put('/me/avatar', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const { avatarUrl } = req.body || {};

  if (!token) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    const [sessions] = await pool.query('SELECT email FROM sessions WHERE token = ?', [token]);
    if (sessions.length === 0) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const email = sessions[0].email;
    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = users[0];
    await pool.query('UPDATE users SET avatarUrl = ? WHERE uid = ?', [avatarUrl || null, user.uid]);

    res.json({
      success: true,
      user: mapUserRow({ ...user, avatarUrl: avatarUrl || null }),
    });
  } catch (error) {
    console.error('Avatar update error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Send OTP via email
router.post(
  '/send-otp',
  [body('email').isEmail().normalizeEmail()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const email = normalizeEmail(req.body.email);
      const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
      if (users.length === 0) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expirationTime = Date.now() + 10 * 60 * 1000; // 10 minutes

      // Store OTP in Database
      await pool.query(
        'REPLACE INTO otps (email, code, expiresAt, attempts) VALUES (?, ?, ?, ?)',
        [email, otp, expirationTime, 0]
      );

      const { canSendEmail, transporter } = getTransporter();

      // Send OTP email
      if (canSendEmail && transporter) {
        try {
          await transporter.verify();
          const info = await transporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: email,
            subject: `${APP_NAME} - Email Verification Code`,
            html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                <h1 style="margin: 0;">📱 ${APP_NAME}</h1>
                <p style="margin: 5px 0 0 0; opacity: 0.9;">Email Verification</p>
              </div>
              <div style="padding: 30px; background: #f5f5f5;">
                <h2 style="color: #333; margin-top: 0;">Verify Your Email</h2>
                <p style="color: #666; font-size: 16px; line-height: 1.6;">
                  Your verification code is:
                </p>
                <div style="background: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                  <div style="font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px;">
                    ${otp}
                  </div>
                </div>
                <p style="color: #999; font-size: 14px;">
                  This code will expire in 10 minutes. If you didn't request this code, please ignore this email.
                </p>
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #999; font-size: 12px;">
                  <p>${APP_NAME} - ${APP_TAGLINE}</p>
                </div>
              </div>
            </div>
          `,
          });
          console.log('OTP email sent successfully to', email);
        } catch (emailErr) {
          console.error('SMTP sending failed:', emailErr.message);
          return res.status(500).json({
            success: false,
            message: 'Failed to send email. Provider might be blocking it.',
          });
        }
      } else {
        console.log(`OTP for ${email}: ${otp} (SMTP not configured)`);
      }

      res.json({
        success: true,
        message: canSendEmail ? 'OTP sent to your email' : 'OTP generated. Check backend console log.',
      });
    } catch (error) {
      console.error('Send OTP error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send OTP',
        error: error.message,
      });
    }
  }
);

// Verify OTP
router.post(
  '/verify-otp',
  [
    body('email').isEmail().normalizeEmail(),
    body('code').isLength({ min: 6, max: 6 }).isNumeric(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const email = normalizeEmail(req.body.email);
      const { code } = req.body;
      const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
      if (users.length === 0) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Get OTP from database
      const [otps] = await pool.query('SELECT * FROM otps WHERE email = ?', [email]);
      const otpData = otps[0];

      if (!otpData) {
        return res.status(400).json({
          success: false,
          message: 'OTP expired or not found',
        });
      }

      // Check expiration
      if (Date.now() > otpData.expiresAt) {
        await pool.query('DELETE FROM otps WHERE email = ?', [email]);
        return res.status(400).json({
          success: false,
          message: 'OTP has expired',
        });
      }

      // Check attempts
      if (otpData.attempts >= 3) {
        return res.status(400).json({
          success: false,
          message: 'Too many attempts. Please request a new OTP',
        });
      }

      // Verify code
      if (otpData.code !== code) {
        // Increment attempts
        await pool.query('UPDATE otps SET attempts = attempts + 1 WHERE email = ?', [email]);
        return res.status(400).json({
          success: false,
          message: 'Invalid OTP code',
        });
      }

      await pool.query('UPDATE users SET isVerified = true WHERE email = ?', [email]);

      // Delete OTP after verification
      await pool.query('DELETE FROM otps WHERE email = ?', [email]);

      res.json({
        success: true,
        message: 'Email verified successfully',
      });
    } catch (error) {
      console.error('Verify OTP error:', error);
      res.status(500).json({
        success: false,
        message: 'Verification failed',
        error: error.message,
      });
    }
  }
);

// Resend OTP
router.post(
  '/resend-otp',
  [body('email').isEmail().normalizeEmail()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const email = normalizeEmail(req.body.email);
      const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
      if (users.length === 0) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Generate new OTP
      const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const expirationTime = Date.now() + 10 * 60 * 1000;

      // Store new OTP
      await pool.query(
        'REPLACE INTO otps (email, code, expiresAt, attempts) VALUES (?, ?, ?, ?)',
        [email, newOtp, expirationTime, 0]
      );

      const { canSendEmail, transporter } = getTransporter();

      // Send email
      if (canSendEmail && transporter) {
        try {
          await transporter.verify();
          const info = await transporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: email,
            subject: `${APP_NAME} - New Email Verification Code`,
            html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                <h1 style="margin: 0;">📱 ${APP_NAME}</h1>
                <p style="margin: 5px 0 0 0; opacity: 0.9;">New Verification Code</p>
              </div>
              <div style="padding: 30px; background: #f5f5f5;">
                <h2 style="color: #333; margin-top: 0;">New Verification Code</h2>
                <p style="color: #666; font-size: 16px; line-height: 1.6;">
                  Your new verification code is:
                </p>
                <div style="background: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                  <div style="font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px;">
                    ${newOtp}
                  </div>
                </div>
                <p style="color: #999; font-size: 14px;">
                  This code will expire in 10 minutes.
                </p>
              </div>
            </div>
          `,
          });
          console.log('Resend OTP email sent successfully to', email);
        } catch (emailErr) {
          console.error('SMTP resending failed:', emailErr.message);
          return res.status(500).json({
            success: false,
            message: 'Failed to resend email. Provider might be blocking it.',
          });
        }
      } else {
        console.log(`New OTP for ${email}: ${newOtp} (SMTP not configured)`);
      }

      res.json({
        success: true,
        message: canSendEmail ? 'New OTP sent to your email' : 'New OTP generated. Check backend console log.',
      });
    } catch (error) {
      console.error('Resend OTP error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to resend OTP',
        error: error.message,
      });
    }
  }
);

export default router;
