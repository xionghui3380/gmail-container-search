# GNG 项目 — 学习文档总索引

> 面向 **有 Vue / Java 经验、无 Next.js 经验** 的开发者。目标：**一天内建立完整概念**，并能独立阅读与修改本项目代码。

---

## 推荐阅读顺序

| 顺序 | 文档 | 用时 | 你会得到什么 |
|------|------|------|--------------|
| **0** | 本文（索引） | 5 分钟 | 全局地图 |
| **1** | [01-一日学习计划.md](./01-一日学习计划.md) | 全天 | 按小时拆分的阅读 + 动手任务 |
| **2** | [02-Next.js与React速成(Vue-Java对照).md](./02-Next.js与React速成(Vue-Java对照).md) | 2～3 小时 | Next.js / React 概念，对照 Vue / Spring |
| **3** | [03-技术栈速查(TypeScript-Prisma-Zod).md](./03-技术栈速查(TypeScript-Prisma-Zod).md) | 1～1.5 小时 | TS、Prisma、Zod、Tailwind 在本项目中的用法 |
| **4** | [04-请求链路详解(从点击到数据库).md](./04-请求链路详解(从点击到数据库).md) | 1.5～2 小时 | 登录、CRUD、Gmail 解析三条完整链路 |
| **5** | [05-手写CRUD列表完整教程.md](./05-手写CRUD列表完整教程.md) | 2～3 小时 | **动手**：从路由到 API 到页面完整 CRUD |
| **6** | [06-Gmail检索与解析说明.md](./06-Gmail检索与解析说明.md) | 1～2 小时 | Gmail OAuth、搜邮件、两条解析线、入库 |
| **7** | [07-Excel解析说明.md](./07-Excel解析说明.md) | 1 小时 | 派送表 xlsx/csv 解析、列映射、汇总规则 |
| **8** | [项目导读.md](./项目导读.md) | 按需查阅 | 目录结构、API 表、数据模型、精读清单 |

---

## 一句话理解本项目

**Next.js 全栈应用**：React 页面在浏览器里 `fetch` 同域 API；API 在 Node 里跑 Prisma 查 PostgreSQL；Gmail / Excel 解析在 Service 层完成。

```
Vue 页面 (React)  →  fetch /api/v1/...  →  Spring Controller (route.ts)
                                              ↓
                                         Service (lib/*-service.ts)
                                              ↓
                                         MyBatis 等价物 (Prisma)
                                              ↓
                                         PostgreSQL
```

---

## 环境与启动（第一天上午必做）

```bash
cd /Volumes/MovingSpace/aiworkspack/gng_test
cp .env.example .env          # 填 DATABASE_URL、JWT_SECRET、Gmail 等
npm install
npm run db:ensure-parse
npm run db:seed
npm run dev
```

- 地址：http://localhost:3000  
- 账号：`admin@gng.local` / `Admin123456`  
- Gmail 解析前：浏览器访问 `/api/v1/gmail/auth` 完成 OAuth  

---

## 核心源码（先记住这 10 个文件）

| 文件 | 类比（Java / Vue） |
|------|---------------------|
| `src/middleware.ts` | Spring `Filter` / Vue Router `beforeEach` |
| `src/lib/auth.ts` | JWT 工具类 + Cookie 管理 |
| `src/app/api/v1/**/route.ts` | `@RestController` |
| `src/lib/*-service.ts` | `@Service` 业务层 |
| `src/lib/*-mapper.ts` | DTO → Entity 转换 |
| `src/lib/*-validators.ts` | `@Valid` + Bean Validation（Zod） |
| `src/app/**/page.tsx` | Vue 单文件组件的「页面版」 |
| `prisma/schema.prisma` | JPA Entity + DDL |
| `src/lib/order-parse-service.ts` | **核心业务** Gmail 解析 |
| `src/components/layout/DashboardLayout.tsx` | 布局壳（类似 layout 组件） |

---

## 业务模块速览

| 路由 | 业务 |
|------|------|
| `/login` | 登录 |
| `/orders` | 订单 CRUD + 「检索」触发 Gmail 解析 |
| `/containers` | 解析结果（按柜号 + 批次） |
| `/parse-logs` | 解析步骤日志 |
| `/warehouse-summaries` | 按仓库汇总箱数 |
| `/google-sheet` | 23 列大表（另一套业务线） |

---

## 学完后你应该能回答

1. `"use client"` 和没有这行字的组件有什么区别？  
2. 为什么 `middleware.ts` 里不能写 `prisma.users.findFirst`？  
3. 订单页点「检索」时，浏览器、API、Service、数据库各做了什么？  
4. `google_sheet` 表和 `containers` 表分别服务哪条业务线？  
5. 新增一个列表页需要改哪几个文件？  

答案分布在 **02～04** 与 **项目导读** 中；一日计划里每阶段末尾有自测题。

---

*文档与代码同步维护，以 `prisma/schema.prisma` 与 `src/app/api/v1/` 为准。*
