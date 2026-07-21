const token = localStorage.getItem('token');
const userRaw = localStorage.getItem('user');
if (!token || !userRaw) {
  window.location.href = 'index.html';
}
const currentUser = JSON.parse(userRaw || '{}');

function authHeaders() {
  return { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { ...authHeaders(), ...(opts.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '请求失败');
  return data;
}

function fmt(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '-';
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ---------- Top bar ----------
document.getElementById('whoami').textContent = `${currentUser.username}${currentUser.isOwner ? '（主账号）' : currentUser.role === 'admin' ? '（管理员）' : ''}`;
document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'index.html';
});
document.getElementById('pwBtn').addEventListener('click', async () => {
  const oldPassword = prompt('请输入当前密码：');
  if (!oldPassword) return;
  const newPassword = prompt('请输入新密码（至少4位）：');
  if (!newPassword) return;
  try {
    await api('/api/change-password', { method: 'POST', body: JSON.stringify({ oldPassword, newPassword }) });
    alert('密码修改成功，请重新登录');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
  } catch (e) {
    alert(e.message);
  }
});

if (currentUser.role === 'admin') {
  document.getElementById('adminFilterWrap').classList.remove('hidden');
}
if (currentUser.isOwner) {
  document.getElementById('adminCard').classList.remove('hidden');
}

// ---------- Calculator ----------
const currencyEl = document.getElementById('currency');
const installmentField = document.getElementById('installmentField');
const installmentLabel = document.getElementById('installmentLabel');
const installmentHint = document.getElementById('installmentHint');
const installmentsEl = document.getElementById('installments');
const rateField = document.getElementById('rateField');
const resultBox = document.getElementById('resultBox');
const calcErr = document.getElementById('calcErr');
const saveBtn = document.getElementById('saveBtn');

let lastResult = null;

function updateCurrencyUI() {
  const c = currencyEl.value;
  resultBox.classList.add('hidden');
  saveBtn.disabled = true;
  lastResult = null;

  if (c === 'MYR') {
    installmentField.classList.add('hidden');
    rateField.classList.remove('hidden');
  } else {
    installmentField.classList.remove('hidden');
    rateField.classList.add('hidden');
    if (c === 'USD') {
      installmentsEl.removeAttribute('max');
      installmentsEl.placeholder = '例如 6';
      installmentLabel.textContent = '分期数';
      installmentHint.textContent = 'USD：1-3 期加 USD 50，4-7 期加 USD 60，8 期及以上加 USD 80（整单只加一次）';
    } else {
      installmentsEl.removeAttribute('max');
      installmentsEl.placeholder = '例如 6';
      installmentLabel.textContent = '分期数';
      installmentHint.textContent = 'SGD：不管分几期，固定加 SGD 40（整单只加一次）';
    }
  }
}
currencyEl.addEventListener('change', updateCurrencyUI);
updateCurrencyUI();

function renderResult(result) {
  const c = result.currency;
  let html = '';
  if (c === 'MYR') {
    html += `<div class="result-row"><span>Main Amount</span><span>${fmt(result.mainAmount)}</span></div>`;
    html += `<div class="result-row"><span>汇率 Rate</span><span>${result.rate}</span></div>`;
    html += `<div class="total">MYR 总额：${fmt(result.total)}</div>`;
    html += `<table class="breakdown-table"><thead><tr><th>分期</th><th>每期应付 (MYR)</th></tr></thead><tbody>`;
    [12, 24, 36].forEach((n) => {
      html += `<tr><td>${n} 期</td><td>${fmt(result.breakdown[n])}</td></tr>`;
    });
    html += `</tbody></table>`;
  } else {
    html += `<div class="result-row"><span>Main Amount</span><span>${fmt(result.mainAmount)} ${c}</span></div>`;
    html += `<div class="result-row"><span>分期手续费</span><span>+${fmt(result.surcharge)} ${c}</span></div>`;
    html += `<div class="total">${c} 总额：${fmt(result.total)}</div>`;
    html += `<div class="result-row"><span>${result.installments} 期，每期应付</span><span><b>${fmt(result.perInstallment)} ${c}</b></span></div>`;
  }
  resultBox.innerHTML = html;
  resultBox.classList.remove('hidden');
}

function collectPayload() {
  const currency = currencyEl.value;
  const mainAmount = document.getElementById('mainAmount').value;
  const note = document.getElementById('note').value;
  const payload = { currency, mainAmount, note };
  if (currency === 'MYR') {
    payload.rate = document.getElementById('rate').value;
  } else {
    payload.installments = installmentsEl.value;
  }
  return payload;
}

document.getElementById('calcBtn').addEventListener('click', async () => {
  calcErr.textContent = '';
  try {
    const payload = collectPayload();
    const { result } = await api('/api/calculate', { method: 'POST', body: JSON.stringify(payload) });
    lastResult = { ...payload, ...result };
    renderResult(result);
    saveBtn.disabled = false;
  } catch (e) {
    calcErr.textContent = e.message;
    resultBox.classList.add('hidden');
    saveBtn.disabled = true;
  }
});

saveBtn.addEventListener('click', async () => {
  if (!lastResult) return;
  try {
    const payload = collectPayload();
    await api('/api/records', { method: 'POST', body: JSON.stringify(payload) });
    saveBtn.disabled = true;
    await loadRecords();
    alert('已保存');
  } catch (e) {
    alert(e.message);
  }
});

// ---------- Records ----------
const recordsWrap = document.getElementById('recordsWrap');
const showAllEl = document.getElementById('showAll');
if (showAllEl) showAllEl.addEventListener('change', loadRecords);

async function loadRecords() {
  recordsWrap.textContent = '加载中…';
  try {
    const all = showAllEl && showAllEl.checked ? '1' : '0';
    const { records } = await api(`/api/records?all=${all}`);
    if (!records.length) {
      recordsWrap.innerHTML = '<p class="hint" style="margin:0;">暂无记录</p>';
      return;
    }
    let html = '<table class="list"><thead><tr><th>时间</th>';
    if (showAllEl && showAllEl.checked) html += '<th>老师</th>';
    html += '<th>货币</th><th>Main Amount</th><th>详情</th><th>总额</th><th>备注</th><th></th></tr></thead><tbody>';
    records.forEach((r) => {
      const time = new Date(r.createdAt).toLocaleString();
      let detail = '';
      if (r.currency === 'MYR') {
        detail = `Rate ${r.rate}；12/24/36期：${fmt(r.breakdown['12'])} / ${fmt(r.breakdown['24'])} / ${fmt(r.breakdown['36'])}`;
      } else {
        detail = `${r.installments} 期，每期 ${fmt(r.perInstallment)}（含手续费 +${r.surcharge}）`;
      }
      html += `<tr>
        <td>${time}</td>
        ${showAllEl && showAllEl.checked ? `<td>${r.username}</td>` : ''}
        <td><span class="tag tag-${r.currency}">${r.currency}</span></td>
        <td>${fmt(r.mainAmount)}</td>
        <td>${detail}</td>
        <td><b>${fmt(r.total)}</b></td>
        <td>${r.note || ''}</td>
        <td><button class="btn-danger small-btn" data-id="${r.id}">删除</button></td>
      </tr>`;
    });
    html += '</tbody></table>';
    recordsWrap.innerHTML = html;
    recordsWrap.querySelectorAll('button[data-id]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('确定删除这条记录？')) return;
        try {
          await api(`/api/records/${btn.dataset.id}`, { method: 'DELETE' });
          loadRecords();
        } catch (e) {
          alert(e.message);
        }
      });
    });
  } catch (e) {
    recordsWrap.innerHTML = `<p class="error">${e.message}</p>`;
  }
}
loadRecords();

