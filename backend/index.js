const express = require('express');
const http = require('http');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const multer = require('multer');
const session = require('express-session');
const XLSX = require('xlsx');
const pool = require('./config/db');
const { initSocket } = require('./socket');

dotenv.config();

const authRoutes = require('./routes/authRoutes');
const secureRoutes = require('./routes/secureRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const publicRoutes = require('./routes/publicRoutes');
const adminRoutes = require('./routes/adminRoutes');
const deptHeadRoutes = require('./routes/deptHead');
const userRoutes = require('./routes/user');
const deanRoutes = require('./routes/dean');
const directorateRoutes = require('./routes/directorate');
const { bulkUploadStudents, registerStudent } = require('./controllers/studentController');
const { batchAssignMatrix } = require('./controllers/courseController');
const { createDepartment } = require('./controllers/departmentController');
const { getUserNotifications, markAllRead, clearAllNotifications, sendNotification, createNotifications, setRealtimeServer } = require('./controllers/notificationController');
const { authenticateToken: mwAuthenticateToken, authorizeRoles: mwAuthorizeRoles } = require('./middleware/auth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const app = express();
const httpServer = http.createServer(app);
const PORT = process.env.PORT || 5005;
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret';
const ADMIN_DEFAULT_PASSWORD = process.env.ADMIN_DEFAULT_PASSWORD || 'admin@123';
const USER_DEFAULT_PASSWORD = process.env.USER_DEFAULT_PASSWORD || process.env.DEFAULT_PASSWORD || '12345678';

const io = initSocket(httpServer);
setRealtimeServer(io);

const getDefaultPasswordForRole = (role) => {
  if (String(role || '').toLowerCase() === 'admin') return ADMIN_DEFAULT_PASSWORD;
  return USER_DEFAULT_PASSWORD;
};

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'ipes-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 8 * 60 * 60 * 1000,
  },
}));
app.use('/api/auth', authRoutes);
app.use('/api/secure', secureRoutes);
app.use('/api/department', departmentRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dept-head', deptHeadRoutes);
app.use('/api/user', userRoutes);
app.use('/api/dean', deanRoutes);
app.use('/api/directorate', directorateRoutes);
app.use('/uploads', express.static(require('path').join(__dirname, 'uploads')));
app.post('/api/students/bulk-upload', upload.single('file'), bulkUploadStudents);
app.post('/api/students/register', mwAuthenticateToken, mwAuthorizeRoles('admin'), registerStudent);
app.get('/api/colleges', mwAuthenticateToken, mwAuthorizeRoles('admin', 'systemadmin'), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name, code FROM colleges ORDER BY name ASC');
    return res.json(rows);
  } catch (error) {
    console.error('Fetch colleges failed:', error);
    return res.status(500).json({ message: 'Unable to load colleges.' });
  }
});
app.post('/api/departments', mwAuthenticateToken, mwAuthorizeRoles('admin', 'systemadmin'), createDepartment);
app.get('/api/notifications/unread-count', mwAuthenticateToken, getUserNotifications);

const sendResponse = (res, statusCode, messageEn, messageAm, data = null) => {
  res.status(statusCode).json({
    success: statusCode < 400,
    message: { en: messageEn, am: messageAm },
    data,
  });
};

const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1] || null;

  if (!token) {
    return sendResponse(res, 401, 'Authentication required.', 'ማረጋገጫ ያስፈልጋል።');
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return sendResponse(res, 401, 'Invalid or expired token.', 'ልክ ያልሆነ ወይም ጊዜ ያለፈ ቶከን ነው።');
    }
    req.user = decoded;
    next();
  });
};

const authorizeRoles = (...roles) => (req, res, next) => {
  const normalizeRole = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized === 'department_head' ? 'dept_head' : normalized;
  };
  const allowedRoles = roles.map(normalizeRole);
  if (!req.user || !allowedRoles.includes(normalizeRole(req.user.role || req.user.user_role))) {
    return sendResponse(res, 403, 'You do not have permission to perform this action.', 'ይህን እርምጃ ለማከናወን ፈቃድ የለህም።');
  }
  next();
};

const normalizeSectionValue = (value) => {
  if (value === null || value === undefined) return '';
  const normalized = String(value).trim();
  if (!normalized) return '';
  const withoutPrefix = normalized.replace(/^section\s+/i, '').trim();
  return withoutPrefix.replace(/\s+/g, ' ');
};

const normalizePublishTarget = (value) => {
  const normalized = String(value || 'both').trim().toLowerCase();
  if (normalized === 'students') return 'student';
  if (normalized === 'instructors') return 'instructor';
  if (['student', 'instructor', 'both'].includes(normalized)) return normalized;
  return 'both';
};

const notifyDepartmentHead = async ({ departmentId, title, message, type = 'evaluation_completed' }) => {
  const [departmentHeads] = await pool.query(
    `SELECT DISTINCT i.user_id
     FROM instructors i
     INNER JOIN users u ON u.id = i.user_id
     WHERE i.department_id = ?
       AND LOWER(u.role) IN ('dept_head', 'department_head')
       AND LOWER(COALESCE(u.status, 'active')) = 'active'`,
    [departmentId]
  );
  await createNotifications({
    userIds: departmentHeads.map((head) => head.user_id),
    title,
    message,
    type,
  });
};

const notifyStudentCohort = async ({ departmentId, programType, yearLevel, semester, section, title, message, type }) => {
  try {
    const [students] = await pool.query(
      `SELECT s.user_id
       FROM students s
       WHERE s.department_id = ?
         AND (? IS NULL OR LOWER(TRIM(s.program_type)) = LOWER(TRIM(?)))
         AND (? IS NULL OR LOWER(TRIM(s.year_level)) = LOWER(TRIM(?)))
         AND (? IS NULL OR LOWER(TRIM(s.semester)) = LOWER(TRIM(?)))
         AND (? IS NULL OR LOWER(TRIM(REPLACE(s.section, 'Section ', ''))) = LOWER(TRIM(REPLACE(?, 'Section ', ''))))`,
      [departmentId, programType ?? null, programType ?? null, yearLevel ?? null, yearLevel ?? null, semester ?? null, semester ?? null, section ?? null, section ?? null]
    );
    await createNotifications({ userIds: students.map((student) => student.user_id), title, message, type });
  } catch (error) {
    console.error('Student cohort notification failed:', error);
  }
};

