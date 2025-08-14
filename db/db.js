import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Determine which config to use
const dbConfig = process.env.NEON_DB_URL 
  ? { 
      connectionString: process.env.NEON_DB_URL,
      ssl: { rejectUnauthorized: false } // Required for Neon
    } 
  : {
      user: process.env.PG_USER,
      host: process.env.PG_HOST,
      database: process.env.PG_DATABASE,
      password: process.env.PG_PASSWORD,
      port: process.env.PG_PORT
    };

const db = new pg.Client(dbConfig);

db.connect()

db.on('error', (err) => {
  console.error('Database connection error:', err);
  process.exit(-1);
});

export const query = (text, params) => db.query(text, params);