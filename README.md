# 课程金额计算器

支持 USD / SGD / MYR 三种货币的课程分期金额计算，带教师账号登录和计算记录保存。

## 计算规则

- **Main Amount**：基础课程金额，任何货币都从这个数字开始算。
- - **Deposit（订金，选填）**：先用 Main Amount（或 Revision 半价）减去 Deposit，剩下的金额才拿去算手续费/分期。
  - - **Revision（勾选后生效）**：金额变成 Main Amount 的一半，固定分 **9 期**，不加任何手续费。三种货币都支持。
    - - **USD**：分期数从 1 起不设上限。
      -   - 1-3 期：整单加 **USD 50**
          -   - 4-7 期：整单加 **USD 60**
              -   - 8 期及以上：整单加 **USD 80**
                  -   - 总额 = 基础金额 + 手续费，每期应付 = 总额 ÷ 分期数
                      - - **SGD**：分期数自填，不管几期，整单固定加 **SGD 40**。
                        -   - 总额 = 基础金额 + 40，每期应付 = 总额 ÷ 分期数
                            - - **MYR**：需要自己填当前汇率 Rate（因为汇率每次不一样）。
                              -   - MYR 总额 = 基础金额 × Rate，不额外加手续费
                                  -   - 总额会做特殊取整：整数部分个位数字是 1-7 时，向上调整到个位为 7（例如 6216.65 会变成 6217）；个位是 0/8/9 时保持原样不调整
                                      -   - 自动显示 **12 期 / 24 期 / 36 期** 三种每期应付金额供参考（Revision 模式下固定显示 9 期，不做这个取整）
                                       
                                          - ## 账号
                                       
                                          - - 每人一个独立账号密码登录。
                                            - - 首次启动会自动创建一个"主账号"（owner，用户名/密码见下方"部署"章节）。**只有主账号能看到/管理"教师账号管理"面板**（新增、删除账号），其他账号即使被设为管理员也看不到这个面板。
                                              - - 管理员（role = admin）可以勾选查看所有老师的历史记录，普通老师只能看到自己的记录。
                                                - - 登录后右上角"修改密码"可以自己改密码。
                                                 
                                                  - ## 本地运行
                                                 
                                                  - 需要先安装 [Node.js](https://nodejs.org/)（18 以上版本即可）。
                                                 
                                                  - ```bash
                                                    cd course-fee-calculator
                                                    npm install
                                                    npm start
                                                    ```

                                                    启动后终端会打印默认管理员账号密码（默认 `admin` / `admin123`），浏览器打开 `http://localhost:3000` 即可使用。**登录后请立刻改掉默认密码。**

                                                    数据保存在 Postgres 数据库里，需要设置 `DATABASE_URL` 环境变量指向一个 Postgres 实例（本地测试可以用 [Postgres.app](https://postgresapp.com/) 之类的工具装一个）。首次启动会自动建表。

                                                    ## 部署到线上（获得一个真实网址）

                                                    推荐用 **Render** 或 **Railway**，都有免费额度，几分钟能上线。以 Render 为例：

                                                    1. 把这个项目文件夹上传到一个 GitHub 仓库（新建仓库，把文件拖进去 commit 即可，或用 `git init && git add . && git commit -m init` 后 push）。
                                                    2. 2. 打开 [render.com](https://render.com)，注册/登录，点 **New +** → **Web Service**，选择刚才的 GitHub 仓库。
                                                       3. 3. 配置：
                                                          4.    - **Build Command**: `npm install`
                                                                -    - **Start Command**: `npm start`
                                                                     - 4. 在 **Environment** 里添加几个环境变量（强烈建议）：
                                                                       5.    - `ADMIN_USERNAME` = 你想要的管理员用户名
                                                                             -    - `ADMIN_PASSWORD` = 你想要的管理员密码
                                                                                  -    - `JWT_SECRET` = 随便一串自己编的乱码（比如 `x8k2m9p1q7z3`），用于登录加密，不要用默认值
                                                                                       - 5. 在同一个 Render 项目里新建一个 **PostgreSQL** 数据库（New + → Postgres），免费版有 1GB 空间，30 天后需要升级到付费档位才能继续保留（到期前 Render 会提醒）。
                                                                                         6. 6. 回到 Web Service 的 Environment 设置里，添加 `DATABASE_URL` 环境变量，值选择刚才建的那个 Postgres 数据库（Render 支持直接从下拉列表选数据库，会自动填连接串）。
                                                                                            7. 7. 点 Deploy，等几分钟构建完成后，会给你一个 `https://xxx.onrender.com` 的网址，这就是可以分享给其他老师用的正式网址。
                                                                                              
                                                                                               8. **关于数据保存**：现在用的是真正的 Postgres 数据库，账号和记录不会因为重新部署或服务休眠而丢失。唯一要注意的是 Render 免费版 Postgres 有 30 天有效期，到期前需要升级到付费档位（几美元/月起）才能继续保留数据，否则数据库会被删除。
                                                                                              
                                                                                               9. Railway 部署方式类似：New Project → Deploy from GitHub repo → 设置同样的环境变量 → 它会自动识别 `npm start` 启动。Railway 对小项目的持久化存储支持更直接一些。
                                                                                              
                                                                                               10. ## 项目结构
                                                                                              
                                                                                               11. ```
                                                                                                   course-fee-calculator/
                                                                                                     server.js       # 后端服务 + API
                                                                                                     db.js           # 数据库初始化（Postgres，pg 库）+ 自动建主账号
                                                                                                     calc.js         # 计算规则（USD/SGD/MYR）
                                                                                                     public/
                                                                                                       index.html    # 登录页
                                                                                                       dashboard.html# 计算器 + 历史记录 + 管理员面板
                                                                                                       app.js        # 前端逻辑
                                                                                                       style.css     # 样式
                                                                                                   ```
