const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'mysql-db',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'libmemberuser',
  password: process.env.DB_PASSWORD || 'memberpass_secure_123',
  database: process.env.DB_NAME || 'library_members_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

console.log(`Configuring MySQL connection pool to ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}...`);

const pool = mysql.createPool(dbConfig);

async function testDbConnection(maxRetries = 10, delayMs = 3000) {
  let retries = 0;
  while (retries < maxRetries) {
    try {
      console.log(`Connecting to MySQL (Attempt ${retries + 1}/${maxRetries})...`);
      const connection = await pool.getConnection();
      console.log('MySQL connection pool established successfully.');
      connection.release();
      return true;
    } catch (err) {
      retries++;
      console.warn(`MySQL connection attempt failed: ${err.message}. Retrying in ${delayMs / 1000}s...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  console.error('Failed to establish MySQL connection after multiple retries.');
  return false;
}

module.exports = {
  pool,
  testDbConnection
};
