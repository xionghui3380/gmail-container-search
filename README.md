<div align="center">

# GNG · 集装箱操作管理系统

**Next.js 14 全栈实战 | Gmail 自动检索 | Excel 派送表解析 | 可编辑大表**

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.x-indigo?logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-blue?logo=postgresql)](https://www.postgresql.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.x-cyan?logo=tailwind-css)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green)]()

</div>

---

> **这套系统不是玩具 Demo** — 它来自真实的海运货代业务场景，覆盖了从 Gmail 邮件自动检索、Excel 派送表解析入库、到 23 字段可编辑大表的全链路。每一个模块都解决了实际问题，每一行代码都配有详细教程。

## 为什么关注这个项目？

如果你正在研究以下任何一个问题，这个项目会给你直接可用的答案：

- **如何在 Next.js API Routes 中调用 Gmail API？**（OAuth 2.0 全流程 + Token 刷新）
- **如何用 ExcelJS 解析不固定表头的 Excel 文件？**（动态列映射 + FBA 字段识别）
- **如何在 React 中实现 23+ 列的可编辑大表？**（行内编辑 + 拖拽排序 + 历史快照）
- **如何设计一套 JWT 双 Token 认证？**（Access + Refresh + RBAC 三角色）
- **如何用 Prisma 管理复杂关联模型？**（订单 → 货柜 → 附件 → 派送明细 四级嵌套）

---

## 核心功能一览

| 模块 | 能力 | 对应源码 | 深入阅读 |
|------|------|---------|---------|
| **JWT 认证** | 双 Token（Access + Refresh）、RBAC 三角色（admin/operator/viewer）、HttpOnly Cookie | [src/lib/auth.ts](src/lib/auth.ts) | [JWT 双 Token 认证实战 →](https://devcfg.com/case/container-ops/jwt-rbac-auth/) |
| **Gmail 检索** | OAuth 2.0 授权、按柜号搜索邮件、自动下载 Excel/CSV 附件 | [src/lib/gmail.ts](src/lib/gmail.ts) | [Gmail API 按柜号检索 →](https://devcfg.com/case/container-ops/gmail-container-search/) |
| **Excel 解析** | 动态表头识别、FBA/仓库/箱数字段映射、warehouse_summaries 汇总 | [src/lib/](src/lib/) | [Excel 派送表解析引擎 →](https://devcfg.com/case/container-ops/delivery-excel-parser/) |
| **解析流水线** | 批次追踪（batch_no）、幂等锁防并发、parse_logs 审计日志、Prisma 事务 | [src/app/api/v1/containers/](src/app/api/v1/containers/) | [ETL 流水线设计 →](https://devcfg.com/case/container-ops/parse-etl-pipeline/) |
| **可编辑大表** | 23 字段行内编辑、dnd-kit 列/行拖拽、localStorage 列偏好、历史快照版本管理 | [src/app/google-sheet/page.tsx](src/app/google-sheet/page.tsx) | [可编辑大表与历史快照 →](https://devcfg.com/case/container-ops/editable-cargo-sheet/) |
| **CRUD 模板** | Zod 校验 + Prisma Mapper + 分页查询，可直接复用的工程模板 | [src/app/api/v1/customers/](src/app/api/v1/customers/) | [CRUD 列表模板最佳实践 →](https://devcfg.com/case/container-ops/crud-list-template/) |

---

## 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         浏览器（前端）                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐   │
│  │ 登录页面   │  │ 订单管理   │  │ Google Sheet│  │ 解析日志/仓库汇总 │   │
│  └──────────┘  └──────────┘  └─────┬────┘  └───────────────┘   │
└──────────────────────────────────────┼──────────────────────────┘
                                       │ fetch + JWT Cookie
┌──────────────────────────────────────┼──────────────────────────┐
│                    Next.js API Routes (Node.js)                   │
│                                      │                           │
│  ┌─────────────┐  ┌──────────┐  ┌────▼─────┐  ┌──────────────┐  │
│  │ /auth/*     │  │ /orders/* │  │ /gmail/* │  │ /containers/*│  │
│  │ JWT 签发验证  │  │ 订单 CRUD │  │ OAuth+搜索│  │ 解析流水线    │  │
│  └─────────────┘  └──────────┘  └────┬─────┘  └──────┬───────┘  │
│                                       │               │          │
│              ┌────────────────────────┘               │          │
│              ↓                                        ↓          │
│  ┌────────────────┐                      ┌──────────────────┐   │
│  │  Gmail API     │                      │  ExcelJS 解析     │   │
│  │  (googleapis)  │                      │  动态表头/FBA映射  │   │
│  └───────┬────────┘                      └────────┬─────────┘   │
│          │ 下载附件 Buffer                        │              │
│          └─────────────────┬─────────────────────┘              │
│                            ↓                                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Prisma ORM (TypeScript 类型安全)              │    │
│  │  users · orders · containers · google_sheet              │    │
│  │  attachments · delivery_items · warehouse_summaries      │    │
│  │  parse_logs · container_parse_meta                       │    │
│  └────────────────────────┬────────────────────────────────┘    │
└───────────────────────────┼─────────────────────────────────────┘
                            ↓
                   ┌─────────────────┐
                   │  PostgreSQL/Neon │
                   └─────────────────┘
```

> 想深入了解每一层的设计决策？阅读 [系统架构设计全文 →](https://devcfg.com/case/container-ops/system-architecture/)

---

## 技术栈

| 分类 | 技术 | 版本 | 用途 |
|------|------|------|------|
| **框架** | [Next.js](https://nextjs.org/) | 14.2 | App Router 全栈框架（SSR + API Routes） |
| **语言** | [TypeScript](https://www.typescriptlang.org/) | 5.x | 全项目类型安全 |
| **数据库** | [PostgreSQL](https://www.postgresql.org/) / [Neon](https://neon.tech/) | - | 关系型数据库（Serverless 可选） |
| **ORM** | [Prisma](https://www.prisma.io/) | 5.x | 类型安全的数据库访问 + 迁移管理 |
| **认证** | [jose](https://github.com/panva/jose) | 6.x | JWT 签发验证（Edge Runtime 兼容） |
| **加密** | [bcryptjs](https://github.com/dcodeIO/bcrypt.js) | - | 密码哈希 |
| **校验** | [Zod](https://zod.dev/) | 4.x | API 请求体 + 表单数据验证 |
| **邮件** | [googleapis](https://github.com/googleapis/google-api-nodejs-client) | 173.x | Gmail API 客户端（OAuth 2.0） |
| **Excel** | [ExcelJS](https://github.com/exceljs/exceljs) | 4.x | `.xlsx` / `.xls` 解析 |
| **拖拽** | [@dnd-kit](https://dndkit.com/) | 6.x | 行/列拖拽排序 |
| **样式** | [Tailwind CSS](https://tailwindcss.com/) | 3.x | 原子化 CSS |
| **图标** | [lucide-react](https://lucide.dev/) | - | SVG 图标库 |
| **提示** | [sonner](https://github.com/emilkowalski/sonner) | - | Toast 消息 |
| **日期** | [date-fns](https://date-fns.org/) | 4.x | 日期格式化 |

---

## 快速开始

### 1. 克隆 & 安装

```bash
git clone <your-repo-url>
cd gng_test
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，填写以下配置：

```env
# 数据库
DATABASE_URL="postgresql://user:password@host:5432/dbname?schema=public"

# JWT（至少 32 字符）
JWT_SECRET="your-secret-key-at-least-32-chars-long"
JWT_ACCESS_EXPIRES="15m"
JWT_REFRESH_EXPIRES="7d"

# Gmail OAuth（从 Google Cloud Console 获取）
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-your-secret"
GOOGLE_REDIRECT_URI="http://localhost:3000/api/v1/gmail/callback"
GMAIL_DEFAULT_SENDER="sender@example.com"
```

> 不清楚如何获取 Gmail OAuth 凭据？参考 [Gmail API 按柜号检索教程 →](https://devcfg.com/case/container-ops/gmail-container-search/)

### 3. 初始化数据库

```bash
# 生成 Prisma Client
npm run db:generate

# 初始化解析相关表结构
npm run db:ensure-parse

# 创建默认管理员账户
npm run db:seed
```

### 4. 启动开发服务器

```bash
npm run dev
```

访问 `http://localhost:3000`，使用默认账户登录：

| 账号 | 密码 |
|------|------|
| `admin@gng.local` | `Admin123456` |

---

## 数据模型

系统包含 9 个核心数据模型，覆盖完整的业务链路：

```
users（用户）
  │
  ├──< orders（订单）
  │       │
  │       └──< containers（货柜解析记录）
  │                   │
  │                   └──< attachments（附件）
  │                                │
  │                                └──< delivery_items（派送明细）
  │
  ├──< google_sheet（货柜操作大表 · 23 字段）
  │       │
  │       ├──< google_sheet_history（历史快照版本）
  │       └── container_parse_meta（解析元数据）
  │
  └──< customers（客户管理）

warehouse_summaries（仓库汇总 · 独立统计表）
parse_logs（解析审计日志 · 独立日志表）
```

完整的 Prisma Schema 定义见 [prisma/schema.prisma](prisma/schema.prisma)。

---

## API 路由总览

| 方法 | 路由 | 说明 |
|------|------|------|
| POST | `/api/v1/auth/login` | 登录，返回双 Token |
| POST | `/api/v1/auth/logout` | 登出，清除 Cookie |
| GET | `/api/v1/auth/me` | 获取当前用户信息 |
| GET | `/api/v1/gmail/auth` | Gmail OAuth 授权跳转 |
| GET | `/api/v1/gmail/callback` | OAuth 回调，交换 Token |
| GET | `/api/v1/gmail/search` | 按柜号搜索邮件 |
| GET | `/api/v1/gmail/message/:id` | 获取邮件详情 + Excel 解析 |
| GET/POST | `/api/v1/orders` | 订单列表 / 创建订单 |
| GET/POST | `/api/v1/containers` | 货柜解析记录 |
| POST | `/api/v1/containers/by-no/:no/parse-attachment` | 解析指定附件 |
| GET/POST | `/api/v1/google-sheet` | 货柜操作大表 CRUD |
| GET/POST | `/api/v1/customers` | 客户管理 CRUD |
| GET | `/api/v1/parse-logs` | 解析日志查询 |
| GET | `/api/v1/warehouse-summaries` | 仓库汇总查询 |
| GET | `/api/v1/attachments/:id/download` | 下载附件 |

---

## 项目结构

```
gng_test/
├── prisma/
│   ├── schema.prisma              # 数据模型定义（9 个 model）
│   ├── seed.ts                    # 种子数据（默认管理员）
│   └── sql/                       # SQL 迁移脚本
├── src/
│   ├── app/
│   │   ├── api/v1/                # 后端 API（按模块组织）
│   │   │   ├── auth/              # 认证（登录/登出/me）
│   │   │   ├── gmail/             # Gmail OAuth + 搜索 + 详情
│   │   │   ├── orders/            # 订单管理
│   │   │   ├── containers/        # 货柜解析记录
│   │   │   ├── google-sheet/      # 货柜操作大表
│   │   │   ├── customers/         # 客户管理
│   │   │   ├── parse-logs/        # 解析日志
│   │   │   └── warehouse-summaries/# 仓库汇总
│   │   ├── login/                 # 登录页
│   │   ├── orders/                # 订单管理页
│   │   ├── containers/            # 解析结果页
│   │   ├── google-sheet/          # 货柜操作大表页
│   │   ├── customers/             # 客户管理页
│   │   ├── parse-logs/            # 解析日志页
│   │   └── warehouse-summaries/   # 仓库汇总页
│   ├── components/                # React 组件
│   │   ├── layout/                # 布局组件（Sidebar 等）
│   │   ├── GmailSearchDialog.tsx  # Gmail 搜索弹框
│   │   └── ContainerHistoryDialog.tsx
│   ├── lib/                       # 服务端工具库
│   │   ├── auth.ts                # JWT 认证
│   │   ├── gmail.ts               # Gmail API 封装
│   │   ├── prisma.ts              # Prisma 单例
│   │   ├── validators.ts          # Zod 校验
│   │   └── ...
│   ├── hooks/                     # React Hooks
│   └── middleware.ts              # 路由守卫
├── docs/                          # 项目文档（含教程）
└── package.json
```

---

## 系列教程（8 篇完整实战）

> 每篇文章都基于本项目源码，从设计思路到代码实现逐行讲解。
> 博客地址：[https://devcfg.com/case/container-ops/](https://devcfg.com/case/container-ops/)

| 篇 | 标题 | 核心知识点 | 阅读链接 |
|----|------|-----------|---------|
| 01 | 系统架构设计 | Next.js 全栈分层、Prisma 数据模型设计、技术选型 | [阅读 →](https://devcfg.com/case/container-ops/system-architecture/) |
| 02 | JWT 双 Token 认证 | HttpOnly Cookie、Access/Refresh Token、RBAC 三角色 | [阅读 →](https://devcfg.com/case/container-ops/jwt-rbac-auth/) |
| 03 | Gmail API 检索 | OAuth 2.0 全流程、按柜号搜索、附件下载 Buffer | [阅读 →](https://devcfg.com/case/container-ops/gmail-container-search/) |
| 04 | Excel 派送表解析 | ExcelJS 动态表头、FIELD_ALIASES 列映射、仓库汇总 | [阅读 →](https://devcfg.com/case/container-ops/delivery-excel-parser/) |
| 05 | 解析 ETL 流水线 | Prisma 事务边界、幂等锁、parse_logs 审计日志 | [阅读 →](https://devcfg.com/case/container-ops/parse-etl-pipeline/) |
| 06 | 可编辑大表 | 23 字段行内编辑、dnd-kit 拖拽、localStorage 列偏好 | [阅读 →](https://devcfg.com/case/container-ops/editable-cargo-sheet/) |
| 07 | CRUD 工程模板 | Zod 校验 + Prisma Mapper + 分页查询标准范式 | [阅读 →](https://devcfg.com/case/container-ops/crud-list-template/) |
| 08 | Vercel 部署上线 | Neon 数据库、OAuth 生产配置、派送表导出 | [阅读 →](https://devcfg.com/case/container-ops/deploy-and-export/) |

### 推荐阅读路线

```
初学者（建立全局认知）：
  ① 架构设计 → ② JWT 认证 → ⑦ CRUD 模板 → ⑧ 部署上线

全栈工程师（完整掌握）：
  ① → ② → ③ → ④ → ⑤ → ⑥ → ⑦ → ⑧（按顺序）

按需查阅：
  只看 Gmail 集成 → ③
  只看 Excel 解析 → ④ + ⑤
  只看前端大表   → ⑥
```

---

## 本地文档

项目 `docs/` 目录包含配套学习文档（适合离线阅读）：

| 文档 | 内容 |
|------|------|
| [docs/README.md](docs/README.md) | 文档总索引 |
| [docs/01-一日学习计划.md](docs/01-一日学习计划.md) | 8 小时学习路线（Vue/Java 背景） |
| [docs/02-Next.js与React速成(Vue-Java对照).md](docs/02-Next.js与React速成(Vue-Java对照).md) | Next.js / React 概念对照速查 |
| [docs/03-技术栈速查(TypeScript-Prisma-Zod).md](docs/03-技术栈速查(TypeScript-Prisma-Zod).md) | TS、Prisma、Zod 速查表 |
| [docs/04-请求链路详解(从点击到数据库).md](docs/04-请求链路详解(从点击到数据库).md) | 登录 / CRUD / Gmail 解析链路 |
| [docs/05-手写CRUD列表完整教程.md](docs/05-手写CRUD列表完整教程.md) | 手写增删改查列表（练手必读） |
| [docs/06-Gmail检索与解析说明.md](docs/06-Gmail检索与解析说明.md) | Gmail 搜邮件 / 解析 / 入库全链路 |
| [docs/07-Excel解析说明.md](docs/07-Excel解析说明.md) | 派送表 Excel/CSV 解析、列映射、入库 |
| [docs/项目导读.md](docs/项目导读.md) | 目录、API、数据模型、精读清单 |

---

## 常用命令

```bash
# 开发
npm run dev              # 启动开发服务器
npm run build            # 构建生产版本
npm run start            # 启动生产服务器
npm run lint             # 代码检查

# 数据库
npm run db:generate      # 生成 Prisma Client
npm run db:seed          # 创建种子数据（默认管理员）
npm run db:ensure-parse  # 初始化解析相关表结构
npm run db:customers     # 创建客户表
npm run db:orders        # 创建订单表
npm run db:google-sheet  # 创建 Google Sheet 表
```

---

## 主要页面

| 路由 | 说明 |
|------|------|
| `/login` | 登录页面 |
| `/orders` | 订单管理（创建订单 → 触发 Gmail 检索） |
| `/containers` | 解析结果（货柜级别，含附件和派送明细） |
| `/google-sheet` | 货柜操作大表（23 字段可编辑 + 拖拽排序） |
| `/customers` | 客户管理（CRUD 模板示例） |
| `/parse-logs` | 解析审计日志 |
| `/warehouse-summaries` | 仓库汇总统计 |

---

<div align="center">

## 相关链接

**完整系列教程** | [devcfg.com/case/container-ops](https://devcfg.com/case/container-ops/)

**技术博客** | [devcfg.com](https://devcfg.com)

---

如果这个项目对你有帮助，欢迎 Star 支持一下。

</div>
