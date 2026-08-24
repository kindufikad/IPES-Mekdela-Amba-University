-- IPES Complete Database Schema & Initial Data
CREATE DATABASE IF NOT EXISTS ipes_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ipes_db;

-- --------------------------------------------------------
-- 1. Colleges Table
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS colleges (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  code VARCHAR(64) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- 2. Departments Table
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS departments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  college_id INT UNSIGNED NOT NULL,
  department_name VARCHAR(100) NOT NULL,
  department_code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL UNIQUE,
  code VARCHAR(64) NULL,
  CONSTRAINT fk_departments_college FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE RESTRICT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- 2. Base Users Table (authentication and account metadata only)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'dept_head', 'instructor', 'student', 'college_dean', 'academic_directorate') NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    is_first_login BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- 3. Instructors & Department Heads Table
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS instructors (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL UNIQUE,
    employee_id VARCHAR(64) NOT NULL UNIQUE,
    first_name VARCHAR(128) NOT NULL,
    last_name VARCHAR(128) NOT NULL,
    department_id INT UNSIGNED NOT NULL,
    gender VARCHAR(10) NULL,
    phone_number VARCHAR(32) NULL,
    profile_picture VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_instructors_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_instructors_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- 4. Students Table
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS students (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL UNIQUE,
    student_id VARCHAR(64) NOT NULL UNIQUE,
    first_name VARCHAR(128) NOT NULL,
    last_name VARCHAR(128) NOT NULL,
    department_id INT UNSIGNED NOT NULL,
    semester VARCHAR(32) NOT NULL,
    year_level VARCHAR(32) NOT NULL,
    section VARCHAR(32) NOT NULL,
    gender VARCHAR(10) NULL,
    phone_number VARCHAR(32) NULL,
    profile_picture VARCHAR(255) NULL,
    program_type VARCHAR(64) DEFAULT 'Regular',
    registration_date VARCHAR(64) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_students_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_students_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS student_id VARCHAR(50) NULL,
  ADD CONSTRAINT fk_users_students
  FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE;

-- --------------------------------------------------------
-- 5. Courses Table
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS courses (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    year_level VARCHAR(32) DEFAULT NULL,
    semester VARCHAR(32) DEFAULT NULL,
    credit_hours INT NOT NULL DEFAULT 3,
    department_id INT UNSIGNED NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_courses_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS audit_logs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  action_title VARCHAR(255) NOT NULL,
  description TEXT,
  performed_by VARCHAR(255),
  ip_address VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_logs_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS evaluation_summaries (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS system_settings (
  setting_key VARCHAR(128) PRIMARY KEY,
  setting_value TEXT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- 6. Evaluation Templates Table (id Fixed to INT UNSIGNED)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS evaluation_templates (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  template_data JSON NOT NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_evaluation_templates_updated_at (updated_at),
  CONSTRAINT fk_templates_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- 7. Dynamic Evaluation Criteria Table
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS evaluation_criteria (
  id INT AUTO_INCREMENT PRIMARY KEY,
  evaluator_type ENUM('student', 'peer', 'dept_head', 'dean') NOT NULL,
  criterion_text VARCHAR(255) NOT NULL,
  criterion_text_am VARCHAR(255) DEFAULT NULL,
  category VARCHAR(100) DEFAULT 'General',
  weight INT DEFAULT 5,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

UPDATE evaluation_criteria
SET criterion_text_am = CONCAT('የግምገማ መስፈርት፦ ', criterion_text)
WHERE criterion_text_am IS NULL OR TRIM(criterion_text_am) = '';

INSERT INTO evaluation_criteria (evaluator_type, criterion_text, criterion_text_am, category, weight, is_active)
SELECT 'student', 'The instructor communicates clearly and supports learning.', 'መምህሩ በግልጽ ይገልጻል እና ትምህርትን ይደግፋል።', 'Teaching', 5, 1
WHERE NOT EXISTS (SELECT 1 FROM evaluation_criteria WHERE evaluator_type = 'student');
INSERT INTO evaluation_criteria (evaluator_type, criterion_text, criterion_text_am, category, weight, is_active)
SELECT 'peer', 'The instructor demonstrates professional competence.', 'መምህሩ ሙያዊ ብቃት ያሳያል።', 'Professional Competency', 5, 1
WHERE NOT EXISTS (SELECT 1 FROM evaluation_criteria WHERE evaluator_type = 'peer');
INSERT INTO evaluation_criteria (evaluator_type, criterion_text, criterion_text_am, category, weight, is_active)
SELECT 'dept_head', 'The instructor fulfills departmental responsibilities.', 'መምህሩ የዲፓርትመንቱን ኃላፊነቶች ይወጣል።', 'Departmental Responsibility', 5, 1
WHERE NOT EXISTS (SELECT 1 FROM evaluation_criteria WHERE evaluator_type = 'dept_head');
INSERT INTO evaluation_criteria (evaluator_type, criterion_text, criterion_text_am, category, weight, is_active)
SELECT 'dean', 'The instructor contributes to college goals.', 'መምህሩ ለኮሌጁ ግቦች አስተዋጽኦ ያደርጋል።', 'College Contribution', 5, 1
WHERE NOT EXISTS (SELECT 1 FROM evaluation_criteria WHERE evaluator_type = 'dean');

-- --------------------------------------------------------
-- 8. Template Criteria Table
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS template_criteria (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  template_id INT UNSIGNED NOT NULL,
  category VARCHAR(255) NOT NULL,
  position INT NOT NULL DEFAULT 0,
  criteria_key VARCHAR(255) NULL,
  text_en TEXT NULL,
  text_am TEXT NULL,
  meta JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_template_criteria_template FOREIGN KEY (template_id) REFERENCES evaluation_templates(id) ON DELETE CASCADE,
  INDEX idx_template_criteria_template_id (template_id),
  INDEX idx_template_criteria_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- 8. Course Assignments Table
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS course_assignments (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    department_id INT UNSIGNED NOT NULL,
    course_id INT UNSIGNED NOT NULL,
    instructor_id INT UNSIGNED NOT NULL,
    year_level VARCHAR(32) NOT NULL,
    semester VARCHAR(32) NOT NULL,
    section VARCHAR(32) NOT NULL,
    academic_year VARCHAR(32) NOT NULL DEFAULT '2026',
    is_published TINYINT(1) NOT NULL DEFAULT 0,
    is_student_published TINYINT(1) NOT NULL DEFAULT 0,
    is_peer_published TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_assign_dept FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
    CONSTRAINT fk_assign_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    CONSTRAINT fk_assign_instructor FOREIGN KEY (instructor_id) REFERENCES instructors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- 9. Evaluation Dispatches Table
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS evaluation_dispatches (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  template_id INT UNSIGNED DEFAULT NULL,
  student_id INT UNSIGNED DEFAULT NULL,
  student_identifier VARCHAR(255) DEFAULT NULL,
  course_id INT UNSIGNED DEFAULT NULL,
  course_name VARCHAR(255) DEFAULT NULL,
  academic_year VARCHAR(64) DEFAULT NULL,
  semester VARCHAR(64) DEFAULT NULL,
  year_level VARCHAR(64) DEFAULT NULL,
  student_group VARCHAR(255) DEFAULT NULL,
  student_identifier_text VARCHAR(255) DEFAULT NULL,
  created_by INT UNSIGNED DEFAULT NULL,
  payload JSON DEFAULT NULL,
  status ENUM('pending', 'submitted', 'closed') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_evaluation_dispatches_template FOREIGN KEY (template_id) REFERENCES evaluation_templates(id) ON DELETE SET NULL,
  CONSTRAINT fk_evaluation_dispatches_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL,
  CONSTRAINT fk_evaluation_dispatches_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_evaluation_dispatches_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- 10. Student Evaluation Submissions Table
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS student_evaluation_submissions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  dispatch_id INT UNSIGNED NOT NULL,
  student_id INT UNSIGNED DEFAULT NULL,
  student_name VARCHAR(255) DEFAULT NULL,
  score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  feedback TEXT DEFAULT NULL,
  responses JSON DEFAULT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'submitted',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_student_evaluation_submissions_dispatch FOREIGN KEY (dispatch_id) REFERENCES evaluation_dispatches(id) ON DELETE CASCADE,
  CONSTRAINT fk_student_evaluation_submissions_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- 11. Legacy Evaluation Submissions Table
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS evaluation_submissions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    assignment_id INT UNSIGNED NOT NULL,
    student_id INT UNSIGNED NOT NULL,
    score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    feedback TEXT NULL,
    responses JSON NULL,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sub_assignment FOREIGN KEY (assignment_id) REFERENCES course_assignments(id) ON DELETE CASCADE,
    CONSTRAINT fk_sub_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- Colleges
INSERT INTO colleges (id, name, code) VALUES
  (1, 'College of Health Sciences', 'CHS'),
  (2, 'College of Education', 'COE'),
  (3, 'College of Computing & Informatics', 'CCI')
ON DUPLICATE KEY UPDATE name = VALUES(name), code = VALUES(code);

INSERT INTO departments (id, college_id, department_name, department_code, name, code) VALUES
  (1, 1, 'Department of Medicine', 'MED', 'Department of Medicine', 'MED'),
  (2, 1, 'Department of Nursing', 'NUR', 'Department of Nursing', 'NUR'),
  (3, 2, 'Department of Education', 'EDU', 'Department of Education', 'EDU'),
  (4, 3, 'Department of Information Technology', 'IT', 'Department of Information Technology', 'IT')
ON DUPLICATE KEY UPDATE college_id = VALUES(college_id), department_name = VALUES(department_name), department_code = VALUES(department_code), name = VALUES(name), code = VALUES(code);

-- Base Users (authentication data only)
INSERT INTO users (id, email, password_hash, role, status, is_first_login) VALUES
  (1, 'admin@ipes.edu.et', '$2a$12$mTKhkjb./.xV2BRtCJR8.OWjLzpUYrj.unZ7ZtK37u5aSigeYZCZS', 'admin', 'active', 1),
  (2, 'depthead@ipes.edu.et', '$2a$12$mTKhkjb./.xV2BRtCJR8.OWjLzpUYrj.unZ7ZtK37u5aSigeYZCZS', 'dept_head', 'active', 1),
  (3, 'instructor@ipes.edu.et', '$2a$12$mTKhkjb./.xV2BRtCJR8.OWjLzpUYrj.unZ7ZtK37u5aSigeYZCZS', 'instructor', 'active', 1),
  (4, NULL, '$2a$12$mTKhkjb./.xV2BRtCJR8.OWjLzpUYrj.unZ7ZtK37u5aSigeYZCZS', 'student', 'active', 1),
  (5, NULL, '$2a$12$mTKhkjb./.xV2BRtCJR8.OWjLzpUYrj.unZ7ZtK37u5aSigeYZCZS', 'student', 'active', 1)
ON DUPLICATE KEY UPDATE email = VALUES(email), password_hash = VALUES(password_hash), role = VALUES(role), status = VALUES(status), is_first_login = VALUES(is_first_login);

-- Instructors
INSERT INTO instructors (id, user_id, employee_id, first_name, last_name, department_id) VALUES
  (1, 2, 'EMP001', 'Department', 'Head', 1),
  (2, 3, 'EMP002', 'Abebe', 'Tolossa', 1)
ON DUPLICATE KEY UPDATE employee_id = VALUES(employee_id), first_name = VALUES(first_name), last_name = VALUES(last_name), department_id = VALUES(department_id);

-- Students
INSERT INTO students (id, user_id, student_id, first_name, last_name, department_id, semester, year_level, section, program_type, registration_date) VALUES
  (1, 4, 'STU1212', 'Chala', 'Bekele', 2, 'I', '3rd Year', 'H', 'Extension', '08/07/2026'),
  (2, 5, 'STU2002', 'Abel', 'Kefe', 1, 'I', '2nd Year', 'B', 'Regular', '08/07/2026')
ON DUPLICATE KEY UPDATE student_id = VALUES(student_id), first_name = VALUES(first_name), last_name = VALUES(last_name), department_id = VALUES(department_id);

-- Courses
INSERT INTO courses (id, code, name, department_id) VALUES
  (1, 'CS101', 'Introduction to Computing', 3)
ON DUPLICATE KEY UPDATE code = VALUES(code);