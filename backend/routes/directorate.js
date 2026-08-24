const express = require('express');
const pool = require('../config/db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken, authorizeRoles('academic_directorate', 'academic_director', 'directorate'));

const sendServerError = (res, error, message) => {
  console.error(`Directorate ${message}:`, error);
  return res.status(500).json({ message: 'Server Error', error: error.message });
};

router.get('/overview-stats', async (req, res) => {
  try {
    const [[collegeCount]] = await pool.query('SELECT COUNT(*) AS totalColleges FROM colleges');
    const [[evaluationCount]] = await pool.query(
      `SELECT
        SUM(CASE WHEN de.id IS NULL OR LOWER(de.status) <> 'completed' THEN 1 ELSE 0 END) AS pendingDeans,
        SUM(CASE WHEN LOWER(de.status) = 'completed' THEN 1 ELSE 0 END) AS completedDeans
       FROM users u
       LEFT JOIN directorate_evaluations de ON de.dean_id = u.id AND de.evaluator_id = ?
       WHERE LOWER(u.role) = 'college_dean'`,
      [req.user.id]
    );
    return res.json({
      totalColleges: Number(collegeCount?.totalColleges || 0),
      pendingDeans: Number(evaluationCount?.pendingDeans || 0),
      completedDeans: Number(evaluationCount?.completedDeans || 0),
    });
  } catch (error) {
    return sendServerError(res, error, 'overview stats error');
  }
});

router.get('/deans', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id AS deanId,
        u.email AS full_name,
        u.email,
        d.college_id AS collegeId,
        COALESCE(c.name, 'Unassigned') AS college_name,
        COALESCE(de.status, 'PENDING') AS evaluation_status,
        COALESCE(de.total_score, 0) AS score
       FROM users u
      LEFT JOIN instructors i ON i.user_id = u.id
      LEFT JOIN departments d ON d.id = i.department_id
      LEFT JOIN colleges c ON c.id = d.college_id
       LEFT JOIN directorate_evaluations de ON de.dean_id = u.id AND de.evaluator_id = ?
       WHERE LOWER(u.role) = 'college_dean'
       ORDER BY college_name ASC, full_name ASC`,
      [req.user.id]
    );
    return res.json(rows.map((row) => ({ ...row, score: Number(row.score || 0) })));
  } catch (error) {
    return sendServerError(res, error, 'deans query error');
  }
});

router.get('/analytics', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.id AS collegeId, c.name AS college_name,
        d.id AS departmentId,
        COALESCE(NULLIF(d.department_name, ''), d.name, 'All Departments') AS department_name,
        ROUND(COALESCE(AVG(de.total_score), 0), 2) AS performance,
        COUNT(DISTINCT d.id) AS departments
       FROM colleges c
       LEFT JOIN departments d ON d.college_id = c.id
        LEFT JOIN instructors dean_instructor ON dean_instructor.department_id = d.id
        LEFT JOIN users u ON u.id = dean_instructor.user_id AND LOWER(u.role) = 'college_dean'
       LEFT JOIN directorate_evaluations de ON de.dean_id = u.id AND LOWER(de.status) = 'completed'
      GROUP BY c.id, c.name, d.id, d.department_name, d.name ORDER BY college_name ASC, department_name ASC`
    );
    return res.json(rows.map((row) => ({ ...row, performance: Number(row.performance || 0), departments: Number(row.departments || 0) })));
  } catch (error) {
    return sendServerError(res, error, 'analytics query error');
  }
});

router.post('/evaluate-dean', async (req, res) => {
  const deanId = Number(req.body?.deanId || 0);
  const ratings = req.body?.ratings || {};
  const strengths = String(req.body?.strengths || '').trim();
  const weaknesses = String(req.body?.weaknesses || '').trim();
  const values = Object.values(ratings).map(Number);
  if (!deanId || !values.length || values.some((value) => value < 1 || value > 5)) {
    return res.status(400).json({ message: 'Dean and valid ratings for all criteria are required.' });
  }

  try {
    const [[dean]] = await pool.query("SELECT id FROM users WHERE id = ? AND LOWER(role) = 'college_dean' LIMIT 1", [deanId]);
    if (!dean) return res.status(404).json({ message: 'College Dean not found.' });
    const totalScore = (values.reduce((sum, value) => sum + value, 0) / (values.length * 5)) * 100;
    await pool.query(
      `INSERT INTO directorate_evaluations (evaluator_id, dean_id, ratings, strengths, weaknesses, total_score, status)
       VALUES (?, ?, ?, ?, ?, ?, 'COMPLETED')
       ON DUPLICATE KEY UPDATE ratings = VALUES(ratings), strengths = VALUES(strengths), weaknesses = VALUES(weaknesses), total_score = VALUES(total_score), status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP`,
      [req.user.id, deanId, JSON.stringify(ratings), strengths, weaknesses, totalScore]
    );
    return res.json({ success: true, totalScore: Number(totalScore.toFixed(2)), status: 'COMPLETED' });
  } catch (error) {
    return sendServerError(res, error, 'Dean evaluation submission error');
  }
});

module.exports = router;
