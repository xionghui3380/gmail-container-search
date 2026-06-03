# GNG 集装箱管理系统 — Vercel 部署与测试指南

本文档说明如何将当前 Next.js 项目部署到 **Vercel**，并完成 Gmail 联调测试。

---

## 一、部署架构说明

```
国内浏览器
    │
    ├─► Vercel（美国/边缘）  ← Next.js 应用 + API
    │         │
    │         ├─► PostgreSQL（Neon / 自建 / 现有库）
    │         └─► Google Gmail API（oauth2.googleapis.com）
    │
    └─► Google 授权页（accounts.google.com）← 浏览器直连，国内可能需 VPN
```

| 环节 | 部署后效果 |
|------|------------|
| 换 Token、搜邮件、解析 Excel | 在 **Vercel 服务器**执行，不受国内直连 Google 限制 |
| Google 授权页 | 仍由 **浏览器**打开，国内测试建议开 VPN |
| 访问网站 | 国内访问 Vercel 域名，略有延迟但可用 |

---

## 二、部署前准备

### 2.1 代码仓库

1. 将项目推送到 **GitHub / GitLab / Bitbucket**（Vercel 从 Git 拉代码部署）
2. 确认 `.env` **不要**提交到 Git（已在 `.gitignore` 中）

```bash
git add .
git commit -m "prepare for vercel deploy"
git push origin main
```

### 2.2 PostgreSQL 数据库

项目使用 **Prisma + PostgreSQL**，Vercel 本身不提供传统 PG，需任选其一：

| 方案 | 说明 | 推荐场景 |
|------|------|----------|
| **Neon** | 与 Vercel 集成好，有连接池 | 新项目首选 |
| **Vercel Postgres** | 控制台一键创建 | 快速上手 |
| **现有服务器 PG** | 如 `82.157.x.x` | 已有库，需放行 Vercel 出口 IP |

**初始化表结构**（任选一种，在本地执行，连接生产库）：

```bash
# 方式 A：Prisma 同步 schema（项目无 migrations 目录时推荐）
DATABASE_URL="postgresql://..." npx prisma db push

# 方式 B：执行 SQL 文件
psql "$DATABASE_URL" -f prisma/sql/schema.sql

# 创建管理员账号
DATABASE_URL="postgresql://..." npm run db:seed

# 可选：导入订单 Excel
DATABASE_URL="postgresql://..." npm run import:orders
```

默认管理员（seed 脚本）：

- 邮箱：`admin@gng.local`
- 密码：`Admin123456`

> 生产环境请登录后立即修改密码，或改 seed 后再执行。

### 2.3 Google Cloud Console

在 OAuth 客户端 **GNG Web Client** 中补充 **生产环境** 配置（保留 localhost 便于本地开发）：

**已获授权的 JavaScript 来源：**

```
https://你的项目.vercel.app
```

**已获授权的重定向 URI：**

```
https://你的项目.vercel.app/api/v1/gmail/callback
```

若使用自定义域名，把 `你的项目.vercel.app` 换成实际域名。

**OAuth 同意屏幕 → 测试用户：** 添加会用 Gmail 的 Google 账号（如 `xionghui3380@gmail.com`）。

---

## 三、在 Vercel 创建项目

### 3.1 导入仓库

