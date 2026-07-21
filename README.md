# 课程金额计算器

支持 USD / SGD / MYR 三种货币的课程分期金额计算，带教师账号登录和计算记录保存。

## 计算规则

- **Main Amount**：基础课程金额，任何货币都从这个数字开始算。
- **USD**：分期数 1-9。
  - 1-3 期：整单加 **USD 50**
  - 4-7 期：整单加 **USD 60**
  - 8-9 期：整单加 **USD 80**
  - 总额 = Main Amount + 手续费，每期应付 = 总额 ÷ 分期数
- **SGD**：分期数自填，不管几期，整单固定加 **SGD 40**。
  - 总额 = Main Amount + 40，每期应付 = 总额 ÷ 分期数
- **MYR**：需要自己填当前汇率 Rate（因为汇率每次不一样）。
  - MYR 总额 = Main Amount × Rate，不额外加手续费
  - 自动显示 **12 期 / 24 期 / 36 期** 三种每期应付金额

## 账号

- 每人一个独立账号密码登录。
- 首次启动会自动创建一个管理员账号（用户名/密码见下方"部署"章节），登录后可在页面里新增其他老师账号。
- 管理员可以查看所有老师的历史记录，普通老师只能看到自己的记录。
- 登录后右上角"修改密码"可以自己改密码。

## 本地运行

需要先安装 [Node.js](https://nodejs.org/)（18 以上版本即可）。

```bash
cd course-fee-calculator
npm install
npm start
```

启动后终端会打印默认管理员账号密码（默认 `admin` / `admin123`），浏览器打开 `http://localhost:3000` 即可使用。**登录后请立刻改掉默认密码。**

数据保存在项目目录下的 `db.json` 文件里（首次启动自动生成），不需要额外安装数据库。

## 部署到线上（获得一个真实网址）

推荐用 **Render** 或 **Railway**，都有免费额度，几分钟能上线。以 Render 为例：

1. 把这个项目文件夹上传到一个 GitHub 仓库（新建仓库，把文件拖进去 commit 即可，或用 `git init && git add . && git commit -m init` 后 push）。
2. 打开 [render.com](https://render.com)，注册/登录，点 **New +** → **Web Service**，选择刚才的 GitHub 仓库。
3. 配置：
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. 在 **Environment** 里添加几个环境变量（强烈建议）：
   - `ADMIN_USERNAME` = 你想要的管理员用户名
   - `ADMIN_PASSWORD` = 你想要的管理员密码
   - `JWT_SECRET` = 随便一串自己编的乱码（比如 `x8k2m9p1q7z3`），用于登录加密，不要用默认值
5. 点 Deploy，等几分钟构建完成后，会给你一个 `https://xxx.onrender.com` 的网址，这就是可以分享给其他老师用的正式网址。

**关于数据保存的重要提醒**：这个项目用的是一个 `db.json` 文件存数据，简单省心，但 Render 免费版的磁盘在每次重新部署或服务休眠重启后可能会被清空（即数据不是永久保存的）。如果只是内部小范围试用，这个方案完全够用；如果之后要长期正式使用、不想丢数据，建议加一个 Render 的 **Persistent Disk**（付费，几美元/月），或者告诉我，我可以帮你换成连接真正数据库（比如免费的 Supabase）的版本。

Railway 部署方式类似：New Project → Deploy from GitHub repo → 设置同样的环境变量 → 它会自动识别 `npm start` 启动。Railway 对小项目的持久化存储支持更直接一些。

## 项目结构

```
course-fee-calculator/
  server.js       # 后端服务 + API
  db.js           # 数据库初始化（lowdb，JSON 文件存储）+ 自动建管理员账号
  calc.js         # 计算规则（USD/SGD/MYR）
  public/
    index.html    # 登录页
    dashboard.html# 计算器 + 历史记录 + 管理员面板
    app.js        # 前端逻辑
    style.css     # 样式
```
