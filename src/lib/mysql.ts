// src/lib/mysql.ts
import mysql, { Pool } from "mysql2/promise";

let _pool: Pool | null = null;

export function getMysqlPool(): Pool {
  if (_pool) return _pool;

  // Use whatever env var you already use for Railway
  const uri = process.env.MYSQL_URL || process.env.DATABASE_URL;
  if (!uri) {
    throw new Error("Missing MYSQL_URL (or DATABASE_URL) env var for MySQL");
  }

  _pool = mysql.createPool({
    uri,
    // tweak if you like
    connectionLimit: 5,
  });

  return _pool;
}
