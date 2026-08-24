const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const DEFAULT_USER_PASSWORD = process.env.USER_DEFAULT_PASSWORD || process.env.DEFAULT_PASSWORD || '12345678';

const tableExists = async (tableName) => {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS tableCount
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tableName]
  );
  return Number(rows[0]?.tableCount || 0) > 0;
};

const getAdminDashboardStats = async (req, res) => {
  try {
    const hasPublishedEvaluations = await tableExists('published_evaluations');
    const hasSecurityLog = await tableExists('security_logs');

    const upcomingEventsQuery = hasPublishedEvaluations
      ? "SELECT COUNT(*) AS upcomingEvents FROM published_evaluations WHERE status = 'active'"
      : "SELECT COUNT(*) AS upcomingEvents FROM evaluation_dispatches WHERE status = 'pending'";
    const securityPulseQuery = hasSecurityLog
      ? "SELECT COUNT(*) AS securityPulse FROM security_logs WHERE status IN ('flagged', 'pending', 'open')"
      : "SELECT COUNT(*) AS securityPulse FROM users WHERE LOWER(COALESCE(status, 'active')) <> 'active'";

    const [upcomingRows, broadcastRows, securityRows, headRows] = await Promise.all([
      pool.query(upcomingEventsQuery),
      pool.query('SELECT COUNT(*) AS totalBroadcasts FROM evaluation_dispatches'),
      pool.query(securityPulseQuery),
      pool.query("SELECT COUNT(*) AS registeredHeads FROM users WHERE role = 'dept_head' AND status = 'active'"),
    ]);

    return res.json({
      success: true,
      message: { en: 'Admin dashboard statistics retrieved successfully.', am: 'የአስተዳዳሪ ዳሽቦርድ ስታቲስቲክስ በተሳካ ሁኔታ ተገኝቷል።' },
      data: {
        upcomingEvents: Number(upcomingRows[0][0]?.upcomingEvents || 0),
        totalBroadcasts: Number(broadcastRows[0][0]?.totalBroadcasts || 0),
        securityPulse: Number(securityRows[0][0]?.securityPulse || 0),
        registeredHeads: Number(headRows[0][0]?.registeredHeads || 0),
      },
    });
  } catch (error) {
    console.error('Unable to retrieve admin dashboard statistics:', error);
    return res.status(500).json({
      success: false,
      message: { en: 'Unable to retrieve admin dashboard statistics.', am: 'የአስተዳዳሪ ዳሽቦርድ ስታቲስቲክስን ማግኘት አልተቻለም።' },
      data: null,
    });
  }
};

