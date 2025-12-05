// app/lib/db.ts
import mysql from "mysql2/promise";

const DB_HOST = process.env.DB_HOST || "metro.proxy.rlwy.net";
const DB_PORT = Number(process.env.DB_PORT || 47124);
const DB_USER = process.env.DB_USER || "root";
const DB_PASSWORD = process.env.MYSQLPASSWORD || "";
const DB_NAME = process.env.DB_NAME || "S8";

// Prevent multiple pools during hot reload
const globalForDB = global as unknown as {
  mysqlPool: mysql.Pool | undefined;
};

export const pool =
  globalForDB.mysqlPool ??
  mysql.createPool({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

if (!globalForDB.mysqlPool) {
  globalForDB.mysqlPool = pool;
}
