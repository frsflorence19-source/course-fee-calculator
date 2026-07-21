const path = require('path');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool, init } = require('./db');
const { calculate } = require('./calc');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const JWT_SECRET = process.env.JWT_SECRET || 'course-fee-calculator-dev-secret-please-change';
if (!process.env.JWT_SECRET) {
    console.log('提示：未设置 JWT_SECRET 环境变量，正在使用开发用默认值。部署到线上前请设置一个自己的随机字符串。');
}

function sign(user) {
    return jwt.sign(
      { id: user.id, username: user.username, role: user.role, isOwner: !!user.is_owner },
          JWT_SECRET,
      { expiresIn: '30d' }
        );
}

function auth(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: '未登录' });
    try {
          req.user = jwt.verify(token, JWT_SECRET);
          next();
    } catch (e) {
          return res.status(401).json({ error: '登录已过期，请重新登录' });
    }
}

function requireOwner(req, res, next) {
    if (!req.user.isOwner) return res.status(403).json({ error: '仅主账号可操作' });
    next();
}

function userToJson(u) {
    return {
          id: u.id,
          username: u.username,
          role: u.role,
          isOwner: !!u.is_owner,
          createdAt: u.created_at,
    };
}

function recordToJson(r) {
    return {
          id: r.id,
          userId: r.user_id,
          username: r.username,
          note: r.note || '',
          currency: r.currency,
          mainAmount: Number(r.main_amount),
          deposit: Number(r.deposit),
          isRevision: !!r.is_revision,
          installments: r.installments,
          rate: r.rate === null ? null : Number(r.rate),
          surcharge: Number(r.surcharge),
          total: Number(r.total),
          perInstallment: r.per_installment === null ? null : Number(r.per_installment),
          breakdown: r.breakdown,
          createdAt: r.created_at,
    };
}

// ---------- Auth ----------
app.post('/api/login', async (req, res) => {
    try {
          const { username, password } = req.body || {};
          const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
          const user = rows[0];
          if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
                  return res.status(401).json({ error: '用户名或密码错误' });
          }
          const token = sign(user);
          res.json({ token, user: userToJson(user) });
    } catch (e) {
          console.error(e);
          res.status(500).json({ error: '服务器错误：' + e.message });
    }
});

app.get('/api/me', auth, (req, res) => {
    res.json({ user: req.user });
});

app.post('/api/change-password', auth, async (req, res) => {
    try {
          const { oldPassword, newPassword } = req.body || {};
          const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
          const user = rows[0];
          if (!user || !bcrypt.compareSync(oldPassword || '', user.password_hash)) {
                  return res.status(400).json({ error: '原密码不正确' });
          }
          if (!newPassword || newPassword.length < 4) {
                  return res.status(400).json({ error: '新密码至少 4 位' });
          }
          await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [
                  bcrypt.hashSync(newPassword, 10),
                  req.user.id,
                ]);
          res.json({ ok: true });
    } catch (e) {
          console.error(e);
          res.status(500).json({ error: '服务器错误：' + e.message });
    }
});

// ---------- Users (owner only) ----------
app.get('/api/users', auth, requireOwner, async (req, res) => {
    try {
          const { rows } = await pool.query(
                  'SELECT id, username, role, is_owner, created_at FROM users ORDER BY id ASC'
                );
          res.json({ users: rows.map(userToJson) });
    } catch (e) {
          console.error(e);
          res.status(500).json({ error: '服务器错误：' + e.message });
    }
});

app.post('/api/users', auth, requireOwner, async (req, res) => {
    try {
          const { username, password, role } = req.body || {};
          if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });
          const existing = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
          if (existing.rows.length) return res.status(400).json({ error: '用户名已存在' });
          const passwordHash = bcrypt.hashSync(password, 10);
          const finalRole = role === 'admin' ? 'admin' : 'teacher';
          const { rows } = await pool.query(
                  'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role, is_owner, created_at',
                  [username, passwordHash, finalRole]
                );
          res.json({ user: userToJson(rows[0]) });
    } catch (e) {
          console.error(e);
          res.status(500).json({ error: '服务器错误：' + e.message });
    }
});

app.delete('/api/users/:id', auth, requireOwner, async (req, res) => {
    try {
          const id = Number(req.params.id);
          if (id === req.user.id) return res.status(400).json({ error: '不能删除自己' });
          const { rows } = await pool.query('SELECT is_owner FROM users WHERE id = $1', [id]);
          if (rows[0] && rows[0].is_owner) {
                  return res.status(400).json({ error: '不能删除主账号' });
          }
          await pool.query('DELETE FROM users WHERE id = $1', [id]);
          res.json({ ok: true });
    } catch (e) {
          console.error(e);
          res.status(500).json({ error: '服务器错误：' + e.message });
    }
});

// ---------- Records ----------
app.post('/api/records', auth, async (req, res) => {
    try {
          const result = calculate(req.body || {});
          const note = (req.body && req.body.note) || '';
          const { rows } = await pool.query(
                  `INSERT INTO records
                          (user_id, username, note, currency, main_amount, deposit, is_revision, installments, rate, surcharge, total, per_installment, breakdown)
                                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
                                        RETURNING *`,
                  [
                            req.user.id,
                            req.user.username,
                            note,
                            result.currency,
                            result.mainAmount,
                            result.deposit,
                            result.isRevision,
                            result.installments ?? null,
                            result.rate ?? null,
                            result.surcharge,
                            result.total,
                            result.perInstallment,
                            result.breakdown ? JSON.stringify(result.breakdown) : null,
                          ]
                );
          res.json({ record: recordToJson(rows[0]) });
    } catch (e) {
          res.status(400).json({ error: e.message });
    }
});

// 只计算，不保存
app.post('/api/calculate', auth, (req, res) => {
    try {
          const result = calculate(req.body || {});
          res.json({ result });
    } catch (e) {
          res.status(400).json({ error: e.message });
    }
});

app.get('/api/records', auth, async (req, res) => {
    try {
          const showAll = req.query.all === '1' && req.user.role === 'admin';
          let rows;
          if (showAll) {
                  ({ rows } = await pool.query('SELECT * FROM records ORDER BY created_at DESC'));
          } else {
                  ({ rows } = await pool.query(
                            'SELECT * FROM records WHERE user_id = $1 ORDER BY created_at DESC',
                            [req.user.id]
                          ));
          }
          res.json({ records: rows.map(recordToJson) });
    } catch (e) {
          console.error(e);
          res.status(500).json({ error: '服务器错误：' + e.message });
    }
});

app.delete('/api/records/:id', auth, async (req, res) => {
    try {
          const id = Number(req.params.id);
          const { rows } = await pool.query('SELECT user_id FROM records WHERE id = $1', [id]);
          const record = rows[0];
          if (!record) return res.status(404).json({ error: '记录不存在' });
          if (record.user_id !== req.user.id && req.user.role !== 'admin') {
                  return res.status(403).json({ error: '无权删除他人记录' });
          }
          await pool.query('DELETE FROM records WHERE id = $1', [id]);
          res.json({ ok: true });
    } catch (e) {
          console.error(e);
          res.status(500).json({ error: '服务器错误：' + e.message });
    }
});

// SPA fallback for the two html pages
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;

init()
  .then(() => {
        app.listen(PORT, () => {
                console.log(`课程金额计算器已启动: http://localhost:${PORT}`);
        });
  })
  .catch((e) => {
        console.error('数据库初始化失败：', e.message);
        process.exit(1);
  });
