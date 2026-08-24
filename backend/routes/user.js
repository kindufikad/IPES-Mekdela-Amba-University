const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const pool = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const uploadDirectory = path.join(__dirname, '..', 'uploads', 'profile');
fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadDirectory),
  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase() || '.jpg';
    callback(null, `user-${req.user.id}-${Date.now()}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (file.mimetype.startsWith('image/')) return callback(null, true);
    return callback(new Error('Only image files are allowed.'));
  },
});

router.put('/profile', authenticateToken, upload.single('photo'), async (req, res) => {
  const phone = String(req.body.phone || '').trim();
  const profilePicture = req.file ? `/uploads/profile/${req.file.filename}` : null;
  try {
    const profileTable = req.user.role === 'student' ? 'students' : 'instructors';
    const fields = ['phone_number = ?'];
    const values = [phone || null];
    if (profilePicture) {
      fields.push('profile_picture = ?');
      values.push(profilePicture);
    }
    values.push(req.user.id);
    await pool.query(`UPDATE ${profileTable} SET ${fields.join(', ')} WHERE user_id = ?`, values);
    return res.status(200).json({ success: true, message: 'Profile updated successfully.', user: { phone, profile_picture: profilePicture } });
  } catch (error) {
    console.error('Unable to update user profile:', error);
    return res.status(500).json({ success: false, message: 'Unable to update profile.' });
  }
});

module.exports = router;