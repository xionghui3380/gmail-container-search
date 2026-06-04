# GNG 管理系统

Next.js 14 + Prisma + PostgreSQL，包含订单管理、Gmail 解析、Google Sheet 等模块。

## 学习文档（推荐从这里开始）

| 文档 | 说明 |
|------|------|
| **[docs/README.md](docs/README.md)** | 文档总索引 |
| [docs/01-一日学习计划.md](docs/01-一日学习计划.md) | 8 小时学习路线（Vue/Java 背景） |
| [docs/02-Next.js与React速成(Vue-Java对照).md](docs/02-Next.js与React速成(Vue-Java对照).md) | Next.js / React 概念对照 |
| [docs/03-技术栈速查(TypeScript-Prisma-Zod).md](docs/03-技术栈速查(TypeScript-Prisma-Zod).md) | TS、Prisma、Zod |
| [docs/04-请求链路详解(从点击到数据库).md](docs/04-请求链路详解(从点击到数据库).md) | 登录 / CRUD / Gmail 解析链路 |
| [docs/05-手写CRUD列表完整教程.md](docs/05-手写CRUD列表完整教程.md) | **手写增删改查列表（练手必读）** |
| [docs/06-Gmail检索与解析说明.md](docs/06-Gmail检索与解析说明.md) | **Gmail 搜邮件 / 解析 / 入库全链路** |
| [docs/07-Excel解析说明.md](docs/07-Excel解析说明.md) | **派送表 Excel/CSV 解析、列映射、入库** |
| [docs/项目导读.md](docs/项目导读.md) | 目录、API、数据模型、精读清单 |

## 环境配置

复制 `.env.example` 为 `.env`，配置 `DATABASE_URL`、JWT 与 Gmail OAuth。

## 常用命令

```bash
npm install
npm run db:ensure-parse   # 初始化/补齐解析相关表结构
npm run db:seed           # 创建默认管理员
npm run dev
```

默认管理员：`admin@gng.local` / `Admin123456`

## 主要页面

| 路由 | 说明 |
|------|------|
| `/orders` | 订单管理 |
| `/containers` | 解析结果 |
| `/parse-logs` | 解析日志 |
| `/warehouse-summaries` | 仓库汇总 |
| `/google-sheet` | Google Sheet |
