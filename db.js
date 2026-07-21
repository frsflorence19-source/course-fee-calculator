const path = require('path');
const bcrypt = require('bcryptjs');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'db.json');
const adapter = new FileSync(DB_FILE);
const db = low(adapter);

db.defaults({ users: [], records: [] }).write();

// 首次启动自动建一个管理员账号
if (db.get('users').isEmpty().value()) {
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const passwordHash = bcrypt.hashSync(adminPassword, 10);
  db.get('users')
    .push({
      id: 1,
      username: adminUsername,
      passwordHash,
      role: 'admin',
      createdAt: new Date().toISOString(),
    })
    .write();
  console.log('======================================');
  console.log('已自动创建管理员账号：');
  console.log('  用户名:', adminUsername);
  console.log('  密码  :', adminPassword);
  console.log('登录后请尽快在"修改密码"里改掉默认密码。');
  console.log('======================================');
}

function nextId(collectionName) {
  const items = db.get(collectionName).value();
  return items.length ? Math.max(...items.map((i) => i.id)) + 1 : 1;
}

module.exports = { db, nextId };
