import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import useAuthStore from '../../store/authStore';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [success, setSuccess] = useState(false);
  const resetPassword = useAuthStore(s => s.resetPassword);
  const isLoading = useAuthStore(s => s.isLoading);
  const error = useAuthStore(s => s.error);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await resetPassword(email);
      setSuccess(true);
    } catch (err) {
      // Error handled in store
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: 'url(/backgrounds/rays.png) center/cover' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, hsla(222,47%,8%,0.6), hsla(222,47%,8%,0.95))' }} />
      
      <motion.div
        className="glass-panel"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ width: '100%', maxWidth: '400px', padding: 'var(--space-8)', position: 'relative', zIndex: 1 }}
      >
        <div className="flex flex-col items-center mb-8">
          <img src="/logo.png" alt="SanctiFlow" style={{ height: 48, marginBottom: 'var(--space-4)' }} />
          <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: 'white' }}>Reset Password</h2>
        </div>

        {error && (
          <div className="mb-4 p-3" style={{ background: 'hsla(0,84%,60%,0.1)', borderLeft: '2px solid var(--color-error)', color: 'var(--color-error)', fontSize: 'var(--text-sm)' }}>
            {error}
          </div>
        )}

        {success ? (
          <div className="text-center">
            <div className="mb-4" style={{ color: 'var(--color-success)', fontSize: '3rem' }}>✓</div>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)' }}>
              If an account exists for {email}, you will receive a password reset link shortly.
            </p>
            <Link to="/login" className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', textDecoration: 'none' }}>
              Return to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)' }}>
              Enter your email address and we'll send you a link to reset your password.
            </p>
            <div>
              <label className="block mb-2" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>Email</label>
              <input
                type="email"
                className="input-field"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            
            <button type="submit" className="btn btn-primary mt-2" disabled={isLoading} style={{ width: '100%', justifyContent: 'center' }}>
              {isLoading ? <span className="spinner" /> : 'Send Reset Link'}
            </button>
          </form>
        )}

        <div className="mt-6 text-center" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
          <Link to="/login" style={{ color: 'var(--color-accent-gold)', textDecoration: 'none' }}>Back to Login</Link>
        </div>
      </motion.div>
    </div>
  );
}
