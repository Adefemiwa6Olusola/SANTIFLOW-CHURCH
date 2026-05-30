import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_church_assistant_key_2026';

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.warn('JWT verification failed:', err.message);
    return res.status(401).json({ error: 'Request is not authorized' });
  }
}

export function requireRole(role) {
  const roles = { admin: 3, operator: 2, viewer: 1 };
  
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const userRoleValue = roles[req.user.role] || 0;
    const requiredRoleValue = roles[role] || 0;
    
    if (userRoleValue < requiredRoleValue) {
      return res.status(403).json({ error: 'Access forbidden: Insufficient permissions' });
    }
    
    next();
  };
}
