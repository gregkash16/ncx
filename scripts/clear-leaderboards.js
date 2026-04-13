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
  await conn.query('TRUNCATE TABLE railway.trench_run_leaderboard');
  await conn.query('TRUNCATE TABLE railway.tauntaun_run_leaderboard');
  await conn.query('TRUNCATE TABLE railway.pod_racer_leaderboard');
  await conn.query('TRUNCATE TABLE railway.last_stand_leaderboard');
  await conn.query('TRUNCATE TABLE railway.pinball_leaderboard');
  console.log('All 5 leaderboards cleared.');
  await conn.end();
})();
