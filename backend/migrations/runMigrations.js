const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

const connectionConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ipes_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

const expectedSchema = {
  users: {
    password_hash: 'varchar(255)',
    role: "enum('admin','dept_head','instructor','student')",
    status: 'varchar(32)',
    email: 'varchar(255)',
    is_first_login: 'tinyint(1)',
  },
  instructors: {
    user_id: 'int(10) unsigned',
    employee_id: 'varchar(64)',
    first_name: 'varchar(128)',
    last_name: 'varchar(128)',
    department_id: 'int(10) unsigned',
    gender: 'varchar(10)',
    phone_number: 'varchar(32)',
    profile_picture: 'varchar(255)',
  },
  students: {
    user_id: 'int(10) unsigned',
    student_id: 'varchar(64)',
    first_name: 'varchar(128)',
    last_name: 'varchar(128)',
    gender: 'varchar(10)',
    phone_number: 'varchar(32)',
    profile_picture: 'varchar(255)',
    department_id: 'int(10) unsigned',
    semester: 'varchar(32)',
    year_level: 'varchar(64)',
    section: 'varchar(64)',
    program_type: 'varchar(64)',
    registration_date: 'varchar(64)',
  },
  departments: {
    name: 'varchar(255)',
    code: 'varchar(64)',
  },
  courses: {
    code: 'varchar(100)',
    name: 'varchar(255)',
    credit_hours: 'int(11)',
    department_id: 'int(10) unsigned',
  },
  evaluation_dispatches: {
    template_id: 'int(10) unsigned',
    student_id: 'int(10) unsigned',
    student_identifier: 'varchar(255)',
    course_id: 'int(10) unsigned',
    course_name: 'varchar(255)',
    academic_year: 'varchar(64)',
    semester: 'varchar(64)',
    year_level: 'varchar(64)',
    student_group: 'varchar(255)',
    created_by: 'int(10) unsigned',
    payload: 'json',
    status: "enum('pending','submitted','closed')",
  },
  evaluation_criteria: {
    evaluator_type: "enum('student','peer','dept_head','dean')",
    criterion_text: 'varchar(255)',
    criterion_text_am: 'varchar(255)',
    category: 'varchar(100)',
    weight: 'int(11)',
    is_active: 'tinyint(1)',
  },
  student_evaluation_submissions: {
    dispatch_id: 'int(10) unsigned',
    student_id: 'int(10) unsigned',
    student_name: 'varchar(255)',
    score: 'decimal(5,2)',
    feedback: 'text',
    responses: 'json',
    status: 'varchar(32)',
  },
  notifications: {
    user_id: 'int(10) unsigned',
    title: 'varchar(255)',
    message: 'text',
    type: 'varchar(50)',
    is_read: 'tinyint(1)',
    created_at: 'timestamp',
  },
  password_resets: {
    user_id: 'int(10) unsigned',
    code_hash: 'varchar(255)',
    expires_at: 'datetime',
    created_at: 'timestamp',
  },
};

