const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const pool = require('../config/db');

dotenv.config();

const authenticateToken = (req, res, next) => {
  const authorization = typeof req.headers?.authorization === 'string'
    ? req.headers.authorization.trim()
    : '';
  const match = authorization.match(/^Bearer\s+([^\s]+)$/i);

  if (!match) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Bearer access token required.',
    });
  }

  const token = match[1];
  try {
    jwt.verify(token, process.env.JWT_SECRET || 'change-this-secret', (err, user) => {
      if (err) {
        return res.status(401).json({
          success: false,
          message: err.name === 'TokenExpiredError'
            ? 'Unauthorized: access token expired.'
            : 'Unauthorized: invalid access token.',
        });
      }
    const rawRole = String(user.role || user.user_role || '').trim().toLowerCase();
    req.user = {
      ...user,
      role: rawRole === 'department_head' ? 'dept_head' : rawRole,
    };
      if (req.user.department_id || !req.user.id) return next();
      pool.query(
        `SELECT COALESCE(i.department_id, s.department_id) AS department_id,
          d.code AS department_code, d.name AS department_name
         FROM users u
         LEFT JOIN instructors i ON i.user_id = u.id
         LEFT JOIN students s ON s.user_id = u.id
         LEFT JOIN departments d ON d.id = COALESCE(i.department_id, s.department_id)
         WHERE u.id = ? LIMIT 1`,
        [req.user.id]
      ).then(([rows]) => {
        if (rows[0]) req.user = { ...req.user, ...rows[0] };
        next();
      }).catch(() => next());
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: unable to verify access token.',
    });
  }
};

const authorizeRoles = (...roles) => (req, res, next) => {
  const allowedRoles = roles.map((role) => {
    const normalized = String(role).trim().toLowerCase();
    return normalized === 'department_head' ? 'dept_head' : normalized;
  });
  const userRole = String(req.user?.role || '').trim().toLowerCase();
  const normalizedUserRole = userRole === 'department_head' ? 'dept_head' : userRole;
  if (!req.user || !allowedRoles.includes(normalizedUserRole)) {
    return res.status(403).json({ message: 'Forbidden: insufficient permissions' });
  }
  next();
};

module.exports = { authenticateToken, authorizeRoles };