const initializeSchema = async () => {
  // Helper to check for column existence
  const columnExists = async (table, column) => {
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column]
    );
    return rows && rows[0] && rows[0].cnt > 0;
  };

  const normalizeUnsignedKey = async (table, column) => {
    try {
      const [rows] = await pool.query(
        `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, column]
      );

      if (rows && rows[0] && !String(rows[0].COLUMN_TYPE).toLowerCase().includes('unsigned')) {
        await pool.query(`ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` INT UNSIGNED NOT NULL AUTO_INCREMENT`);
      }
    } catch (error) {
      console.warn(`Could not normalize unsigned key for ${table}.${column}:`, error?.message || error);
    }
  };

  await pool.query(`CREATE TABLE IF NOT EXISTS colleges (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    code VARCHAR(64) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    college_id INT UNSIGNED NOT NULL,
    department_name VARCHAR(100) NOT NULL,
    department_code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(64) NOT NULL UNIQUE,
    CONSTRAINT fk_departments_college FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE RESTRICT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  if (!(await columnExists('departments', 'college_id'))) {
    await pool.query('ALTER TABLE departments ADD COLUMN college_id INT UNSIGNED NULL AFTER id');
  }
  if (!(await columnExists('departments', 'department_name'))) {
    await pool.query('ALTER TABLE departments ADD COLUMN department_name VARCHAR(100) NULL AFTER college_id');
  }
  if (!(await columnExists('departments', 'department_code'))) {
    await pool.query('ALTER TABLE departments ADD COLUMN department_code VARCHAR(20) NULL UNIQUE AFTER department_name');
  }
  await pool.query('UPDATE departments SET department_name = COALESCE(NULLIF(department_name, ""), name), department_code = COALESCE(NULLIF(department_code, ""), code) WHERE department_name IS NULL OR department_code IS NULL');

  // Users table stores authentication and account metadata; role profiles store identity fields.
    await pool.query(`CREATE TABLE IF NOT EXISTS users (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('admin','dept_head','instructor','student') NOT NULL DEFAULT 'student',
      status VARCHAR(32) NOT NULL DEFAULT 'active',
      is_first_login BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  if (!(await columnExists('users', 'email'))) {
    await pool.query('ALTER TABLE users ADD COLUMN email VARCHAR(255) NULL UNIQUE AFTER id');
  }

  if (!(await columnExists('users', 'is_first_login'))) {
    await pool.query('ALTER TABLE users ADD COLUMN is_first_login BOOLEAN NOT NULL DEFAULT TRUE');
  }

  await pool.query("ALTER TABLE users MODIFY COLUMN role ENUM('admin','dept_head','instructor','student','college_dean','academic_directorate') NOT NULL DEFAULT 'student'");

  // Instructors table
  await pool.query(`CREATE TABLE IF NOT EXISTS instructors (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    employee_id VARCHAR(64) DEFAULT NULL,
    first_name VARCHAR(128) DEFAULT NULL,
    last_name VARCHAR(128) DEFAULT NULL,
    department_id INT UNSIGNED DEFAULT NULL,
    gender VARCHAR(10) DEFAULT NULL,
    phone_number VARCHAR(32) DEFAULT NULL,
    profile_picture VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_instructor_user (user_id),
    CONSTRAINT fk_instructors_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_instructors_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  // Students table
  await pool.query(`CREATE TABLE IF NOT EXISTS students (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    student_id VARCHAR(64) DEFAULT NULL,
    first_name VARCHAR(128) DEFAULT NULL,
    last_name VARCHAR(128) DEFAULT NULL,
    department_id INT UNSIGNED DEFAULT NULL,
    semester VARCHAR(32) DEFAULT NULL,
    year_level VARCHAR(64) DEFAULT NULL,
    section VARCHAR(64) DEFAULT NULL,
    gender VARCHAR(10) DEFAULT NULL,
    phone_number VARCHAR(32) DEFAULT NULL,
    profile_picture VARCHAR(255) DEFAULT NULL,
    program_type VARCHAR(64) DEFAULT NULL,
    registration_date VARCHAR(64) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_student_user (user_id),
    CONSTRAINT fk_students_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_students_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  // Courses
  await pool.query(`CREATE TABLE IF NOT EXISTS courses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    credit_hours INT NOT NULL DEFAULT 3,
    year_level VARCHAR(32) DEFAULT NULL,
    semester VARCHAR(32) DEFAULT NULL,
    department_id INT UNSIGNED DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_courses_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query('ALTER TABLE courses ADD COLUMN IF NOT EXISTS year_level VARCHAR(32) DEFAULT NULL');
  await pool.query('ALTER TABLE courses ADD COLUMN IF NOT EXISTS semester VARCHAR(32) DEFAULT NULL');
  await pool.query('ALTER TABLE courses ADD COLUMN IF NOT EXISTS credit_hours INT NOT NULL DEFAULT 3');

  await pool.query(`CREATE TABLE IF NOT EXISTS audit_logs (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    action_title VARCHAR(255) NOT NULL,
    description TEXT,
    performed_by VARCHAR(255),
    ip_address VARCHAR(64),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_logs_created_at (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS system_settings (
    setting_key VARCHAR(128) PRIMARY KEY,
    setting_value TEXT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  // Course assignments (connections between course, instructor, optional student)
  await pool.query(`CREATE TABLE IF NOT EXISTS course_assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    course_id INT UNSIGNED NOT NULL,
    department_id INT UNSIGNED DEFAULT NULL,
    instructor_id INT UNSIGNED DEFAULT NULL,
    student_id INT UNSIGNED DEFAULT NULL,
    program_type VARCHAR(32) DEFAULT NULL,
    year_level VARCHAR(32) DEFAULT NULL,
    semester VARCHAR(32) DEFAULT NULL,
    section VARCHAR(32) DEFAULT NULL,
    publish_target VARCHAR(32) DEFAULT 'both',
    is_published TINYINT(1) DEFAULT 0,
    is_student_published TINYINT(1) DEFAULT 0,
    is_peer_published TINYINT(1) DEFAULT 0,
    academic_year VARCHAR(32) DEFAULT '2026',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_assign_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    CONSTRAINT fk_assign_dept FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    CONSTRAINT fk_assign_instructor FOREIGN KEY (instructor_id) REFERENCES instructors(id) ON DELETE SET NULL,
    CONSTRAINT fk_assign_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`ALTER TABLE course_assignments
    ADD COLUMN IF NOT EXISTS student_id INT UNSIGNED DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS program_type VARCHAR(32) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS year_level VARCHAR(32) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS semester VARCHAR(32) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS section VARCHAR(32) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS publish_target VARCHAR(32) DEFAULT 'both',
    ADD COLUMN IF NOT EXISTS is_student_published TINYINT(1) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS is_peer_published TINYINT(1) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS academic_year VARCHAR(32) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT NULL`);

  // Evaluation templates
  await pool.query(`CREATE TABLE IF NOT EXISTS evaluation_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    template_data JSON NOT NULL,
    created_by INT UNSIGNED DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_evaluation_templates_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS evaluation_criteria (
    id INT AUTO_INCREMENT PRIMARY KEY,
    evaluator_type ENUM('student', 'peer', 'dept_head', 'dean') NOT NULL,
    criterion_text VARCHAR(255) NOT NULL,
    criterion_text_am VARCHAR(255) DEFAULT NULL,
    category VARCHAR(100) DEFAULT 'General',
    weight INT DEFAULT 5,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query('ALTER TABLE evaluation_criteria ADD COLUMN IF NOT EXISTS criterion_text_am VARCHAR(255) DEFAULT NULL AFTER criterion_text');
  await pool.query("UPDATE evaluation_criteria SET criterion_text_am = CONCAT('የግምገማ መስፈርት፦ ', criterion_text) WHERE criterion_text_am IS NULL OR TRIM(criterion_text_am) = ''");

  // Evaluation dispatches
  await pool.query(`CREATE TABLE IF NOT EXISTS evaluation_dispatches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    template_id INT DEFAULT NULL,
    student_id INT UNSIGNED DEFAULT NULL,
    student_identifier VARCHAR(255) DEFAULT NULL,
    course_id INT UNSIGNED DEFAULT NULL,
    assignment_id INT UNSIGNED DEFAULT NULL,
    course_code VARCHAR(64) DEFAULT NULL,
    course_name VARCHAR(255) DEFAULT NULL,
    academic_year VARCHAR(64) DEFAULT NULL,
    semester VARCHAR(64) DEFAULT NULL,
    year_level VARCHAR(64) DEFAULT NULL,
    student_group VARCHAR(255) DEFAULT NULL,
    student_identifier_text VARCHAR(255) DEFAULT NULL,
    created_by INT UNSIGNED DEFAULT NULL,
    payload JSON DEFAULT NULL,
    status ENUM('pending','submitted','closed') NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_evaluation_dispatches_template FOREIGN KEY (template_id) REFERENCES evaluation_templates(id) ON DELETE SET NULL,
    CONSTRAINT fk_evaluation_dispatches_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL,
    CONSTRAINT fk_evaluation_dispatches_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_evaluation_dispatches_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query('ALTER TABLE evaluation_dispatches ADD COLUMN IF NOT EXISTS assignment_id INT UNSIGNED DEFAULT NULL');
  await pool.query('ALTER TABLE evaluation_dispatches ADD COLUMN IF NOT EXISTS course_code VARCHAR(64) DEFAULT NULL');
  await pool.query('ALTER TABLE evaluation_dispatches ADD COLUMN IF NOT EXISTS student_identifier_text VARCHAR(255) DEFAULT NULL');
  await pool.query('ALTER TABLE evaluation_dispatches ADD COLUMN IF NOT EXISTS department_id INT UNSIGNED DEFAULT NULL');
  await pool.query('ALTER TABLE evaluation_dispatches ADD COLUMN IF NOT EXISTS program_type VARCHAR(64) DEFAULT NULL');
  await pool.query('ALTER TABLE evaluation_dispatches ADD COLUMN IF NOT EXISTS is_student_published TINYINT(1) DEFAULT 0');

  try {
    await pool.query('DROP TABLE IF EXISTS peer_evaluation_submissions');
  } catch (error) {
    console.warn('Unable to drop stale peer_evaluation_submissions:', error?.message || error);
  }

  try {
    await pool.query('DROP TABLE IF EXISTS peer_evaluations');
  } catch (error) {
    console.warn('Unable to drop stale peer_evaluations:', error?.message || error);
  }

  // Peer evaluations must exist before peer evaluation submissions reference them.
  await pool.query(`CREATE TABLE IF NOT EXISTS peer_evaluations (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    evaluator_id INT UNSIGNED NOT NULL,
    evaluatee_id INT UNSIGNED NOT NULL,
    course_id INT UNSIGNED DEFAULT NULL,
    deadline VARCHAR(64) DEFAULT '2026-08-17',
    status ENUM('pending', 'submitted') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_evaluator_id (evaluator_id),
    INDEX idx_evaluatee_id (evaluatee_id),
    UNIQUE KEY uk_peer_eval (evaluator_id, evaluatee_id, course_id),
    CONSTRAINT fk_peer_evaluations_evaluator FOREIGN KEY (evaluator_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_peer_evaluations_evaluatee FOREIGN KEY (evaluatee_id) REFERENCES instructors(id) ON DELETE CASCADE,
    CONSTRAINT fk_peer_evaluations_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  // Student evaluation submissions
  await pool.query(`CREATE TABLE IF NOT EXISTS student_evaluation_submissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dispatch_id INT NOT NULL,
    student_id INT UNSIGNED DEFAULT NULL,
    student_name VARCHAR(255) DEFAULT NULL,
    score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    feedback TEXT DEFAULT NULL,
    responses JSON DEFAULT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'submitted',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_student_evaluation_submissions_dispatch FOREIGN KEY (dispatch_id) REFERENCES evaluation_dispatches(id) ON DELETE CASCADE,
    CONSTRAINT fk_student_evaluation_submissions_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS notifications (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'reminder',
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_notifications_user_read (user_id, is_read, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS password_resets (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    code_hash VARCHAR(255) NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_password_resets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_password_resets_user (user_id, expires_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  // Peer evaluation submissions
  await pool.query(`CREATE TABLE IF NOT EXISTS peer_evaluation_submissions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    peer_evaluation_id INT UNSIGNED NOT NULL,
    evaluator_id INT UNSIGNED NOT NULL,
    evaluatee_id INT UNSIGNED DEFAULT NULL,
    score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    strengths TEXT DEFAULT NULL,
    suggestions TEXT DEFAULT NULL,
    responses JSON DEFAULT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'submitted',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_peer_evaluation_submissions_peer_eval FOREIGN KEY (peer_evaluation_id) REFERENCES peer_evaluations(id) ON DELETE CASCADE,
    CONSTRAINT fk_peer_evaluation_submissions_evaluator FOREIGN KEY (evaluator_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_peer_evaluation_submissions_evaluatee FOREIGN KEY (evaluatee_id) REFERENCES instructors(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  // Evaluations (link to course assignment and evaluator user)
  await pool.query(`CREATE TABLE IF NOT EXISTS evaluations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    assignment_id INT UNSIGNED NOT NULL,
    evaluator_id INT UNSIGNED NOT NULL,
    evaluator_role VARCHAR(32) NOT NULL DEFAULT 'student',
    score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    feedback TEXT DEFAULT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'submitted',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_evaluations_assignment FOREIGN KEY (assignment_id) REFERENCES course_assignments(id) ON DELETE CASCADE,
    CONSTRAINT fk_evaluations_evaluator FOREIGN KEY (evaluator_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS evaluation_results (
    id INT AUTO_INCREMENT PRIMARY KEY,
    instructor_id INT UNSIGNED NOT NULL,
    department_id INT UNSIGNED DEFAULT NULL,
    student_average DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    peer_average DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    dept_head_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    total_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_evaluation_results_instructor FOREIGN KEY (instructor_id) REFERENCES instructors(id) ON DELETE CASCADE,
    CONSTRAINT fk_evaluation_results_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    UNIQUE KEY uk_evaluation_results_instructor (instructor_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS evaluation_summaries (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    instructor_id INT UNSIGNED NOT NULL UNIQUE,
    department_id INT UNSIGNED DEFAULT NULL,
    student_raw_percentage DECIMAL(6,2) NOT NULL DEFAULT 0,
    student_weighted_score DECIMAL(6,2) NOT NULL DEFAULT 0,
    dept_head_raw_percentage DECIMAL(6,2) NOT NULL DEFAULT 0,
    dept_head_weighted_score DECIMAL(6,2) NOT NULL DEFAULT 0,
    peer_raw_percentage DECIMAL(6,2) NOT NULL DEFAULT 0,
    peer_weighted_score DECIMAL(6,2) NOT NULL DEFAULT 0,
    total_weighted_score DECIMAL(6,2) NOT NULL DEFAULT 0,
    is_published TINYINT(1) NOT NULL DEFAULT 0,
    published_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_evaluation_summaries_instructor FOREIGN KEY (instructor_id) REFERENCES instructors(id) ON DELETE CASCADE,
    INDEX idx_evaluation_summaries_department (department_id, is_published)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  // Dept head evaluations (separate table to store dept head individual evaluations)
  await pool.query(`CREATE TABLE IF NOT EXISTS dept_head_evaluations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    evaluator_id INT UNSIGNED NOT NULL,
    instructor_id INT UNSIGNED NOT NULL,
    department_id INT UNSIGNED DEFAULT NULL,
    criteria_scores JSON DEFAULT NULL,
    total_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    status VARCHAR(32) NOT NULL DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_dept_head_eval_evaluator FOREIGN KEY (evaluator_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_dept_head_eval_instructor FOREIGN KEY (instructor_id) REFERENCES instructors(id) ON DELETE CASCADE,
    CONSTRAINT fk_dept_head_eval_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    UNIQUE KEY uk_dept_head_eval_unique (evaluator_id, instructor_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  if (!(await columnExists('dept_head_evaluations', 'strengths'))) {
    await pool.query('ALTER TABLE dept_head_evaluations ADD COLUMN strengths TEXT NULL AFTER criteria_scores');
  }
  if (!(await columnExists('dept_head_evaluations', 'weaknesses'))) {
    await pool.query('ALTER TABLE dept_head_evaluations ADD COLUMN weaknesses TEXT NULL AFTER strengths');
  }
  await pool.query(`CREATE TABLE IF NOT EXISTS directorate_evaluations (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    evaluator_id INT UNSIGNED NOT NULL,
    dean_id INT UNSIGNED NOT NULL,
    ratings JSON NOT NULL,
    strengths TEXT NULL,
    weaknesses TEXT NULL,
    total_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_directorate_eval (evaluator_id, dean_id),
    CONSTRAINT fk_directorate_eval_evaluator FOREIGN KEY (evaluator_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_directorate_eval_dean FOREIGN KEY (dean_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  const [adminRows] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', ['admin.k@system.local']);
  if (!adminRows.length) {
    const adminPasswordHash = await bcrypt.hash(getDefaultPasswordForRole('admin'), 12);
    await pool.query(
      'INSERT INTO users (email, password_hash, role, status, is_first_login) VALUES (?, ?, ?, ?, ?)',
      ['admin.k@system.local', adminPasswordHash, 'admin', 'active', true]
    );
  }
};

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    return sendResponse(res, 200, 'API is healthy.', 'ኤፒአይ ጤናማ ነው።', { service: 'ipes-api', database: 'connected' });
  } catch (error) {
    return sendResponse(res, 500, 'API is running but the database is unavailable.', 'ኤፒአይ እየሄደ ነው ነገር ግን ዳታቤዝ የለም።', { database: 'disconnected' });
  }
});

app.get('/api/dept-head/courses', authenticate, authorizeRoles('dept_head'), async (req, res) => {
  try {
    const departmentValue = req.query.department ?? req.query.department_id ?? req.user.department_id ?? req.user.departmentId ?? req.user.department;
    const departmentId = await resolveDepartmentId(departmentValue);
    if (!departmentId) {
      return sendResponse(res, 403, 'Your department is not defined. Contact an administrator.', 'የክፍልዎ መለያ አልተገኘም። እባክዎ ከአስተዳደሩ ጋር ይገናኙ።');
    }

    const [departmentColumns] = await pool.query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'departments'
         AND COLUMN_NAME IN ('name', 'department_name')
       ORDER BY FIELD(COLUMN_NAME, 'name', 'department_name')
       LIMIT 1`
    );

    const departmentNameColumn = departmentColumns.length
      ? (departmentColumns[0].COLUMN_NAME === 'department_name' ? 'd.department_name' : 'd.name')
      : "'N/A'";

    const [courseCreditColumns] = await pool.query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'courses'
         AND COLUMN_NAME IN ('credits', 'credit_hours')
       ORDER BY FIELD(COLUMN_NAME, 'credits', 'credit_hours')
       LIMIT 1`
    );
    const creditsExpression = courseCreditColumns.length
      ? `COALESCE(c.${courseCreditColumns[0].COLUMN_NAME}, 0)`
      : '0';

    const [rows] = await pool.query(
      `SELECT
        c.id,
        c.code AS course_code,
        c.name AS course_name,
        ${creditsExpression} AS credits,
        c.department_id,
        ${departmentNameColumn} AS department_name
      FROM courses c
      LEFT JOIN departments d ON c.department_id = d.id
      WHERE c.department_id = ?
      ORDER BY c.code ASC`,
      [departmentId]
    );

    return sendResponse(res, 200, 'Department courses fetched successfully.', 'የዲፓርትማንት ኮርሶች በትክክል ተመልሰዋል።', { courses: rows });
  } catch (error) {
    console.error('Error fetching department courses:', error.message);
    return sendResponse(res, 500, 'Failed to fetch department courses.', 'የዲፓርትማንት ኮርሶችን ማግኘት አልተቻለም።', { error: error.message });
  }
});

app.get('/api/dept-head/tracking/students', authenticate, authorizeRoles('dept_head'), async (req, res) => {
  try {
    const departmentId = Number(req.user.department_id ?? req.user.department ?? req.query.department_id);
    if (!Number.isInteger(departmentId) || departmentId <= 0) {
      return sendResponse(res, 403, 'Your department is not defined. Contact an administrator.', 'የክፍልዎ መለያ አልተገኘም። እባክዎ ከአስተዳደሩ ጋር ይገናኙ።');
    }

    const normalizeValue = (value) => (value || '').toString().trim();
    const normalizeFilter = (value, allValues) => {
      const normalized = normalizeValue(value);
      return !normalized || allValues.includes(normalized.toLowerCase()) ? null : normalized;
    };
    const programType = normalizeFilter(req.query.program_type || req.query.program, ['all', 'all programs']);
    const yearLevel = normalizeFilter(req.query.year_level || req.query.year, ['all', 'all years']);
    const section = normalizeFilter(req.query.section, ['all', 'all sections']);
        const instructorId = Number(req.query.instructor_id || 0) || null;
        const normalizedSection = section?.replace(/^section\s*/i, '').trim() || null;
    const query = `SELECT
      s.id AS student_db_id,
      u.id AS evaluator_id,
      TRIM(CONCAT(COALESCE(s.first_name, ''), ' ', COALESCE(s.last_name, ''))) AS student_name,
      CASE WHEN MAX(se.id) IS NOT NULL THEN 'Submitted' ELSE 'Pending' END AS status
    FROM students s
        INNER JOIN users u ON u.id = s.user_id
        LEFT JOIN course_assignments ca
           ON ca.department_id = s.department_id
          AND (? IS NULL OR ca.instructor_id = ?)
        LEFT JOIN evaluation_dispatches ed
           ON ed.student_id = s.id
          AND (ed.assignment_id = ca.id OR ed.course_id = ca.course_id)
        LEFT JOIN student_evaluation_submissions se
           ON se.student_id = s.id
          AND se.dispatch_id = ed.id
    WHERE s.department_id = ?
      AND (? IS NULL OR LOWER(TRIM(s.program_type)) = LOWER(TRIM(?)))
      AND (? IS NULL OR LOWER(TRIM(s.year_level)) = LOWER(TRIM(?)))
      AND (? IS NULL OR REPLACE(LOWER(s.section), 'section ', '') = LOWER(?))
    GROUP BY s.id, u.id, s.first_name, s.last_name
    ORDER BY status DESC, student_name ASC`;
    const params = [
      instructorId, instructorId, departmentId,
      programType, programType,
      yearLevel, yearLevel,
      normalizedSection, normalizedSection,
    ];

    console.log('[DEBUG] Executing Tracking Query:', query);
    console.log('[DEBUG] Query Parameters:', params);

    let rows = [];
    try {
      [rows] = await pool.query(query, params);
      console.log('[DEBUG] Tracking Query Result Count:', rows.length);
    } catch (queryError) {
      console.error('Dept Head Student Tracking DB Error:', queryError);
      return res.status(500).json({
        success: false,
        message: 'Database query failed',
        error: queryError?.message || 'Unknown database error',
      });
    }

    const normalized = rows.map((row) => ({
      student_db_id: row.student_db_id,
      evaluator_id: row.evaluator_id,
      student_name: row.student_name || 'Unknown',
      status: String(row.status || 'Pending'),
    }));

    return sendResponse(res, 200, 'Student tracking retrieved.', 'የተማሪ ተከታታይ መረጃ ተመለሰ።', normalized);
  } catch (error) {
    console.error('Dept-head student tracking error:', error);
    return sendResponse(res, 500, 'Unable to retrieve student tracking.', 'የተማሪ ተከታታይን ማግኘት አልቻለም።', []);
  }
});

app.post('/api/evaluations/send-reminder', authenticate, authorizeRoles('dept_head'), async (req, res) => {
  try {
    const departmentId = Number(req.user.department_id ?? req.user.department ?? req.body.department_id);
    if (!Number.isInteger(departmentId) || departmentId <= 0) return res.status(403).json({ message: 'Your department is not defined.' });

    const { evaluator_id, target_id, evaluation_type, send_to_all_pending } = req.body || {};
    const targetId = evaluator_id ?? target_id;
    const recipients = new Map();
    const addRecipients = (rows, type) => rows.forEach((row) => {
      if (row.evaluator_id) recipients.set(`${type}:${row.evaluator_id}`, { ...row, evaluation_type: type });
    });

    if (send_to_all_pending) {
      const [students] = await pool.query(`SELECT u.id AS evaluator_id, COALESCE(NULLIF(TRIM(CONCAT(s.first_name, ' ', s.last_name)), ''), u.email) AS name
        FROM students s JOIN users u ON u.id = s.user_id JOIN evaluation_dispatches ed ON ed.student_id = s.id
        LEFT JOIN student_evaluation_submissions sub ON sub.dispatch_id = ed.id
        WHERE s.department_id = ? AND ed.status = 'pending' AND sub.id IS NULL`, [departmentId]);
      const [peers] = await pool.query(`SELECT DISTINCT u.id AS evaluator_id, COALESCE(NULLIF(TRIM(CONCAT(i.first_name, ' ', i.last_name)), ''), u.email) AS name
        FROM peer_evaluations pe JOIN users u ON u.id = pe.evaluator_id JOIN instructors target ON target.id = pe.evaluatee_id
        LEFT JOIN peer_evaluation_submissions pes ON pes.peer_evaluation_id = pe.id
        LEFT JOIN instructors i ON i.user_id = u.id
        WHERE target.department_id = ? AND pe.status = 'pending' AND pes.id IS NULL`, [departmentId]);
      addRecipients(students, 'student');
      addRecipients(peers, 'peer');
    } else if (targetId !== undefined && targetId !== null && String(targetId).trim() !== '') {
      const userId = Number(targetId);
      if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ success: false, message: 'A valid target_id is required.' });
      const [rows] = await pool.query(`SELECT u.id AS evaluator_id,
        COALESCE(NULLIF(TRIM(CONCAT(i.first_name, ' ', i.last_name)), ''), NULLIF(TRIM(CONCAT(s.first_name, ' ', s.last_name)), ''), u.email, s.student_id) AS name
        FROM users u
        LEFT JOIN instructors i ON i.user_id = u.id
        LEFT JOIN students s ON s.user_id = u.id
        WHERE u.id = ? LIMIT 1`, [userId]);
      if (!rows.length) return res.status(400).json({ success: false, message: 'The specified target_id was not found.' });
      addRecipients(rows, evaluation_type || 'evaluation');
    } else {
      return res.status(400).json({ success: false, message: 'target_id or send_to_all_pending is required.' });
    }

    const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    for (const recipient of recipients.values()) {
      const description = `Dear ${recipient.name || 'Evaluator'}, Please complete your pending instructor evaluation before ${deadline}.`;
      try {
        await pool.query('INSERT INTO audit_logs (action_title, description, performed_by) VALUES (?, ?, ?)', ['Evaluation reminder sent', description, req.user.id]);
      } catch (auditError) {
        console.warn('Evaluation reminder audit log failed:', auditError?.message || auditError);
      }
    }
    if (!recipients.size) {
      return res.status(400).json({ success: false, message: 'No pending evaluators were found for the reminder.' });
    }
    await createNotifications({
      userIds: [...recipients.values()].map((recipient) => recipient.evaluator_id),
      title: 'Pending Evaluation Reminder / የግምገማ ማሳሰቢያ',
      message: 'You have pending instructor performance evaluations. Please complete them. / የመማር ማስተማር ግምገማ ቅጽ አልሞሉምና እባክዎ ይሙሉ፡፡',
      type: 'evaluation_reminder',
    });
    return res.json({ success: true, sent: recipients.size, message: `Reminders sent to ${recipients.size} pending evaluators.` });
  } catch (error) {
    console.error('Send evaluation reminder failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to send evaluation reminders.', error: error.message });
  }
});

app.get('/api/notifications', mwAuthenticateToken, getUserNotifications);
app.put('/api/notifications/read', mwAuthenticateToken, markAllRead);
app.put('/api/notifications/mark-all-read/:userId', mwAuthenticateToken, markAllRead);
app.delete('/api/notifications/clear-all/:userId', mwAuthenticateToken, clearAllNotifications);
app.post('/api/notifications/send', mwAuthenticateToken, mwAuthorizeRoles('admin', 'systemadmin'), sendNotification);

app.get('/api/dept-head/tracking/peers', authenticate, authorizeRoles('dept_head'), async (req, res) => {
  try {
    const departmentId = Number(req.user.department_id ?? req.user.department ?? req.query.department_id);
    if (!Number.isInteger(departmentId) || departmentId <= 0) {
      return sendResponse(res, 403, 'Your department is not defined. Contact an administrator.', 'የክፍልዎ መለያ አልተገኘም። እባክዎ ከአስተዳደሩ ጋር ይገናኙ።');
    }

    const targetInstructorId = Number(req.query.target_instructor_id || req.query.instructor_id || 0);
    if (!targetInstructorId) return sendResponse(res, 400, 'target_instructor_id is required.', 'የታለመ አስተማሪ መለያ ያስፈልጋል።', []);

    const query = `SELECT
      pe.id AS peer_id,
      pe.evaluator_id,
      TRIM(CONCAT(COALESCE(i.first_name, ''), ' ', COALESCE(i.last_name, u.email))) AS peer_instructor,
      CASE WHEN MAX(pes.id) IS NOT NULL THEN 'Submitted' ELSE 'Pending' END AS status
    FROM peer_evaluations pe
    JOIN instructors target ON pe.evaluatee_id = target.id
    JOIN users u ON pe.evaluator_id = u.id
    JOIN instructors i ON i.user_id = u.id
    LEFT JOIN peer_evaluation_submissions pes ON pes.peer_evaluation_id = pe.id
    WHERE target.department_id = ?
      AND (target.id = ? OR target.user_id = ?)
      AND u.role = 'instructor'
    GROUP BY pe.id, pe.evaluator_id, i.first_name, i.last_name, u.email
    ORDER BY status DESC, peer_instructor ASC`;
    const params = [departmentId, targetInstructorId, targetInstructorId];

    let rows = [];
    try {
      [rows] = await pool.query(query, params);
    } catch (err) {
      console.error('Peer Tracking DB Error:', err);
      return res.status(500).json({
        success: false,
        message: 'Database query failed',
        error: err.message,
      });
    }

    const normalized = rows.map((row) => ({
      peer_id: row.peer_id,
      evaluator_id: row.evaluator_id,
      peer_instructor: (row.peer_instructor || '').trim() || 'Unknown Peer',
      status: String(row.status || 'Pending'),
    }));

    return sendResponse(res, 200, 'Peer tracking retrieved.', 'የእርስ ላይ ግምገማ ተከታታይ ተመለሰ።', normalized);
  } catch (error) {
    console.error('Dept-head peer tracking error:', error);
    return sendResponse(res, 500, 'Unable to retrieve peer tracking.', 'የእርስ ላይ ግምገማ ተከታታይን ማግኘት አልቻለም።', []);
  }
});

app.post('/api/evaluations/peer/publish-department', authenticate, authorizeRoles('dept_head'), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const departmentId = Number(req.user.department_id ?? req.user.department);
    if (!Number.isInteger(departmentId) || departmentId <= 0) {
      return res.status(403).json({ message: 'Your department is not defined. Contact an administrator.' });
    }

    const academicYear = String(req.body.academic_year || new Date().getFullYear());
    const semester = String(req.body.semester || 'Semester I');
    const sessionDeadline = `${academicYear} ${semester}`;
    const [[existingSession]] = await connection.query(
      'SELECT COUNT(*) AS total FROM peer_evaluations pe INNER JOIN instructors target ON target.id = pe.evaluatee_id WHERE target.department_id = ? AND pe.course_id IS NULL AND pe.deadline = ?',
      [departmentId, sessionDeadline]
    );
    if (Number(existingSession?.total || 0) > 0) {
      return res.status(400).json({ success: false, isAlreadyPublished: true, message: 'Peer evaluations have already been published for this department.' });
    }
    const [staff] = await connection.query(
      `SELECT i.id AS instructor_id, i.user_id
       FROM instructors i
       INNER JOIN users u ON u.id = i.user_id
       WHERE i.department_id = ?
         AND LOWER(COALESCE(u.status, 'active')) = 'active'
         AND LOWER(u.role) IN ('instructor', 'dept_head', 'college_dean', 'academic_directorate')`,
      [departmentId]
    );
    if (staff.length < 2) return res.status(400).json({ message: 'At least two active academic staff are required.' });

    await connection.beginTransaction();
    let createdCount = 0;
    for (const evaluator of staff) {
      for (const target of staff) {
        if (evaluator.instructor_id === target.instructor_id) continue;
        const [existing] = await connection.query(
          'SELECT id FROM peer_evaluations WHERE evaluator_id = ? AND evaluatee_id = ? AND course_id IS NULL LIMIT 1',
          [evaluator.user_id, target.instructor_id]
        );
        if (existing.length) {
          await connection.query('UPDATE peer_evaluations SET status = \'pending\' WHERE id = ? AND status <> \'submitted\'', [existing[0].id]);
        } else {
          await connection.query(
            'INSERT INTO peer_evaluations (evaluator_id, evaluatee_id, course_id, deadline, status) VALUES (?, ?, NULL, ?, \'pending\')',
            [evaluator.user_id, target.instructor_id, sessionDeadline]
          );
          createdCount += 1;
        }
      }
    }
    await connection.commit();
    try {
      await createNotifications({
        userIds: staff.map((member) => member.user_id),
        title: 'Peer Evaluation Published',
        message: `New peer evaluations are available for the ${academicYear} ${semester} session. Please complete your assigned evaluations.`,
        type: 'peer_evaluation',
      });
    } catch (notificationError) {
      console.error('Peer evaluation publication notification failed:', notificationError);
    }
    return res.status(201).json({ success: true, staffCount: staff.length, createdCount, message: `Peer evaluations published for ${staff.length} academic staff members.` });
  } catch (error) {
    try { await connection.rollback(); } catch (rollbackError) { console.error('Peer publish rollback failed:', rollbackError); }
    console.error('Department peer publishing failed:', error);
    return res.status(500).json({ message: 'Unable to publish department peer evaluations.', error: error.message });
  } finally {
    connection.release();
  }
});

app.post('/api/evaluations/peer/unpublish-department', authenticate, authorizeRoles('dept_head'), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const departmentId = Number(req.user.department_id ?? req.user.department);
    const sessionDeadline = `${String(req.body.academic_year || new Date().getFullYear())} ${String(req.body.semester || 'Semester I')}`;
    if (!Number.isInteger(departmentId) || departmentId <= 0) return res.status(403).json({ message: 'Your department is not defined. Contact an administrator.' });

    const [submitted] = await connection.query(
      `SELECT pes.id FROM peer_evaluation_submissions pes
       INNER JOIN peer_evaluations pe ON pe.id = pes.peer_evaluation_id
       INNER JOIN instructors target ON target.id = pe.evaluatee_id
       WHERE target.department_id = ? AND pe.course_id IS NULL AND pe.deadline = ? LIMIT 1`,
      [departmentId, sessionDeadline]
    );
    if (submitted.length) return res.status(400).json({ success: false, message: 'Cannot unpublish because peer evaluations have already been submitted.' });

    await connection.beginTransaction();
    await connection.query(
      `DELETE pe FROM peer_evaluations pe
       INNER JOIN instructors target ON target.id = pe.evaluatee_id
       WHERE target.department_id = ? AND pe.course_id IS NULL AND pe.deadline = ?`,
      [departmentId, sessionDeadline]
    );
    await connection.commit();
    return res.json({ success: true, message: 'Peer evaluations unpublished successfully.' });
  } catch (error) {
    try { await connection.rollback(); } catch (rollbackError) { console.error('Peer unpublish rollback failed:', rollbackError); }
    return res.status(500).json({ message: 'Unable to unpublish peer evaluations.', error: error.message });
  } finally { connection.release(); }
});

app.get('/api/dept-head/tracking/dept-head', authenticate, authorizeRoles('dept_head'), async (req, res) => {
  try {
    const departmentId = Number(req.user.department_id ?? req.user.department ?? req.query.department_id);
    if (!Number.isInteger(departmentId) || departmentId <= 0) {
      return sendResponse(res, 403, 'Your department is not defined. Contact an administrator.', 'የክፍልዎ መለያ አልተገኘም። እባክዎ ከአስተዳደሩ ጋር ይገናኙ።');
    }

    const instructorId = Number(req.query.instructor_id || 0);
    const whereClauses = ['i.department_id = ?'];
    const params = [departmentId];

    if (instructorId > 0) {
      whereClauses.push('(i.id = ? OR i.user_id = ?)');
      params.push(instructorId, instructorId);
    }

    const query = `SELECT
      i.id AS instructor_id,
      CONCAT(COALESCE(i.first_name, ''), ' ', COALESCE(i.last_name, '')) AS instructor_name,
      COALESCE(dhe.total_score, 0) AS score,
      COALESCE(dhe.status, 'Pending') AS status,
      dhe.updated_at AS submitted_at,
      dhe.id AS evaluation_id
    FROM instructors i
    LEFT JOIN dept_head_evaluations dhe ON (dhe.instructor_id = i.id OR dhe.instructor_id = i.user_id)
    WHERE ${whereClauses.join(' AND ')}
    GROUP BY i.id, dhe.id
    ORDER BY i.id ASC, dhe.updated_at DESC`;

    const [rows] = await pool.query(query, params);
    const normalized = rows.map((row) => ({
      id: row.evaluation_id ?? row.instructor_id,
      instructor_id: row.instructor_id,
      instructor_name: (row.instructor_name || '').trim() || 'Unknown Instructor',
      score: Number(row.score || 0),
      status: String(row.status || 'Pending'),
      submitted_at: row.submitted_at || null,
    }));

    return sendResponse(res, 200, 'Dept head tracking retrieved.', 'የዲፓርትመንት ኃላፊ ተከታታይ ተመለሰ።', normalized);
  } catch (error) {
    console.error('Dept-head dept-head tracking error:', error);
    return sendResponse(res, 500, 'Unable to retrieve dept head tracking.', 'የዲፓርትመንት ኃላፊ ተከታታይን ማግኘት አልቻለም።', []);
  }
});

// Fetch instructors for department head evaluation view
app.get('/api/dept-head/instructors', authenticate, authorizeRoles('dept_head'), async (req, res) => {
  try {
    const departmentValue = req.query.department ?? req.query.department_id ?? req.user.department_id ?? req.user.department;
    const departmentId = await resolveDepartmentId(departmentValue);
    if (!departmentId) {
      return sendResponse(res, 403, 'Your department is not defined. Contact an administrator.', 'የክፍልዎ መለያ አልተገኘም።');
    }

    const evaluatorId = Number(req.user.id || req.user.user_id || 0);

    const query = `
      SELECT 
        i.id AS instructor_id,
        i.user_id,
        i.employee_id,
        i.department_id,
        CONCAT(COALESCE(i.first_name, ''), ' ', COALESCE(i.last_name, '')) AS instructor_name,
        COALESCE(u.email, '') AS username,
        u.role,
        CASE WHEN dhe.id IS NOT NULL THEN 'Submitted' ELSE 'Pending' END AS evaluation_status,
        dhe.total_score
      FROM instructors i
      JOIN users u ON i.user_id = u.id
      LEFT JOIN dept_head_evaluations dhe ON dhe.instructor_id = i.id AND dhe.evaluator_id = ?
      WHERE i.department_id = ? 
        AND LOWER(u.role) = 'instructor'
      GROUP BY i.id
    `;

    const [rows] = await pool.query(query, [evaluatorId, departmentId]);

    const formattedData = rows.map(row => ({
      id: row.instructor_id,
      instructor_id: row.instructor_id,
      instructor_name: (row.instructor_name || '').trim() || row.username,
      employee_id: row.employee_id,
      department_id: row.department_id,
      deadline: '2026-08-17',
      evaluation_status: row.evaluation_status,
      total_score: row.total_score ? Number(row.total_score) : null
    }));

    return sendResponse(res, 200, 'Department instructors fetched.', 'የዲፓርትመንት አስተማሪዎች ተመልሰዋል።', formattedData);
  } catch (err) {
    console.error("Dept Head Instructors DB Error:", err);
    return res.status(500).json({ success: false, message: "Database query failed", error: err.message });
  }
});

const getDeptHeadPerformance = async (req, res) => {
  try {
    const [instructorRows] = await pool.query(
      'SELECT id, department_id FROM instructors WHERE user_id = ? LIMIT 1',
      [req.user.id]
    );
    if (!instructorRows.length) return res.status(404).json({ message: 'Department Head profile not found.' });

    const instructorId = instructorRows[0].id;
    const [[assignmentCount]] = await pool.query(
      `SELECT COUNT(*) AS total FROM course_assignments
       WHERE instructor_id = ?
         AND (is_published = 1 OR is_student_published = 1 OR is_peer_published = 1)
         AND (semester IS NULL OR semester <> '')
         AND (academic_year IS NULL OR academic_year <> '')`,
      [instructorId]
    );
    const isTeaching = Number(assignmentCount?.total || 0) > 0;
    const [deanRows] = await pool.query(
      `SELECT dhe.total_score AS score, COALESCE(AVG(dhe.total_score) OVER (), 0) AS average_score, dhe.criteria_scores, dhe.strengths, dhe.weaknesses
       FROM dept_head_evaluations dhe
      WHERE dhe.instructor_id = ? AND LOWER(dhe.status) IN ('submitted', 'completed', 'approved')
      ORDER BY dhe.updated_at DESC`,
      [instructorId]
    );
    const [studentRows] = await pool.query(
      `SELECT COALESCE(ses.score, 0) AS score, COALESCE(AVG(ses.score) OVER (), 0) AS average_score, ses.feedback
       FROM student_evaluation_submissions ses
       INNER JOIN evaluation_dispatches ed ON ed.id = ses.dispatch_id
       INNER JOIN course_assignments ca ON ca.id = ed.assignment_id
       WHERE ca.instructor_id = ? AND ca.department_id = ?
         AND ses.status = 'submitted'`,
      [instructorId, instructorRows[0].department_id]
    );
    const [peerRows] = await pool.query(
      `SELECT COALESCE(pes.score, 0) AS score, COALESCE(AVG(pes.score) OVER (), 0) AS average_score, pes.strengths, pes.suggestions
       FROM peer_evaluation_submissions pes
       INNER JOIN peer_evaluations pe ON pe.id = pes.peer_evaluation_id
       WHERE pe.evaluatee_id = ?`,
      [instructorId]
    );

    const average = (rows) => rows.length ? rows.reduce((sum, row) => sum + Number(row.score || 0), 0) / rows.length : 0;
    const studentAvg = Number(studentRows[0]?.average_score || 0);
    const peerAvg = Number(peerRows[0]?.average_score || 0);
    const deanScore = Number(deanRows[0]?.average_score || 0);
    const totalScore = (studentAvg * 0.5) + (deanScore * 0.3) + (peerAvg * 0.2);
    const strengths = [];
    const improvements = [];
    const addFeedback = (list, value) => {
      const text = String(value || '').trim();
      if (text && !list.includes(text)) list.push(text);
    };
    studentRows.forEach((row) => addFeedback(Number(row.score || 0) >= 70 ? strengths : improvements, row.feedback));
    peerRows.forEach((row) => { addFeedback(strengths, row.strengths); addFeedback(improvements, row.suggestions); });
    deanRows.forEach((row) => {
      addFeedback(strengths, row.strengths);
      addFeedback(improvements, row.weaknesses);
      const deanCriteria = row.criteria_scores;
      if (deanCriteria) {
        const criteriaData = typeof deanCriteria === 'string' ? JSON.parse(deanCriteria) : deanCriteria;
        addFeedback(deanScore >= 70 ? strengths : improvements, criteriaData?.remarks || criteriaData?.feedback);
      }
    });

    return res.json({
      totalWeightedScore: Number(totalScore.toFixed(2)),
      isTeaching,
      breakdown: {
        student: { rawPercentage: Number(studentAvg.toFixed(2)), weightedContribution: Number((studentAvg * 0.5).toFixed(2)), weight: 50 },
        deanHead: { rawPercentage: Number(deanScore.toFixed(2)), weightedContribution: Number((deanScore * 0.3).toFixed(2)), weight: 30 },
        peer: { rawPercentage: Number(peerAvg.toFixed(2)), weightedContribution: Number((peerAvg * 0.2).toFixed(2)), weight: 20 },
      },
      strengths,
      weaknesses: improvements,
    });
  } catch (error) {
    console.error('Department Head performance error:', error);
    return res.status(500).json({ message: 'Unable to load Department Head performance.', error: error.message });
  }
};

app.get('/api/dept-head/performance', authenticate, authorizeRoles('dept_head'), getDeptHeadPerformance);
app.get('/api/dept-head/my-performance', authenticate, authorizeRoles('dept_head'), getDeptHeadPerformance);

app.get('/api/dept-head/students', authenticate, authorizeRoles('dept_head'), async (req, res) => {
  try {
    const departmentValue = req.query.department ?? req.query.department_id ?? req.user.department_id ?? req.user.departmentId ?? req.user.department;
    const departmentId = await resolveDepartmentId(departmentValue);
    if (!departmentId) {
      return res.status(404).json({ message: 'Department was not found.' });
    }

    const yearLevel = String(req.query.year_level || '').trim();
    const programType = String(req.query.program_type || '').trim();
    const section = normalizeSectionValue(req.query.section);
    const filters = ['u.role = \'student\'', 's.department_id = ?'];
    const params = [departmentId];

    if (yearLevel && yearLevel.toLowerCase() !== 'all') {
      filters.push('LOWER(TRIM(s.year_level)) = LOWER(TRIM(?))');
      params.push(yearLevel);
    }
    if (programType && programType.toLowerCase() !== 'all') {
      filters.push('LOWER(TRIM(s.program_type)) = LOWER(TRIM(?))');
      params.push(programType);
    }
    if (section && section.toLowerCase() !== 'all') {
      filters.push("LOWER(TRIM(REPLACE(REPLACE(s.section, 'Section ', ''), 'section ', ''))) = LOWER(?)");
      params.push(section);
    }

    const [rows] = await pool.query(
      `SELECT
        s.student_id,
        TRIM(CONCAT(COALESCE(s.first_name, ''), ' ', COALESCE(s.last_name, ''))) AS name,
        s.program_type,
        s.year_level,
        s.section,
        d.name AS department,
        s.department_id
      FROM users u
      INNER JOIN students s ON s.user_id = u.id
      INNER JOIN departments d ON d.id = s.department_id
      WHERE ${filters.join(' AND ')}
      ORDER BY name ASC`,
      params
    );

    return res.json(rows);
  } catch (error) {
    console.error('Department head students query failed:', error);
    return res.status(500).json({ message: 'Failed to fetch department students.' });
  }
});

app.get('/api/department-data/:type', authenticate, authorizeRoles('dept_head', 'admin'), async (req, res) => {
  try {
    const { type } = req.params;
    if (!['instructors', 'students', 'courses'].includes(type)) {
      return res.status(400).json({ message: 'Unsupported department data type.' });
    }

    const departmentValue = req.query.department ?? req.query.department_id ?? req.user.department_id ?? req.user.departmentId ?? req.user.department;
    const departmentId = await resolveDepartmentId(departmentValue);
    if (!departmentId) return res.status(404).json({ message: 'Department was not found.' });

    let query;
    if (type === 'instructors') {
      query = `SELECT u.id, TRIM(CONCAT(COALESCE(i.first_name, ''), ' ', COALESCE(i.last_name, ''))) AS name,
        u.email, u.role, i.employee_id, i.department_id
        FROM users u
        INNER JOIN instructors i ON i.user_id = u.id
        WHERE u.role = 'instructor' AND i.department_id = ?
        ORDER BY name ASC`;
    } else if (type === 'students') {
      query = `SELECT u.id, TRIM(CONCAT(COALESCE(s.first_name, ''), ' ', COALESCE(s.last_name, ''))) AS name,
        COALESCE(u.email, s.student_id) AS email, u.role, s.student_id, s.department_id,
        s.program_type, s.year_level, s.section
        FROM users u
        INNER JOIN students s ON s.user_id = u.id
        WHERE u.role = 'student' AND s.department_id = ?
        ORDER BY name ASC`;
    } else {
      const [courseCreditColumns] = await pool.query(
        `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'courses'
           AND COLUMN_NAME IN ('credits', 'credit_hours')
         ORDER BY FIELD(COLUMN_NAME, 'credits', 'credit_hours')
         LIMIT 1`
      );
      const creditsExpression = courseCreditColumns.length
        ? `${courseCreditColumns[0].COLUMN_NAME} AS credits`
        : '0 AS credits';
      query = `SELECT id, code, name, ${creditsExpression}, department_id
        FROM courses WHERE department_id = ? ORDER BY code ASC`;
    }

    const [rows] = await pool.query(query, [departmentId]);
    return res.json(rows);
  } catch (error) {
    console.error('Department data query failed:', error);
    return res.status(500).json({ message: 'Failed to fetch department data.' });
  }
});

// Submit or update a department head evaluation
app.post('/api/dept-head/evaluations', authenticate, authorizeRoles('dept_head'), async (req, res) => {
  try {
    const { evaluator_id, instructor_id, department_id, criteria_scores, total_score } = req.body;
    const evaluatorId = Number(evaluator_id || req.user.id || req.user.user_id || 0);
    const instrId = Number(instructor_id || 0);
    const deptId = Number(department_id || req.user.department_id || req.user.department || 0);

    if (!evaluatorId || !instrId || !deptId) {
      return sendResponse(res, 400, 'Missing required fields.', 'የሚያስፈልጉ መረጃዎች አልተሰጡም።');
    }

    // persist into dept_head_evaluations (upsert)
    const criteriaJson = criteria_scores ? JSON.stringify(criteria_scores) : null;
    await pool.query(
      `INSERT INTO dept_head_evaluations (evaluator_id, instructor_id, department_id, criteria_scores, total_score, status)
       VALUES (?, ?, ?, ?, ?, 'Submitted')
       ON DUPLICATE KEY UPDATE criteria_scores = VALUES(criteria_scores), total_score = VALUES(total_score), status = VALUES(status), updated_at = CURRENT_TIMESTAMP`,
      [evaluatorId, instrId, deptId, criteriaJson, Number(total_score || 0)]
    );

    // reflect in evaluation_results so tracking shows the dept_head_score
    await pool.query(
      `INSERT INTO evaluation_results (instructor_id, department_id, student_average, peer_average, dept_head_score, total_score)
       VALUES (?, ?, 0, 0, ?, ?)
       ON DUPLICATE KEY UPDATE dept_head_score = VALUES(dept_head_score), total_score = VALUES(total_score), published_at = CURRENT_TIMESTAMP`,
      [instrId, deptId, Number(total_score || 0), Number(total_score || 0)]
    );

    return sendResponse(res, 200, 'Evaluation submitted successfully.', 'ግምገማው በተሳካ ሁኔታ ተሳክቷል።', { success: true, total_score: Number(total_score || 0) });
  } catch (error) {
    console.error('Submit dept-head evaluation error:', error);
    return sendResponse(res, 500, 'Unable to submit evaluation.', 'ግምገማውን ማስተካከል አልቻለም።', { error: error.message });
  }
});

app.post(['/api/dept-head/calculate-publish', '/api/evaluations/publish-instructor-scores'], authenticate, authorizeRoles('dept_head'), async (req, res) => {
  try {
    const { department_id, academic_year, semester } = req.body || {};
    const departmentId = Number(department_id);
    const academicYear = String(academic_year || '').trim();
    const semesterValue = String(semester || '').trim();
    const userDepartmentId = Number(req.user.department_id ?? req.user.department);
    if (!Number.isInteger(departmentId) || departmentId <= 0 || departmentId !== userDepartmentId) {
      return res.status(400).json({ success: false, message: 'A valid department_id for your department is required.' });
    }
    if (!academicYear || !semesterValue) {
      return res.status(400).json({ success: false, message: 'academic_year and semester are required.' });
    }

    const [instructors] = await pool.query(
      'SELECT id FROM instructors WHERE department_id = ? ORDER BY id ASC',
      [departmentId]
    );

    const results = [];
    for (const instructor of instructors) {
      const [studentRows] = await pool.query(
        `SELECT COALESCE(AVG(ses.score), 0) AS avg_score
         FROM student_evaluation_submissions ses
         JOIN evaluation_dispatches ed ON ses.dispatch_id = ed.id
         JOIN course_assignments ca ON ca.id = ed.assignment_id
           OR (ca.student_id = ed.student_id AND ca.course_id = ed.course_id)
         WHERE ca.instructor_id = ? AND ca.department_id = ?
           AND (ed.academic_year = ? OR ed.academic_year IS NULL)
           AND (ed.semester = ? OR ed.semester IS NULL)`,
        [instructor.id, departmentId, academicYear, semesterValue]
      );
      const studentAverage = Number(studentRows[0]?.avg_score || 0);

      const [peerRows] = await pool.query(
        `SELECT COALESCE(AVG(pe.score), 0) AS avg_score
         FROM instructors i
         LEFT JOIN peer_evaluation_submissions pe ON i.id = pe.evaluatee_id
         WHERE i.id = ?
           AND pe.status IN ('submitted', 'completed', 'approved')`,
        [instructor.id]
      );
      const peerAverage = Number(peerRows[0]?.avg_score || 0);

      const [deptHeadRows] = await pool.query(
        `SELECT COALESCE(AVG(dhe.total_score), 0) AS avg_score
         FROM dept_head_evaluations dhe
         WHERE dhe.instructor_id = ?
           AND LOWER(TRIM(dhe.status)) IN ('submitted', 'completed', 'approved')`,
        [instructor.id]
      );
      const rawDeptHeadAverage = Number(deptHeadRows[0]?.avg_score || 0);
      const deptHeadScore = rawDeptHeadAverage;
      const totalScore = Number((studentAverage * 0.5 + peerAverage * 0.2 + rawDeptHeadAverage * 0.3).toFixed(2));

      await pool.query(
        `INSERT INTO evaluation_results (instructor_id, department_id, student_average, peer_average, dept_head_score, total_score)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE student_average = VALUES(student_average), peer_average = VALUES(peer_average), dept_head_score = VALUES(dept_head_score), total_score = VALUES(total_score), published_at = CURRENT_TIMESTAMP`,
        [instructor.id, departmentId, studentAverage, peerAverage, deptHeadScore, totalScore]
      );
      await pool.query(
        `INSERT INTO evaluation_summaries (
           instructor_id, department_id,
           student_raw_percentage, student_weighted_score,
           dept_head_raw_percentage, dept_head_weighted_score,
           peer_raw_percentage, peer_weighted_score, total_weighted_score,
           is_published, published_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
         ON DUPLICATE KEY UPDATE
           department_id = VALUES(department_id),
           student_raw_percentage = VALUES(student_raw_percentage),
           student_weighted_score = VALUES(student_weighted_score),
           dept_head_raw_percentage = VALUES(dept_head_raw_percentage),
           dept_head_weighted_score = VALUES(dept_head_weighted_score),
           peer_raw_percentage = VALUES(peer_raw_percentage),
           peer_weighted_score = VALUES(peer_weighted_score),
           total_weighted_score = VALUES(total_weighted_score),
           is_published = 1, published_at = CURRENT_TIMESTAMP` ,
        [
          instructor.id,
          departmentId,
          studentAverage,
          studentAverage * 0.5,
          rawDeptHeadAverage,
          rawDeptHeadAverage * 0.3,
          peerAverage,
          peerAverage * 0.2,
          totalScore,
        ]
      );

      results.push({
        instructor_id: instructor.id,
        student_average: Number(studentAverage.toFixed(2)),
        peer_average: Number(peerAverage.toFixed(2)),
        dept_head_score: Number(deptHeadScore.toFixed(2)),
        total_score: Number(totalScore.toFixed(2)),
      });
    }

    return res.status(200).json({ success: true, message: 'Final results calculated and published successfully.', data: { results } });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Unable to calculate and publish results.', error: error.message });
  }
});

// Public endpoint to fetch students with strict DB filtering
app.get('/api/students', authenticate, async (req, res) => {
  try {
    const { department_id, program_type = 'All', year_level = 'All', section = 'All' } = req.query;

    // If the requester is a dept_head, restrict to their department
    let deptId = department_id;
    if (req.user && req.user.role === 'dept_head') {
      deptId = req.user.department_id || req.user.department || deptId;
    }

    if (!deptId) {
      return sendResponse(res, 400, 'department_id is required.', 'የክፍል መለያ ያስፈልጋል።');
    }

    const query = `SELECT 
      s.id,
      s.student_id,
      CONCAT(COALESCE(s.first_name, ''), ' ', COALESCE(s.last_name, '')) AS full_name,
      s.department_id,
      s.program_type,
      s.year_level,
      s.section
    FROM students s
    JOIN users u ON s.user_id = u.id
    WHERE s.department_id = ?
      AND (? = 'All' OR s.program_type = ?)
      AND (? = 'All' OR s.year_level = ?)
      AND (? = 'All' OR s.section = ?)`;

    const params = [deptId, program_type, program_type, year_level, year_level, section, section];
    const [rows] = await pool.query(query, params);
    return sendResponse(res, 200, 'Students retrieved.', 'ተማሪዎች ተመልሰዋል።', rows);
  } catch (error) {
    console.error('Student list fetch error:', error?.message || error);
    return sendResponse(res, 500, 'Unable to fetch students.', 'ተማሪዎችን ማግኘት አልተቻለም።', []);
  }
});

app.post('/api/auth/register', mwAuthenticateToken, mwAuthorizeRoles('admin'), async (req, res) => {
  try {
    const {
      full_name,
      email,
      username,
      password,
      role = 'student',
      department,
      department_id,
      department_name,
      phone_number,
      college,
      academic_year,
      semester,
      year,
      section,
      specialization,
      learning_level,
      student_id,
      employee_id,
      program_type,
      gender,
      replace_existing = false,
    } = req.body;

    const errors = {};
    if (!full_name || !String(full_name).trim()) errors.full_name = 'full_name is required.';
    
    // Validation based on role
    if (role === 'student') {
      if (!student_id || !String(student_id).trim()) errors.student_id = 'student_id is required for students.';
      if (!section || !String(section).trim()) errors.section = 'section is required for students.';
      if (!year || !String(year).trim()) errors.year = 'year is required for students.';
    } else {
      if (!email || !String(email).trim()) errors.email = 'email is required for staff roles.';
    }

    if (Object.keys(errors).length) {
      return sendResponse(res, 400, 'Validation failed.', 'ማረጋገጫ አልተሳካም።', { errors });
    }

    const normalizedEmail = role === 'student' ? null : (typeof email === 'string' && email.trim() ? email.trim() : null);
    const normalizedStudentId = role === 'student' ? (typeof student_id === 'string' && student_id.trim() ? student_id.trim() : null) : null;
    
    const resolvedDepartmentId = await resolveDepartmentId(department_id ?? department ?? department_name);
    const [departmentRows] = resolvedDepartmentId
      ? await pool.query('SELECT college_id FROM departments WHERE id = ? LIMIT 1', [resolvedDepartmentId])
      : [[]];
    const inferredCollegeId = departmentRows[0]?.college_id || null;
    const resolvedDepartment = [department, department_name, department_id].find((value) => typeof value === 'string' && value.trim()) || null;
    const normalizedDepartment = typeof resolvedDepartment === 'string' && resolvedDepartment.trim() ? resolvedDepartment.trim() : null;
    
    if (role === 'dept_head') {
      if (!resolvedDepartmentId) {
        return res.status(400).json({ message: 'Please select a valid department before assigning a Department Head.' });
      }
      if (await hasActiveDepartmentHead(resolvedDepartmentId)) {
        return res.status(400).json({ message: 'This department already has an assigned Department Head. Please reassign or update the existing one.' });
      }
    }

    const passwordValue = typeof password === 'string' && password.trim() ? password.trim() : getDefaultPasswordForRole(role);
    const hashedPassword = await bcrypt.hash(passwordValue, 12);
    
    const userFields = {
      full_name: String(full_name).trim(),
      email: normalizedEmail,
      student_id: normalizedStudentId,
      password_hash: hashedPassword,
      role,
      department: normalizedDepartment,
      department_name: typeof department_name === 'string' && department_name.trim() ? department_name.trim() : null,
      phone_number: typeof phone_number === 'string' && phone_number.trim() ? phone_number.trim() : null,
      college: typeof college === 'string' && college.trim() ? college.trim() : null,
      academic_year: typeof academic_year === 'string' && academic_year.trim() ? academic_year.trim() : null,
      semester: typeof semester === 'string' && semester.trim() ? semester.trim() : null,
      year: typeof year === 'string' && year.trim() ? year.trim() : null,
      section: typeof section === 'string' && section.trim() ? section.trim() : null,
      specialization: typeof specialization === 'string' && specialization.trim() ? specialization.trim() : null,
      learning_level: typeof learning_level === 'string' && learning_level.trim() ? learning_level.trim() : null,
      employee_id: typeof employee_id === 'string' && employee_id.trim() ? employee_id.trim() : null,
      program_type: typeof program_type === 'string' && program_type.trim() ? program_type.trim() : null,
      gender: typeof gender === 'string' && gender.trim() ? gender.trim() : null,
    };

    // Use transaction: insert into users then role-specific tables
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Check if email or student_id already exists
      if (normalizedEmail) {
        const [existingEmail] = await conn.query('SELECT id FROM users WHERE email = ? LIMIT 1', [normalizedEmail]);
        if (existingEmail.length) {
          await conn.rollback();
          return sendResponse(res, 409, 'Email already exists.', 'ኢሜል አስቀድሞ አለ።');
        }
      }

      if (normalizedStudentId) {
        const [existingStudentId] = await conn.query('SELECT user_id AS id FROM students WHERE student_id = ? LIMIT 1', [normalizedStudentId]);
        if (existingStudentId.length) {
          await conn.rollback();
          return sendResponse(res, 409, 'Student ID already exists.', 'ተማሪ ቁጥር አስቀድሞ አለ።');
        }
      }

      const [userResult] = await conn.query(
        'INSERT INTO users (email, password_hash, role, status, is_first_login) VALUES (?, ?, ?, ?, ?)',
        [userFields.email, userFields.password_hash, userFields.role, 'active', 1]
      );
      const userId = userResult.insertId;

      // Insert into role-specific table
      if (userFields.role === 'student') {
        await conn.query(
          'INSERT INTO students (user_id, student_id, first_name, last_name, department_id, semester, year_level, section, program_type, gender, phone_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            userId,
            userFields.student_id,
            userFields.full_name || null,
            null,
            resolvedDepartmentId || null,
            req.body.semester || null,
            req.body.year || null,
            req.body.section || null,
            userFields.program_type || null,
            userFields.gender || null,
            userFields.phone_number || null,
          ]
        );
      } else if (userFields.role === 'instructor' || userFields.role === 'dept_head') {
        await conn.query(
          'INSERT INTO instructors (user_id, employee_id, first_name, last_name, department_id, gender, phone_number) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            userId,
            userFields.employee_id || null,
            userFields.full_name || null,
            null,
            resolvedDepartmentId || null,
            userFields.gender || null,
            userFields.phone_number || null,
          ]
        );
      }

      await conn.commit();
      return sendResponse(res, 201, 'User registered successfully.', 'ተጠቃሚ በተሳካ ሁኔታ ተመዝግቧል።', { id: userId, role: userFields.role });
    } catch (sqlErr) {
      console.error('SQL Error:', sqlErr);
      try { await conn.rollback(); } catch (e) {}
      return sendResponse(res, 500, 'Registration failed due to database error.', 'መመዝገብ በዳታቤዝ ስህተት ምክንያት አልተሳካም።');
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error('Registration failed:', {
      message: error.message,
      code: error.code,
      sql: error.sql,
      sqlMessage: error.sqlMessage,
      stack: error.stack,
      body: req.body,
    });
    if (error.code === 'ER_DUP_ENTRY') {
      return sendResponse(res, 409, 'Department Head already exists for this department. Please update or reassign the existing Department Head.', 'ይህ ዲፓርትመንት ለነበረው የዲፓርትመንት አስተዳዳሪ ነው። እባክዎ ነበረውን ይለውጡ ወይም አስተካክሉ።');
    }

    return res.status(500).json({
      message: 'Registration failed due to database error.',
      error: error.sqlMessage || error.message,
    });
  }
});

const cleanCsvKey = (key) => String(key || '')
  .trim()
  .replace(/^\uFEFF/, '')
  .toLowerCase()
  .replace(/[^a-zA-Z0-9_]/g, '');

const normalizeFieldName = (field) => cleanCsvKey(field);
const normalizeRow = (row) => {
  const normalized = {};
  const aliases = {
    studentid: 'student_id',
    studentnumber: 'student_number',
    employeeid: 'employee_id',
    employeenumber: 'employee_number',
    fullname: 'full_name',
    firstname: 'first_name',
    lastname: 'last_name',
    departmentid: 'department_id',
    departmentname: 'department_name',
    registrationdate: 'registration_date',
    enrollmentdate: 'enrollment_date',
    programtype: 'program_type',
    academicyear: 'academic_year',
    username: 'user_name',
  };
  Object.keys(row).forEach((key) => {
    const cleanKey = normalizeFieldName(key);
    const value = row[key] != null ? String(row[key]).trim() : '';
    const snakeKey = cleanKey.replace(/_+/g, '_').replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
    normalized[cleanKey] = value;
    normalized[snakeKey] = value;
    if (aliases[cleanKey]) normalized[aliases[cleanKey]] = value;
  });
  return normalized;
};

const parseUploadRows = (fileBuffer, originalName) => {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer', raw: false });
  const sheetNames = workbook.SheetNames || [];
  if (!sheetNames.length) return [];
  const sheet = workbook.Sheets[sheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  return rows.map(normalizeRow).filter((row) => Object.values(row).some((value) => String(value).trim() !== ''));
};

const resolveRoleFromType = (registration_type) => {
  const type = String(registration_type || '').trim().toLowerCase();
  if (type === 'dept_head') return 'dept_head';
  if (type === 'instructor') return 'instructor';
  return 'student';
};

const resolveDepartmentId = async (value, db = pool) => {
  if (value == null) return null;
  const candidate = String(value).trim();
  if (!candidate) return null;

  const numericId = Number(candidate);
  if (Number.isFinite(numericId) && Number.isInteger(numericId) && numericId > 0) {
    const [rows] = await db.query('SELECT id FROM departments WHERE id = ? LIMIT 1', [numericId]);
    if (rows.length) return rows[0].id;
  }

  const lowerCandidate = candidate.toLowerCase();
  const [rows] = await db.query(
    'SELECT id FROM departments WHERE LOWER(name) = ? OR LOWER(code) = ? LIMIT 1',
    [lowerCandidate, lowerCandidate]
  );

  return rows.length ? rows[0].id : null;
};

const hasActiveDepartmentHead = async (departmentId, excludeUserId = null) => {
  if (!departmentId) return false;
  const query = `SELECT u.id FROM users u
    INNER JOIN instructors i ON u.id = i.user_id
    WHERE i.department_id = ? AND u.role = ? AND u.status != ?${excludeUserId ? ' AND u.id != ?' : ''} LIMIT 1`;
  const params = [departmentId, 'dept_head', 'inactive'];
  if (excludeUserId) params.push(excludeUserId);
  const [rows] = await pool.query(query, params);
  return rows.length > 0;
};

const resolveDepartmentValue = (row) => {
  if (row.department_id) return row.department_id;
  if (row.department_name) return row.department_name;
  if (row.department) return row.department;
  return null;
};

app.post('/api/auth/bulk-register', upload.single('file'), async (req, res) => {
  let connection;
  try {
    if (!req.file) {
      return sendResponse(res, 400, 'No file uploaded.', 'ፋይል አልተላከም።');
    }

    const registrationType = resolveRoleFromType(req.body.registration_type);
    const replaceExisting = String(req.body.replace_existing || 'false').toLowerCase() === 'true';
    const rows = parseUploadRows(req.file.buffer, req.file.originalname);

    if (!rows.length) {
      return sendResponse(res, 400, 'Uploaded file contains no rows.', 'አሸናፊ ፋይሉ ምንም ረድፎችን አልያዘም።');
    }

    const result = {
      created: 0,
      updated: 0,
      failed: 0,
      created_users: [],
      errors: [],
    };

    connection = await pool.getConnection();
    await connection.beginTransaction();

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const rowNumber = index + 2;
      const role = resolveRoleFromType(row.role || registrationType);
      const full_name = row.full_name || `${row.first_name || ''} ${row.last_name || ''}`.trim();
      const student_id = String(row.student_id || row.student_number || row.studentid || '').trim();
      const employee_id = String(row.employee_id || row.employee_number || row.employeeid || '').trim();
      const email = String(row.email || row.user_name || row.username || '').trim();
      const department = resolveDepartmentValue(row);
      const resolvedDepartmentId = await resolveDepartmentId(department, connection);
      const section = row.section || '';
      const year = row.year || '';
      const program_type = row.program_type || row.program || 'regular';
      const department_name = row.department_name || '';
      const semester = row.semester || '';
      const phone_number = row.phone_number || '';
      const academic_year = row.academic_year || '';
      const specialization = row.specialization || '';
      const learning_level = row.learning_level || '';

      // Determine identifier based on role
      const loginIdentifier = role === 'student' ? student_id : email;

      const rowErrors = [];
      if (!full_name) rowErrors.push('full_name is required');
      if (!loginIdentifier) rowErrors.push(role === 'student' ? 'student_id is required' : 'email is required');
      if (!resolvedDepartmentId) rowErrors.push('department is required');
      if (role === 'student' && !student_id) rowErrors.push('student_id is required');
      if (role === 'student' && !section) rowErrors.push('section is required');
      if (role === 'student' && !year) rowErrors.push('year is required');
      if (role !== 'student' && !employee_id) rowErrors.push('employee_id is required');

      if (rowErrors.length) {
        result.failed += 1;
        result.errors.push({ row: rowNumber, errors: rowErrors });
        continue;
      }

      // Check for existing user based on role
      let existingUserQuery, existingUserParams;
      if (role === 'student') {
        existingUserQuery = 'SELECT s.user_id AS id, u.role FROM students s INNER JOIN users u ON u.id = s.user_id WHERE s.student_id = ? LIMIT 1';
        existingUserParams = [student_id];
      } else {
        existingUserQuery = 'SELECT id, role FROM users WHERE email = ? LIMIT 1';
        existingUserParams = [email];
      }

      const [existingUsers] = await connection.query(existingUserQuery, existingUserParams);
      const existingUser = existingUsers[0];

      if (role === 'dept_head' && resolvedDepartmentId) {
        const [existingDeptHead] = await connection.query(
          'SELECT u.id FROM users u INNER JOIN instructors i ON u.id = i.user_id WHERE i.department_id = ? AND u.role = ? AND u.status != ?' + (existingUser ? ' AND u.id != ?' : ' LIMIT 1'),
          existingUser ? [resolvedDepartmentId, 'dept_head', 'inactive', existingUser.id] : [resolvedDepartmentId, 'dept_head', 'inactive']
        );
        if (existingDeptHead.length) {
          result.failed += 1;
          result.errors.push({ row: rowNumber, errors: ['Department Head already exists for this department.'] });
          continue;
        }
      }

      if (existingUser) {
        if (existingUser.role === 'dept_head' && role === 'dept_head' && replaceExisting) {
          const password_hash = await bcrypt.hash(getDefaultPasswordForRole(role), 12);
          const updateFields = { password_hash };
          const updateClause = Object.keys(updateFields).map((key) => `${key} = ?`).join(', ');
          const updateValues = Object.values(updateFields);
          updateValues.push(existingUser.id);
          await connection.query(`UPDATE users SET ${updateClause} WHERE id = ?`, updateValues);
          result.updated += 1;
          continue;
        }

        result.failed += 1;
        result.errors.push({ row: rowNumber, errors: [role === 'student' ? 'student_id already exists' : 'email already exists'] });
        continue;
      }

      const password_hash = await bcrypt.hash(getDefaultPasswordForRole(role), 12);
      const userFields = {
        email: role === 'student' ? null : (email || null),
        password_hash,
        role,
      };

      const [insertResult] = await connection.query(
        `INSERT INTO users (email, password_hash, role, status, is_first_login)
         VALUES (?, ?, ?, 'active', 1)`,
        [userFields.email, userFields.password_hash, userFields.role]
      );

      const nameParts = full_name.split(/\s+/).filter(Boolean);
      const firstName = row.first_name || nameParts.shift() || '';
      const lastName = row.last_name || nameParts.join(' ');

      if (role === 'student') {
        await connection.query(
          'INSERT INTO students (user_id, student_id, first_name, last_name, department_id, semester, year_level, section, program_type, phone_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            insertResult.insertId,
            student_id,
            firstName,
            lastName,
            resolvedDepartmentId,
            semester || null,
            year || null,
            section || null,
            program_type || null,
            phone_number || null,
          ]
        );
      } else {
        await connection.query(
          'INSERT INTO instructors (user_id, employee_id, first_name, last_name, department_id, phone_number) VALUES (?, ?, ?, ?, ?, ?)',
          [
            insertResult.insertId,
            employee_id,
            firstName,
            lastName,
            resolvedDepartmentId,
            phone_number || null,
          ]
        );
      }

      result.created += 1;
      result.created_users.push({
        id: insertResult.insertId,
        ...userFields,
        full_name,
        first_name: firstName,
        last_name: lastName,
        department: department || resolvedDepartmentId,
        department_id: resolvedDepartmentId,
        department_name,
        employee_id,
        student_id,
        semester,
        year,
        section,
        program_type,
      });
    }

    await connection.commit();
    connection.release();
    return sendResponse(res, 200, 'Bulk registration completed.', 'ብዛት ምዝገባ ተካሄዷል።', result);
  } catch (error) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    console.error('Bulk registration failed:', {
      message: error.message,
      code: error.code,
      sql: error.sql,
      stack: error.stack,
      file: req.file?.originalname,
      body: req.body,
    });
    return sendResponse(res, 500, 'Bulk registration failed.', 'የብዛት ምዝገባ አልተሳካም።', {
      errors: [{ message: error.message }],
    });
  }
});

app.get('/api/auth/me', authenticate, async (req, res) => {
  try {
    if (!req.user?.id) {
      console.error('Error in /api/auth/me: missing authenticated user in request');
      return res.status(401).json({ message: 'User not found or unauthenticated' });
    }

    const [rows] = await pool.query(
      `SELECT
        u.id,
        u.email,
        u.role,
        u.status,
        u.is_first_login,
        u.created_at,
        COALESCE(i.first_name, s.first_name, '') AS first_name,
        COALESCE(i.last_name, s.last_name, '') AS last_name,
        CASE WHEN u.role = 'student' THEN s.gender ELSE i.gender END AS gender,
        CASE WHEN u.role = 'student' THEN s.phone_number ELSE i.phone_number END AS phone_number,
        CASE WHEN u.role = 'student' THEN s.profile_picture ELSE i.profile_picture END AS profile_picture,
        CASE WHEN u.role = 'student' THEN s.department_id ELSE i.department_id END AS department_id,
        d.name AS department_name,
        c.name AS college_name,
        s.student_id AS student_id
      FROM users u
      LEFT JOIN instructors i ON u.id = i.user_id
      LEFT JOIN students s ON u.id = s.user_id
      LEFT JOIN departments d ON d.id = COALESCE(i.department_id, s.department_id)
      LEFT JOIN colleges c ON c.id = d.college_id
      WHERE u.id = ? LIMIT 1`,
      [req.user.id]
    );

    if (!rows.length) {
      console.error(`Error in /api/auth/me: user not found for id=${req.user.id}`);
      return res.status(401).json({ message: 'User not found or unauthenticated' });
    }

    const user = rows[0];
    const displayIdentifier = user.email || user.student_id || `user-${user.id}`;
    return res.status(200).json({
      success: true,
      message: { en: 'User profile loaded.', am: 'የተጠቃሚ መገለጫ ተጭኗል።' },
      data: {
        id: user.id,
        username: displayIdentifier,
        email: user.email,
        role: user.role,
        status: user.status,
        isFirstLogin: Boolean(user.is_first_login),
        gender: user.gender,
        created_at: user.created_at,
        department_id: user.department_id,
        department_name: user.department_name,
        college_name: user.college_name,
        first_name: user.first_name,
        last_name: user.last_name,
        student_id: user.student_id,
        phone_number: user.phone_number,
        profile_picture: user.profile_picture,
      },
    });
  } catch (error) {
    console.error('Error in /api/auth/me:', error);
    return res.status(500).json({ message: 'Unable to load profile.' });
  }
});

app.post('/api/auth/register-instructor', authenticate, authorizeRoles('admin', 'systemadmin'), async (req, res) => {
  const {
    first_name,
    last_name,
    department_id,
    department,
    department_name,
    email,
    username,
    employee_id,
    gender,
    password,
    full_name,
    name,
  } = req.body;
  const role = 'instructor';

  // Use email if provided, otherwise fall back to username
  const staffEmail = email || username;

  const nameToSplit = String(full_name || name || '').trim();
  if ((!first_name || !last_name) && nameToSplit) {
    const [firstName, ...lastNameParts] = nameToSplit.split(/\s+/).filter(Boolean);
    first_name = first_name || firstName || '';
    last_name = last_name || lastNameParts.join(' ') || '';
  }

  if (!staffEmail || !staffEmail.trim() || !first_name || !String(first_name).trim() || !last_name || !String(last_name).trim()) {
    return sendResponse(res, 400, 'Missing required fields (email, first_name, last_name).', 'የሚጠየቁ መረጃዎች አሉ።');
  }

  const normalizedEmail = String(staffEmail).trim();
  first_name = String(first_name).trim();
  last_name = String(last_name).trim();

  const resolvedDepartmentId = await resolveDepartmentId(department_id ?? department ?? department_name);
  if (!resolvedDepartmentId) {
    return res.status(400).json({
      message: 'Please select a valid department before registering.',
    });
  }

  if (department_id || department || department_name) {
    console.debug('Instructor registration department resolution:', { department_id, department, department_name, resolvedDepartmentId });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [exists] = await conn.query('SELECT id FROM users WHERE email = ? LIMIT 1', [normalizedEmail]);
    if (exists.length) {
      await conn.rollback();
      return sendResponse(res, 409, 'Email already exists.', 'ኢሜል አስቀድሞ አለ።');
    }

    const passwordValue = typeof password === 'string' && password.trim() ? password.trim() : getDefaultPasswordForRole(role);
    const hashed = await bcrypt.hash(String(passwordValue), 12);

    const [userResult] = await conn.query(
      'INSERT INTO users (email, password_hash, role, status, is_first_login) VALUES (?, ?, ?, ?, ?)',
      [normalizedEmail, hashed, role, 'active', 1]
    );
    const userId = userResult.insertId;

    await conn.query(
      'INSERT INTO instructors (user_id, employee_id, first_name, last_name, department_id, gender) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, employee_id || null, first_name, last_name, resolvedDepartmentId || null, gender || null]
    );

    await conn.commit();
    return sendResponse(res, 201, 'Instructor registered successfully.', 'አስተማሪ በተሳካ ሁኔታ ተመዝግቧል።', { id: userId });
  } catch (error) {
    console.error('Register instructor failed:', error);
    try { await conn.rollback(); } catch (e) {}
    return res.status(500).json({
      message: 'Registration failed due to database error.',
      error: error.sqlMessage || error.message,
    });
  } finally {
    conn.release();
  }
});

// Register a student (creates user + student record) using a transaction (admin only)
app.post('/api/auth/register-student', mwAuthenticateToken, mwAuthorizeRoles('admin'), async (req, res) => {
  const {
    first_name,
    last_name,
    department_id,
    department,
    department_name,
    student_id,
    username,
    gender,
    semester,
    year_level,
    section,
    program_type,
    password,
  } = req.body;

  if (!student_id || !first_name || !last_name) {
    return sendResponse(res, 400, 'Missing required fields (student_id, first_name, last_name).', 'የሚጠየቁ መረጃዎች አሉ።');
  }

  const resolvedDepartmentId = await resolveDepartmentId(department_id ?? department ?? department_name);
  if (!resolvedDepartmentId) {
    return res.status(400).json({
      message: 'Please select a valid department before registering.',
    });
  }

  if (department_id || department || department_name) {
    console.debug('Student registration department resolution:', { department_id, department, department_name, resolvedDepartmentId });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [existing] = await conn.query('SELECT user_id AS id FROM students WHERE student_id = ? LIMIT 1', [student_id]);
    if (existing.length) {
      await conn.rollback();
      return sendResponse(res, 400, 'Student ID already exists.', 'ተማሪ ቁጥር አስቀድሞ አለ።');
    }

    const passwordValue = typeof password === 'string' && password.trim() ? password.trim() : getDefaultPasswordForRole('student');
    const hashedPassword = await bcrypt.hash(String(passwordValue), 12);

    const [userResult] = await conn.query(
      'INSERT INTO users (email, password_hash, role, status, is_first_login) VALUES (?, ?, ?, ?, ?)',
      [null, hashedPassword, 'student', 'active', 1]
    );
    const newUserId = userResult.insertId;

    await conn.query(
      'INSERT INTO students (user_id, student_id, first_name, last_name, department_id, semester, year_level, section, program_type, gender) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        newUserId,
        student_id || null,
        first_name || null,
        last_name || null,
        resolvedDepartmentId || null,
        semester || null,
        year_level || null,
        section || null,
        program_type || null,
        gender || null,
      ]
    );

    await conn.commit();
    return sendResponse(res, 201, 'Student registered successfully.', 'ተማሪ በተሳካ ሁኔታ ተመዝግቧል።', { id: newUserId });
  } catch (error) {
    console.error('Registration Error:', error);
    try { await conn.rollback(); } catch (rollbackError) {
      console.error('Rollback Error:', rollbackError);
    }
    return res.status(500).json({
      message: 'Registration failed due to database error.',
      error: error.sqlMessage || error.message,
    });
  } finally {
    conn.release();
  }
});

// Legacy alias for clients that still use /api/auth/departments.
app.post('/api/auth/departments', mwAuthenticateToken, mwAuthorizeRoles('admin', 'systemadmin'), createDepartment);

// List departments
app.get('/api/departments', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT d.id,
              d.college_id,
              d.department_name,
              d.department_code,
              d.name,
              d.code,
              c.name AS college_name
       FROM departments d
       LEFT JOIN colleges c ON d.college_id = c.id
       ORDER BY c.name ASC, d.name ASC`
    );
    return sendResponse(res, 200, 'Departments loaded.', 'ዲፓርትመንቶች ተጫኑ።', rows);
  } catch (error) {
    console.error('Fetch departments failed:', error?.message || error);
    return sendResponse(res, 500, 'Unable to load departments.', 'ዲፓርትመንቶችን ማግኘት አልቻለም።');
  }
});

const getDepartmentInstructors = async (req, res) => {
  try {
    const departmentId = Number(req.params.deptId);
    if (!Number.isInteger(departmentId) || departmentId <= 0) {
      return res.status(400).json({ message: 'A valid department ID is required.' });
    }

    const [rows] = await pool.query(
      `SELECT i.id AS instructor_id,
        u.id AS user_id,
        CONCAT(COALESCE(i.first_name, ''), ' ', COALESCE(i.last_name, '')) AS full_name,
        u.email, u.status, u.role,
        i.department_id,
        d.name AS department_name,
        c.name AS college_name
       FROM users u
      INNER JOIN instructors i ON i.user_id = u.id
      LEFT JOIN departments d ON d.id = i.department_id
      LEFT JOIN colleges c ON c.id = d.college_id
      WHERE i.department_id = ?
         AND LOWER(COALESCE(u.status, 'active')) = 'active'
         AND LOWER(u.role) IN ('instructor', 'dept_head', 'college_dean')
       ORDER BY i.first_name ASC`,
      [departmentId]
    );
    return res.json(rows);
  } catch (error) {
    console.error('Department instructors query failed:', error);
    return res.status(500).json({ message: 'Unable to load department instructors.', error: error.message });
  }
};

app.get('/api/courses/department-instructors/:deptId', authenticate, authorizeRoles('admin', 'dept_head', 'college_dean'), getDepartmentInstructors);
app.get('/api/instructors/department/:deptId', authenticate, authorizeRoles('admin', 'dept_head', 'college_dean'), getDepartmentInstructors);

app.get('/api/courses/filter', authenticate, authorizeRoles('admin', 'dept_head', 'college_dean'), async (req, res) => {
  try {
    const departmentId = Number(req.query.deptId);
    const year = String(req.query.year || '').trim();
    const semester = String(req.query.semester || '').trim();
    if (!departmentId || !year || !semester) return res.status(400).json({ message: 'deptId, year, and semester are required.' });
    const [rows] = await pool.query(
      `SELECT id, code, name, department_id, year_level, semester, credit_hours
       FROM courses WHERE department_id = ? AND (year_level = ? OR year_level IS NULL OR year_level = '') AND (semester = ? OR semester IS NULL OR semester = '') ORDER BY code ASC`,
      [departmentId, year, semester]
    );
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Unable to filter courses.', error: error.message });
  }
});

const getCoursesByFilters = async (req, res) => {
  try {
    const departmentId = Number(req.query.deptId);
    const requestedYear = String(req.query.year_level || req.query.year || '').trim();
    const requestedSemester = String(req.query.semester || '').trim();
    const yearNum = requestedYear.match(/\d+/)?.[0] || requestedYear;
    const dbYear = /^year\s+\d+$/i.test(requestedYear) ? requestedYear : `Year ${yearNum}`;
    const semesterValue = requestedSemester.replace(/^semester\s+/i, '').trim();
    const semesterRoman = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' }[semesterValue] || semesterValue;
    const dbSemester = `Semester ${semesterRoman}`;
    if (!departmentId || !requestedYear || !requestedSemester) return res.status(400).json({ message: 'deptId, year, and semester are required.' });
    const [rows] = await pool.query(
      `SELECT id, code, name, code AS course_code, name AS course_title, department_id, year_level, semester
       FROM courses
       WHERE department_id = ?
         AND (year_level = ? OR year_level LIKE ?)
         AND (semester = ? OR semester LIKE ?)
       ORDER BY code ASC`,
      [departmentId, dbYear, `%${dbYear}%`, dbSemester, `%${dbSemester}%`]
    );
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Unable to load courses by year and semester.', error: error.message });
  }
};

app.get('/api/courses/by-filters', authenticate, authorizeRoles('admin', 'dept_head', 'college_dean'), getCoursesByFilters);
app.get('/api/courses/by-year-semester', authenticate, authorizeRoles('admin', 'dept_head', 'college_dean'), getCoursesByFilters);

// Create a course
app.post('/api/auth/courses', async (req, res) => {
  const code = req.body.course_code || req.body.code;
  const name = req.body.course_name || req.body.name;
  const departmentId = req.body.department_id ?? req.body.departmentId ?? null;
  if (!code || !name) return sendResponse(res, 400, 'code and name are required', 'code እና name ያስፈልጋሉ');
  try {
    const [result] = await pool.query('INSERT INTO courses (code, name, department_id) VALUES (?, ?, ?)', [code, name, departmentId || null]);
    return sendResponse(res, 201, 'Course created.', 'ኮርስ ተፈጥሯል።', { id: result.insertId, code, name, department_id: departmentId });
  } catch (error) {
    console.error('Create course failed:', error?.message || error);
    return sendResponse(res, 500, 'Unable to create course.', 'ኮርስን ማፍጠር አልቻለም።');
  }
});

app.get('/api/course-assignments', authenticate, async (req, res) => {
  try {
    const params = [];
    let query = `SELECT ca.id, ca.course_id, c.code AS course_code, c.name AS course_name, ca.department_id, ca.instructor_id, ca.student_id, ca.program_type, ca.year_level, ca.semester, ca.section, ca.publish_target, ca.is_published, ca.is_student_published, ca.is_peer_published, ca.academic_year, ca.status, ca.created_at,
      CONCAT(COALESCE(i_instructor.first_name, ''), ' ', COALESCE(i_instructor.last_name, '')) AS instructor_name,
      CONCAT(COALESCE(s_student.first_name, ''), ' ', COALESCE(s_student.last_name, '')) AS student_name
      FROM course_assignments ca
      LEFT JOIN courses c ON ca.course_id = c.id
      LEFT JOIN instructors i_instructor ON ca.instructor_id = i_instructor.id
      LEFT JOIN students s_student ON ca.student_id = s_student.id`;

    if (req.user && req.user.role === 'dept_head') {
      query += ' WHERE ca.department_id = ?';
      params.push(req.user.department_id || null);
    }

    query += ' ORDER BY ca.created_at DESC';
    const [rows] = await pool.query(query, params);
    return sendResponse(res, 200, 'Course assignments retrieved.', 'የኮርስ ስራዎች ተመልሰዋል።', rows);
  } catch (error) {
    console.error('Course assignments fetch error:', error?.message || error);
    return sendResponse(res, 200, 'Course assignments unavailable; returning empty list.', 'ስራዎች አልተገኙም; ባዶ ዝርዝር ተመልሷል።', []);
  }
});

app.post('/api/courses/batch-assign', authenticate, authorizeRoles('dept_head', 'admin', 'college_dean'), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { instructorId, courseIds, yearLevel, semester, section, programType } = req.body;
    const ids = Array.isArray(courseIds) ? [...new Set(courseIds.map(Number).filter((id) => Number.isInteger(id) && id > 0))] : [];
    const callerDepartmentId = Number(req.user.department_id || req.body.departmentId || 0);
    if (!instructorId || !ids.length || !yearLevel || !semester || !section || !programType || !callerDepartmentId) {
      return res.status(400).json({ message: 'instructorId, courseIds, yearLevel, semester, section, and programType are required.' });
    }

    const [instructorRows] = await connection.query(
      `SELECT i.id, i.department_id, u.role FROM instructors i INNER JOIN users u ON u.id = i.user_id
       WHERE (i.id = ? OR i.user_id = ?) AND LOWER(u.role) IN ('instructor', 'dept_head', 'college_dean') AND LOWER(COALESCE(u.status, 'active')) = 'active' LIMIT 1`,
      [Number(instructorId), Number(instructorId)]
    );
    if (!instructorRows.length) return res.status(404).json({ message: 'Teaching staff member not found.' });

    const placeholders = ids.map(() => '?').join(', ');
    const [courseRows] = await connection.query(`SELECT id, department_id FROM courses WHERE id IN (${placeholders})`, ids);
    if (courseRows.length !== ids.length) return res.status(404).json({ message: 'One or more courses were not found.' });
    if (req.user.role === 'dept_head' && courseRows.some((course) => Number(course.department_id) !== callerDepartmentId)) {
      return res.status(403).json({ message: 'You can only assign courses from your department.' });
    }

    await connection.beginTransaction();
    for (const course of courseRows) {
      await connection.query(
        `INSERT INTO course_assignments (department_id, course_id, instructor_id, program_type, year_level, semester, section, is_published, is_student_published, is_peer_published, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 'Assigned')`,
        [course.department_id, course.id, instructorRows[0].id, programType, yearLevel, semester, String(section).trim()]
      );
    }
    await connection.commit();
    return res.status(201).json({ success: true, assignedCount: courseRows.length });
  } catch (error) {
    try { await connection.rollback(); } catch (rollbackError) { console.error('Batch assignment rollback failed:', rollbackError); }
    console.error('Batch assignment failed:', error);
    return res.status(500).json({ message: 'Unable to save batch course assignments.', error: error.message });
  } finally {
    connection.release();
  }
});

app.post('/api/courses/batch-assign-matrix', authenticate, authorizeRoles('dept_head', 'admin', 'college_dean'), batchAssignMatrix);

app.post('/api/assignments/assign', authenticate, authorizeRoles('dept_head', 'admin', 'college_dean'), async (req, res) => {
  try {
    const { course_id, instructor_id, program_type, year_level, semester, section } = req.body;
    const normalizedSection = normalizeSectionValue(section);
    const departmentId = Number(req.user.department_id || req.body.department_id || 0);
    const courseId = Number(course_id);
    const instructorId = Number(instructor_id);
    if (!departmentId || !courseId || !instructorId || !program_type || !year_level || !semester || !normalizedSection) {
      return res.status(400).json({ message: 'All assignment fields are required.' });
    }

    const [courseRows] = await pool.query('SELECT id, department_id FROM courses WHERE id = ? LIMIT 1', [courseId]);
    const [instructorRows] = await pool.query(
      `SELECT i.id, i.department_id, u.role
       FROM instructors i INNER JOIN users u ON u.id = i.user_id
       WHERE (i.id = ? OR i.user_id = ?)
         AND LOWER(u.role) IN ('instructor', 'dept_head', 'college_dean')
         AND LOWER(COALESCE(u.status, 'active')) = 'active'
       LIMIT 1`,
      [instructorId, instructorId]
    );
    if (!courseRows.length) return res.status(404).json({ message: 'Course not found.' });
    if (!instructorRows.length) return res.status(404).json({ message: 'Instructor not found.' });
    if (Number(courseRows[0].department_id) !== departmentId || Number(instructorRows[0].department_id) !== departmentId) {
      return res.status(403).json({ message: 'Course and instructor must belong to your department.' });
    }

    const [result] = await pool.query(
      `INSERT INTO course_assignments
        (department_id, course_id, instructor_id, program_type, year_level, semester, section, is_published, is_student_published, is_peer_published, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 'Assigned')`,
      [departmentId, courseId, instructorRows[0].id, program_type, year_level, semester, normalizedSection]
    );
    return res.status(201).json({ id: result.insertId, message: 'Course assignment saved.' });
  } catch (error) {
    console.error('Assignment save failed:', error);
    return res.status(500).json({ message: 'Unable to save course assignment.' });
  }
});

app.get('/api/evaluations/publish-assignments', authenticate, authorizeRoles('dept_head', 'admin'), async (req, res) => {
  try {
    const departmentId = await resolveDepartmentId(req.query.department || req.user.department_id || req.user.department);
    if (!departmentId) return res.status(404).json({ message: 'Department was not found.' });
    const [rows] = await pool.query(
      `SELECT ca.id, ca.course_id, ca.instructor_id, ca.program_type, ca.year_level, ca.semester, ca.section,
        ca.is_student_published, ca.is_peer_published, c.code AS course_code, c.name AS course_name,
        TRIM(CONCAT(COALESCE(i.first_name, ''), ' ', COALESCE(i.last_name, ''))) AS instructor_name
       FROM course_assignments ca
       INNER JOIN courses c ON c.id = ca.course_id
       INNER JOIN instructors i ON i.id = ca.instructor_id
       WHERE ca.department_id = ? ORDER BY ca.created_at DESC`,
      [departmentId]
    );
    return res.json(rows);
  } catch (error) {
    console.error('Publish assignments query failed:', error);
    return res.status(500).json({ message: 'Unable to load course assignments.' });
  }
});

app.post('/api/evaluations/toggle-peer-publish', authenticate, authorizeRoles('dept_head', 'admin'), async (req, res) => {
  try {
    const requestedDepartmentId = Number(req.body?.department_id || req.user.department_id || req.user.department);
    const departmentId = req.user.role === 'dept_head' ? Number(req.user.department_id) : requestedDepartmentId;
    const publishStatus = Number(req.body?.publish_status);
    if (!Number.isInteger(departmentId) || departmentId <= 0) return res.status(400).json({ success: false, message: 'A valid department_id is required.' });
    if (![0, 1].includes(publishStatus)) return res.status(400).json({ success: false, message: 'publish_status must be 0 or 1.' });

    if (publishStatus === 1) {
      const [[existingPeerSession]] = await pool.query(
        `SELECT COUNT(*) AS total
         FROM peer_evaluations pe
         INNER JOIN instructors target ON target.id = pe.evaluatee_id
         WHERE target.department_id = ? AND pe.course_id IS NULL`,
        [departmentId]
      );
      if (Number(existingPeerSession?.total || 0) > 0) {
        return res.status(400).json({ success: false, isAlreadyPublished: true, message: 'Peer evaluations have already been published for this department.' });
      }
    } else {
      const [[submittedPeerEvaluation]] = await pool.query(
        `SELECT COUNT(*) AS total
         FROM peer_evaluation_submissions pes
         INNER JOIN peer_evaluations pe ON pe.id = pes.peer_evaluation_id
         INNER JOIN instructors target ON target.id = pe.evaluatee_id
         WHERE target.department_id = ? AND pe.course_id IS NULL`,
        [departmentId]
      );
      if (Number(submittedPeerEvaluation?.total || 0) > 0) {
        return res.status(400).json({ success: false, message: 'Cannot unpublish because an instructor has already submitted a peer evaluation.' });
      }
    }

    const [result] = await pool.query(
      'UPDATE course_assignments SET is_peer_published = ?, is_published = IF(? = 1, 1, is_student_published), publish_target = CASE WHEN ? = 1 AND is_student_published = 1 THEN \'both\' WHEN ? = 1 THEN \'instructor\' WHEN is_student_published = 1 THEN \'student\' ELSE \'\' END WHERE department_id = ?',
      [publishStatus, publishStatus, publishStatus, publishStatus, departmentId]
    );
    return res.json({ success: true, department_id: departmentId, is_peer_published: publishStatus, updated: result.affectedRows });
  } catch (error) {
    console.error('Toggle peer publish failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to update peer publish status.', error: error.message });
  }
});

app.get('/api/evaluations/publish-statuses/:deptId', authenticate, authorizeRoles('dept_head', 'admin'), async (req, res) => {
  try {
    const requestedDepartmentId = Number(req.params.deptId);
    const departmentId = req.user.role === 'dept_head' ? Number(req.user.department_id) : requestedDepartmentId;
    if (!Number.isInteger(requestedDepartmentId) || requestedDepartmentId <= 0 || departmentId !== requestedDepartmentId) return res.status(403).json({ success: false, message: 'You can only access your department publish status.' });
    const [[status]] = await pool.query(
      `SELECT COALESCE(MAX(is_student_published), 0) AS is_student_published,
              COALESCE(MAX(is_peer_published), 0) AS is_peer_published
       FROM course_assignments WHERE department_id = ?`,
      [departmentId]
    );
    return res.json({
      success: true,
      department_id: departmentId,
      is_student_published: Boolean(status?.is_student_published),
      is_peer_published: Boolean(status?.is_peer_published),
    });
  } catch (error) {
    console.error('Publish statuses query failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to load publish statuses.', error: error.message });
  }
});

const findPublishedEvaluationTerm = async (departmentId, yearLevel, semester, academicYear) => {
  const [rows] = await pool.query(
    `SELECT ca.id
     FROM course_assignments ca
     LEFT JOIN evaluation_dispatches ed ON ed.assignment_id = ca.id
     WHERE ca.department_id = ?
       AND ca.year_level = ?
       AND ca.semester = ?
       AND ca.academic_year = ?
       AND ca.is_published = 1
     LIMIT 1`,
    [departmentId, yearLevel, semester, academicYear]
  );
  return rows.length > 0;
};

const validateEvaluationPublishTerm = async (res, departmentId, yearLevel, semester, academicYear) => {
  if (await findPublishedEvaluationTerm(departmentId, yearLevel, semester, academicYear)) {
    res.status(400).json({ message: 'Evaluation form has already been published for this academic term.' });
    return false;
  }
  return true;
};

app.post('/api/evaluations/publish', authenticate, authorizeRoles('dept_head', 'admin'), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { department_id, program_type, year_level, semester, section, academic_year } = req.body;
    const departmentId = await resolveDepartmentId(department_id || req.user.department_id || req.user.department);
    const academicYear = String(academic_year || new Date().getFullYear());
    if (!departmentId) return res.status(404).json({ message: 'Department was not found.' });
    if (!await validateEvaluationPublishTerm(res, departmentId, year_level, semester, academicYear)) return;

    const filters = ['ca.department_id = ?', 'ca.year_level = ?', 'ca.semester = ?', 'ca.academic_year = ?'];
    const params = [departmentId, year_level, semester, academicYear];
    if (program_type) { filters.push('LOWER(TRIM(ca.program_type)) = LOWER(TRIM(?))'); params.push(program_type); }
    if (section) { filters.push('LOWER(TRIM(ca.section)) = LOWER(TRIM(?))'); params.push(normalizeSectionValue(section)); }
    const [assignments] = await connection.query(`SELECT ca.id, ca.course_id, c.name FROM course_assignments ca INNER JOIN courses c ON c.id = ca.course_id WHERE ${filters.join(' AND ')}`, params);
    await connection.beginTransaction();
    for (const assignment of assignments) {
      await connection.query("UPDATE course_assignments SET is_published = 1, is_student_published = 1, is_peer_published = 1, publish_target = 'both' WHERE id = ?", [assignment.id]);
    }
    await connection.commit();
    return res.json({ message: `Published student and peer evaluations for ${assignments.length} assignments.` });
  } catch (error) {
    try { await connection.rollback(); } catch (rollbackError) { console.error('Publish rollback failed:', rollbackError); }
    return res.status(500).json({ message: 'Unable to publish evaluations.', error: error.message });
  } finally { connection.release(); }
});

app.get('/api/evaluations/student-list', authenticate, authorizeRoles('student'), async (req, res) => {
  try {
    const departmentId = Number(req.user.department_id || req.query.department_id || 0);
    const yearLevel = String(req.query.year_level || req.query.year || '').trim();
    const semester = String(req.query.semester || '').trim();
    const academicYear = String(req.query.academic_year || new Date().getFullYear());
    if (!departmentId) return res.status(400).json({ message: 'Student department is not configured.' });
    const [rows] = await pool.query(
      `SELECT i.id AS instructor_id,
        CONCAT(COALESCE(i.first_name, ''), ' ', COALESCE(i.last_name, '')) AS instructor_name,
        GROUP_CONCAT(DISTINCT c.code ORDER BY c.code SEPARATOR ', ') AS course_codes,
        COUNT(DISTINCT ca.course_id) AS course_count
       FROM course_assignments ca
       INNER JOIN instructors i ON i.id = ca.instructor_id
       INNER JOIN users u ON u.id = i.user_id AND LOWER(u.status) = 'active'
       INNER JOIN courses c ON c.id = ca.course_id
       WHERE ca.department_id = ?
         AND ca.is_published = 1
         AND (? = '' OR ca.year_level = ?)
         AND (? = '' OR ca.semester = ?)
         AND (? = '' OR ca.academic_year = ?)
       GROUP BY i.id, i.first_name, i.last_name
       ORDER BY instructor_name ASC`,
      [departmentId, yearLevel, yearLevel, semester, semester, academicYear, academicYear]
    );
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Unable to load student evaluation list.', error: error.message });
  }
});

app.post('/api/evaluations/publish-student', authenticate, authorizeRoles('dept_head', 'admin'), async (req, res) => {
  try {
    const { department_id, program_type, year_level, semester, section } = req.body;
    const departmentId = await resolveDepartmentId(department_id || req.user.department_id || req.user.department);
    if (!departmentId) return res.status(404).json({ message: 'Department was not found.' });
    const academicYear = String(req.body.academic_year || new Date().getFullYear());
    const duplicateFilters = ['ca.department_id = ?', 'ca.academic_year = ?', 'ca.is_student_published = 1'];
    const duplicateParams = [departmentId, academicYear];
    [['ca.program_type', program_type], ['ca.year_level', year_level], ['ca.semester', semester], ['ca.section', normalizeSectionValue(section)]].forEach(([column, value]) => {
      if (value) { duplicateFilters.push(`LOWER(TRIM(${column})) = LOWER(TRIM(?))`); duplicateParams.push(value); }
    });
    const [[existingBatch]] = await pool.query(`SELECT COUNT(*) AS total FROM course_assignments ca WHERE ${duplicateFilters.join(' AND ')}`, duplicateParams);
    if (Number(existingBatch?.total || 0) > 0) {
      return res.status(400).json({ success: false, isAlreadyPublished: true, message: 'Evaluation form has already been published for this section/batch.' });
    }
    if (!await validateEvaluationPublishTerm(res, departmentId, year_level, semester, academicYear)) return;
    const filters = ['ca.department_id = ?'];
    const params = [departmentId];
    [['ca.program_type', program_type], ['ca.year_level', year_level], ['ca.semester', semester], ['ca.section', normalizeSectionValue(section)]].forEach(([column, value]) => {
      if (value) { filters.push(`LOWER(TRIM(${column})) = LOWER(TRIM(?))`); params.push(value); }
    });
    const [assignments] = await pool.query(`SELECT ca.id, ca.course_id, ca.instructor_id, c.name FROM course_assignments ca JOIN courses c ON c.id = ca.course_id WHERE ${filters.join(' AND ')}`, params);
    for (const assignment of assignments) {
      await pool.query('UPDATE course_assignments SET is_published = 1, is_student_published = 1, publish_target = CASE WHEN is_peer_published = 1 THEN \'both\' ELSE \'student\' END WHERE id = ?', [assignment.id]);
      const [students] = await pool.query("SELECT id FROM students WHERE department_id = ? AND (? = '' OR LOWER(TRIM(program_type)) = LOWER(TRIM(?))) AND (? = '' OR LOWER(TRIM(year_level)) = LOWER(TRIM(?))) AND (? = '' OR LOWER(TRIM(semester)) = LOWER(TRIM(?))) AND (? = '' OR LOWER(TRIM(REPLACE(REPLACE(section, 'Section ', ''), 'section ', ''))) = LOWER(TRIM(?)))", [departmentId, program_type || '', program_type || '', year_level || '', year_level || '', semester || '', semester || '', normalizeSectionValue(section), normalizeSectionValue(section)]);
      for (const student of students) await pool.query('INSERT INTO evaluation_dispatches (assignment_id, student_id, course_id, course_name, semester, year_level, student_group, created_by, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [assignment.id, student.id, assignment.course_id, assignment.name, semester || null, year_level || null, 'student', req.user.id, JSON.stringify({ source: 'student_publish' })]);
    }
    return res.json({ message: `Published student evaluations for ${assignments.length} assignments.` });
  } catch (error) { console.error('Student evaluation publish failed:', error); return res.status(500).json({ message: 'Unable to publish student evaluations.' }); }
});

app.post('/api/evaluations/student/unpublish', authenticate, authorizeRoles('dept_head', 'admin'), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { department_id, program_type, year_level, semester, section } = req.body;
    const departmentId = await resolveDepartmentId(department_id || req.user.department_id || req.user.department);
    const academicYear = String(req.body.academic_year || new Date().getFullYear());
    if (!departmentId) return res.status(404).json({ message: 'Department was not found.' });

    const filters = ['ca.department_id = ?', 'ca.academic_year = ?', 'ca.is_student_published = 1'];
    const params = [departmentId, academicYear];
    [['ca.program_type', program_type], ['ca.year_level', year_level], ['ca.semester', semester], ['ca.section', normalizeSectionValue(section)]].forEach(([column, value]) => {
      if (value) { filters.push(`LOWER(TRIM(${column})) = LOWER(TRIM(?))`); params.push(value); }
    });
    const [assignments] = await connection.query(`SELECT id FROM course_assignments ca WHERE ${filters.join(' AND ')}`, params);
    if (!assignments.length) return res.status(404).json({ message: 'No published student evaluation batch found.' });
    const assignmentIds = assignments.map((assignment) => assignment.id);
    const placeholders = assignmentIds.map(() => '?').join(', ');
    const [submitted] = await connection.query(
      `SELECT ses.id FROM student_evaluation_submissions ses INNER JOIN evaluation_dispatches ed ON ed.id = ses.dispatch_id WHERE ed.assignment_id IN (${placeholders}) LIMIT 1`,
      assignmentIds
    );
    if (submitted.length) return res.status(400).json({ success: false, message: 'Cannot unpublish because student evaluations have already been submitted.' });

    await connection.beginTransaction();
    await connection.query(`DELETE FROM evaluation_dispatches WHERE assignment_id IN (${placeholders})`, assignmentIds);
    await connection.query(`UPDATE course_assignments SET is_student_published = 0, is_published = IF(is_peer_published = 1, 1, 0), publish_target = IF(is_peer_published = 1, 'instructor', '') WHERE id IN (${placeholders})`, assignmentIds);
    await connection.commit();
    return res.json({ success: true, message: 'Student evaluation form unpublished successfully.' });
  } catch (error) {
    try { await connection.rollback(); } catch (rollbackError) { console.error('Student unpublish rollback failed:', rollbackError); }
    return res.status(500).json({ message: 'Unable to unpublish student evaluations.', error: error.message });
  } finally { connection.release(); }
});

app.post('/api/evaluations/publish-instructor', authenticate, authorizeRoles('dept_head', 'admin'), async (req, res) => {
  try {
    const { department_id, program_type, year_level, semester, section } = req.body;
    const departmentId = await resolveDepartmentId(department_id || req.user.department_id || req.user.department);
    if (!departmentId) return res.status(404).json({ message: 'Department was not found.' });
    const academicYear = String(req.body.academic_year || new Date().getFullYear());
    if (!await validateEvaluationPublishTerm(res, departmentId, year_level, semester, academicYear)) return;
    const filters = ['ca.department_id = ?'];
    const params = [departmentId];
    [['ca.program_type', program_type], ['ca.year_level', year_level], ['ca.semester', semester], ['ca.section', normalizeSectionValue(section)]].forEach(([column, value]) => { if (value) { filters.push(`LOWER(TRIM(${column})) = LOWER(TRIM(?))`); params.push(value); } });
    const [assignments] = await pool.query(`SELECT id, course_id, instructor_id FROM course_assignments ca WHERE ${filters.join(' AND ')}`, params);
    const evaluatorUserIds = new Set();
    for (const assignment of assignments) {
      await pool.query('UPDATE course_assignments SET is_published = 1, is_peer_published = 1, publish_target = CASE WHEN is_student_published = 1 THEN \'both\' ELSE \'instructor\' END WHERE id = ?', [assignment.id]);
      const [peers] = await pool.query('SELECT user_id FROM instructors WHERE department_id = ? AND id <> ?', [departmentId, assignment.instructor_id]);
      for (const peer of peers) {
        evaluatorUserIds.add(peer.user_id);
        await pool.query('INSERT IGNORE INTO peer_evaluations (evaluator_id, evaluatee_id, course_id, status) VALUES (?, ?, ?, \'pending\')', [peer.user_id, assignment.instructor_id, assignment.course_id]);
      }
    }
    if (evaluatorUserIds.size) {
      await createNotifications({
        userIds: [...evaluatorUserIds],
        title: 'Instructor Evaluation Published',
        message: 'A new instructor peer evaluation is available. Please complete your assigned evaluation.',
        type: 'peer_evaluation',
      });
    }
    return res.json({ message: `Published instructor evaluations for ${assignments.length} assignments.` });
  } catch (error) { console.error('Instructor evaluation publish failed:', error); return res.status(500).json({ message: 'Unable to publish instructor evaluations.' }); }
});

app.get('/api/instructor/assigned-courses', authenticate, authorizeRoles('instructor', 'dept_head', 'admin'), async (req, res) => {
  try {
    const userId = req.user.role === 'instructor' ? req.user.id : Number(req.query.instructor_id || req.query.user_id || req.user.id);
    const [rows] = await pool.query(
      `SELECT ca.id, ca.course_id, c.code AS course_code, c.name AS course_name, ca.department_id, ca.program_type, ca.year_level, ca.semester, ca.section, ca.is_published, ca.status
       FROM course_assignments ca
       LEFT JOIN courses c ON c.id = ca.course_id
       WHERE ca.instructor_id = ? AND ca.is_published = 1
       ORDER BY ca.created_at DESC`,
      [userId]
    );

    return sendResponse(res, 200, 'Instructor assignments retrieved.', 'የመምህራን ስራዎች ተመልሰዋል።', rows);
  } catch (error) {
    console.error('Instructor assignments fetch error:', error?.message || error);
    return sendResponse(res, 200, 'Instructor assignments unavailable; returning empty list.', 'የመምህራን ስራዎች አልተገኙም።', []);
  }
});

app.get('/api/instructor/peer-evaluations', authenticate, authorizeRoles('instructor', 'dept_head', 'admin'), async (req, res) => {
  try {
    const instructorIdParam = Number(req.query.instructor_id || req.query.user_id || 0);
    let evaluatorId = Number(req.user?.id || 0);

    if (instructorIdParam) {
      const [userRows] = await pool.query(
        'SELECT user_id FROM instructors WHERE id = ? OR user_id = ? LIMIT 1',
        [instructorIdParam, instructorIdParam]
      );
      evaluatorId = userRows[0].user_id;
    }

    if (!evaluatorId) {
      return res.status(400).json({ success: false, message: 'Instructor ID is required.' });
    }

    console.log('Fetching peer evaluations for evaluator user_id:', evaluatorId);

    await pool.query(`CREATE TABLE IF NOT EXISTS peer_evaluations (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      evaluator_id INT UNSIGNED NOT NULL,
      evaluatee_id INT UNSIGNED NOT NULL,
      course_id INT UNSIGNED DEFAULT NULL,
      deadline VARCHAR(64) DEFAULT '2026-08-17',
      status ENUM('pending', 'submitted') DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_evaluator_id (evaluator_id),
      INDEX idx_evaluatee_id (evaluatee_id),
      UNIQUE KEY uk_peer_eval (evaluator_id, evaluatee_id, course_id),
      CONSTRAINT fk_peer_evaluations_evaluator FOREIGN KEY (evaluator_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_peer_evaluations_evaluatee FOREIGN KEY (evaluatee_id) REFERENCES instructors(id) ON DELETE CASCADE,
      CONSTRAINT fk_peer_evaluations_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    const [rows] = await pool.query(
      `SELECT
        pe.id,
        pe.evaluatee_id,
        pe.course_id,
        CONCAT(COALESCE(i.first_name, ''), ' ', COALESCE(i.last_name, '')) AS instructor_name,
        c.code AS course_code,
        c.name AS course_name,
        pe.deadline,
        CASE
          WHEN LOWER(TRIM(pe.status)) = 'pending' THEN 'pending'
          ELSE 'completed'
        END AS status,
        pes.score AS total_score,
        pes.strengths,
        pes.suggestions,
        pes.responses,
        pes.status AS submission_status,
        pes.id AS submission_id,
        CASE WHEN pes.id IS NOT NULL THEN 1 ELSE 0 END AS is_evaluated
       FROM peer_evaluations pe
       JOIN instructors i ON pe.evaluatee_id = i.id
       LEFT JOIN courses c ON pe.course_id = c.id
       LEFT JOIN peer_evaluation_submissions pes ON pes.peer_evaluation_id = pe.id
       WHERE pe.evaluator_id = ?
       ORDER BY pe.created_at DESC`,
      [evaluatorId]
    );

    const normalized = rows.map(row => ({
      ...row,
      total_score: row.total_score !== null ? Number(row.total_score) : 0,
      is_evaluated: Boolean(row.is_evaluated),
      responses: row.responses ? (typeof row.responses === 'string' ? JSON.parse(row.responses) : row.responses) : {},
    }));

    const pendingCount = normalized.reduce((count, row) => count + (row.status === 'pending' ? 1 : 0), 0);
    return res.status(200).json({
      success: true,
      pendingCount,
      evaluations: normalized,
    });
  } catch (err) {
    console.error('Peer Evaluations SQL Error:', err?.message || err);
    return res.status(200).json({
      success: true,
      pendingCount: 0,
      evaluations: [],
      message: 'Fallback: No peer evaluations table or records found.',
    });
  }
});

app.get('/api/student/assigned-courses', authenticate, authorizeRoles('student'), async (req, res) => {
  try {
    const [studentRows] = await pool.query('SELECT department_id, year_level, semester, section FROM students WHERE user_id = ? LIMIT 1', [req.user.id]);
    if (!studentRows.length) {
      return sendResponse(res, 200, 'Student record not found.', 'የተማሪ መረጃ አልተገኘም።', []);
    }

    const student = studentRows[0];
    const normalizedSection = normalizeSectionValue(student.section);
    const [rows] = await pool.query(
      `SELECT ca.id, ca.course_id, c.code AS course_code, c.name AS course_name, ca.department_id, ca.program_type, ca.year_level, ca.semester, ca.section, ca.is_student_published, ca.is_peer_published, ca.status
       FROM course_assignments ca
       LEFT JOIN courses c ON c.id = ca.course_id
       WHERE ca.department_id = ?
         AND ca.year_level = ?
         AND ca.semester = ?
         AND LOWER(TRIM(REPLACE(REPLACE(ca.section, 'Section ', ''), 'section ', ''))) = LOWER(?)
         AND ca.is_student_published = 1
       ORDER BY c.code ASC`,
      [student.department_id, student.year_level, student.semester, normalizedSection]
    );

    return sendResponse(res, 200, 'Student assignments retrieved.', 'የተማሪ ስራዎች ተመልሰዋል።', rows);
  } catch (error) {
    console.error('Student assignments fetch error:', error?.message || error);
    return sendResponse(res, 200, 'Student assignments unavailable; returning empty list.', 'የተማሪ ስራዎች አልተገኙም።', []);
  }
});

app.post('/api/course-assignments', authenticate, authorizeRoles('dept_head', 'admin'), async (req, res) => {
  try {
    const {
      course_id,
      instructor_id,
      program_type,
      year_level,
      semester,
      section,
      publish_target = 'both',
    } = req.body;

    const normalizedSection = normalizeSectionValue(section);
    if (!course_id || !instructor_id || !program_type || !year_level || !semester || !normalizedSection) {
      return sendResponse(res, 400, 'course_id, instructor_id, program_type, year_level, semester, and section are required.', 'course_id፣ instructor_id፣ program_type፣ year_level፣ semester እና section ያስፈልጋሉ።');
    }

    const departmentId = req.user.department_id || null;
    const [courseRows] = await pool.query('SELECT department_id, name FROM courses WHERE id = ? LIMIT 1', [course_id]);
    if (!courseRows.length) {
      return sendResponse(res, 404, 'Course not found.', 'ኮርስ አልተገኘም።');
    }

    if (departmentId && courseRows[0].department_id !== departmentId) {
      return sendResponse(res, 403, 'Course must belong to your department.', 'ኮርሱ የየትም ክፍልዎ መሆን አለበት።');
    }

    const publishTargetValue = normalizePublishTarget(publish_target);
    const isPublishedValue = publishTargetValue ? 1 : 0;
    const isStudentPublished = publishTargetValue === 'student' || publishTargetValue === 'both' ? 1 : 0;
    const isPeerPublished = publishTargetValue === 'instructor' || publishTargetValue === 'both' ? 1 : 0;

    const [result] = await pool.query(
      'INSERT INTO course_assignments (course_id, department_id, instructor_id, program_type, year_level, semester, section, publish_target, is_published, is_student_published, is_peer_published) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [course_id, departmentId, instructor_id, program_type, year_level, semester, normalizedSection, publishTargetValue, isPublishedValue, isStudentPublished, isPeerPublished]
    );

    return sendResponse(res, 201, 'Course assignment saved successfully!', 'የኮርስ ምውጫ በተሳካ ሁኔታ ተቀምጧል።', { id: result.insertId, publish_target: publishTargetValue, section: normalizedSection });
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Unable to create assignment.', 'ስራ ለመፍጠር አልተቻለም።');
  }
});

app.post('/api/dept-head/assign-course', authenticate, authorizeRoles('dept_head', 'admin'), async (req, res) => {
  try {
    console.log('Incoming Assign Payload:', req.body);
    const {
      course_id,
      instructor_id,
      department_id,
      program_type,
      year_level,
      semester,
      section,
      publish_target = 'both',
      is_published,
      academic_year,
    } = req.body;
    const normalizedSection = normalizeSectionValue(section);
    const departmentIdFromBody = Number(department_id);
    const courseIdNum = Number(course_id);
    const instructorIdNum = Number(instructor_id);
    const publishedVal = is_published ? 1 : 0;
    const publishTargetValue = normalizePublishTarget(publish_target);
    const acYear = typeof academic_year === 'string' && academic_year.trim() ? academic_year.trim() : '2026';

    if (!Number.isInteger(courseIdNum) || courseIdNum <= 0 || !Number.isInteger(instructorIdNum) || instructorIdNum <= 0 || !program_type || !year_level || !semester || !normalizedSection) {
      return sendResponse(res, 400, 'course_id, instructor_id, program_type, year_level, semester, and section are required and must be valid.', 'course_id፣ instructor_id፣ program_type፣ year_level፣ semester እና section ያስፈልጋሉ እና ትክክለኛ መሆን አለባቸው።');
    }

    let departmentId = Number(departmentIdFromBody) || Number(req.user.department_id) || null;
    const [courseRows] = await pool.query('SELECT department_id, code, name FROM courses WHERE id = ? LIMIT 1', [courseIdNum]);
    if (!courseRows.length) {
      return sendResponse(res, 404, 'Course not found.', 'ኮርስ አልተገኘም።');
    }

    if (!departmentId) {
      departmentId = courseRows[0].department_id || null;
    }

    if (!departmentId) {
      return sendResponse(res, 400, 'department_id is required.', 'department_id ያስፈልጋል።');
    }

    if (courseRows[0].department_id !== departmentId) {
      return sendResponse(res, 403, 'Course must belong to your department.', 'ኮርሱ የየትም ክፍልዎ መሆን አለበት።');
    }

    const [instructorRows] = await pool.query(
      'SELECT id, user_id FROM instructors WHERE id = ? OR user_id = ? LIMIT 1',
      [instructorIdNum, instructorIdNum]
    );
    if (!instructorRows.length) {
      return sendResponse(res, 404, 'Instructor record not found.', 'የመምህር መዝገብ አልተገኘም።');
    }

    const instructorRecordId = instructorRows[0].id;
    const isStudentPublished = publishTargetValue === 'student' || publishTargetValue === 'both' ? 1 : 0;
    const isPeerPublished = publishTargetValue === 'instructor' || publishTargetValue === 'both' ? 1 : 0;

    const [result] = await pool.query(
      'INSERT INTO course_assignments (department_id, course_id, instructor_id, program_type, year_level, semester, section, publish_target, is_published, is_student_published, is_peer_published, academic_year) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [departmentId, courseIdNum, instructorRecordId, program_type, year_level, semester, normalizedSection, publishTargetValue, publishedVal, isStudentPublished, isPeerPublished, acYear]
    );

    if (publishedVal === 1) {
      if (publishTargetValue !== 'instructor') {
        let [studentRows] = await pool.query(
          `SELECT id, user_id FROM students s
           WHERE s.department_id = ?
             AND (
               LOWER(TRIM(s.program_type)) = LOWER(TRIM(?))
               OR s.program_type IS NULL
               OR ? IS NULL
               OR ? = ''
               OR LOWER(?) = 'all'
             )
             AND (
               REGEXP_REPLACE(LOWER(s.year_level), '[^0-9]', '') = REGEXP_REPLACE(LOWER(?), '[^0-9]', '')
               OR s.year_level IS NULL
               OR ? IS NULL
               OR ? = ''
               OR LOWER(?) = 'all'
             )
             AND (
               LOWER(TRIM(s.semester)) = LOWER(TRIM(?))
               OR s.semester IS NULL
               OR ? IS NULL
               OR ? = ''
               OR LOWER(?) = 'all'
             )
             AND (
               LOWER(TRIM(s.section)) = LOWER(TRIM(?))
               OR s.section IS NULL
               OR ? IS NULL
               OR ? = ''
               OR LOWER(?) = 'all'
             )`,
          [departmentId, program_type, program_type, program_type, program_type,
           year_level, year_level, year_level, year_level, year_level,
           semester, semester, semester, semester, semester,
           normalizedSection, normalizedSection, normalizedSection, normalizedSection, normalizedSection]
        );

        if (!studentRows.length) {
          console.log(`[Assign Course Warning] No strict match for Dept ${departmentId}. Falling back to all department students.`);
          [studentRows] = await pool.query(
            `SELECT id, user_id FROM students WHERE department_id = ?`,
            [departmentId]
          );
        }

        console.log(`[Assign Course Success] Creating dispatches for ${studentRows.length} students.`);

        for (const student of studentRows) {
          try {
            await pool.query(
              'INSERT INTO evaluation_dispatches (assignment_id, template_id, student_id, student_identifier, course_id, course_name, academic_year, semester, year_level, student_group, created_by, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
              [result.insertId, null, student.id, null, courseIdNum, courseRows[0].name || '', acYear, semester, year_level, 'student', req.user.id, JSON.stringify({ source: 'course_publish' })]
            );
          } catch (dispatchError) {
            console.warn('Failed to dispatch student evaluation for student', student.id, dispatchError.message || dispatchError);
          }
        }
      }

      if (publishTargetValue !== 'student') {
        await pool.query(`CREATE TABLE IF NOT EXISTS peer_evaluations (
          id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          evaluator_id INT UNSIGNED NOT NULL,
          evaluatee_id INT UNSIGNED NOT NULL,
          course_id INT UNSIGNED DEFAULT NULL,
          deadline VARCHAR(64) DEFAULT '2026-08-17',
          status ENUM('pending', 'submitted') DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

        const [courseIdColumn] = await pool.query("SHOW COLUMNS FROM peer_evaluations LIKE 'course_id'");
        if (!courseIdColumn.length) {
          await pool.query('ALTER TABLE peer_evaluations ADD COLUMN course_id INT UNSIGNED DEFAULT NULL');
        }

        console.log('Dispatching to instructors strictly by department_id...');
        const [peerRows] = await pool.query(
          'SELECT user_id FROM instructors WHERE department_id = ? AND id != ?',
          [departmentId, instructorRecordId]
        );
        console.log(`Found ${peerRows.length} peer instructors in department ${departmentId}`);
        for (const peer of peerRows) {
          if (!peer.user_id) continue;
          await pool.query(
            'INSERT INTO peer_evaluations (evaluator_id, evaluatee_id, course_id, status) VALUES (?, ?, ?, ?)',
            [peer.user_id, instructorRecordId, courseIdNum, 'pending']
          );
        }
      }
    }

    return sendResponse(res, 200, 'Course assigned successfully', 'የኮርስ ምውጫ በተሳካ ሁኔታ ተደርጓል።', { id: result.insertId });
  } catch (err) {
    console.log('Incoming Assign Payload:', req.body);
    console.error('CRITICAL BACKEND ERROR ON ASSIGN COURSE:');
    console.error('SQL Message:', err.sqlMessage || err.message);
    console.error('Full Error Stack:', err);
    return res.status(500).json({ error: 'Unable to create department assignment.', details: err.sqlMessage || err.message });
  }
});

app.get('/api/evaluations', async (req, res) => {
  try {
    const query = `SELECT e.id, e.assignment_id, e.score, e.feedback, e.status, e.created_at, e.updated_at,
      ca.course_code, ca.course_name, ca.assignment_title,
      COALESCE(
        CONCAT(i.first_name, ' ', i.last_name),
        CONCAT(s.first_name, ' ', s.last_name),
        u.email,
        s.student_id
      ) AS evaluator_name
      FROM evaluations e
      LEFT JOIN course_assignments ca ON e.assignment_id = ca.id
      LEFT JOIN users u ON e.evaluator_id = u.id
      LEFT JOIN instructors i ON i.user_id = u.id
      LEFT JOIN students s ON s.user_id = u.id
      ORDER BY e.created_at DESC`;
    const [rows] = await pool.query(query);
    return sendResponse(res, 200, 'Evaluations retrieved.', 'ግምገማዎች ተመልሰዋል።', rows);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Unable to retrieve evaluations.', 'ግምገማዎችን ማግኘት አልተቻለም።');
  }
});

app.post('/api/evaluations', authenticate, authorizeRoles('dept_head', 'admin'), async (req, res) => {
  try {
    const { assignment_id, score, feedback = '', status = 'submitted' } = req.body;

    if (!assignment_id || score === undefined) {
      return sendResponse(res, 400, 'assignment_id and score are required.', 'assignment_id እና score ያስፈልጋሉ።');
    }

    const [assignmentRows] = await pool.query('SELECT * FROM course_assignments WHERE id = ? LIMIT 1', [assignment_id]);
    if (!assignmentRows.length) {
      return sendResponse(res, 404, 'Assignment not found.', 'ስራ አልተገኘም።');
    }

    const cappedScore = Math.min(Math.max(Number(score), 0), 30);
    const evaluatorId = req.user.id;
    const evaluatorRole = req.user.role || 'dept_head';

    const [result] = await pool.query(
      'INSERT INTO evaluations (assignment_id, evaluator_id, evaluator_role, score, feedback, status) VALUES (?, ?, ?, ?, ?, ?)',
      [assignment_id, evaluatorId, evaluatorRole, cappedScore, feedback, status]
    );

    await pool.query('UPDATE course_assignments SET status = ? WHERE id = ?', ['evaluated', assignment_id]);

    return sendResponse(res, 201, 'Evaluation submitted successfully.', 'ግምገማ በተሳካ ሁኔታ ተላክቷል።', { id: result.insertId });
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Unable to submit evaluation.', 'ግምገማ ለመላክ አልተቻለም።');
  }
});

app.get('/api/evaluations/template', authenticate, authorizeRoles('dept_head', 'admin'), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM evaluation_templates ORDER BY updated_at DESC LIMIT 1');
    if (!rows.length) {
      // No template exists yet — return an empty object with 200 so frontend can use defaults
      return sendResponse(res, 200, 'No evaluation template found; returning empty.', 'የግምገማ አቅም አልተገኘም፤ ባዶ ነገር ተመልሷል።', {});
    }
    return sendResponse(res, 200, 'Evaluation template loaded.', 'የግምገማ አቅም ተጫኗል።', rows[0]);
  } catch (error) {
    console.error('Evaluation template fetch error:', error?.message || error);
    // Return an empty object so frontend can proceed using local/default template
    return sendResponse(res, 200, 'Evaluation template unavailable; returning empty.', 'የግምገማ አቅም አልተገኘም፤ ባዶ ነገር ተመልሷል።', {});
  }
});

app.post('/api/evaluations/template', authenticate, authorizeRoles('dept_head', 'admin'), async (req, res) => {
  try {
    const { name = 'Student Evaluation Template', template_data } = req.body;
    if (!template_data) {
      return sendResponse(res, 400, 'Template data is required.', 'የአቅም ውሂብ ያስፈልጋል።');
    }
    const [result] = await pool.query(
      'INSERT INTO evaluation_templates (name, template_data, created_by) VALUES (?, ?, ?)',
      [name, JSON.stringify(template_data), req.user.id]
    );
    return sendResponse(res, 201, 'Evaluation template saved.', 'የግምገማ አቅም ተቀምጧል።', { id: result.insertId });
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Unable to save evaluation template.', 'የግምገማ አቅም ለማስቀመጥ አልተቻለም።');
  }
});

app.put('/api/evaluations/template/:id', authenticate, authorizeRoles('dept_head', 'admin'), async (req, res) => {
  try {
    const { name, template_data } = req.body;
    const [rows] = await pool.query('SELECT * FROM evaluation_templates WHERE id = ? LIMIT 1', [req.params.id]);
    if (!rows.length) {
      return sendResponse(res, 404, 'Evaluation template not found.', 'የግምገማ አቅም አልተገኘም።');
    }
    const updateFields = [];
    const values = [];
    if (name) {
      updateFields.push('name = ?');
      values.push(name);
    }
    if (template_data) {
      updateFields.push('template_data = ?');
      values.push(JSON.stringify(template_data));
    }
    if (!updateFields.length) {
      return sendResponse(res, 400, 'No updates provided.', 'ምንም የማስተካከያ መረጃ አልተሰጠም።');
    }
    values.push(req.params.id);
    await pool.query(`UPDATE evaluation_templates SET ${updateFields.join(', ')} WHERE id = ?`, values);
    return sendResponse(res, 200, 'Evaluation template updated.', 'የግምገማ አቅም ተዘምኗል።');
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Unable to update evaluation template.', 'የግምገማ አቅም ለማዘመን አልተቻለም።');
  }
});

const criterionTypes = ['student', 'peer', 'dept_head', 'dean'];

app.get('/api/admin/criteria', authenticate, authorizeRoles('admin', 'systemadmin'), async (req, res) => {
  try {
    const type = req.query.type ? String(req.query.type).trim().toLowerCase() : null;
    if (type && !criterionTypes.includes(type)) return res.status(400).json({ message: 'Invalid evaluator type.' });
    const [rows] = await pool.query(
      `SELECT id, evaluator_type, criterion_text, criterion_text_am, category, weight, is_active, created_at
       FROM evaluation_criteria ${type ? 'WHERE evaluator_type = ?' : ''} ORDER BY evaluator_type ASC, category ASC, id ASC`,
      type ? [type] : []
    );
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Unable to load all evaluation criteria.', error: error.message });
  }
});

app.get('/api/criteria', authenticate, authorizeRoles('student', 'instructor', 'dept_head', 'college_dean', 'dean', 'academic_directorate', 'academic_director', 'directorate', 'admin', 'systemadmin'), async (req, res) => {
  try {
    const type = String(req.query.type || '').trim().toLowerCase();
    if (!criterionTypes.includes(type)) return res.status(400).json({ message: 'A valid evaluator type is required.' });
    const [rows] = await pool.query('SELECT id, evaluator_type, criterion_text, criterion_text_am, category, weight, is_active, created_at FROM evaluation_criteria WHERE evaluator_type = ? AND is_active = 1 ORDER BY category ASC, id ASC', [type]);
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Unable to load evaluation criteria.', error: error.message });
  }
});

app.post('/api/admin/criteria', authenticate, authorizeRoles('admin', 'systemadmin'), async (req, res) => {
  try {
    const evaluatorType = String(req.body.evaluator_type || '').trim().toLowerCase();
    const criterionText = String(req.body.criterion_text || '').trim();
    const criterionTextAm = String(req.body.criterion_text_am || '').trim();
    const category = String(req.body.category || 'General').trim() || 'General';
    const weight = Number(req.body.weight ?? 5);
    if (!criterionTypes.includes(evaluatorType) || !criterionText || criterionText.length > 255 || !Number.isInteger(weight) || weight < 1) {
      return res.status(400).json({ message: 'evaluator_type, criterion_text, and a positive whole-number weight are required.' });
    }
    if (criterionTextAm.length > 255) return res.status(400).json({ message: 'criterion_text_am must be 255 characters or fewer.' });
    const [result] = await pool.query('INSERT INTO evaluation_criteria (evaluator_type, criterion_text, criterion_text_am, category, weight, is_active) VALUES (?, ?, ?, ?, ?, 1)', [evaluatorType, criterionText, criterionTextAm || null, category, weight]);
    return res.status(201).json({ id: result.insertId, evaluator_type: evaluatorType, criterion_text: criterionText, criterion_text_am: criterionTextAm || null, category, weight, is_active: 1 });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to create evaluation criterion.', error: error.message });
  }
});

app.put('/api/admin/criteria/:id', authenticate, authorizeRoles('admin', 'systemadmin'), async (req, res) => {
  try {
    const criterionId = Number(req.params.id);
    const fields = [];
    const values = [];
    if (req.body.criterion_text !== undefined) { const text = String(req.body.criterion_text).trim(); if (!text || text.length > 255) return res.status(400).json({ message: 'criterion_text must be 1-255 characters.' }); fields.push('criterion_text = ?'); values.push(text); }
    if (req.body.criterion_text_am !== undefined) { const textAm = String(req.body.criterion_text_am || '').trim(); if (textAm.length > 255) return res.status(400).json({ message: 'criterion_text_am must be 255 characters or fewer.' }); fields.push('criterion_text_am = ?'); values.push(textAm || null); }
    if (req.body.category !== undefined) { fields.push('category = ?'); values.push(String(req.body.category).trim() || 'General'); }
    if (req.body.weight !== undefined) { const weight = Number(req.body.weight); if (!Number.isInteger(weight) || weight < 1) return res.status(400).json({ message: 'weight must be a positive whole number.' }); fields.push('weight = ?'); values.push(weight); }
    if (req.body.is_active !== undefined) { fields.push('is_active = ?'); values.push(req.body.is_active ? 1 : 0); }
    if (!Number.isInteger(criterionId) || criterionId <= 0 || !fields.length) return res.status(400).json({ message: 'A valid criterion id and update are required.' });
    values.push(criterionId);
    const [result] = await pool.query(`UPDATE evaluation_criteria SET ${fields.join(', ')} WHERE id = ?`, values);
    if (!result.affectedRows) return res.status(404).json({ message: 'Evaluation criterion not found.' });
    return res.json({ success: true, id: criterionId });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to update evaluation criterion.', error: error.message });
  }
});

app.delete('/api/admin/criteria/:id', authenticate, authorizeRoles('admin', 'systemadmin'), async (req, res) => {
  try {
    const criterionId = Number(req.params.id);
    const [result] = await pool.query('UPDATE evaluation_criteria SET is_active = 0 WHERE id = ?', [criterionId]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Evaluation criterion not found.' });
    return res.json({ success: true, message: 'Evaluation criterion disabled.' });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to disable evaluation criterion.', error: error.message });
  }
});

app.post('/api/evaluations/publish-dispatch', authenticate, authorizeRoles('dept_head', 'admin'), async (req, res) => {
  try {
    const { department_id, program_type = null, year_level, semester, section = null, academic_year } = req.body;
    const departmentId = await resolveDepartmentId(department_id || req.user.department_id || req.user.department);
    if (!departmentId || !year_level || !semester || !academic_year) return res.status(400).json({ message: 'Batch department, year level, semester, and academic year are required.' });

    const [existing] = await pool.query(
      `SELECT id FROM evaluation_dispatches
       WHERE department_id = ? AND program_type <=> ? AND year_level = ? AND semester = ? AND student_group <=> ? AND academic_year = ?
       LIMIT 1`,
      [departmentId, program_type, year_level, semester, section, academic_year]
    );
    if (existing.length) {
      await pool.query('UPDATE evaluation_dispatches SET is_student_published = 1, status = \'pending\' WHERE id = ?', [existing[0].id]);
      await notifyStudentCohort({
        departmentId,
        programType: program_type,
        yearLevel: year_level,
        semester,
        section,
        title: 'New evaluation forms available',
        message: 'New instructor evaluation forms are available. Please complete them.',
        type: 'evaluation_dispatch',
      });
      return res.json({ success: true, dispatchId: existing[0].id, updated: true });
    }

    const [result] = await pool.query(
      `INSERT INTO evaluation_dispatches (department_id, program_type, year_level, semester, student_group, academic_year, is_student_published, status, created_by, payload)
       VALUES (?, ?, ?, ?, ?, ?, 1, 'pending', ?, ?)`,
      [departmentId, program_type, year_level, semester, section, academic_year, req.user.id, JSON.stringify({ source: 'batch_publish' })]
    );
    await notifyStudentCohort({
      departmentId,
      programType: program_type,
      yearLevel: year_level,
      semester,
      section,
      title: 'New evaluation forms available',
      message: 'New instructor evaluation forms are available. Please complete them.',
      type: 'evaluation_dispatch',
    });
    return res.status(201).json({ success: true, dispatchId: result.insertId, updated: false });
  } catch (error) {
    console.error('Batch dispatch publish failed:', error);
    return res.status(500).json({ message: 'Unable to publish evaluation batch.', error: error.message });
  }
});

app.get('/api/student/evaluations', authenticate, authorizeRoles('student'), async (req, res) => {
  try {
    const [[student]] = await pool.query('SELECT id, department_id, year_level, semester, section, program_type FROM students WHERE user_id = ? LIMIT 1', [req.user.id]);
    if (!student) return res.json([]);
    const [rows] = await pool.query(
      `SELECT DISTINCT ca.id AS assignment_id, ed.id AS dispatch_id, c.code AS course_code, c.name AS course_name,
        ca.year_level, ca.semester, ca.section, ca.program_type,
        CONCAT(COALESCE(i.first_name, ''), ' ', COALESCE(i.last_name, '')) AS instructor_name
       FROM course_assignments ca
       INNER JOIN courses c ON c.id = ca.course_id
       LEFT JOIN instructors i ON i.id = ca.instructor_id
       INNER JOIN evaluation_dispatches ed ON ed.department_id = ca.department_id
         AND ed.year_level = ca.year_level AND ed.semester = ca.semester
         AND ed.academic_year = ca.academic_year AND ed.is_student_published = 1
         AND (ed.program_type IS NULL OR ed.program_type = ca.program_type)
         AND (ed.student_group IS NULL OR ed.student_group = ca.section)
       WHERE ca.department_id = ? AND ca.year_level = ? AND ca.semester = ?
         AND ca.section = ? AND ca.program_type = ?
       ORDER BY c.code ASC`,
      [student.department_id, student.year_level, student.semester, student.section, student.program_type]
    );
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Unable to load student evaluations.', error: error.message });
  }
});

app.delete('/api/courses/assign/:assignmentId', authenticate, authorizeRoles('dept_head', 'admin'), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const assignmentId = Number(req.params.assignmentId);
    if (!Number.isInteger(assignmentId) || assignmentId <= 0) return res.status(400).json({ message: 'Invalid assignment ID.' });
    const [rows] = await connection.query('SELECT id, department_id, course_id, instructor_id FROM course_assignments WHERE id = ? LIMIT 1', [assignmentId]);
    if (!rows.length) return res.status(404).json({ message: 'Course assignment not found.' });
    const assignment = rows[0];
    if (req.user.role === 'dept_head' && Number(assignment.department_id) !== Number(req.user.department_id)) return res.status(403).json({ message: 'You can only delete assignments in your department.' });

    const [submittedStudents] = await connection.query('SELECT ses.id FROM student_evaluation_submissions ses INNER JOIN evaluation_dispatches ed ON ed.id = ses.dispatch_id WHERE ed.assignment_id = ? LIMIT 1', [assignmentId]);
    const [submittedPeers] = await connection.query('SELECT pes.id FROM peer_evaluation_submissions pes INNER JOIN peer_evaluations pe ON pe.id = pes.peer_evaluation_id WHERE pe.course_id = ? AND pe.evaluatee_id = ? LIMIT 1', [assignment.course_id, assignment.instructor_id]);
    if (submittedStudents.length || submittedPeers.length) return res.status(400).json({ success: false, message: 'Cannot delete this assignment because evaluations have already been submitted.' });

    await connection.beginTransaction();
    await connection.query('DELETE FROM evaluation_dispatches WHERE assignment_id = ?', [assignmentId]);
    await connection.query('DELETE FROM peer_evaluations WHERE course_id = ? AND evaluatee_id = ?', [assignment.course_id, assignment.instructor_id]);
    await connection.query('DELETE FROM course_assignments WHERE id = ?', [assignmentId]);
    await connection.commit();
    return res.json({ success: true, message: 'Course assignment deleted successfully.' });
  } catch (error) {
    try { await connection.rollback(); } catch (rollbackError) { console.error('Assignment delete rollback failed:', rollbackError); }
    return res.status(500).json({ message: 'Unable to delete course assignment.', error: error.message });
  } finally { connection.release(); }
});

app.post('/api/evaluations/dispatch', authenticate, authorizeRoles('dept_head', 'admin'), async (req, res) => {
  try {
    const {
      template_id = null,
      student_id = null,
      student_identifier = null,
      student_group = null,
      course_code = null,
      course_name = null,
      academic_year = null,
      semester = null,
      year_level = null,
      student_identifier_text = null,
      payload = {},
    } = req.body;

    if (!course_code || !course_name || !academic_year || !semester || !year_level) {
      return sendResponse(res, 400, 'Required dispatch fields are missing.', 'የማስተላለፊያ አስፈላጊ መረጃዎች የጎደሉት ናቸው።');
    }

    // If a course_code is provided, attempt to dispatch to all students assigned to that course
    const [assignedStudents] = await pool.query(
      `SELECT DISTINCT s.id AS student_id, s.user_id
       FROM course_assignments ca
       INNER JOIN students s ON s.id = ca.student_id
       WHERE ca.course_code = ? AND ca.student_id IS NOT NULL`,
      [course_code]
    );

    if (assignedStudents.length) {
      const insertedIds = [];
      for (const row of assignedStudents) {
        try {
          const [r] = await pool.query(
            'INSERT INTO evaluation_dispatches (template_id, student_id, student_identifier, course_code, course_name, academic_year, semester, year_level, student_group, student_identifier_text, created_by, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [template_id, row.student_id, null, course_code, course_name, academic_year, semester, year_level, student_group, student_identifier_text, req.user.id, JSON.stringify(payload)]
          );
          insertedIds.push(r.insertId);
        } catch (err) {
          console.warn('Failed to insert dispatch for student', row.student_id, err.message || err);
        }
      }
      await createNotifications({
        userIds: assignedStudents.map((student) => student.user_id),
        title: 'New evaluation form assigned',
        message: `Please complete the ${course_name} instructor evaluation.`,
        type: 'evaluation_dispatch',
      });
      return sendResponse(res, 201, 'Student evaluations dispatched to course students.', 'የተማሪ ግምገማዎች ወደ ኮርስ ተማሪዎች ተልከዋል።', { created: insertedIds.length, ids: insertedIds });
    }

    // Fallback: create a generic dispatch (e.g., for a group or individual identifier)
    const [result] = await pool.query(
      'INSERT INTO evaluation_dispatches (template_id, student_id, student_identifier, course_code, course_name, academic_year, semester, year_level, student_group, student_identifier_text, created_by, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [template_id, student_id, student_identifier, course_code, course_name, academic_year, semester, year_level, student_group, student_identifier_text, req.user.id, JSON.stringify(payload)]
    );

    return sendResponse(res, 201, 'Student evaluation dispatched successfully.', 'የተማሪ ግምገማ በተሳካ ሁኔታ ተላክቷል።', { id: result.insertId });
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Unable to dispatch evaluation.', 'ግምገማ ለማስተላለፍ አልተቻለም።');
  }
});

app.get('/api/student/profile', authenticate, authorizeRoles('student'), async (req, res) => {
  try {
    if (!req.user) {
      throw new Error('Authenticated user is required');
    }

    const [rows] = await pool.query(
      `SELECT u.id AS user_id,
        COALESCE(u.email, s.student_id, '') AS username,
        s.id AS student_row_id,
        s.student_id,
        s.first_name,
        s.last_name,
        s.department_id,
        TRIM(CONCAT(COALESCE(s.first_name, ''), ' ', COALESCE(s.last_name, ''))) AS full_name,
        d.name AS department_name,
        s.program_type,
        s.program_type AS program,
        s.year_level,
        s.semester,
        s.section
      FROM users u
      LEFT JOIN students s ON u.id = s.user_id
      LEFT JOIN departments d ON s.department_id = d.id
      WHERE u.id = ? LIMIT 1`,
      [req.user.id]
    );

    if (!rows.length) {
      return sendResponse(res, 200, 'Student profile retrieved successfully.', 'የተማሪ መረጃ በትክክል ተቀርቧል።', {
        user_id: req.user.id,
        student_id: null,
        username: req.user.username,
        full_name: req.user.username,
        department_id: null,
        department_name: null,
        program_type: null,
        year_level: null,
        semester: null,
        section: null,
      });
    }

    const profile = rows[0];
    const fullName = profile.full_name && profile.full_name.trim()
      ? profile.full_name
      : (profile.first_name && profile.last_name)
        ? `${profile.first_name} ${profile.last_name}`
        : profile.username || 'Student';

    profile.full_name = fullName;
    profile.first_name = profile.first_name || profile.username || '';
    profile.last_name = profile.last_name || '';
    profile.program = profile.program_type || null;

    return sendResponse(res, 200, 'Student profile retrieved successfully.', 'የተማሪ መረጃ በትክክል ተቀርቧል።', profile);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Unable to load student profile.',
    });
  }
});

app.get('/api/instructor/profile', authenticate, authorizeRoles('instructor'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
        i.id,
        CONCAT(COALESCE(i.first_name, ''), ' ', COALESCE(i.last_name, '')) AS full_name,
        d.name AS department_name,
        i.employee_id,
        i.gender
      FROM instructors i
      LEFT JOIN departments d ON i.department_id = d.id
      WHERE i.user_id = ? LIMIT 1`,
      [req.user.id]
    );

    if (!rows.length) {
      return sendResponse(res, 404, 'Instructor profile not found.', 'የመምህር መገለጫ አልተገኘም።');
    }

    return sendResponse(res, 200, 'Instructor profile retrieved successfully.', 'የመምህር መገለጫ ተቀርቧል።', rows[0]);
  } catch (error) {
    console.error('Instructor profile error:', error);
    return res.status(500).json({ message: 'Unable to load instructor profile.' });
  }
});

app.get('/api/instructor/performance-summary', authenticate, authorizeRoles('instructor'), async (req, res) => {
  try {
    const [instructorRows] = await pool.query('SELECT id, department_id FROM instructors WHERE user_id = ? LIMIT 1', [req.user.id]);
    if (!instructorRows.length) {
      return sendResponse(res, 404, 'Instructor profile not found.', 'የመምህር መገለጫ አልተገኘም።');
    }

    const instructor = instructorRows[0];
    const [summaryRows] = await pool.query(
      `SELECT student_raw_percentage, student_weighted_score,
              dept_head_raw_percentage, dept_head_weighted_score,
              peer_raw_percentage, peer_weighted_score, total_weighted_score,
              is_published
       FROM evaluation_summaries
       WHERE instructor_id = ? AND is_published = 1
       LIMIT 1`,
      [instructor.id]
    );
    if (!summaryRows.length) return res.json({ published: false });

    const publishedSummary = summaryRows[0];
    return res.json({
      published: true,
      totalWeightedScore: Number(publishedSummary.total_weighted_score || 0),
      breakdown: {
        student: { rawPercentage: Number(publishedSummary.student_raw_percentage || 0), weightedContribution: Number(publishedSummary.student_weighted_score || 0), weight: 50 },
        deptHead: { rawPercentage: Number(publishedSummary.dept_head_raw_percentage || 0), weightedContribution: Number(publishedSummary.dept_head_weighted_score || 0), weight: 30 },
        peer: { rawPercentage: Number(publishedSummary.peer_raw_percentage || 0), weightedContribution: Number(publishedSummary.peer_weighted_score || 0), weight: 20 },
      },
    });

    const [studentRows] = await pool.query(
      `SELECT ses.score, ses.feedback, ses.responses, ed.course_name, ses.created_at
       FROM student_evaluation_submissions ses
       JOIN evaluation_dispatches ed ON ed.id = ses.dispatch_id
       LEFT JOIN course_assignments ca ON (ca.id = ed.assignment_id OR (ca.student_id = ed.student_id AND ca.course_id = ed.course_id))
       WHERE ca.instructor_id = ? AND ses.status = 'submitted'
       ORDER BY ses.created_at DESC`,
      [instructor.id]
    );
    const [deptHeadRows] = await pool.query(
      `SELECT dhe.total_score AS score, dhe.criteria_scores, dhe.created_at
       FROM dept_head_evaluations dhe
       WHERE dhe.instructor_id = ? AND LOWER(TRIM(dhe.status)) IN ('submitted', 'completed', 'approved')
       ORDER BY dhe.created_at DESC`,
      [instructor.id]
    );
    const [peerRows] = await pool.query(
      `SELECT pes.score, pes.strengths, pes.suggestions, pes.responses, pes.created_at
       FROM peer_evaluation_submissions pes
       JOIN peer_evaluations pe ON pe.id = pes.peer_evaluation_id
       WHERE pe.evaluatee_id = ? AND LOWER(TRIM(pes.status)) IN ('submitted', 'completed', 'approved')
       ORDER BY pes.created_at DESC`,
      [instructor.id]
    );

    const parseJson = (value) => {
      if (!value) return {};
      if (typeof value === 'object') return value;
      try { return JSON.parse(value); } catch { return {}; }
    };
    const average = (rows) => rows.length ? rows.reduce((total, row) => total + Number(row.score || 0), 0) / rows.length : 0;
    const scores = { student: average(studentRows), deptHead: average(deptHeadRows), peer: average(peerRows) };
    const weights = { student: 0.5, deptHead: 0.3, peer: 0.2 };
    const totalScore = (scores.student * weights.student) + (scores.deptHead * weights.deptHead) + (scores.peer * weights.peer);
    const status = totalScore >= 85 ? 'Excellent' : totalScore >= 70 ? 'Good' : totalScore >= 50 ? 'Needs Improvement' : 'At Risk';
    const badgeColor = totalScore >= 85 ? 'emerald' : totalScore >= 70 ? 'blue' : totalScore >= 50 ? 'amber' : 'red';
    const strengths = [];
    const improvements = [];
    const addUnique = (list, value) => {
      const text = String(value || '').trim();
      if (text && !list.includes(text)) list.push(text);
    };
    const classifyRemark = (text, score, fallback) => {
      const normalized = String(text || '').trim();
      if (!normalized) {
        addUnique(score >= 70 ? strengths : improvements, fallback);
        return;
      }
      const indicatesImprovement = /improv|enhanc|weak|need|lack|late|timely|คว|should|suggest/i.test(normalized);
      addUnique(indicatesImprovement || score < 50 ? improvements : strengths, normalized);
    };

    studentRows.forEach((row) => classifyRemark(row.feedback, Number(row.score || 0), 'Maintains positive engagement with students.'));
    deptHeadRows.forEach((row) => {
      const criteria = parseJson(row.criteria_scores);
      classifyRemark(criteria.remarks || criteria.feedback, Number(row.score || 0), 'Demonstrates consistent professional performance.');
    });
    peerRows.forEach((row) => {
      addUnique(strengths, row.strengths);
      addUnique(improvements, row.suggestions);
    });

    if (!strengths.length) addUnique(strengths, 'No positive highlights have been recorded yet.');
    if (!improvements.length) addUnique(improvements, 'No improvement areas have been recorded yet.');

    return sendResponse(res, 200, 'Performance summary retrieved.', 'የአፈጻጸም ማጠቃለያ ተመለሰ።', {
      totalWeightedScore: Number(totalScore.toFixed(2)),
      status,
      badgeColor,
      feedback: { strengths, improvements },
    });
  } catch (error) {
    console.error('Performance dashboard error:', error);
    return sendResponse(res, 500, 'Unable to retrieve performance dashboard.', 'የአፈጻጸም ዳሽቦርድን ማግኘት አልተቻለም።');
  }
});

app.get('/api/student/pending-evaluations', authenticate, authorizeRoles('student'), async (req, res) => {
  try {
    if (!req.user) {
      console.warn('Request missing authenticated user for pending evaluations');
      return res.status(200).json([]);
    }

    const [studentRows] = await pool.query(
      'SELECT department_id, year_level, semester, section FROM students WHERE user_id = ? LIMIT 1',
      [req.user.id]
    );

    if (!studentRows.length) {
      return res.status(200).json([]);
    }

    const student = studentRows[0];
    const normalizedSection = normalizeSectionValue(student.section);
    const [rows] = await pool.query(
      `SELECT c.code AS course_code, c.name AS course_name,
        CONCAT(COALESCE(i.first_name, ''), ' ', COALESCE(i.last_name, '')) AS instructor_name,
        DATE_FORMAT(DATE_ADD(ca.created_at, INTERVAL 7 DAY), '%Y-%m-%d') AS deadline,
        ca.id AS assignment_id,
        ca.is_published,
        ca.is_student_published,
        ca.is_peer_published
      FROM course_assignments ca
      JOIN courses c ON ca.course_id = c.id
      LEFT JOIN instructors i ON ca.instructor_id = i.id
      WHERE ca.department_id = ?
        AND LOWER(TRIM(ca.year_level)) = LOWER(TRIM(?))
        AND LOWER(TRIM(ca.semester)) = LOWER(TRIM(?))
        AND LOWER(TRIM(REPLACE(REPLACE(ca.section, 'Section ', ''), 'section ', ''))) = LOWER(?)
        AND ca.is_student_published = 1
      ORDER BY c.code ASC`,
      [student.department_id, student.year_level, student.semester, normalizedSection]
    );

    return sendResponse(res, 200, 'Pending evaluations retrieved successfully.', 'የቅድሚያ ግምገማዎች በትክክል ተቀርቧል።', rows);
  } catch (error) {
    console.error(error);
    return res.status(200).json([]);
  }
});

app.get('/api/student/evaluations/pending', authenticate, authorizeRoles('student'), async (req, res) => {
  try {
    if (!req.user) {
      console.warn('Pending evaluations request missing authenticated user.');
      return res.status(200).json([]);
    }

    const [studentRows] = await pool.query('SELECT id FROM students WHERE user_id = ? LIMIT 1', [req.user.id]);
    if (!studentRows.length) {
      return res.status(200).json([]);
    }

    const student = studentRows[0];
    const [rows] = await pool.query(
      `SELECT ed.id,
        ed.template_id,
        ed.student_id,
        ed.student_identifier,
        COALESCE(ed.course_code, c.code) AS course_code,
        COALESCE(ed.course_name, c.name) AS course_name,
        ed.academic_year,
        ed.semester,
        ed.year_level,
        ed.student_group,
        ed.student_identifier_text,
        ed.payload,
        ed.status,
        ed.created_at,
        CONCAT(COALESCE(i.first_name, ''), ' ', COALESCE(i.last_name, '')) AS instructor_name,
        ses.score AS total_score,
        ses.feedback,
        ses.responses,
        ses.status AS submission_status,
        ses.id AS submission_id,
        CASE WHEN ses.id IS NOT NULL THEN 1 ELSE 0 END AS is_evaluated
      FROM evaluation_dispatches ed
      LEFT JOIN courses c ON ed.course_id = c.id
      LEFT JOIN course_assignments ca ON (ca.id = ed.assignment_id OR (ca.student_id = ed.student_id AND ca.course_id = ed.course_id))
      LEFT JOIN instructors i ON ca.instructor_id = i.id
      LEFT JOIN student_evaluation_submissions ses ON ses.dispatch_id = ed.id
      WHERE ed.student_id = ?
      ORDER BY ed.created_at DESC`,
      [student.id]
    );

    const normalized = rows.map(row => ({
      ...row,
      total_score: row.total_score !== null ? Number(row.total_score) : 0,
      is_evaluated: Boolean(row.is_evaluated),
      responses: row.responses ? (typeof row.responses === 'string' ? JSON.parse(row.responses) : row.responses) : {},
    }));

    return res.status(200).json(normalized);
  } catch (error) {
    console.error('Pending Evaluations Error:', error);
    return res.status(200).json([]);
  }
});

app.get('/api/student/evaluations/available', authenticate, authorizeRoles('student'), async (req, res) => {
  try {
    const [studentRows] = await pool.query(
      'SELECT department_id, year_level, semester, section FROM students WHERE user_id = ? LIMIT 1',
      [req.user.id]
    );

    if (!studentRows.length) {
      return sendResponse(res, 200, 'No student record found.', 'የተማሪ መዝገብ አልተገኘም።', []);
    }

    const student = studentRows[0];
    const [rows] = await pool.query(
      `SELECT
          ca.id AS assignment_id,
          c.code AS course_code,
          c.name AS course_name,
          CONCAT(COALESCE(i.first_name, ''), ' ', COALESCE(i.last_name, '')) AS instructor_name,
          DATE_FORMAT(DATE_ADD(COALESCE(ca.created_at, NOW()), INTERVAL 7 DAY), '%Y-%m-%d') AS deadline
        FROM course_assignments ca
        JOIN courses c ON ca.course_id = c.id
        LEFT JOIN instructors i ON ca.instructor_id = i.id
        WHERE ca.department_id = ?
          AND ca.is_student_published = 1
        ORDER BY c.code ASC`,
      [student.department_id]
    );

    return sendResponse(res, 200, 'Available student evaluations retrieved successfully.', 'ለተማሪዎች የሚገኙ ግምገማዎች ተመለሰ።', rows);
  } catch (error) {
    console.error('Available Student Evaluations Error:', error);
    return sendResponse(res, 500, 'Unable to load available student evaluations.', 'ለተማሪዎች የሚገኙ ግምገማዎችን ማግኘት አልቻለም።');
  }
});

app.post('/api/student/evaluations/submit', authenticate, authorizeRoles('student'), async (req, res) => {
  try {
    const { dispatch_id, score, feedback = '', responses = {} } = req.body;
    if (!dispatch_id) {
      return sendResponse(res, 400, 'Dispatch ID is required.', 'Dispatch ID ያስፈልጋል።');
    }

    const scores = Array.isArray(responses)
      ? responses
      : (responses && typeof responses === 'object')
        ? Object.values(responses)
        : [];

    const computedScore = scores
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0)
      .reduce((sum, value) => sum + value, 0);
    const count = scores.filter((value) => Number.isFinite(Number(value)) && Number(value) > 0).length;
    const normalizedScore = count ? (computedScore / count) * 20 : 0;
    const finalScore = score === undefined ? normalizedScore : Number(score);

    const [studentRows] = await pool.query("SELECT id, department_id, CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')) AS student_name FROM students WHERE user_id = ? LIMIT 1", [req.user.id]);
    if (!studentRows.length) {
      return sendResponse(res, 404, 'Student record not found.', 'የተማሪ መረጃ አልተገኘም።');
    }

    const student = studentRows[0];
    const [dispatchRows] = await pool.query('SELECT * FROM evaluation_dispatches WHERE id = ? AND student_id = ? LIMIT 1', [dispatch_id, student.id]);
    if (!dispatchRows.length) {
      return sendResponse(res, 404, 'Dispatch not found.', 'Dispatch አልተገኘም።');
    }

    const dispatch = dispatchRows[0];
    const responsePayload = JSON.stringify(
      responses && typeof responses === 'object' ? responses : {}
    );
    const [existingSubmission] = await pool.query(
      'SELECT id FROM student_evaluation_submissions WHERE dispatch_id = ? LIMIT 1',
      [dispatch.id]
    );
    const submissionWasUpdated = existingSubmission.length > 0;
    let result;
    if (submissionWasUpdated) {
      await pool.query(
        'UPDATE student_evaluation_submissions SET score = ?, feedback = ?, responses = ?, status = ? WHERE dispatch_id = ?',
        [finalScore, feedback, responsePayload, 'submitted', dispatch.id]
      );
      result = { insertId: existingSubmission[0].id };
    } else {
      [result] = await pool.query(
        'INSERT INTO student_evaluation_submissions (dispatch_id, student_id, student_name, score, feedback, responses, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [dispatch.id, student.id, student.student_name || req.user.username, finalScore, feedback, responsePayload, 'submitted']
      );
    }

    await pool.query('UPDATE evaluation_dispatches SET status = ? WHERE id = ?', ['submitted', dispatch.id]);

    try {
      await notifyDepartmentHead({
        departmentId: student.department_id,
        title: submissionWasUpdated ? 'Student evaluation updated' : 'Student evaluation submitted',
        message: `${student.student_name || 'A student'} ${submissionWasUpdated ? 'updated' : 'submitted'} an evaluation for ${dispatch.course_name || 'your course'}.`,
      });
    } catch (notificationError) {
      console.error('Student evaluation notification failed:', notificationError);
    }

    return sendResponse(res, 201, 'Student evaluation submitted.', 'የተማሪ ግምገማ ተላክቷል።', { id: result.insertId });
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Unable to submit student evaluation.', 'የተማሪ ግምገማ ለማስገባት አልተቻለም።');
  }
});

app.post('/api/evaluations/submit-student', authenticate, authorizeRoles('student'), async (req, res) => {
  try {
    const { dispatch_id, score, feedback = '', responses = {} } = req.body;
    if (!dispatch_id) {
      return sendResponse(res, 400, 'Dispatch ID is required.', 'Dispatch ID ያስፈልጋል።');
    }

    // Validate that responses are not empty
    const responseValues = Array.isArray(responses) ? responses : (responses && typeof responses === 'object' ? Object.values(responses) : []);
    if (responseValues.length === 0) {
      return sendResponse(res, 400, 'Please answer all criteria questions before submitting.', 'ሁሉንም ጥያቄዎች መልስ ከመስጠት በፊት እባክዎ ያስገቡ።');
    }

    const scores = Array.isArray(responses)
      ? responses
      : (responses && typeof responses === 'object')
        ? Object.values(responses)
        : [];

    const computedScore = scores
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0)
      .reduce((sum, value) => sum + value, 0);
    const count = scores.filter((value) => Number.isFinite(Number(value)) && Number(value) > 0).length;
    const normalizedScore = count ? (computedScore / count) * 20 : 0;
    const finalScore = score === undefined ? normalizedScore : Number(score);

    const [studentRows] = await pool.query("SELECT id, department_id, CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')) AS student_name FROM students WHERE user_id = ? LIMIT 1", [req.user.id]);
    if (!studentRows.length) {
      return sendResponse(res, 404, 'Student record not found.', 'የተማሪ መረጃ አልተገኘም።');
    }

    const student = studentRows[0];
    const [dispatchRows] = await pool.query('SELECT * FROM evaluation_dispatches WHERE id = ? AND student_id = ? LIMIT 1', [dispatch_id, student.id]);
    if (!dispatchRows.length) {
      return sendResponse(res, 404, 'Dispatch not found.', 'Dispatch አልተገኘም።');
    }

    const dispatch = dispatchRows[0];
    const responsePayload = JSON.stringify(
      responses && typeof responses === 'object' ? responses : {}
    );

    // Check if submission already exists for this dispatch
    const [existingSubmission] = await pool.query(
      'SELECT id FROM student_evaluation_submissions WHERE dispatch_id = ? LIMIT 1',
      [dispatch.id]
    );
    const submissionWasUpdated = existingSubmission.length > 0;

    let result;
    if (submissionWasUpdated) {
      // Update existing submission
      await pool.query(
        'UPDATE student_evaluation_submissions SET score = ?, feedback = ?, responses = ?, status = ? WHERE dispatch_id = ?',
        [finalScore, feedback, responsePayload, 'submitted', dispatch.id]
      );
      result = { insertId: existingSubmission[0].id };
    } else {
      // Insert new submission
      [result] = await pool.query(
        'INSERT INTO student_evaluation_submissions (dispatch_id, student_id, student_name, score, feedback, responses, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [dispatch.id, student.id, student.student_name || req.user.username, finalScore, feedback, responsePayload, 'submitted']
      );
    }

    await pool.query('UPDATE evaluation_dispatches SET status = ? WHERE id = ?', ['submitted', dispatch.id]);

    try {
      await notifyDepartmentHead({
        departmentId: student.department_id,
        title: submissionWasUpdated ? 'Student evaluation updated' : 'Student evaluation submitted',
        message: `${student.student_name || 'A student'} ${submissionWasUpdated ? 'updated' : 'submitted'} an evaluation for ${dispatch.course_name || 'your course'}.`,
      });
    } catch (notificationError) {
      console.error('Student evaluation notification failed:', notificationError);
    }

    return sendResponse(res, 201, 'Student evaluation submitted.', 'የተማሪ ግምገማ ተላክቷል።', { id: result.insertId });
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Unable to submit student evaluation.', 'የተማሪ ግምገማ ለማስገባት አልተቻለም።');
  }
});

app.post('/api/evaluations/submit-peer', authenticate, authorizeRoles('instructor', 'dept_head', 'admin'), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { peer_evaluation_id, score, strengths = '', suggestions = '', responses = {} } = req.body;
    if (!peer_evaluation_id) {
      return sendResponse(res, 400, 'Peer evaluation ID is required.', 'Peer evaluation ID ያስፈልጋል።');
    }

    // Validate that responses are not empty
    const responseValues = Array.isArray(responses) ? responses : (responses && typeof responses === 'object' ? Object.values(responses) : []);
    if (responseValues.length === 0) {
      return sendResponse(res, 400, 'Please answer all criteria questions before submitting.', 'ሁሉንም ጥያቄዎች መልስ ከመስጠት በፊት እባክዎ ያስገቡ።');
    }

    const scores = Array.isArray(responses)
      ? responses
      : (responses && typeof responses === 'object')
        ? Object.values(responses)
        : [];

    const computedScore = scores
      .map((value) => {
        if (typeof value === 'string' && value.trim().toUpperCase() === 'NA') return null;
        return Number(value);
      })
      .filter((value) => Number.isFinite(value) && value > 0)
      .reduce((sum, value) => sum + value, 0);
    const count = scores
      .map((value) => {
        if (typeof value === 'string' && value.trim().toUpperCase() === 'NA') return null;
        return Number(value);
      })
      .filter((value) => Number.isFinite(value) && value > 0).length;
    const normalizedScore = count ? (computedScore / count) * 20 : 0;
    const finalScore = score === undefined ? normalizedScore : Number(score);

    const [peerRows] = await connection.query(
      `SELECT pe.*, target.id AS target_instructor_id
       FROM peer_evaluations pe
       INNER JOIN instructors target ON target.id = pe.evaluatee_id
       WHERE pe.id = ? AND pe.evaluator_id = ? LIMIT 1`,
      [peer_evaluation_id, req.user.id]
    );
    if (!peerRows.length) {
      return sendResponse(res, 404, 'Peer evaluation assignment was not found for this evaluator.', 'የባልደረባ ግምገማ ለዚህ ገምጋሚ አልተገኘም።');
    }

    const peerEval = peerRows[0];
    const responsePayload = JSON.stringify(
      responses && typeof responses === 'object' ? responses : {}
    );

    // Check if submission already exists for this peer evaluation and evaluator
    await connection.beginTransaction();
    const [existingSubmission] = await connection.query(
      'SELECT id FROM peer_evaluation_submissions WHERE peer_evaluation_id = ? AND evaluator_id = ? LIMIT 1',
      [peerEval.id, req.user.id]
    );

    let result;
    if (existingSubmission.length > 0) {
      // Update existing submission
      await connection.query(
        'UPDATE peer_evaluation_submissions SET evaluatee_id = ?, score = ?, strengths = ?, suggestions = ?, responses = ?, status = ? WHERE peer_evaluation_id = ? AND evaluator_id = ?',
        [peerEval.evaluatee_id, finalScore, strengths, suggestions, responsePayload, 'submitted', peerEval.id, req.user.id]
      );
      result = { insertId: existingSubmission[0].id };
    } else {
      // Insert new submission
      [result] = await connection.query(
        'INSERT INTO peer_evaluation_submissions (peer_evaluation_id, evaluator_id, evaluatee_id, score, strengths, suggestions, responses, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [peerEval.id, req.user.id, peerEval.evaluatee_id, finalScore, strengths, suggestions, responsePayload, 'submitted']
      );
    }

    await connection.query('UPDATE peer_evaluations SET status = ? WHERE id = ?', ['submitted', peerEval.id]);
    await connection.commit();

    try {
      const [[evaluatee]] = await pool.query(
        'SELECT user_id, department_id, CONCAT(COALESCE(first_name, \'\'), \' \', COALESCE(last_name, \'\')) AS instructor_name FROM instructors WHERE id = ? LIMIT 1',
        [peerEval.evaluatee_id]
      );
      if (evaluatee?.department_id) {
        const peerMessage = `${req.user.username || 'An instructor'} completed a peer evaluation for ${evaluatee.instructor_name || 'an instructor'}.`;
        const [headRows] = await pool.query(
          `SELECT i.user_id
           FROM instructors i
           INNER JOIN users u ON u.id = i.user_id
           WHERE i.department_id = ? AND LOWER(u.role) IN ('dept_head', 'department_head')
             AND LOWER(COALESCE(u.status, 'active')) = 'active'`,
          [evaluatee.department_id]
        );
        await createNotifications({
          userIds: [evaluatee.user_id, ...headRows.map((head) => head.user_id)],
          title: 'Peer evaluation completed',
          message: peerMessage,
          type: 'peer_evaluation_completed',
        });
      }
    } catch (notificationError) {
      console.error('Peer evaluation notification failed:', notificationError);
    }

    return sendResponse(res, 201, 'Peer evaluation submitted.', 'የባልደረባ ግምገባ ተላክቷል።', { id: result.insertId });
  } catch (error) {
    try { await connection.rollback(); } catch (rollbackError) { console.error('Peer submission rollback failed:', rollbackError); }
    console.error('Peer evaluation submission failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to submit peer evaluation.', error: error.message });
  } finally {
    connection.release();
  }
});

// List evaluation dispatches (admin/dept_head/instructor)
app.get('/api/evaluations/dispatches', authenticate, authorizeRoles('admin', 'dept_head', 'instructor'), async (req, res) => {
  try {
    const { status = null, created_by = null } = req.query;
    const where = [];
    const params = [];
    if (status) {
      where.push('status = ?');
      params.push(status);
    }
    if (created_by) {
      where.push('created_by = ?');
      params.push(created_by);
    }
    const query = `SELECT * FROM evaluation_dispatches ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC`;
    const [rows] = await pool.query(query, params);
    return sendResponse(res, 200, 'Dispatches retrieved.', 'የማስተላለፊያ ዝርዝር ተመልሷል።', rows);
  } catch (error) {
    console.error('Failed to list dispatches:', error?.message || error);
    return sendResponse(res, 500, 'Unable to list dispatches.', 'የማስተላለፊያ ማውጫ አልተሳካም።', []);
  }
});

// List submissions (admin/dept_head/instructor)
app.get('/api/evaluations/submissions', authenticate, authorizeRoles('admin', 'dept_head', 'instructor'), async (req, res) => {
  try {
    const { dispatch_id = null, student_id = null } = req.query;
    const where = [];
    const params = [];
    if (dispatch_id) {
      where.push('dispatch_id = ?');
      params.push(dispatch_id);
    }
    if (student_id) {
      where.push('student_id = ?');
      params.push(student_id);
    }
    const query = `SELECT * FROM student_evaluation_submissions ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC`;
    const [rows] = await pool.query(query, params);
    return sendResponse(res, 200, 'Submissions retrieved.', 'የግምገማ ሰነዶች ተመልሰዋል።', rows);
  } catch (error) {
    console.error('Failed to list submissions:', error?.message || error);
    return sendResponse(res, 500, 'Unable to list submissions.', 'የግምገማ ሰነዶችን ለማግኘት አልተቻለም።', []);
  }
});

app.put('/api/evaluations/:id', authenticate, async (req, res) => {
  try {
    const { score, feedback, status } = req.body;
    const [rows] = await pool.query('SELECT * FROM evaluations WHERE id = ? LIMIT 1', [req.params.id]);

    if (!rows.length) {
      return sendResponse(res, 404, 'Evaluation not found.', 'ግምገማ አልተገኘም።');
    }

    const updateFields = [];
    const values = [];

    if (score !== undefined) {
      updateFields.push('score = ?');
      values.push(score);
    }
    if (feedback !== undefined) {
      updateFields.push('feedback = ?');
      values.push(feedback);
    }
    if (status) {
      updateFields.push('status = ?');
      values.push(status);
    }

    if (!updateFields.length) {
      return sendResponse(res, 400, 'No update fields provided.', 'ምንም የማዘመኛ መስኮች አልተሰጡም።');
    }

    values.push(req.params.id);
    await pool.query(`UPDATE evaluations SET ${updateFields.join(', ')} WHERE id = ?`, values);
    return sendResponse(res, 200, 'Evaluation updated successfully.', 'ግምገማ በተሳካ ሁኔታ ተዘምኗል።');
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Unable to update evaluation.', 'ግምገማ ለመዘመን አልተቻለም።');
  }
});

app.get('/', (req, res) => {
  return sendResponse(res, 200, 'Welcome to the IEPS API.', 'እንኳን ወደ IEPS API በደህና መጡ።');
});

const startServer = async () => {
  try {
    if (process.env.SKIP_SCHEMA_INIT !== 'true') {
      await initializeSchema();
    } else {
      console.log('Skipping schema initialization (SKIP_SCHEMA_INIT=true)');
    }
    httpServer.listen(PORT, () => {
      console.log(`🚀 IEPS API listening on http://localhost:${PORT}`);
      console.log(`📘 Health: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('Failed to start API:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = app;
