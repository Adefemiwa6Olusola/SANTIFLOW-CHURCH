import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { verifyResetToken, resetPasswordSubmit } from '../services/authService';
import useAppStore from '../store/appStore';

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const addToast = useAppStore(s => s.addToast);

  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [email, setEmail] = useState('');
  const [verificationError, setVerificationError] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let active = true;
    verifyResetToken(token)
      .then(data => {
        if (active) {
          setTokenValid(true);
          setEmail(data.email || '');
          setVerifying(false);
        }
      })
      .catch(err => {
        if (active) {
          setTokenValid(false);
          setVerificationError(err.message || 'Invalid or expired reset token');
          setVerifying(false);
        }
      });

    return () => { active = false; };
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');

    if (newPassword.length < 6) {
      setSubmitError('Password must be at least 6 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setSubmitError('Passwords do not match');
      return;
    }

    setSubmitting(true);
    try {
      await resetPasswordSubmit(token, newPassword);
      setSuccess(true);
      addToast({ type: 'success', message: 'Password reset successful!' });
    } catch (err) {
      setSubmitError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const cardStyle = {
    background: 'hsla(222,40%,10%,0.8)',
    border: '1px solid hsla(255,255,255,0.06)',
    borderRadius: 16,
    padding: '32px 28px',
    maxWidth: 420,
    width: '100%',
    backdropFilter: 'blur(30px)',
    boxShadow: '0 20px 40px rgba(0,0,0,0.35)',
  };

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 10,
    fontSize: 13,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'white',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border 0.2s ease',
    marginTop: 6,
    marginBottom: 16,
  };

  const labelStyle = {
    fontSize: 10,
    fontWeight: 800,
    color: 'rgba(255,255,255,0.35)',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    display: 'block',
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'hsl(222,47%,5%)',
      fontFamily: '"Outfit","Inter",sans-serif',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
      padding: 20,
    }}>
      {/* Background Blobs */}
      <div style={{
        position: 'absolute', width: 400, height: 400, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(245,200,66,0.08) 0%, transparent 70%)',
        top: '10%', left: '15%', zIndex: 0
      }} />
      <div style={{
        position: 'absolute', width: 450, height: 450, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)',
        bottom: '10%', right: '15%', zIndex: 0
      }} />

      <motion.div
        style={cardStyle}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Logo Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, margin: '0 auto 12px',
            background: 'linear-gradient(135deg,#f5c842,#e07b39)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, fontWeight: 900, color: '#1a1000',
            boxShadow: '0 0 20px rgba(245,200,66,0.25)',
          }}>S</div>
          <h1 style={{
            margin: 0, fontSize: 20, fontWeight: 800, color: 'white',
            background: 'linear-gradient(135deg, #f5c842 0%, #e07b39 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
          }}>
            Set New Password
          </h1>
        </div>

        {verifying ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
            <div style={{
              width: 28, height: 28, border: '3px solid rgba(255,255,255,0.1)',
              borderTopColor: '#f5c842', borderRadius: '50%', margin: '0 auto 12px',
              animation: 'spin 1s linear infinite'
            }} />
            Verifying secure link...
          </div>
        ) : !tokenValid ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <div style={{ color: '#ef4444', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
              Link Invalid or Expired
            </div>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, lineHeight: 1.6, marginBottom: 20 }}>
              {verificationError || 'This password reset link is invalid or has expired. Please request a new one.'}
            </p>
            <Link to="/forgot-password" style={{
              display: 'inline-block', padding: '10px 20px', borderRadius: 8,
              background: 'rgba(255,255,255,0.06)', color: 'white',
              fontSize: 12, fontWeight: 700, textDecoration: 'none',
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              Request New Link
            </Link>
          </div>
        ) : success ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>✅</div>
            <div style={{ color: '#22c55e', fontSize: 14, fontWeight: 800, marginBottom: 8 }}>
              Password Reset Complete
            </div>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, lineHeight: 1.6, marginBottom: 24 }}>
              Your password has been successfully updated. You can now log in to your account with your new password.
            </p>
            <Link to="/login" style={{
              display: 'block', padding: '12px', borderRadius: 10,
              background: 'linear-gradient(135deg,#f5c842,#e07b39)', color: '#1a1000',
              fontSize: 13, fontWeight: 800, textDecoration: 'none',
              boxShadow: '0 4px 12px rgba(245,200,66,0.2)'
            }}>
              Log In Now
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginBottom: 20, marginTop: 0 }}>
              Resetting password for <strong style={{ color: 'rgba(255,255,255,0.7)' }}>{email}</strong>
            </p>

            {submitError && (
              <div style={{
                padding: '10px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.15)',
                border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5',
                fontSize: 12, marginBottom: 16, textAlign: 'center'
              }}>
                {submitError}
              </div>
            )}

            <div>
              <label style={labelStyle} htmlFor="new-password">New Password</label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                style={inputStyle}
                placeholder="Minimum 6 characters"
                required
                autoFocus
              />
            </div>

            <div>
              <label style={labelStyle} htmlFor="confirm-password">Confirm Password</label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                style={inputStyle}
                placeholder="Re-enter new password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%', padding: '12px', borderRadius: 10, border: 'none',
                background: 'linear-gradient(135deg,#f5c842,#e07b39)', color: '#1a1000',
                fontSize: 13, fontWeight: 800, cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(245,200,66,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
              }}
            >
              {submitting ? (
                <>
                  <span style={{
                    width: 12, height: 12, border: '2px solid rgba(26,16,0,0.2)',
                    borderTopColor: '#1a1000', borderRadius: '50%', display: 'inline-block',
                    animation: 'spin 0.8s linear infinite'
                  }} />
                  Updating...
                </>
              ) : 'Update Password'}
            </button>
          </form>
        )}
      </motion.div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
