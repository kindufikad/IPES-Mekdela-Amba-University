const express = require('express');
const pool = require('../config/db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

router.get('/analytics', authenticateToken, authorizeRoles('dept_head'), async (req, res) => {
  const departmentId = Number(req.user?.department_id);
  if (!Number.isInteger(departmentId) || departmentId <= 0) {
    return res.status(403).json({ message: 'Your department is not defined. Contact an administrator.' });
  }

  try {
    const [rows] = await pool.query(`
      SELECT
        COALESCE(NULLIF(d.department_name, ''), d.name) AS department,
        ROUND(AVG(er.total_score), 2) AS satisfaction
      FROM evaluation_results er
      INNER JOIN instructors i ON i.id = er.instructor_id
      INNER JOIN departments d ON d.id = er.department_id
      INNER JOIN users u ON u.id = i.user_id
      WHERE er.department_id = ?
        AND LOWER(COALESCE(u.status, 'active')) = 'active'
      GROUP BY d.id, d.department_name, d.name
      ORDER BY department ASC
    `, [departmentId]);

    return res.json(rows.map((row) => ({
      department: row.department || 'Department',
      satisfaction: Number(row.satisfaction || 0),
    })));
  } catch (error) {
    console.error('Unable to load department-head analytics:', error);
    return res.status(500).json({ message: 'Unable to load department analytics.' });
  }
});

module.exports = router;