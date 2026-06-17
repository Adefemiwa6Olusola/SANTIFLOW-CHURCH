import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import db from '../services/db.js';
import { sendPasswordResetEmail } from '../services/emailService.js';

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

// ── Password Reset: Step 1 — Request reset (sends email) ──────
export async function requestPasswordReset(req, res) {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    // SECURITY: Always respond with the same message whether user exists or not
    // This prevents email enumeration attacks
    const successMessage = 'If an account exists with that email, a password reset link has been sent.';

    const user = db.findUserByEmail(email);
    if (!user) {
      // Don't reveal that the user doesn't exist
      console.log(`[Auth] Password reset requested for non-existent email: ${email}`);
      return res.json({ message: successMessage });
    }

    // Generate a cryptographically secure token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + RESET_TOKEN_EXPIRY_MS;

    // Store the token
    db.createResetToken({
      token: resetToken,
      userId: user.id,
      email: user.email,
      expiresAt
    });

    // Determine the frontend URL for the reset link
    const frontendUrl = process.env.FRONTEND_URL || req.headers.origin || 'https://sanctiflow.vercel.app';

    // Send the email
    try {
      await sendPasswordResetEmail(user.email, user.name, resetToken, frontendUrl);
      console.log(`[Auth] Password reset email sent to ${user.email}`);
    } catch (emailErr) {
      console.error(`[Auth] Failed to send reset email:`, emailErr.message);
      // Still return success to not reveal information, but log the error
    }

    res.json({ message: successMessage });
  } catch (err) {
    console.error('Password reset request error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ── Password Reset: Step 2 — Verify token is valid ────────────
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
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token and new password are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    const tokenData = db.findResetToken(token);

    if (!tokenData) {
      return res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' });
    }

    if (tokenData.expiresAt < Date.now()) {
      db.deleteResetToken(token);
      return res.status(400).json({ error: 'This reset link has expired. Please request a new one.' });
    }

    // Hash the new password
    const hashedPassword = bcrypt.hashSync(newPassword, 10);

    // Update the user's password
    const updated = db.updateUserPassword(tokenData.userId, hashedPassword);
    if (!updated) {
      return res.status(400).json({ error: 'User account not found' });
    }

    // Delete the token (single-use)
    db.deleteResetToken(token);

    console.log(`[Auth] Password successfully reset for user ${tokenData.email}`);
    res.json({ message: 'Password has been reset successfully. You can now log in with your new password.' });
  } catch (err) {
    console.error('Password reset error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

