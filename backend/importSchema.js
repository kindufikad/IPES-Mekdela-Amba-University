const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const importSchema = async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false },
    multipleStatements: true,
  });

  try {
    console.log('Connected to Aiven MySQL successfully.');

    const sqlFilePath = path.join(__dirname, 'database.sql');
    const sql = fs.readFileSync(sqlFilePath, 'utf8');
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    await connection.query(sql);

    console.log('SQL schema imported successfully.');
  } finally {
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    await connection.end();
  }
};

importSchema().catch((error) => {
  console.error(`Schema import failed: ${error.message}`);
  process.exitCode = 1;
});
