import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';
import useAuthStore from '../store/authStore';

export default function Signup() {
  const [formData, setFormData] = useState({ name: '', email: '', password: '', churchName: '' });
  const [showPassword, setShowPassword] = useState(false);
  const signup = useAuthStore(s => s.signup);
  const isLoading = useAuthStore(s => s.isLoading);
  const error = useAuthStore(s => s.error);
  const clearError = useAuthStore(s => s.clearError);
  const navigate = useNavigate();

  const handleChange = (field) => (e) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
    clearError();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password.length < 6) {
      useAuthStore.setState({ error: 'Password must be at least 6 characters' });
      return;
    }
    try {
      await signup({ ...formData, role: 'admin' });
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
          <span className="text-gradient-gold" style={{ background: 'linear-gradient(135deg, #f5c842 0%, #e07b39 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'inline-block' }}>Create Account</span>
        </h1>
        <p className="auth-subtitle">Set up your church media workspace</p>

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
            <label className="form-label" htmlFor="signup-name">Full Name</label>
            <input
              id="signup-name"
              type="text"
              className="input-field"
              placeholder="John Doe"
              value={formData.name}
              onChange={handleChange('name')}
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="signup-church">Church Name</label>
            <input
              id="signup-church"
              type="text"
              className="input-field"
              placeholder="e.g. Grace Community Church"
              value={formData.churchName}
              onChange={handleChange('churchName')}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="signup-email">Email</label>
            <input
              id="signup-email"
              type="email"
              className="input-field"
              placeholder="your@email.com"
              value={formData.email}
              onChange={handleChange('email')}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="signup-password">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="signup-password"
                type={showPassword ? 'text' : 'password'}
                className="input-field"
                placeholder="Min. 6 characters"
                value={formData.password}
                onChange={handleChange('password')}
                required
                minLength={6}
                style={{ paddingRight: '40px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 0
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-lg w-full"
            disabled={isLoading}
            id="signup-submit-btn"
          >
            {isLoading ? <span className="spinner" /> : 'Create Account'}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--color-accent-gold)', fontWeight: 600 }}>Sign in</Link>
        </div>
      </motion.div>
    </div>
  );
}
