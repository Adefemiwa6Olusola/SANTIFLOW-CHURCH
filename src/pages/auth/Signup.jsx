import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import useAuthStore from '../../store/authStore';

export default function Signup() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    churchName: '',
    password: '',
    confirmPassword: '',
  });
  const signup = useAuthStore(s => s.signup);
  const isLoading = useAuthStore(s => s.isLoading);
  const error = useAuthStore(s => s.error);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      alert("Passwords don't match");
      return;
    }
    try {
      await signup(formData);
      navigate('/');
    } catch (err) {
      // Error handled in store
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: 'url(/backgrounds/nebula.png) center/cover' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, hsla(222,47%,8%,0.6), hsla(222,47%,8%,0.95))' }} />
      
      <motion.div
        className="glass-panel"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{ width: '100%', maxWidth: '450px', padding: 'var(--space-8)', position: 'relative', zIndex: 1 }}
      >
        <div className="flex flex-col items-center mb-8">
          <img src="/logo.png" alt="SanctiFlow" style={{ height: 48, marginBottom: 'var(--space-4)' }} />
          <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: 'white' }}>Create Account</h2>
        </div>

        {error && (
          <div className="mb-4 p-3" style={{ background: 'hsla(0,84%,60%,0.1)', borderLeft: '2px solid var(--color-error)', color: 'var(--color-error)', fontSize: 'var(--text-sm)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex gap-4">
            <div style={{ flex: 1 }}>
              <label className="block mb-2" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>Full Name</label>
              <input type="text" name="name" className="input-field" value={formData.name} onChange={handleChange} required />
            </div>
            <div style={{ flex: 1 }}>
              <label className="block mb-2" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>Church Name</label>
              <input type="text" name="churchName" className="input-field" value={formData.churchName} onChange={handleChange} />
            </div>
          </div>
          <div>
            <label className="block mb-2" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>Email</label>
            <input type="email" name="email" className="input-field" value={formData.email} onChange={handleChange} required />
          </div>
          <div>
            <label className="block mb-2" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>Password</label>
            <input type="password" name="password" className="input-field" value={formData.password} onChange={handleChange} required minLength={6} />
          </div>
          <div>
            <label className="block mb-2" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>Confirm Password</label>
            <input type="password" name="confirmPassword" className="input-field" value={formData.confirmPassword} onChange={handleChange} required minLength={6} />
          </div>
          
          <button type="submit" className="btn btn-primary mt-2" disabled={isLoading} style={{ width: '100%', justifyContent: 'center' }}>
            {isLoading ? <span className="spinner" /> : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 text-center" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--color-accent-gold)', textDecoration: 'none' }}>Sign In</Link>
        </div>
      </motion.div>
    </div>
  );
}
