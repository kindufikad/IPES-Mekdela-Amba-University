const express = require('express');
const pool = require('../config/db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();
const getCollegeId = async (req) => {
  const userId = Number(req.user?.id || req.user?.user_id || 0);
  if (!userId) return 0;

  const [[fallbackRow]] = await pool.query(
    `SELECT d.college_id FROM instructors i
     INNER JOIN departments d ON d.id = i.department_id
     WHERE i.user_id = ? LIMIT 1`,
    [userId]
  );
  return Number(fallbackRow?.college_id || 0);
};
const sendError = (res, status, message) => res.status(status).json({ success: false, message });

router.use(authenticateToken, authorizeRoles('college_dean', 'dean'));

router.get('/my-performance', async (req, res) => {
  try {
    const [[instructor]] = await pool.query(
      'SELECT id FROM instructors WHERE user_id = ? LIMIT 1',
      [req.user.id]
    );
    const instructorId = instructor?.id || null;
    const [[studentRow]] = instructorId
      ? await pool.query(
        `SELECT COALESCE(AVG(ses.score), 0) AS score
         FROM student_evaluation_submissions ses
         INNER JOIN evaluation_dispatches ed ON ed.id = ses.dispatch_id
         INNER JOIN course_assignments ca ON ca.course_id = ed.course_id AND ca.instructor_id = ?
         WHERE LOWER(ses.status) = 'submitted'`,
        [instructorId]
      )
      : [[{ score: 0 }]];
    const [[peerRow]] = instructorId
      ? await pool.query(
        `SELECT COALESCE(AVG(pes.score), 0) AS score
         FROM peer_evaluation_submissions pes
         INNER JOIN peer_evaluations pe ON pe.id = pes.peer_evaluation_id
         WHERE pe.evaluatee_id = ? AND LOWER(pes.status) IN ('submitted', 'completed', 'approved')`,
        [instructorId]
      )
      : [[{ score: 0 }]];
    const [[directorateRow]] = await pool.query(
      `SELECT COALESCE(AVG(total_score), 0) AS score,
              MAX(strengths) AS strengths, MAX(weaknesses) AS weaknesses
       FROM directorate_evaluations
       WHERE dean_id = ? AND LOWER(status) = 'completed'
       GROUP BY dean_id`,
      [req.user.id]
    );

    const studentScore = Number(studentRow?.score || 0);
    const peerScore = Number(peerRow?.score || 0);
    const directorateScore = Number(directorateRow?.score || 0);
    const totalWeightedScore = (studentScore * 0.5) + (directorateScore * 0.3) + (peerScore * 0.2);
    const strengths = directorateRow?.strengths ? [directorateRow.strengths] : [];
    const improvements = directorateRow?.weaknesses ? [directorateRow.weaknesses] : [];

    return res.json({
      totalWeightedScore: Number(totalWeightedScore.toFixed(2)),
      breakdown: {
        student: { rawPercentage: Number(studentScore.toFixed(2)), weightedContribution: Number((studentScore * 0.5).toFixed(2)), weight: 50 },
        directorate: { rawPercentage: Number(directorateScore.toFixed(2)), weightedContribution: Number((directorateScore * 0.3).toFixed(2)), weight: 30 },
        peer: { rawPercentage: Number(peerScore.toFixed(2)), weightedContribution: Number((peerScore * 0.2).toFixed(2)), weight: 20 },
      },
      status: totalWeightedScore >= 85 ? 'Excellent' : totalWeightedScore >= 70 ? 'Good' : totalWeightedScore >= 50 ? 'Needs Improvement' : 'At Risk',
      feedback: { strengths, improvements },
    });
  } catch (error) {
    console.error('Dean performance error:', error);
    return res.status(500).json({ message: 'Unable to load Dean performance.', error: error.message });
  }
});

router.get('/overview-stats', async (req, res) => {
  try {
    const collegeId = await getCollegeId(req);
    if (!collegeId) return sendError(res, 400, 'Your college is not configured. Contact an administrator.');
    const [departmentRows] = await pool.query(
      'SELECT COUNT(*) AS departmentsCount FROM departments WHERE college_id = ?',
      [collegeId]
    );
    const [evaluationRows] = await pool.query(
      `SELECT
        SUM(CASE WHEN dhe.id IS NULL OR LOWER(COALESCE(dhe.status, 'pending')) NOT IN ('submitted', 'completed', 'approved') THEN 1 ELSE 0 END) AS pendingDeptHeadEvals,
        SUM(CASE WHEN dhe.id IS NOT NULL AND LOWER(COALESCE(dhe.status, 'pending')) IN ('submitted', 'completed', 'approved') THEN 1 ELSE 0 END) AS completedEvals
       FROM instructors i
       INNER JOIN users u ON u.id = i.user_id AND LOWER(u.role) = 'dept_head'
       INNER JOIN departments d ON d.id = i.department_id AND d.college_id = ?
       LEFT JOIN dept_head_evaluations dhe ON dhe.instructor_id = i.id
         AND dhe.evaluator_id = ?
         AND YEAR(dhe.created_at) = YEAR(CURDATE())`,
      [collegeId, req.user.id]
    );

    return res.json({
      departmentsCount: Number(departmentRows[0]?.departmentsCount || 0),
      pendingDeptHeadEvals: Number(evaluationRows[0]?.pendingDeptHeadEvals || 0),
      completedEvals: Number(evaluationRows[0]?.completedEvals || 0),
    });
  } catch (error) {
    console.error('Dean overview stats error:', error);
    return res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

router.get('/department-analytics', async (req, res) => {
  try {
    const collegeId = await getCollegeId(req);
    if (!collegeId) return sendError(res, 400, 'Your college is not configured.');
    const [rows] = await pool.query(
      `SELECT d.id AS departmentId,
        COALESCE(NULLIF(d.department_name, ''), d.name) AS department,
        ROUND(COALESCE(AVG(er.total_score), 0), 2) AS performance
       FROM departments d
       LEFT JOIN evaluation_results er ON er.department_id = d.id
       WHERE d.college_id = ?
       GROUP BY d.id, d.department_name, d.name
       ORDER BY department ASC`,
      [collegeId]
    );
    return res.json(rows.map((row) => ({ ...row, performance: Number(row.performance || 0) })));
  } catch (error) {
    console.error('Dean department analytics error:', error);
    return sendError(res, 500, 'Unable to load college analytics.');
  }
});

router.get('/dept-heads', async (req, res) => {
  try {
    const collegeId = await getCollegeId(req);
    if (!collegeId) {
      return res.status(200).json([]);
    }

    const [rows] = await pool.query(
      `SELECT u.id AS dept_head_id,
        i.id AS instructorId,
        COALESCE(NULLIF(CONCAT_WS(' ', i.first_name, i.last_name), ''), u.email) AS full_name,
        CONCAT(COALESCE(i.first_name, ''), ' ', COALESCE(i.last_name, '')) AS name,
        u.email,
        d.id AS departmentId,
        COALESCE(NULLIF(d.department_name, ''), d.name) AS department_name,
        COALESCE(NULLIF(d.department_name, ''), d.name) AS department,
        c.name AS college_name,
        COALESCE(dhe.total_score, 0) AS score,
        COALESCE(dhe.status, 'Pending') AS status
       FROM users u
       INNER JOIN instructors i ON i.user_id = u.id
       INNER JOIN departments d ON d.id = i.department_id
       INNER JOIN colleges c ON c.id = d.college_id
         AND c.id = ?
       LEFT JOIN dept_head_evaluations dhe ON dhe.instructor_id = i.id AND dhe.evaluator_id = ?
       WHERE LOWER(u.role) = 'dept_head'
       ORDER BY department_name ASC, full_name ASC`,
      [collegeId, req.user.id]
    );
    return res.json(rows.map((row) => ({
      ...row,
      score: Number(row.score || 0),
      name: row.full_name || row.name || row.email,
      department: row.department_name || row.department,
    })));
  } catch (error) {
    console.error('Dean department heads error:', error);
    return res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

const submitDepartmentHeadEvaluation = async (req, res) => {
  const instructorId = Number(req.body?.instructorId || 0);
  const criteriaScores = req.body?.criteriaScores || {};
  const totalScore = Number(req.body?.totalScore || 0);
  const strengths = String(req.body?.strengths || '').trim();
  const weaknesses = String(req.body?.weaknesses || '').trim();

  try {
    const collegeId = await getCollegeId(req);
    if (!collegeId || !instructorId || !Number.isFinite(totalScore)) return sendError(res, 400, 'Instructor and evaluation scores are required.');

    const [targetRows] = await pool.query(
      `SELECT i.id, i.department_id FROM instructors i
       INNER JOIN users u ON u.id = i.user_id AND LOWER(u.role) = 'dept_head'
       INNER JOIN departments d ON d.id = i.department_id
      WHERE (i.id = ? OR u.id = ?) AND d.college_id = ? LIMIT 1`,
          [instructorId, instructorId, collegeId]
    );
    if (!targetRows.length) return sendError(res, 404, 'Department Head was not found in your college.');

    await pool.query(
      `INSERT INTO dept_head_evaluations (evaluator_id, instructor_id, department_id, criteria_scores, strengths, weaknesses, total_score, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'COMPLETED')
       ON DUPLICATE KEY UPDATE criteria_scores = VALUES(criteria_scores), strengths = VALUES(strengths), weaknesses = VALUES(weaknesses), total_score = VALUES(total_score), status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP`,
      [req.user.id, instructorId, targetRows[0].department_id, JSON.stringify(criteriaScores), strengths, weaknesses, totalScore]
    );
    return res.json({ success: true, message: 'Department Head evaluation submitted.' });
  } catch (error) {
    console.error('Dean department head evaluation error:', error);
    return sendError(res, 500, 'Unable to submit Department Head evaluation.');
  }
};

router.post('/evaluate-dept-head', submitDepartmentHeadEvaluation);
router.post('/submit-evaluation', submitDepartmentHeadEvaluation);
router.post('/dept-head-evaluations', submitDepartmentHeadEvaluation);

router.get('/faculty-performance', async (req, res) => {
  try {
    const collegeId = await getCollegeId(req);
    if (!collegeId) return sendError(res, 400, 'Your college is not configured.');
    const [rows] = await pool.query(
      `SELECT i.id AS instructorId,
        CONCAT(COALESCE(i.first_name, ''), ' ', COALESCE(i.last_name, '')) AS name,
        COALESCE(NULLIF(d.department_name, ''), d.name) AS department,
        COALESCE(er.total_score, 0) AS score,
        CASE WHEN er.id IS NULL THEN 'Pending' WHEN er.total_score >= 70 THEN 'Good' ELSE 'Needs Improvement' END AS status
       FROM instructors i
       INNER JOIN users u ON u.id = i.user_id AND LOWER(u.role) = 'instructor'
       INNER JOIN departments d ON d.id = i.department_id AND d.college_id = ?
       LEFT JOIN evaluation_results er ON er.instructor_id = i.id
       ORDER BY department ASC, name ASC`,
      [collegeId]
    );
    return res.json(rows.map((row) => ({ ...row, score: Number(row.score || 0) })));
  } catch (error) {
    console.error('Dean faculty performance error:', error);
    return sendError(res, 500, 'Unable to load faculty performance.');
  }
});

module.exports = router;