const getColumns = async (conn, table) => {
  const [rows] = await conn.query(
    `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  );
  return rows.reduce((acc, row) => {
    acc[row.COLUMN_NAME] = row;
    return acc;
  }, {});
};

const tableExists = async (conn, table) => {
  const [rows] = await conn.query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  );
  return rows.length > 0;
};

const addMissingColumn = async (conn, table, column, type) => {
  console.log(`Adding missing column \`${column}\` to table \`${table}\``);
  await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${type} DEFAULT NULL`);
};

const createTable = async (conn, table) => {
  switch (table) {
    case 'users':
      await conn.query(`CREATE TABLE users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) DEFAULT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('admin','dept_head','instructor','student') NOT NULL DEFAULT 'student',
        status VARCHAR(32) NOT NULL DEFAULT 'active',
        is_first_login BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      break;
    case 'departments':
      await conn.query(`CREATE TABLE departments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(64) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      break;
    case 'courses':
      await conn.query(`CREATE TABLE courses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(100) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        credit_hours INT NOT NULL DEFAULT 3,
        department_id INT(10) unsigned DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_courses_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      break;
    case 'instructors':
      await conn.query(`CREATE TABLE instructors (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT(10) unsigned NOT NULL,
        employee_id VARCHAR(64) DEFAULT NULL,
        first_name VARCHAR(128) DEFAULT NULL,
        last_name VARCHAR(128) DEFAULT NULL,
        department_id INT(10) unsigned DEFAULT NULL,
        gender VARCHAR(10) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_instructor_user (user_id),
        CONSTRAINT fk_instructors_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_instructors_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      break;
    case 'students':
      await conn.query(`CREATE TABLE students (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT(10) unsigned NOT NULL,
        student_id VARCHAR(64) DEFAULT NULL,
        first_name VARCHAR(128) DEFAULT NULL,
        last_name VARCHAR(128) DEFAULT NULL,
        gender VARCHAR(10) DEFAULT NULL,
        department_id INT(10) unsigned DEFAULT NULL,
        semester VARCHAR(32) DEFAULT NULL,
        year_level VARCHAR(64) DEFAULT NULL,
        section VARCHAR(64) DEFAULT NULL,
        program_type VARCHAR(64) DEFAULT NULL,
        registration_date VARCHAR(64) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_student_user (user_id),
        CONSTRAINT fk_students_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_students_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      break;
    case 'evaluation_dispatches':
      await conn.query(`CREATE TABLE evaluation_dispatches (
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
        created_by INT UNSIGNED DEFAULT NULL,
        payload JSON DEFAULT NULL,
        status ENUM('pending','submitted','closed') NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_evaluation_dispatches_template FOREIGN KEY (template_id) REFERENCES evaluation_templates(id) ON DELETE SET NULL,
        CONSTRAINT fk_evaluation_dispatches_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL,
        CONSTRAINT fk_evaluation_dispatches_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT fk_evaluation_dispatches_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      break;
    case 'evaluation_criteria':
      await conn.query(`CREATE TABLE evaluation_criteria (
        id INT AUTO_INCREMENT PRIMARY KEY,
        evaluator_type ENUM('student', 'peer', 'dept_head', 'dean') NOT NULL,
        criterion_text VARCHAR(255) NOT NULL,
        criterion_text_am VARCHAR(255) DEFAULT NULL,
        category VARCHAR(100) DEFAULT 'General',
        weight INT DEFAULT 5,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      break;
    case 'student_evaluation_submissions':
      await conn.query(`CREATE TABLE student_evaluation_submissions (
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      break;
    case 'notifications':
      await conn.query(`CREATE TABLE notifications (
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
      break;
    case 'password_resets':
      await conn.query(`CREATE TABLE password_resets (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        code_hash VARCHAR(255) NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_password_resets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_password_resets_user (user_id, expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      break;
    default:
      throw new Error(`Unhandled schema creation for table: ${table}`);
  }
};

const run = async () => {
  const conn = await mysql.createConnection(connectionConfig);
  try {
    console.log('Connected to', connectionConfig.database);

    for (const [table, columns] of Object.entries(expectedSchema)) {
      if (!(await tableExists(conn, table))) {
        console.log(`Creating missing table: ${table}`);
        await createTable(conn, table);
        continue;
      }

      const existingColumns = await getColumns(conn, table);
      for (const [column, expectedType] of Object.entries(columns)) {
        const existing = existingColumns[column];
        if (!existing) {
          await addMissingColumn(conn, table, column, expectedType);
          continue;
        }

        const actualType = existing.COLUMN_TYPE.toLowerCase();
        if (!actualType.includes(expectedType.toLowerCase())) {
          console.warn(`Column type mismatch for ${table}.${column}: actual=${actualType} expected=${expectedType}. Skipping automatic ALTER TABLE.`);
        }
      }
    }

    const instructorColumns = await getColumns(conn, 'instructors');
    for (const column of ['program_type', 'registration_date']) {
      if (instructorColumns[column]) {
        await conn.query(`ALTER TABLE instructors DROP COLUMN \`${column}\``);
      }
    }

    await conn.query("UPDATE evaluation_criteria SET criterion_text_am = CONCAT('የግምገማ መስፈርት፦ ', criterion_text) WHERE criterion_text_am IS NULL OR TRIM(criterion_text_am) = ''");
    const seedCriteria = [
      ['student', 'The instructor communicates clearly and supports learning.', 'መምህሩ በግልጽ ይገልጻል እና ትምህርትን ይደግፋል።', 'Teaching'],
      ['peer', 'The instructor demonstrates professional competence.', 'መምህሩ ሙያዊ ብቃት ያሳያል።', 'Professional Competency'],
      ['dept_head', 'The instructor fulfills departmental responsibilities.', 'መምህሩ የዲፓርትመንቱን ኃላፊነቶች ይወጣል።', 'Departmental Responsibility'],
      ['dean', 'The instructor contributes to college goals.', 'መምህሩ ለኮሌጁ ግቦች አስተዋጽኦ ያደርጋል።', 'College Contribution'],
    ];
    for (const [evaluatorType, englishText, amharicText, category] of seedCriteria) {
      await conn.query(
        'INSERT INTO evaluation_criteria (evaluator_type, criterion_text, criterion_text_am, category, weight, is_active) SELECT ?, ?, ?, ?, 5, 1 WHERE NOT EXISTS (SELECT 1 FROM evaluation_criteria WHERE evaluator_type = ?)',
        [evaluatorType, englishText, amharicText, category, evaluatorType]
      );
    }

    console.log('Schema migration completed successfully.');
  } catch (error) {
    console.error('Schema migration failed:', error);
    process.exit(1);
  } finally {
    await conn.end();
  }
};

run().catch((error) => {
  console.error('Migration execution error:', error);
  process.exit(1);
});
