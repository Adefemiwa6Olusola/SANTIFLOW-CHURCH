// SanctiFlow Auth Service
// Production-grade architecture calling our Node.js backend

const STORAGE_KEY = 'sanctiflow_auth_session';
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

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
    
    const data = await response.json();
    
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
    
    const data = await response.json();
    
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
  // In a full implementation, this calls /api/auth/reset-password
  // Since password reset usually sends an email, we simulate for now or return true
  await new Promise(r => setTimeout(r, 800));
  return true;
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
