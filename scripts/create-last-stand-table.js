const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const envFile = fs.readFileSync(path.resolve(__dirname, '../.env.local'), 'utf8');
const match = envFile.match(/^MYSQLPASSWORD=(.+)$/m);
const password = match ? match[1].trim() : '';

(async () => {
  const conn = await mysql.createConnection({
    host: 'metro.proxy.rlwy.net',
    port: 47124,
    user: 'root',
    password,
    database: 'S9'
  });
  await conn.query(`
    CREATE TABLE IF NOT EXISTS railway.last_stand_leaderboard (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(3) NOT NULL,
      score INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('last_stand_leaderboard table created.');
  await conn.end();
})();
