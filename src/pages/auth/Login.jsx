import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import useAuthStore from '../../store/authStore';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const login = useAuthStore(s => s.login);
  const isLoading = useAuthStore(s => s.isLoading);
  const error = useAuthStore(s => s.error);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      // Error is handled in store
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
          <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: 'white' }}>Welcome to SanctiFlow</h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>AI Church Media Operating System</p>
        </div>

        {error && (
          <div className="mb-4 p-3" style={{ background: 'hsla(0,84%,60%,0.1)', borderLeft: '2px solid var(--color-error)', color: 'var(--color-error)', fontSize: 'var(--text-sm)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
          <div>
            <div className="flex justify-between items-center mb-2">
              <label style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>Password</label>
              <Link to="/forgot-password" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-accent-gold)', textDecoration: 'none' }}>Forgot?</Link>
            </div>
            <input
              type="password"
              className="input-field"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          
          <button type="submit" className="btn btn-primary mt-2" disabled={isLoading} style={{ width: '100%', justifyContent: 'center' }}>
            {isLoading ? <span className="spinner" /> : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
          Don't have an account? <Link to="/signup" style={{ color: 'var(--color-accent-gold)', textDecoration: 'none' }}>Create one</Link>
        </div>
      </motion.div>
    </div>
  );
}
