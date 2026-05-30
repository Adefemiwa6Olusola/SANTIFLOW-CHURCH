import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import useAuthStore from '../store/authStore';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const resetPassword = useAuthStore(s => s.resetPassword);
  const isLoading = useAuthStore(s => s.isLoading);
  const error = useAuthStore(s => s.error);
  const clearError = useAuthStore(s => s.clearError);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await resetPassword(email);
      setSent(true);
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
        <h1 className="auth-title" style={{ background: 'linear-gradient(135deg, #f5c842 0%, #e07b39 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'inline-block', width: '100%', textAlign: 'center' }}>Reset Password</h1>
        <p className="auth-subtitle">

          {sent ? 'Check your email for reset instructions.' : 'Enter your email to receive a reset link.'}
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

        {sent ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-4)' }}>
            <div style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>📧</div>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-6)' }}>
              If an account exists with <strong>{email}</strong>, you'll receive a password reset link.
            </p>
            <Link to="/login" className="btn btn-primary">Back to Login</Link>
          </div>
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
              {isLoading ? <span className="spinner" /> : 'Send Reset Link'}
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
