const path = require('path');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db, nextId } = require('./db');
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
    { id: user.id, username: user.username, role: user.role, isOwner: !!user.isOwner },
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

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '仅管理员可操作' });
  next();
}

function requireOwner(req, res, next) {
  if (!req.user.isOwner) return res.status(403).json({ error: '仅主账号可操作' });
  next();
}

// ---------- Auth ----------
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = db.get('users').find({ username }).value();
  if (!user || !bcrypt.compareSync(password || '', user.passwordHash)) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  const token = sign(user);
  res.json({
    token,
    user: { id: user.id, username: user.username, role: user.role, isOwner: !!user.isOwner },
  });
});

app.get('/api/me', auth, (req, res) => {
  res.json({ user: req.user });
});

app.post('/api/change-password', auth, (req, res) => {
  const { oldPassword, newPassword } = req.body || {};
  const user = db.get('users').find({ id: req.user.id }).value();
  if (!user || !bcrypt.compareSync(oldPassword || '', user.passwordHash)) {
    return res.status(400).json({ error: '原密码不正确' });
  }
  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ error: '新密码至少 4 位' });
  }
  db.get('users')
    .find({ id: req.user.id })
    .assign({ passwordHash: bcrypt.hashSync(newPassword, 10) })
    .write();
  res.json({ ok: true });
});

// ---------- Users (owner only) ----------
app.get('/api/users', auth, requireOwner, (req, res) => {
  const users = db
    .get('users')
    .map((u) => ({
      id: u.id,
      username: u.username,
      role: u.role,
      isOwner: !!u.isOwner,
      createdAt: u.createdAt,
    }))
    .value();
  res.json({ users });
});

app.post('/api/users', auth, requireOwner, (req, res) => {
  const { username, password, role } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });
  if (db.get('users').find({ username }).value()) {
    return res.status(400).json({ error: '用户名已存在' });
  }
  const user = {
    id: nextId('users'),
    username,
    passwordHash: bcrypt.hashSync(password, 10),
    role: role === 'admin' ? 'admin' : 'teacher',
    createdAt: new Date().toISOString(),
  };
  db.get('users').push(user).write();
  res.json({ user: { id: user.id, username: user.username, role: user.role } });
});

app.delete('/api/users/:id', auth, requireOwner, (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: '不能删除自己' });
  const target = db.get('users').find({ id }).value();
  if (target && target.isOwner) {
    return res.status(400).json({ error: '不能删除主账号' });
  }
  db.get('users').remove({ id }).write();
  res.json({ ok: true });
});

// ---------- Records ----------
app.post('/api/records', auth, (req, res) => {
  try {
    const result = calculate(req.body || {});
    const record = {
      id: nextId('records'),
      userId: req.user.id,
      username: req.user.username,
      note: (req.body && req.body.note) || '',
      ...result,
      createdAt: new Date().toISOString(),
    };
    db.get('records').push(record).write();
    res.json({ record });
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

app.get('/api/records', auth, (req, res) => {
  const showAll = req.query.all === '1' && req.user.role === 'admin';
  let records = db.get('records').value();
  if (!showAll) records = records.filter((r) => r.userId === req.user.id);
  records = [...records].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ records });
});

app.delete('/api/records/:id', auth, (req, res) => {
  const id = Number(req.params.id);
  const record = db.get('records').find({ id }).value();
  if (!record) return res.status(404).json({ error: '记录不存在' });
  if (record.userId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: '无权删除他人记录' });
  }
  db.get('records').remove({ id }).write();
  res.json({ ok: true });
});

// SPA fallback for the two html pages
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`课程金额计算器已启动: http://localhost:${PORT}`);
});
