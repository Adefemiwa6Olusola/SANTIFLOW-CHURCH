import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import db from '../services/db.js';
import { sendPasswordResetEmail, sendOtpEmail } from '../services/emailService.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_church_assistant_key_2026';
const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

export async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = db.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role, churchName: user.churchName },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        churchName: user.churchName
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function signup(req, res) {
  const { email, password, name, churchName, role } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password, and name are required' });
  }

  try {
    const existingUser = db.findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    
    // First user is automatically admin, others operator
    const usersCount = db.getUsers().length;
    const assignedRole = usersCount === 0 ? 'admin' : (role || 'operator');

    const newUser = db.createUser({
      email,
      password: hashedPassword,
      name,
      churchName,
      role: assignedRole
    });

    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role, churchName: newUser.churchName },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        churchName: newUser.churchName
      }
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getCurrentUser(req, res) {
  try {
    const user = db.findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      churchName: user.churchName
    });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ── Password Reset: Step 1 — Request reset (sends OTP and token) ──────
export async function requestPasswordReset(req, res) {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    // SECURITY: Always respond with the same message whether user exists or not
    // This prevents email enumeration attacks
    const successMessage = 'If an account exists with that email, a verification code has been sent.';

    const user = db.findUserByEmail(email);
    if (!user) {
      // Don't reveal that the user doesn't exist
      console.log(`[Auth] Password reset requested for non-existent email: ${email}`);
      return res.json({ message: successMessage });
    }

    // 1. Generate 6-digit numeric OTP code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = Date.now() + 15 * 60 * 1000; // 15 minutes

    // Anti-spam cooldown check (60 seconds)
    const existingOtp = db.findOtpByEmail(email);
    if (existingOtp && Date.now() - new Date(existingOtp.createdAt).getTime() < 60 * 1000) {
      return res.status(429).json({ error: 'Please wait 60 seconds before requesting another code.' });
    }

    // Hash the OTP securely
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

    // Save the OTP to DB
    db.createOtp({
      email: user.email,
      userId: user.id,
      otpHash,
      expiresAt: otpExpiry,
      attempts: 0,
      verified: false
    });

    // 2. Generate a traditional token link for backwards compatibility
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiry = Date.now() + RESET_TOKEN_EXPIRY_MS;

    db.createResetToken({
      token: resetToken,
      userId: user.id,
      email: user.email,
      expiresAt: tokenExpiry
    });

    const frontendUrl = process.env.FRONTEND_URL || req.headers.origin || 'https://sanctiflow.vercel.app';

    // 3. Dispatch emails (both the OTP email and the legacy token link email)
    try {
      await sendOtpEmail(user.email, user.name, otp, 15);
      console.log(`[Auth] Secure OTP email sent to ${user.email}`);
    } catch (emailErr) {
      console.error(`[Auth] Failed to send OTP email:`, emailErr.message);
    }

    try {
      await sendPasswordResetEmail(user.email, user.name, resetToken, frontendUrl);
      console.log(`[Auth] Backup password reset token link email sent to ${user.email}`);
    } catch (emailErr) {
      console.error(`[Auth] Failed to send backup reset email:`, emailErr.message);
    }

    res.json({ message: successMessage });
  } catch (err) {
    console.error('Password reset request error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ── Password Reset: Step 1b — Verify OTP code ───────────────────
export async function verifyOtp(req, res) {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and OTP code are required' });
  }

  try {
    const otpData = db.findOtpByEmail(email);

    if (!otpData) {
      return res.status(400).json({ error: 'Invalid or expired OTP code' });
    }

    // Expiry check
    if (new Date(otpData.expiresAt).getTime() < Date.now()) {
      db.deleteOtp(email);
      return res.status(400).json({ error: 'This OTP code has expired. Please request a new one.' });
    }

    // Attempts limit check
    if (otpData.attempts >= 3) {
      db.deleteOtp(email);
      return res.status(400).json({ error: 'Too many incorrect attempts. This OTP code has been invalidated. Please request a new one.' });
    }

    // Validate the OTP
    const hashed = crypto.createHash('sha256').update(otp.trim()).digest('hex');
    if (hashed !== otpData.otpHash) {
      const newAttempts = (otpData.attempts || 0) + 1;
      db.updateOtpAttempts(email, newAttempts);

      if (newAttempts >= 3) {
        db.deleteOtp(email);
        return res.status(400).json({ error: 'Too many incorrect attempts. This OTP code has been invalidated. Please request a new one.' });
      }

      return res.status(400).json({ error: `Incorrect OTP code. You have ${3 - newAttempts} attempt(s) remaining.` });
    }

    // Mark OTP as verified
    const updatedOtp = {
      ...otpData,
      verified: true
    };
    db.createOtp(updatedOtp);

    console.log(`[Auth] OTP verified successfully for ${email}`);
    res.json({ success: true, message: 'OTP verified successfully.' });
  } catch (err) {
    console.error('OTP verification error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ── Password Reset: Step 2 — Verify token is valid (Legacy) ────
export async function verifyResetToken(req, res) {
  const { token } = req.params;

  if (!token) {
    return res.status(400).json({ error: 'Token is required', valid: false });
  }

  try {
    const tokenData = db.findResetToken(token);

    if (!tokenData) {
      return res.status(400).json({ error: 'Invalid or expired reset link', valid: false });
    }

    if (tokenData.expiresAt < Date.now()) {
      db.deleteResetToken(token);
      return res.status(400).json({ error: 'This reset link has expired. Please request a new one.', valid: false });
    }

    res.json({ valid: true, email: tokenData.email });
  } catch (err) {
    console.error('Token verification error:', err);
    res.status(500).json({ error: 'Internal server error', valid: false });
  }
}

// ── Password Reset: Step 3 — Set new password ─────────────────
export async function resetPassword(req, res) {
  const { token, email, otp, newPassword } = req.body;

  if (!newPassword) {
    return res.status(400).json({ error: 'New password is required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    let userId = null;
    let userEmail = null;

    // A. OTP-based reset verification path
    if (email && otp) {
      const otpData = db.findOtpByEmail(email);

      if (!otpData) {
        return res.status(400).json({ error: 'Invalid or expired OTP code. Please request a new one.' });
      }

      // Check expiry
      if (new Date(otpData.expiresAt).getTime() < Date.now()) {
        db.deleteOtp(email);
        return res.status(400).json({ error: 'This OTP code has expired. Please request a new one.' });
      }

      // Verify attempts limit
      if (otpData.attempts >= 3) {
        db.deleteOtp(email);
        return res.status(400).json({ error: 'Too many incorrect attempts. This OTP code has been invalidated. Please request a new one.' });
      }

      // Validate the code
      const hashed = crypto.createHash('sha256').update(otp.trim()).digest('hex');
      if (hashed !== otpData.otpHash && !otpData.verified) {
        const newAttempts = (otpData.attempts || 0) + 1;
        db.updateOtpAttempts(email, newAttempts);

        if (newAttempts >= 3) {
          db.deleteOtp(email);
          return res.status(400).json({ error: 'Too many incorrect attempts. This OTP code has been invalidated. Please request a new one.' });
        }

        return res.status(400).json({ error: `Incorrect OTP code. You have ${3 - newAttempts} attempt(s) remaining.` });
      }

      userId = otpData.userId;
      userEmail = otpData.email;

      // Invalidate the OTP (single-use)
      db.deleteOtp(email);
    } 
    // B. Legacy Token-based reset path
    else if (token) {
      const tokenData = db.findResetToken(token);

      if (!tokenData) {
        return res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' });
      }

      if (tokenData.expiresAt < Date.now()) {
        db.deleteResetToken(token);
        return res.status(400).json({ error: 'This reset link has expired. Please request a new one.' });
      }

      userId = tokenData.userId;
      userEmail = tokenData.email;

      // Invalidate token (single-use)
      db.deleteResetToken(token);
    } 
    else {
      return res.status(400).json({ error: 'Either a valid verification token or OTP and email details are required.' });
    }

    // Hash and update the user's password
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    const updated = db.updateUserPassword(userId, hashedPassword);
    if (!updated) {
      return res.status(400).json({ error: 'User account not found' });
    }

    console.log(`[Auth] Password successfully reset for user ${userEmail}`);
    res.json({ message: 'Password has been reset successfully. You can now log in with your new password.' });
  } catch (err) {
    console.error('Password reset error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