const getDepartmentAnalytics = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        d.id AS department_id,
        d.name AS department,
        ROUND(COALESCE(AVG(ses.score), 0), 2) AS score
      FROM departments d
      LEFT JOIN course_assignments ca ON ca.department_id = d.id
      LEFT JOIN evaluation_dispatches ed ON ed.assignment_id = ca.id
      LEFT JOIN student_evaluation_submissions ses
        ON ses.dispatch_id = ed.id
        AND LOWER(TRIM(COALESCE(ses.status, 'submitted'))) = 'submitted'
      GROUP BY d.id, d.name
      ORDER BY d.name ASC
    `);

    return res.json({
      success: true,
      message: { en: 'Department analytics retrieved successfully.', am: 'የዲፓርትመንት ትንታኔ በተሳካ ሁኔታ ተገኝቷል።' },
      data: rows.map((row) => ({
        department: row.department,
        score: Number(row.score || 0),
      })),
    });
  } catch (error) {
    console.error('Unable to retrieve department analytics:', error);
    return res.status(500).json({
      success: false,
      message: { en: 'Unable to retrieve department analytics.', am: 'የዲፓርትመንት ትንታኔን ማግኘት አልተቻለም።' },
      data: null,
    });
  }
};

const getSecurityLogs = async (req, res) => {
  try {
    const [[auditRows], [connectionRows], [settingRows]] = await Promise.all([
      pool.query(`
        SELECT id, action_title, description, performed_by, ip_address, created_at
        FROM audit_logs
        ORDER BY created_at DESC
        LIMIT 20
      `),
      pool.query("SHOW STATUS LIKE 'Threads_connected'"),
      pool.query(`
        SELECT setting_key, setting_value
        FROM system_settings
        WHERE setting_key IN ('last_backup', 'backup_retention_days', 'security_score', 'api_token')
      `),
    ]);

    const settings = settingRows.reduce((result, row) => {
      result[row.setting_key] = row.setting_value;
      return result;
    }, {});

    return res.json({
      success: true,
      message: { en: 'Security logs retrieved successfully.', am: 'የደህንነት መዝገቦች በተሳካ ሁኔታ ተገኝተዋል።' },
      data: {
        logs: auditRows.map((row) => ({
          id: row.id,
          action: row.action_title || '',
          desc: row.description || '',
          user: row.performed_by || 'System',
          ip: row.ip_address || 'N/A',
          time: row.created_at,
        })),
        database: {
          status: 'Online',
          connections: Number(connectionRows[0]?.Value || 0),
          lastBackup: settings.last_backup || '--',
          backupRetentionDays: Number(settings.backup_retention_days || 0),
          securityScore: settings.security_score || '--',
          apiToken: settings.api_token || '--',
        },
      },
    });
  } catch (error) {
    console.error('Unable to retrieve security logs:', error);
    return res.status(500).json({
      success: false,
      message: { en: 'Unable to retrieve security logs.', am: 'የደህንነት መዝገቦችን ማግኘት አልተቻለም።' },
      data: null,
    });
  }
};

const createCollege = async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const code = String(req.body.code || '').trim().toUpperCase();
    if (!name || !code) return res.status(400).json({ message: 'College name and code are required.' });

    const [result] = await pool.query('INSERT INTO colleges (name, code) VALUES (?, ?)', [name, code]);
    return res.status(201).json({ id: result.insertId, name, code, message: 'College created successfully.' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'College name or code already exists.' });
    console.error('Unable to create college:', error);
    return res.status(500).json({ message: 'Unable to create college.' });
  }
};

const getColleges = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name, code FROM colleges ORDER BY name ASC');
    return res.json(rows);
  } catch (error) {
    console.error('Unable to retrieve colleges:', error);
    return res.status(500).json({ message: 'Unable to retrieve colleges.' });
  }
};

const getManagementRoleOccupant = async (req, res) => {
  const role = String(req.query.role || '').trim().toLowerCase();
  const collegeId = Number(req.query.college_id || 0) || null;
  const departmentId = Number(req.query.department_id || 0) || null;
  if (!['dept_head', 'college_dean', 'academic_directorate'].includes(role)) {
    return res.status(400).json({ message: 'Unsupported management role.' });
  }
  if (role === 'college_dean' && !collegeId) return res.status(400).json({ message: 'A college is required.' });
  if (role === 'dept_head' && !departmentId) return res.status(400).json({ message: 'A department is required.' });

  try {
    const scopeClause = role === 'academic_directorate'
      ? ''
      : role === 'college_dean' ? 'AND d.college_id = ?' : 'AND i.department_id = ?';
    const params = role === 'academic_directorate' ? [role] : [role, role === 'college_dean' ? collegeId : departmentId];
    const [[occupant]] = await pool.query(`
      SELECT u.id, u.role, COALESCE(CONCAT(i.first_name, ' ', i.last_name), u.email) AS full_name,
        i.department_id, d.name AS department_name, d.college_id, c.name AS college_name
      FROM users u
      INNER JOIN instructors i ON i.user_id = u.id
      LEFT JOIN departments d ON d.id = i.department_id
      LEFT JOIN colleges c ON c.id = d.college_id
      WHERE u.role = ? AND LOWER(COALESCE(u.status, 'active')) = 'active' ${scopeClause}
      ORDER BY u.id ASC LIMIT 1
    `, params);
    return res.json(occupant || null);
  } catch (error) {
    console.error('Unable to retrieve management role occupant:', error);
    return res.status(500).json({ message: 'Unable to retrieve management role occupant.' });
  }
};

const assignRoleWithHierarchy = async (req, res) => {
  const allowedRoles = ['dept_head', 'college_dean', 'academic_directorate'];
  const role = String(req.body.role || '').trim().toLowerCase();
  const userId = Number(req.params.id);
  const collegeId = Number(req.body.college_id || 0) || null;
  const departmentId = Number(req.body.department_id || 0) || null;
  if (!allowedRoles.includes(role)) return res.status(400).json({ message: 'Unsupported management role.' });
  if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ message: 'Invalid user ID.' });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[user]] = await connection.query(`
      SELECT u.id, u.role, u.status, i.department_id, d.college_id
      FROM users u
      LEFT JOIN instructors i ON i.user_id = u.id
      LEFT JOIN departments d ON d.id = i.department_id
      WHERE u.id = ? LIMIT 1
    `, [userId]);
    if (!user) {
      await connection.rollback();
      return res.status(404).json({ message: 'User not found.' });
    }
    if (String(user.status || '').toLowerCase() !== 'active') {
      await connection.rollback();
      return res.status(400).json({ message: 'Only active instructors can receive institutional roles.' });
    }
    if (!['instructor', 'dept_head', 'college_dean'].includes(String(user.role).toLowerCase())) {
      await connection.rollback();
      return res.status(400).json({ message: 'Students cannot receive institutional roles.' });
    }
    if (role === 'college_dean' && (!collegeId || Number(user.college_id) !== collegeId)) {
      await connection.rollback();
      return res.status(400).json({ message: 'Instructor does not belong to the selected college.' });
    }
    if (role === 'dept_head' && (!departmentId || user.role !== 'instructor' || Number(user.department_id) !== departmentId)) {
      await connection.rollback();
      return res.status(400).json({ message: 'Instructor does not belong to the selected department.' });
    }
    if (role === 'academic_directorate' && !['instructor', 'dept_head', 'college_dean'].includes(user.role)) {
      await connection.rollback();
      return res.status(400).json({ message: 'Only academic staff can receive this role.' });
    }

    const scopeClause = role === 'academic_directorate'
      ? ''
      : role === 'college_dean' ? 'AND d.college_id = ?' : 'AND i.department_id = ?';
    const scopeParams = role === 'academic_directorate' ? [] : [role === 'college_dean' ? collegeId : departmentId];
    const [[occupant]] = await connection.query(`
      SELECT u.id, COALESCE(CONCAT(i.first_name, ' ', i.last_name), u.email) AS full_name
      FROM users u
      INNER JOIN instructors i ON i.user_id = u.id
      LEFT JOIN departments d ON d.id = i.department_id
      WHERE u.role = ? AND LOWER(COALESCE(u.status, 'active')) = 'active' ${scopeClause}
      LIMIT 1 FOR UPDATE
    `, [role, ...scopeParams]);
    if (occupant && Number(occupant.id) !== userId) {
      await connection.rollback();
      return res.status(409).json({ message: `Current ${role === 'college_dean' ? 'College Dean' : role === 'dept_head' ? 'Department Head' : 'Academic Directorate'}: ${occupant.full_name}. Remove the current occupant first.` });
    }

    const [result] = await connection.query('UPDATE users SET role = ? WHERE id = ?', [role, userId]);
    if (!result.affectedRows) {
      await connection.rollback();
      return res.status(404).json({ message: 'User not found.' });
    }
    await connection.commit();
    return res.json({ id: userId, role, message: 'Role assigned successfully.' });
  } catch (error) {
    await connection.rollback();
    console.error('Unable to assign management role:', error);
    return res.status(500).json({ message: 'Unable to assign management role.' });
  } finally {
    connection.release();
  }
};

const resetManagementRole = async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ message: 'Invalid user ID.' });
  try {
    const [result] = await pool.query(
      "UPDATE users SET role = 'instructor' WHERE id = ? AND role IN ('dept_head', 'college_dean', 'academic_directorate')",
      [userId]
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'Active management role occupant not found.' });
    return res.json({ id: userId, role: 'instructor', message: 'Management role removed successfully.' });
  } catch (error) {
    console.error('Unable to reset management role:', error);
    return res.status(500).json({ message: 'Unable to reset management role.' });
  }
};

const resetUserPassword = async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ message: 'Invalid user ID.' });

  try {
    const passwordHash = await bcrypt.hash(DEFAULT_USER_PASSWORD, 12);
    const [result] = await pool.query(
      'UPDATE users SET password_hash = ?, is_first_login = 1 WHERE id = ?',
      [passwordHash, userId]
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'User not found.' });
    return res.json({ success: true, id: userId, message: 'Password reset successfully. The user must change it on next login.' });
  } catch (error) {
    console.error('Unable to reset user password:', error);
    return res.status(500).json({ success: false, message: 'Unable to reset user password.' });
  }
};

const getRoleCandidates = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT u.id, u.email, u.role, u.status,
        COALESCE(CONCAT(i.first_name, ' ', i.last_name), u.email) AS full_name,
        i.department_id, d.name AS department_name, d.college_id, c.name AS college_name
      FROM users u
      INNER JOIN instructors i ON i.user_id = u.id
      LEFT JOIN departments d ON d.id = i.department_id
      LEFT JOIN colleges c ON c.id = d.college_id
      WHERE u.role IN ('instructor', 'dept_head', 'college_dean')
        AND LOWER(COALESCE(u.status, 'active')) = 'active'
      ORDER BY full_name ASC
    `);
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Unable to retrieve role candidates:', error);
    return res.status(500).json({ success: false, message: 'Unable to retrieve role candidates.', data: null });
  }
};

module.exports = { getAdminDashboardStats, getDepartmentAnalytics, getSecurityLogs, createCollege, getColleges, getManagementRoleOccupant, assignRoleWithHierarchy, resetManagementRole, resetUserPassword, getRoleCandidates };