// ---------- Admin: user management (仅主账号 owner 可见) ----------
if (currentUser.isOwner) {
  const usersWrap = document.getElementById('usersWrap');
  const userErr = document.getElementById('userErr');

  async function loadUsers() {
    usersWrap.textContent = '加载中…';
    try {
      const { users } = await api('/api/users');
      let html = '<table class="list"><thead><tr><th>用户名</th><th>角色</th><th>创建时间</th><th></th></tr></thead><tbody>';
      users.forEach((u) => {
        const roleLabel = u.isOwner ? '主账号' : u.role === 'admin' ? '管理员' : '老师';
        html += `<tr>
          <td>${u.username}</td>
          <td>${roleLabel}</td>
          <td>${new Date(u.createdAt).toLocaleString()}</td>
          <td>${u.id === currentUser.id ? '' : `<button class="btn-danger small-btn" data-uid="${u.id}">删除</button>`}</td>
        </tr>`;
      });
      html += '</tbody></table>';
      usersWrap.innerHTML = html;
      usersWrap.querySelectorAll('button[data-uid]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          if (!confirm('确定删除该账号？')) return;
          try {
            await api(`/api/users/${btn.dataset.uid}`, { method: 'DELETE' });
            loadUsers();
          } catch (e) {
            alert(e.message);
          }
        });
      });
    } catch (e) {
      usersWrap.innerHTML = `<p class="error">${e.message}</p>`;
    }
  }

  document.getElementById('addUserBtn').addEventListener('click', async () => {
    userErr.textContent = '';
    const username = document.getElementById('newUsername').value.trim();
    const password = document.getElementById('newPassword').value;
    const role = document.getElementById('newIsAdmin').checked ? 'admin' : 'teacher';
    try {
      await api('/api/users', { method: 'POST', body: JSON.stringify({ username, password, role }) });
      document.getElementById('newUsername').value = '';
      document.getElementById('newPassword').value = '';
      document.getElementById('newIsAdmin').checked = false;
      loadUsers();
    } catch (e) {
      userErr.textContent = e.message;
    }
  });

  loadUsers();
}
