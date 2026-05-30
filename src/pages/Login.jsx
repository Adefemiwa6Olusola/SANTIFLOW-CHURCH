import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import useAuthStore from '../store/authStore';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const login = useAuthStore(s => s.login);
  const isLoading = useAuthStore(s => s.isLoading);
  const error = useAuthStore(s => s.error);
  const clearError = useAuthStore(s => s.clearError);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(email, password);
      navigate('/');
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
        <h1 className="auth-title">
          <span className="text-gradient-gold" style={{ background: 'linear-gradient(135deg, #f5c842 0%, #e07b39 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'inline-block' }}>SanctiFlow</span>
        </h1>
        <p className="auth-subtitle">Sign in to your church media dashboard</p>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              padding: 'var(--space-3) var(--space-4)',
              background: 'var(--color-error-dim)',
              border: '1px solid hsla(0,84%,60%,0.3)',
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

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              className="input-field"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); clearError(); }}
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              className="input-field"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); clearError(); }}
              required
            />
          </div>
          <div style={{ textAlign: 'right' }}>
            <Link to="/forgot-password" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-accent-gold)' }}>
              Forgot password?
            </Link>
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-lg w-full"
            disabled={isLoading}
            id="login-submit-btn"
          >
            {isLoading ? <span className="spinner" /> : 'Sign In'}
          </button>
        </form>

        <div className="auth-footer">
          Don't have an account?{' '}
          <Link to="/signup" style={{ color: 'var(--color-accent-gold)', fontWeight: 600 }}>Create one</Link>
        </div>
      </motion.div>
    </div>
  );
}
