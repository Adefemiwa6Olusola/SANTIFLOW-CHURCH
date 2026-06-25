import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import useAuthStore from '../store/authStore';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const resetPassword = useAuthStore(s => s.resetPassword);
  const resetPasswordSubmit = useAuthStore(s => s.resetPasswordSubmit);
  const isLoading = useAuthStore(s => s.isLoading);
  const error = useAuthStore(s => s.error);
  const clearError = useAuthStore(s => s.clearError);

  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await resetPassword(email);
      setSent(true);
      setResendCooldown(60);
    } catch {
      // Error handled by store
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      useAuthStore.setState({ error: 'Password must be at least 6 characters long' });
      return;
    }
    if (newPassword !== confirmPassword) {
      useAuthStore.setState({ error: 'Passwords do not match' });
      return;
    }
    if (otp.length !== 6) {
      useAuthStore.setState({ error: 'OTP must be exactly 6 digits' });
      return;
    }

    try {
      await resetPasswordSubmit({ email, otp, newPassword });
      setResetSuccess(true);
    } catch {
      // Error handled by store
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      await resetPassword(email);
      setResendCooldown(60);
    } catch {
      // Error handled by store
    }
  };

  return (
    <div className="auth-screen">
      {/* Floating blur blobs background */}
      <div className="blob-container">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
      </div>

      <motion.div
        className="auth-card glass-panel"
        initial={{ opacity: 0, y: 35, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        style={{ backdropFilter: 'blur(30px)', webkitBackdropFilter: 'blur(30px)' }}
      >
        <div className="auth-logo">
          <motion.img 
            src="/logo.png" 
            alt="SanctiFlow" 
            initial={{ rotate: -15, scale: 0.85 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
          />
        </div>
        <h1 className="auth-title" style={{ background: 'linear-gradient(135deg, #f5c842 0%, #e07b39 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'inline-block', width: '100%', textAlign: 'center' }}>
          {resetSuccess ? 'Success' : 'Reset Password'}
        </h1>
        <p className="auth-subtitle">
          {resetSuccess ? 'Password reset completed' : sent ? 'Enter your 6-digit OTP code' : 'Enter your email to receive a reset link.'}
        </p>

        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              padding: 'var(--space-3) var(--space-4)',
              background: 'var(--color-error-dim)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-error)',
              fontSize: 'var(--text-sm)',
              marginBottom: 'var(--space-4)',
              textAlign: 'center',
            }}
          >
            {error}
          </motion.div>
        )}

        {resetSuccess ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-4)' }}>
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              style={{ fontSize: '3.5rem', marginBottom: 'var(--space-4)' }}
            >
              ✅
            </motion.div>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-6)', lineHeight: '1.6' }}>
              Your password has been successfully updated. You can now log in to SanctiFlow.
            </p>
            <Link to="/login" className="btn btn-primary w-full">Back to Login</Link>
          </div>
        ) : sent ? (
          <form className="auth-form" onSubmit={handleResetSubmit}>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)', textAlign: 'center', lineHeight: '1.5' }}>
              We've sent a 6-digit OTP code to <strong>{email}</strong>. Enter it below along with your new password.
            </p>
            
            <div className="form-group">
              <label className="form-label" htmlFor="otp-code">6-Digit OTP Code</label>
              <input
                id="otp-code"
                type="text"
                maxLength={6}
                pattern="\d{6}"
                className="input-field"
                placeholder="123456"
                value={otp}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  setOtp(val);
                  clearError();
                }}
                style={{ 
                  textAlign: 'center', 
                  letterSpacing: '0.4em', 
                  fontSize: '1.5rem', 
                  fontFamily: 'monospace',
                  fontWeight: 'bold',
                  color: 'var(--color-accent-gold)'
                }}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="new-password">New Password</label>
              <input
                id="new-password"
                type="password"
                className="input-field"
                placeholder="Minimum 6 characters"
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); clearError(); }}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="confirm-password">Confirm Password</label>
              <input
                id="confirm-password"
                type="password"
                className="input-field"
                placeholder="Confirm your new password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); clearError(); }}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg w-full"
              disabled={isLoading}
              style={{ marginTop: 'var(--space-3)' }}
            >
              {isLoading ? <span className="spinner" /> : 'Verify & Reset Password'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 'var(--space-4)' }}>
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCooldown > 0 || isLoading}
                style={{
                  background: 'none',
                  border: 'none',
                  color: resendCooldown > 0 ? 'var(--color-text-muted)' : 'var(--color-accent-gold)',
                  cursor: resendCooldown > 0 ? 'default' : 'pointer',
                  fontSize: 'var(--text-sm)',
                  textDecoration: 'underline'
                }}
              >
                {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend OTP Code'}
              </button>
            </div>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="reset-email">Email</label>
              <input
                id="reset-email"
                type="email"
                className="input-field"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); clearError(); }}
                required
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary btn-lg w-full"
              disabled={isLoading}
              id="reset-submit-btn"
            >
              {isLoading ? <span className="spinner" /> : 'Send Reset Link & OTP'}
            </button>
          </form>
        )}

        <div className="auth-footer">
          <Link to="/login" style={{ color: 'var(--color-accent-gold)' }}>← Back to login</Link>
        </div>
      </motion.div>
    </div>
  );
}
