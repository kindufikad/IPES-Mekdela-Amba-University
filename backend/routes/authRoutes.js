const express = require('express');
const { login, changePassword, logout, forgotPassword, resetPassword } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

router.post('/login', login);
router.post('/change-password', authenticateToken, changePassword);
router.post('/logout', logout);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;
