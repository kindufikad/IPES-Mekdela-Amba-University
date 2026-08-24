const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const nodemailer = require('nodemailer');

const createMailer = () => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
};

const forgotPassword = async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ success: false, message: 'Email is required.' });

  try {
    const [[user]] = await pool.query('SELECT id FROM users WHERE LOWER(email) = ? AND status = \'active\' LIMIT 1', [email]);
    if (!user) return res.status(404).json({ success: false, message: 'No active account was found for that email.' });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await bcrypt.hash(code, 10);
    await pool.query('DELETE FROM password_resets WHERE user_id = ?', [user.id]);
    await pool.query(
      'INSERT INTO password_resets (user_id, code_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 15 MINUTE))',
      [user.id, codeHash]
    );

    const mailer = createMailer();
    const message = `Your IPES password recovery code is ${code}. It expires in 15 minutes.`;
    if (mailer) {
      await mailer.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        subject: 'IPES password recovery code',
        text: message,
      });
    } else {
      console.info(`[PASSWORD RESET OTP] ${email}: ${code} (expires in 15 minutes)`);
    }
    return res.json({ success: true, message: 'A 6-digit code has been sent to your email.' });
  } catch (error) {
    console.error('Forgot password request failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to send password recovery code.' });
  }
};

const resetPassword = async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const code = String(req.body?.code || req.body?.verificationCode || '').trim();
  const newPassword = String(req.body?.newPassword || req.body?.new_password || '').trim();
  if (!email || !/^\d{6}$/.test(code) || newPassword.length < 8) {
    return res.status(400).json({ success: false, message: 'Email, a valid 6-digit code, and a password of at least 8 characters are required.' });
  }

  try {
    const [[reset]] = await pool.query(
      `SELECT pr.id, pr.code_hash, u.id AS user_id
       FROM password_resets pr INNER JOIN users u ON u.id = pr.user_id
       WHERE LOWER(u.email) = ? AND u.status = 'active' AND pr.expires_at > NOW()
       ORDER BY pr.created_at DESC LIMIT 1`,
      [email]
    );
    if (!reset || !(await bcrypt.compare(code, reset.code_hash))) {
      return res.status(400).json({ success: false, message: 'Invalid or expired verification code.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password_hash = ?, is_first_login = 0 WHERE id = ?', [passwordHash, reset.user_id]);
    await pool.query('DELETE FROM password_resets WHERE user_id = ?', [reset.user_id]);
    return res.json({ success: true, message: 'Password reset successfully.' });
  } catch (error) {
    console.error('Password reset failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to reset password.' });
  }
};

const login = async (req, res) => {
  try {
    const identifier = String(req.body?.identifier ?? req.body?.email ?? req.body?.username ?? '').trim();
    const password = String(req.body?.password ?? '').trim();

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email/Student ID and password are required.',
      });
    }

    let rows;
    try {
      [rows] = await pool.query(
        `SELECT u.id AS user_id,
          u.email,
          u.password_hash,
          u.role,
          u.status,
          u.is_first_login,
          CASE WHEN u.role = 'student' THEN s.gender ELSE i.gender END AS gender,
          CASE WHEN u.role = 'student' THEN s.phone_number ELSE i.phone_number END AS phone_number,
          CASE WHEN u.role = 'student' THEN s.profile_picture ELSE i.profile_picture END AS profile_picture,
          COALESCE(i.first_name, s.first_name, '') AS first_name,
          COALESCE(i.last_name, s.last_name, '') AS last_name,
          CASE WHEN u.role = 'student' THEN s.department_id ELSE i.department_id END AS department_id,
          d.code AS department_code,
          d.name AS department_name,
          s.student_id,
          i.employee_id,
          COALESCE(CONCAT(i.first_name, ' ', i.last_name), CONCAT(s.first_name, ' ', s.last_name), u.email) AS full_name
         FROM users u
         LEFT JOIN instructors i ON i.user_id = u.id
         LEFT JOIN students s ON s.user_id = u.id
         LEFT JOIN departments d ON d.id = COALESCE(i.department_id, s.department_id)
        WHERE (u.email = ? OR s.student_id = ? OR i.employee_id = ?)
           AND u.status = 'active'
         LIMIT 1`,
        [identifier, identifier, identifier]
      );
    } catch (err) {
      console.error('EXACT LOGIN SQL ERROR:', err.message, err.sql);
      console.error(err.stack);
      return res.status(500).json({ success: false, message: err.message, sqlError: err.code });
    }

    if (!rows.length) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect email',
      });
    }

    const user = rows[0];
    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'User';
    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect password',
      });
    }

    const token = jwt.sign(
      {
        id: user.user_id,
        email: user.email,
        student_id: user.student_id || null,
        role: user.role,
        phone: user.phone_number,
        phone_number: user.phone_number,
        department_id: user.department_id,
        department_code: user.department_code,
        department_name: user.department_name,
      },
      process.env.JWT_SECRET || 'change-this-secret',
      { expiresIn: '8h' }
    );

    if (req.session) {
      req.session.user = {
        id: user.user_id,
        email: user.email,
        student_id: user.student_id,
        role: user.role,
      };
      req.session.token = token;
    }

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: {
        token,
        user: {
          id: user.user_id,
          email: user.email,
          role: user.role,
          isFirstLogin: Boolean(user.is_first_login),
          name: fullName,
          gender: user.gender,
          phone_number: user.phone_number,
          profile_picture: user.profile_picture,
          department_id: user.department_id,
          student_id: user.student_id || null,
          username: user.email || user.student_id || null,
        },
      },
    });
  } catch (error) {
    console.error('DETAILED LOGIN ERROR:', error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const changePassword = async (req, res) => {
  try {
    const userId = Number(req.user?.id);
    const currentPassword = typeof req.body?.currentPassword === 'string'
      ? req.body.currentPassword.trim()
      : '';
    const newPassword = typeof req.body?.newPassword === 'string'
      ? req.body.newPassword.trim()
      : '';

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({ success: false, message: 'Authentication failed. Please log in again.' });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Both current and new passwords are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
    }

    if (newPassword === currentPassword) {
      return res.status(400).json({ success: false, message: 'New password must be different from the current password.' });
    }

    const [[user]] = await pool.query(
      `SELECT u.id, u.email, u.password_hash, u.role, s.student_id
       FROM users u
       LEFT JOIN students s ON s.user_id = u.id
       WHERE u.id = ? LIMIT 1`,
      [userId]
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (!(await bcrypt.compare(currentPassword, user.password_hash))) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password_hash = ?, is_first_login = 0 WHERE id = ?', [passwordHash, userId]);

    const identifier = user.email || user.student_id || `user-${user.id}`;
    const role = req.user.role || user.role;
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        student_id: user.student_id || null,
        role,
        isFirstLogin: false,
      },
      process.env.JWT_SECRET || 'change-this-secret',
      { expiresIn: '8h' }
    );

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully.',
      data: {
        token,
        user: {
          id: user.id,
          username: identifier,
          email: user.email,
          student_id: user.student_id || null,
          role,
          isFirstLogin: false,
        },
      },
    });
  } catch (error) {
    console.error('Change password failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to change password.' });
  }
};

const logout = (req, res) => {
  try {
    if (req.session && typeof req.session.destroy === 'function') {
      req.session.destroy((err) => {
        if (err) {
          console.error('Logout session destroy error:', err);
        }
      });
    }

    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
    res.clearCookie('connect.sid', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    return res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout Error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Logout failed.' });
  }
};

module.exports = {
  login,
  changePassword,
  logout,
  forgotPassword,
  resetPassword,
};
