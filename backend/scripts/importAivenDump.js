const fs = require('fs');
const path = require('path');
const readline = require('readline/promises');
const mysql = require('mysql2/promise');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const requiredConfig = [
  'AIVEN_DB_HOST',
  'AIVEN_DB_PORT',
  'AIVEN_DB_USER',
  'AIVEN_DB_PASSWORD',
  'AIVEN_DB_NAME',
  'AIVEN_DB_SSL_CA',
];

const run = async () => {
  const dumpPath = process.argv[2];
  if (!dumpPath || process.argv.length !== 3) {
    throw new Error('Usage: npm run import:aiven-dump -- <path-to-local-dump.sql>');
  }

  const missingConfig = requiredConfig.filter((key) => !process.env[key]);
  if (missingConfig.length) {
    throw new Error(`Missing Aiven configuration: ${missingConfig.join(', ')}`);
  }

  const absoluteDumpPath = path.resolve(dumpPath);
  if (!fs.existsSync(absoluteDumpPath) || !fs.statSync(absoluteDumpPath).isFile()) {
    throw new Error(`SQL dump file not found: ${absoluteDumpPath}`);
  }

  const sql = fs.readFileSync(absoluteDumpPath, 'utf8');
  if (!/\bCREATE\s+TABLE\s+`?users`?\b/i.test(sql)
    || !/\bINSERT\s+INTO\s+`?users`?\b/i.test(sql)) {
    throw new Error('Dump must contain both the users table definition and user rows.');
  }

  const caPath = path.resolve(process.env.AIVEN_DB_SSL_CA);
  if (!fs.existsSync(caPath) || !fs.statSync(caPath).isFile()) {
    throw new Error(`Aiven CA certificate not found: ${caPath}`);
  }

  if (!process.stdin.isTTY) {
    throw new Error('Run this command in an interactive terminal to confirm the destructive import.');
  }

  console.warn(`Target: ${process.env.AIVEN_DB_HOST}:${process.env.AIVEN_DB_PORT}/${process.env.AIVEN_DB_NAME}`);
  console.warn(`Source: ${absoluteDumpPath}`);
  console.warn('WARNING: The dump may DROP and recreate tables, replacing their current data.');
  const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
  let confirmation;
  try {
    confirmation = await prompt.question(`Type IMPORT ${process.env.AIVEN_DB_NAME} to continue: `);
  } finally {
    prompt.close();
  }

  if (confirmation !== `IMPORT ${process.env.AIVEN_DB_NAME}`) {
    throw new Error('Confirmation did not match; no database changes were made.');
  }

  const connection = await mysql.createConnection({
    host: process.env.AIVEN_DB_HOST,
    port: Number(process.env.AIVEN_DB_PORT),
    user: process.env.AIVEN_DB_USER,
    password: process.env.AIVEN_DB_PASSWORD,
    database: process.env.AIVEN_DB_NAME,
    ssl: { ca: fs.readFileSync(caPath), rejectUnauthorized: true },
    multipleStatements: true,
    connectTimeout: 15000,
  });

  let foreignKeyChecksDisabled = false;
  try {
    console.log('Connected to the configured Aiven MySQL database.');
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    foreignKeyChecksDisabled = true;
    await connection.query(sql);
    const [userRows] = await connection.query('SELECT COUNT(*) AS user_count FROM users');
    const userCount = Number(userRows[0].user_count);
    if (userCount === 0) {
      throw new Error('Import completed, but the users table is empty.');
    }
    console.log(`SQL dump imported successfully; verified ${userCount} user accounts.`);
  } finally {
    if (foreignKeyChecksDisabled) {
      try {
        await connection.query('SET FOREIGN_KEY_CHECKS = 1');
      } catch (error) {
        console.error(`Could not restore FOREIGN_KEY_CHECKS: ${error.message}`);
      }
    }
    await connection.end();
  }
};

run().catch((error) => {
  console.error(`Aiven dump import failed: ${error.message}`);
  process.exitCode = 1;
});