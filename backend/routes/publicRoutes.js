const express = require('express');
const { getSystemStats } = require('../controllers/publicController');

const router = express.Router();

router.get('/system-stats', getSystemStats);

module.exports = router;