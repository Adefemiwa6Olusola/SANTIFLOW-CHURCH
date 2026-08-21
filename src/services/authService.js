// SanctiFlow Auth Service
// Production-grade architecture calling our Node.js backend

const STORAGE_KEY = 'sanctiflow_auth_session';
const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://olusotem-sanctiflow-backend.hf.space/api' : 'http://localhost:3001/api');

async function parseResponse(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (err) {
    if (text.includes('Your space') || text.includes('hf.co') || text.includes('sleeping')) {
      throw new Error('Backend server is currently offline or sleeping. Please restart your Hugging Face space.');
    }
    throw new Error('Received an invalid response from the backend server.');
  }
}

function getSession() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;
    const session = JSON.parse(data);
    
    // Check if token exists
    if (!session.token) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    
    // Check local expiry check (24h)
    if (session.loginAt && Date.now() - session.loginAt > 86400000) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    
    return session;
  } catch {
    return null;
  }
}

export function getAuthToken() {
  const session = getSession();
  return session ? session.token : null;
}

export async function login(email, password) {
  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });
    
    const data = await parseResponse(response);
    
    if (!response.ok) {
      throw new Error(data.error || 'Invalid email or password');
    }
    
    const session = {
      token: data.token,
      user: data.user,
      loginAt: Date.now()
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    return data.user;
  } catch (error) {
    console.error('[AuthService] Login failed:', error.message);
    throw error;
  }
}

export async function signup({ email, password, name, churchName, role = 'operator' }) {
  try {
    const response = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password, name, churchName, role })
    });
    
    const data = await parseResponse(response);
    
    if (!response.ok) {
      throw new Error(data.error || 'Signup failed');
    }
    
    const session = {
      token: data.token,
      user: data.user,
      loginAt: Date.now()
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    return data.user;
  } catch (error) {
    console.error('[AuthService] Signup failed:', error.message);
    throw error;
  }
}

export function logout() {
  localStorage.removeItem(STORAGE_KEY);
}

export function getCurrentUser() {
  const session = getSession();
  return session ? session.user : null;
}

export async function resetPassword(email) {
  try {
    const response = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email })
    });
    
    const data = await parseResponse(response);
    if (!response.ok) {
      throw new Error(data.error || 'Failed to request password reset');
    }
    return true;
  } catch (error) {
    console.error('[AuthService] Reset password request failed:', error.message);
    throw error;
  }
}

export async function verifyResetToken(token) {
  try {
    const response = await fetch(`${API_BASE}/auth/reset-password/${token}`);
    const data = await parseResponse(response);
    if (!response.ok) {
      throw new Error(data.error || 'Invalid or expired reset link');
    }
    return data;
  } catch (error) {
    console.error('[AuthService] Verify reset token failed:', error.message);
    throw error;
  }
}

export async function verifyOtp(email, otp) {
  try {
    const response = await fetch(`${API_BASE}/auth/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, otp })
    });
    
    const data = await parseResponse(response);
    if (!response.ok) {
      throw new Error(data.error || 'Failed to verify OTP');
    }
    return true;
  } catch (error) {
    console.error('[AuthService] Verify OTP failed:', error.message);
    throw error;
  }
}

export async function resetPasswordSubmit(param1, param2) {
  let body = {};
  if (param1 && typeof param1 === 'object') {
    body = param1;
  } else {
    body = { token: param1, newPassword: param2 };
  }
  
  try {
    const response = await fetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    
    const data = await parseResponse(response);
    if (!response.ok) {
      throw new Error(data.error || 'Failed to reset password');
    }
    return true;
  } catch (error) {
    console.error('[AuthService] Reset password submit failed:', error.message);
    throw error;
  }
}

export function isAuthenticated() {
  return !!getSession();
}

export function hasRole(requiredRole) {
  const session = getSession();
  if (!session || !session.user) return false;
  
  const roles = { admin: 3, operator: 2, viewer: 1 };
  const userRole = session.user.role || 'viewer';
  
  return (roles[userRole] || 0) >= (roles[requiredRole] || 0);
}
