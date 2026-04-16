import { pool } from "@/lib/db";

let ensured = false;

async function ensureTable() {
  if (ensured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS railway.push_notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      category VARCHAR(64) NOT NULL,
      title VARCHAR(255),
      body TEXT,
      trigger_source VARCHAR(512),
      recipient_count INT NOT NULL DEFAULT 0,
      sent_count INT NOT NULL DEFAULT 0,
      failed_count INT NOT NULL DEFAULT 0,
      INDEX idx_sent_at (sent_at),
      INDEX idx_category (category)
    )
  `);
  ensured = true;
}

export type PushLogMeta = {
  category: string;
  trigger: string;
};

export async function logPushNotification(args: {
  category: string;
  title: string;
  body: string;
  trigger: string;
  recipientCount: number;
  sent: number;
  failed: number;
}) {
  try {
    await ensureTable();
    await pool.query(
      `INSERT INTO railway.push_notifications
         (category, title, body, trigger_source, recipient_count, sent_count, failed_count)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        args.category,
        args.title,
        args.body,
        args.trigger,
        args.recipientCount,
        args.sent,
        args.failed,
      ]
    );
  } catch (e) {
    console.warn("[pushLog] Failed to log push notification:", e);
  }
}