1. 打开 [https://vercel.com](https://vercel.com) 并登录
2. 点击 **Add New → Project**
3. 选择 Git 仓库 `gng_test`（或你的仓库名）
4. **Framework Preset** 应自动识别为 **Next.js**

### 3.2 构建设置（一般保持默认）

| 配置项 | 值 |
|--------|-----|
| Build Command | `npm run build`（默认，已含 `prisma generate`） |
| Output Directory | `.next`（默认） |
| Install Command | `npm install`（默认） |
| Node.js Version | 20.x（推荐） |

可选：在 **Settings → General → Node.js Version** 设为 `20.x`。

### 3.3 环境变量

在 **Settings → Environment Variables** 中添加（Production / Preview / Development 至少 Production 要填）：

| 变量名 | 示例 / 说明 |
|--------|-------------|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/gmg?schema=public` |
| `JWT_SECRET` | 至少 32 位随机字符串（生产环境务必更换） |
| `JWT_ACCESS_EXPIRES` | `15m` |
| `JWT_REFRESH_EXPIRES` | `7d` |
| `GOOGLE_CLIENT_ID` | `xxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-xxx` |
| `GOOGLE_REDIRECT_URI` | `https://你的项目.vercel.app/api/v1/gmail/callback` |
| `GMAIL_DEFAULT_SENDER` | `wenyang@ggtransport.in` |

**注意：**

- `GOOGLE_REDIRECT_URI` 必须与 Google Console 中 **完全一致**（https、无多余斜杠）
- 使用 Neon 时，连接串建议用 **Pooled connection**（带 `-pooler` 主机名），避免 Serverless 连接数过多

### 3.4 首次部署

1. 点击 **Deploy**
2. 等待 Build 完成（约 2～5 分钟）
3. 记录分配的域名，例如：`https://gng-test-xxx.vercel.app`

部署成功后，用该域名更新：

- Vercel 环境变量 `GOOGLE_REDIRECT_URI`
- Google Console 中的 JavaScript 来源与重定向 URI

然后 **Redeploy** 一次使环境变量生效。

---

## 四、部署后验证清单

### 4.1 基础功能

1. 打开 `https://你的域名/login`
2. 使用 `admin@gng.local` / `Admin123456` 登录
3. 进入 `/containers`，确认列表可加载（依赖 `DATABASE_URL` 正确且已建表）

### 4.2 导入订单数据

**方式 A — 本地连生产库执行（推荐）：**

```bash
DATABASE_URL="生产库连接串" npm run import:orders
```

**方式 B — 登录生产站点，页面点击「导入 Excel」上传 `docs/复刻google sheet表.xlsx`**

### 4.3 Gmail 连接

1. 国内测试时，浏览器建议 **开 VPN**
2. 在 `/containers` 点击 **「连接 Gmail」**
3. 使用已加入 **测试用户** 的 Google 账号授权
4. 成功后 URL 带 `gmail_connected=true`，按钮变为 **「Gmail 已连接」**

### 4.4 邮件解析入库

1. 点击某个 **柜号** 进入详情页 `/containers/[containerNo]`
2. 点击 **「从 Gmail 解析」**
3. 查看：仓库汇总、派送明细、解析日志
4. 可导出 CSV 验证

### 4.5 行内邮件搜索

列表操作列 **「邮件」** 按钮，按柜号搜索 Gmail 并预览 Excel 附件。

---

## 五、常见问题

### 5.1 `redirect_uri_mismatch`

- 检查 Vercel 的 `GOOGLE_REDIRECT_URI` 与 Google Console 是否一致
- 改完后 Redeploy

### 5.2 `403 access_denied`（Google）

- OAuth 同意屏幕为「测试中」→ 把当前 Google 账号加入 **测试用户**

### 5.3 部署成功但列表为空 / 500

- 检查 `DATABASE_URL` 是否正确
- 确认已执行 `prisma db push` 或 `schema.sql`
- 在 Vercel **Deployments → 某次部署 → Functions → Logs** 查看错误

### 5.4 数据库连接失败（Serverless）

- 使用 Neon **连接池** URL
- 或在 Prisma 连接串后加：`?connection_limit=1`（临时缓解）

### 5.5 Gmail 解析超时

Vercel **Hobby** 计划 Serverless 函数默认最长 **10 秒**，复杂邮件解析可能超时。

处理方式：

1. 升级到 **Pro**，并在解析 API 路由增加：

```ts
// src/app/api/v1/containers/by-no/[containerNo]/route.ts
export const maxDuration = 60;
```

2. 或先测试「邮件搜索 + 预览」，解析逻辑后续优化

### 5.6 使用国内现有 PostgreSQL（82.157.x.x）

- 需在数据库防火墙 **放行 Vercel 出口 IP**（Vercel IP 不固定，实践中较麻烦）
- **更推荐**：Neon / Supabase 等与 Vercel 同区域的数据库

---

## 六、自定义域名（可选）

1. Vercel 项目 → **Settings → Domains** → 添加域名
2. 按提示配置 DNS CNAME
3. 更新 `GOOGLE_REDIRECT_URI` 与 Google Console 为 `https://你的域名/api/v1/gmail/callback`
4. Redeploy

---

## 七、环境变量速查（复制模板）

```env
# 数据库
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/gmg?schema=public

# JWT
JWT_SECRET=请替换为至少32位随机字符串
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# Google OAuth
GOOGLE_CLIENT_ID=你的ClientID.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-你的Secret
GOOGLE_REDIRECT_URI=https://你的项目.vercel.app/api/v1/gmail/callback

# Gmail 搜索默认发件人
GMAIL_DEFAULT_SENDER=wenyang@ggtransport.in
```

---

## 八、推荐部署顺序（ checklist ）

- [ ] 代码推送到 Git
- [ ] 准备 PostgreSQL 并执行建表 + seed
- [ ] Vercel 导入项目并配置环境变量
- [ ] Google Console 添加生产域名回调 URI
- [ ] 首次 Deploy 成功
- [ ] 更新 `GOOGLE_REDIRECT_URI` 为真实域名后 Redeploy
- [ ] 登录测试 → 导入 Excel → 连接 Gmail → 解析测试

---

## 九、本地 vs Vercel 对比

| 项目 | 本地 `localhost:3000` | Vercel 生产 |
|------|----------------------|-------------|
| Gmail 换 Token | 国内常失败，需代理 | 正常 |
| Google 授权页 | 国内可能慢 | 浏览器仍可能需 VPN |
| 数据库 | 本地 / 远程均可 | 需公网可访问的 PG |
| HTTPS | 否 | 是（Cookie secure 生效） |

完成以上步骤后，即可在美国服务器环境稳定测试 Gmail 集成功能。
