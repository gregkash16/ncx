// src/lib/mysql.ts
import type { Pool } from "mysql2/promise";
import { pool } from "@/lib/db";

/**
 * Legacy compatibility wrapper.
 * IMPORTANT: this MUST return the SAME pool as /lib/db
 * to avoid "Too many connections".
 */
export function getMysqlPool(): Pool {
  return pool;
}
