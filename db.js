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
      isOwner: true,
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

// 迁移：确保有且仅有最早的管理员账号是"主账号"(owner)。
// 只有主账号能看到/管理"教师账号管理"面板，其他管理员账号即使 role 是 admin 也看不到。
if (!db.get('users').find({ isOwner: true }).value()) {
  const admins = db.get('users').filter({ role: 'admin' }).value().sort((a, b) => a.id - b.id);
  if (admins.length) {
    db.get('users').find({ id: admins[0].id }).assign({ isOwner: true }).write();
    console.log(`已将账号 "${admins[0].username}" 设为主账号(owner)，只有它能管理教师账号列表。`);
  }
}

function nextId(collectionName) {
  const items = db.get(collectionName).value();
  return items.length ? Math.max(...items.map((i) => i.id)) + 1 : 1;
}

module.exports = { db, nextId };
