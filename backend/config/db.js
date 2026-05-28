import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'chatnotes',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Initialize database tables
export const initDB = async () => {
  try {
    const dbName = process.env.DB_NAME || 'chatnotes';

    const ensureColumn = async (tableName, columnName, columnDefinition) => {
      const [rows] = await pool.query(
        `
          SELECT 1
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = ?
            AND TABLE_NAME = ?
            AND COLUMN_NAME = ?
          LIMIT 1
        `,
        [dbName, tableName, columnName]
      );

      if (rows.length === 0) {
        await pool.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnDefinition}`);
      }
    };

    // Create database if it doesn't exist
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
    });
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'chatnotes'}\`;`);
    await connection.end();

    // Create tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        uid VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        displayName VARCHAR(255) NOT NULL,
        passwordHash VARCHAR(255) NOT NULL,
        avatarUrl LONGTEXT NULL,
        isVerified BOOLEAN DEFAULT FALSE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await ensureColumn('users', 'isOnline', 'isOnline BOOLEAN DEFAULT FALSE');
    await ensureColumn('users', 'lastSeenAt', 'lastSeenAt DATETIME NULL');
    await ensureColumn('users', 'avatarUrl', 'avatarUrl LONGTEXT NULL');
    await ensureColumn('users', 'publicKey', 'publicKey TEXT NULL');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        token VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (email) REFERENCES users(email) ON DELETE CASCADE
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS otps (
        email VARCHAR(255) PRIMARY KEY,
        code VARCHAR(10) NOT NULL,
        expiresAt BIGINT NOT NULL,
        attempts INT DEFAULT 0,
        FOREIGN KEY (email) REFERENCES users(email) ON DELETE CASCADE
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await ensureColumn('conversations', 'createdByUid', 'createdByUid VARCHAR(255) NULL');
    await ensureColumn('conversations', 'participantUid', 'participantUid VARCHAR(255) NULL');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        conversationId BIGINT NOT NULL,
        sender VARCHAR(255) NOT NULL,
        text TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversationId) REFERENCES conversations(id) ON DELETE CASCADE
      );
    `);

    await ensureColumn('messages', 'senderUid', 'senderUid VARCHAR(255) NULL');
    await ensureColumn('messages', 'deliveredAt', 'deliveredAt DATETIME NULL');
    await ensureColumn('messages', 'seenAt', 'seenAt DATETIME NULL');

    console.log('MySQL Database initialized successfully');
  } catch (error) {
    console.error('MySQL initialization error:', error.message);
    throw error;
  }
};

export default pool;