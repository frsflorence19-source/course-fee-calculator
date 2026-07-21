const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.warn(
          '警告：未设置 DATABASE_URL 环境变量。请在 Render 的 Environment 里添加 DATABASE_URL（指向你创建的 Postgres 数据库），否则数据库操作会全部失败。'
        );
}

const pool = new Pool({
    connectionString,
    ssl: connectionString ? { rejectUnauthorized: false } : undefined,
});

async function init() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
              id SERIAL PRIMARY KEY,
                    username TEXT UNIQUE NOT NULL,
                          password_hash TEXT NOT NULL,
                                role TEXT NOT NULL DEFAULT 'teacher',
                                      is_owner BOOLEAN NOT NULL DEFAULT false,
                                            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
                                                );
                                                  `);

  await pool.query(`
      CREATE TABLE IF NOT EXISTS records (
            id SERIAL PRIMARY KEY,
                  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        username TEXT NOT NULL,
                              note TEXT DEFAULT '',
                                    currency TEXT NOT NULL,
                                          main_amount NUMERIC NOT NULL,
                                                deposit NUMERIC NOT NULL DEFAULT 0,
                                                      is_revision BOOLEAN NOT NULL DEFAULT false,
                                                            installments INTEGER,
                                                                  rate NUMERIC,
                                                                        surcharge NUMERIC NOT NULL DEFAULT 0,
                                                                              total NUMERIC NOT NULL,
                                                                                    per_installment NUMERIC,
                                                                                          breakdown JSONB,
                                                                                                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
                                                                                                    );
                                                                                                      `);

  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM users');
    if (rows[0].count === 0) {
          const adminUsername = process.env.ADMIN_USERNAME || 'admin';
          const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
          const passwordHash = bcrypt.hashSync(adminPassword, 10);
          await pool.query(
                  'INSERT INTO users (username, password_hash, role, is_owner) VALUES ($1, $2, $3, true)',
                  [adminUsername, passwordHash, 'admin']
                );
          console.log('======================================');
          console.log('已自动创建管理员账号（主账号）：');
          console.log('  用户名:', adminUsername);
          console.log('  密码  :', adminPassword);
          console.log('登录后请尽快在"修改密码"里改掉默认密码。');
          console.log('======================================');
    } else {
          // 迁移：确保有且仅有一个主账号(owner)，取最早创建的管理员账号
      const ownerCheck = await pool.query('SELECT id FROM users WHERE is_owner = true LIMIT 1');
          if (ownerCheck.rows.length === 0) {
                  const admins = await pool.query(
                            "SELECT id, username FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1"
                          );
                  if (admins.rows.length) {
                            await pool.query('UPDATE users SET is_owner = true WHERE id = $1', [admins.rows[0].id]);
                            console.log(`已将账号 "${admins.rows[0].username}" 设为主账号(owner)，只有它能管理教师账号列表。`);
                  }
          }
    }
}

module.exports = { pool, init };
