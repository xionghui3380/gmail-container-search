# Gmail API + ExcelJS 集成教程 — 邮箱自动搜索模块

## 目录

1. [功能目标](#1-功能目标)
2. [技术栈对比与 Node.js 的角色](#2-技术栈对比与-nodejs-的角色)
3. [前置知识：OAuth 2.0 是什么？](#3-前置知识oauth-20-是什么)
4. [第一步：Google Cloud 控制台配置（图文详解）](#4-第一步google-cloud-控制台配置图文详解)
5. [第二步：安装依赖包](#5-第二步安装依赖包)
6. [第三步：创建 Gmail 客户端封装库](#6-第三步创建-gmail-客户端封装库)
7. [第四步：创建 OAuth 授权接口](#7-第四步创建-oauth-授权接口)
8. [第五步：创建邮件搜索接口](#8-第五步创建邮件搜索接口)
9. [第六步：创建邮件详情接口（含 Excel 附件解析）](#9-第六步创建邮件详情接口含-excel-附件解析)
10. [第七步：前端集成 — 搜索按钮 + 结果弹框](#10-第七步前端集成--搜索按钮--结果弹框)
11. [第八步：端到端测试流程](#11-第八步端到端测试流程)
12. [常见问题排查手册](#12-常见问题排查手册)

---

## 1. 功能目标

### 需求回顾（来自程序设计文档）

```
系统需要根据柜号自动搜索 Gmail 邮件。

搜索条件：
  from:wenyang@ggtransport.in {containerNo}

例如：
  from:wenyang@ggtransport.in EGSU6027772

要求：
  · 能搜索到对应邮件
  · 能读取邮件标题、正文、时间、发件人
  · 能判断邮件中是否有 Excel 附件
  · 判断是否从邮件中获取到需要的信息，如果失败有提示
```

### 最终效果预览

用户在集装箱管理页面点击「搜索邮件」按钮 → 弹出 Gmail 授权（首次）→ 自动按柜号搜索 → 展示匹配的邮件列表 → 点击某封邮件可查看详情和 Excel 附件内容。

---

## 2. 技术栈对比与 Node.js 的角色

### 你列出的技术栈 vs 当前项目

| 技术 | 状态 | 说明 |
|------|------|------|
| **Next.js** | ✅ 已有 | 全栈框架，API Routes 就是服务端 |
| **Node.js** | ✅ 已有（隐含） | Next.js 运行时就是 Node.js |
| **TypeScript** | ✅ 已有 | 全项目类型安全 |
| **PostgreSQL / Neon** | ✅ 已有 | 通过 Prisma 连接 |
| **Gmail API** | 🆕 新增 | 通过 `googleapis` npm 包调用 |
| **ExcelJS** | 🆕 新增 | 解析邮件中的 `.xlsx` / `.xls` 附件 |
| **Prisma** | ✅ 已有 | 数据库 ORM |
| **Vercel** | 可选 | 部署平台，本地开发不需要 |

### Node.js 在 Next.js 中的位置（重要概念）

很多初学者会困惑：「Next.js 是 React 框架，那我的后端逻辑写在哪里？」

答案是：**Next.js 的 API Routes 就是你的 Node.js 后端。**

```
传统架构（前后端分离）:
┌─────────────┐        ┌──────────────┐
│  React 前端   │  HTTP  │  Express/Koa  │
│  (端口3000)   │ ←→    │  后端(端口8000) │
└─────────────┘        └──────────────┘


Next.js 全栈架构（本项目采用）:
┌─────────────────────────────────────┐
│           Next.js 应用               │
│                                     │
│  src/app/containers/page.tsx        │  ← 前端页面（React）
│  src/app/api/gmail/search/route.ts  │  ← 后端接口（Node.js）
│  src/app/api/v1/containers/route.ts │  ← 后端接口（Node.js）
│  src/lib/gmail.ts                   │  ← 服务端工具库（Node.js）
│                                     │
│  所有这些文件都运行在同一个 Node.js 进程中！     │
└─────────────────────────────────────┘
```

> **核心理解：** `src/app/api/` 下每个目录中的 `route.ts` 文件就是一个独立的 API 端点。它们可以导入任何 npm 包、读写文件系统、调用外部 API——这就是标准的 Node.js 环境。

### 新增的两个 npm 包

```bash
# Gmail API 官方 Node.js 客户端
googleapis          — Google 全家桶 API（Gmail、Drive、Sheets 等）
google-auth-library — OAuth 2.0 认证库（Token 管理、刷新）

# Excel 解析库（二选一）
exceljs             — 功能丰富，支持样式读写，推荐用于解析
xlsx (SheetJS)      — 轻量快速，兼容性好
```

**本教程使用 ExcelJS**，原因：
- 对 `.xlsx` 格式支持更完善
- API 设计更直观（面向对象风格）
- 社区活跃，文档清晰

---

## 3. 前置知识：OAuth 2.0 是什么？

在动手之前，必须理解一个核心概念：**为什么不能直接用账号密码调 Gmail API？**

### 生活类比

想象你要帮朋友去邮局取信：

```
❌ 错误方式（账号密码）：
   你拿了朋友的身份证 + 邮局密码 → 直接翻信箱
   → 危险！密码可能泄露，权限无法控制

✅ 正确方式（OAuth 令牌）：
   1. 朋友给你一张「取信授权卡」（Token），上面写着"只能取来自 xxx 的信"
   2. 你拿授权卡去邮局，邮员验证卡片有效 → 让你取信
   3. 授权卡有过期时间，过期需重新申请
   4. 朋友随时可以去邮局注销这张卡
```

### OAuth 2.0 授权流程图

```
┌──────┐                    ┌──────────────┐         ┌─────────────┐
│ 用户  │                    │ 你的应用       │         │ Google      │
│(浏览器)│                    │ (Next.js)     │         │ (Gmail API) │
└──┬───┘                    └──────┬───────┘         └──────┬──────┘
   │                               │                         │
   │  ① 点击「连接 Gmail」按钮       │                         │
   │ ───────────────────────────→ │                         │
   │                               │  ② 跳转到 Google 登录页   │
   │                               │ ──────────────────────→ │
   │                               │                         │
   │  ③ 用户输入 Google 账号密码     │                         │
   │ ──────────────────────────────────────────────────────→ │
   │                               │                         │
   │  ④ Google 问："允许该应用读     │                         │
   │     取你的邮件吗？"            │                         │
   │ ←────────────────────────────                          │
   │                               │                         │
   │  ⑤ 用户点击"允许"              │                         │
   │ ──────────────────────────────────────────────────────→ │
   │                               │                         │
   │                               │  ⑥ Google 返回授权码     │
   │                               │ ←────────────────────── │
   │                               │                         │
   │                               │  ⑦ 用授权码换 Access Token│
   │                               │ ──────────────────────→ │
   │                               │                         │
   │                               │  ⑧ 拿到 Token！          │
   │                               │ ←────────────────────── │
   │                               │                         │
   │  ⑨ 之后每次请求都带 Token      │                         │
   │ ─────────────────────────→    │  ⑩ 用 Token 调 Gmail API │
   │                               │ ──────────────────────→ │
   │                               │ ←────────────────────── │
   │  ⑪ 展示搜索结果               │                         │
   │ ←─────────────────────────── │                         │
```

### 两种 Token 的区别

| Token 类型 | 有效期 | 用途 |
|-----------|--------|------|
| **Access Token** | ~1 小时 | 每次调 API 时携带，类似"临时通行证" |
| **Refresh Token** | 长期有效（除非用户撤销） | 当 Access Token 过期时，用它换取新的 Access Token |

---

## 4. 第一步：Google Cloud 控制台配置（图文详解）

这是最关键的一步，请严格按顺序操作。

### 4.1 创建 Google Cloud 项目

1. 打开浏览器访问：**https://console.cloud.google.com/**
2. 点击左上角项目选择器 → 「新建项目」
3. 项目名称输入：`gng-gmail-integration`（或你喜欢的名字）
4. 点击「创建」，等待几秒钟

### 4.2 启用 Gmail API 和 Drive API

> 为什么需要 Drive API？因为 Gmail 附件实际上存储在 Google Drive 上，下载附件需要 Drive API 的权限。

1. 在左侧菜单中找到 **「API 和服务」→「库」**
2. 搜索栏输入 **`Gmail API`** → 点击进入 → 点击 **「启用」**
3. 再搜索 **`Google Drive API`** → 点击进入 → 点击 **「启用」**
4. 两个 API 都显示「已启用」状态即可

### 4.3 配置 OAuth 同意屏幕

这一步决定用户授权时会看到什么提示信息。

1. 左侧菜单 **「API 和服务」→「OAuth 同意屏幕」**
2. 选择 **「外部」**（External）用户类型 → 点击「创建」
3. 填写应用信息：

| 字段 | 填写内容 | 说明 |
|------|---------|------|
| 应用名称 | `GNG 邮件助手` | 用户授权时看到的名称 |
| 用户支持邮箱 | `你的邮箱@gmail.com` | 用于联系 |
| 开发者联系邮箱 | `你的邮箱@gmail.com` | 同上 |

4. 点击「保存并继续」
5. **Scopes（作用域）** 页面 — 点击「添加或移除范围」，添加以下三个：

```
...auth/gmail.readonly      — 只读 Gmail 邮件（推荐先用这个）
...auth/gmail.compose        — 发送/草稿邮件（如果未来需要回复）
...auth/drive.readonly       — 读取 Drive 文件（下载附件需要）
```

6. 点击「保存并继续」
7. **测试用户** 页面 — 点击「添加用户」→ 输入**你自己的 Gmail 地址**（比如 `your-email@gmail.com`）
   > 重要：只有这里添加的用户才能完成 OAuth 授权！其他人会看到"此应用未经验证"的警告。
8. 点击「保存并继续」

### 4.4 创建 OAuth 2.0 凭据（Credentials）

1. 左侧菜单 **「API 和服务」→「凭据」**
2. 点击顶部 **「+ 创建凭据」→「OAuth 客户端 ID」**
3. 应用类型选择 **「Web 应用」**
4. 名称填：`GNG Web Client`
5. **已授权的重定向 URI** — 点击「添加 URI」，填入：

```
http://localhost:3000/api/gmail/callback
```

> 这个地址是你的 Next.js 应用处理 OAuth 回调的路径。生产环境部署后要改成实际域名。

6. 点击「创建」
7. **立即弹出下载对话框** — 下载 `client_secret_xxx.json` 文件
8. 将文件重命名为 `gmail-credentials.json`，放到项目根目录：

```
gng_test/
├── gmail-credentials.json    ← 放在这里（不要提交到 Git！）
├── .env                      ← 环境变量也放这里
├── .gitignore                ← 确保 credentials 被忽略
├── package.json
├── prisma/
├── src/
...
```

9. 打开 `gmail-credentials.json`，你会看到类似这样的结构：

```json
{
  "installed": {
    "client_id": "123456.apps.googleusercontent.com",
    "project_id": "gng-gmail.ts-integration",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "client_secret": "GOCSPX-xxxxx",
    "redirect_uris": ["http://localhost:3000/api/gmail.ts/callback"]
  }
}
```

> 记下 `client_id` 和 `client_secret`，下一步要用。

### 4.5 配置环境变量

在项目根目录的 `.env` 文件中添加以下内容：

```env
# ============================================
# Gmail API 配置（从 gmail-credentials.json 中复制）
# ============================================
GOOGLE_CLIENT_ID=你的client_id_填在这里
GOOGLE_CLIENT_SECRET=你的client_secret_填在这里
GOOGLE_REDIRECT_URI=http://localhost:3000/api/gmail/callback

# Gmail 搜索默认的发件人（可修改）
GMAIL_DEFAULT_SENDER=wenyang@ggtransport.in
```

### 4.6 更新 .gitignore

确保敏感文件不会被提交到 Git：

```gitignore
# 在 .gitignore 末尾添加
gmail-credentials.json
.env.local
```

---

## 5. 第二步：安装依赖包

打开终端，在项目根目录执行：

```bash
npm install googleapis google-auth-library exceljs
```

安装完成后确认 `package.json` 中新增了这三个依赖：

```json
{
  "dependencies": {
    // ... 已有的依赖 ...
    "exceljs": "^4.4.0",
    "google-auth-library": "^9.15.0",
    "googleapis": "^144.0.0"
  }
}
```

### 各包的作用说明

```
googleapis
  ├── google.gmail({ version: "v1" })   — Gmail API 客户端（搜索、读取邮件）
  ├── google.drive({ version: "v3" })   — Drive API 客户端（下载附件）
  └── google.auth.OAuth2                — OAuth 2.0 认证处理器

google-auth-library
  └── 独立的认证库，googleapis 内部依赖它

exceljs
  ├── new ExcelJS.Workbook()            — 创建工作簿对象
  ├── workbook.xlsx.load(buffer)         — 从 Buffer 加载 xlsx 文件
  ├── worksheet.getRow(n)                — 读取指定行
  ├── worksheet.getColumn(n)             — 读取指定列
  └── workbook.eachSheet()               — 遍历所有工作表
```

---

## 6. 第三步：创建 Gmail 客户端封装库

这是整个模块的核心文件，封装了所有 Gmail 操作。

**创建文件：** `src/lib/gmail.ts`

```typescript
/**
 * ============================================================
 *  Gmail API 客户端封装库
 * ============================================================
 *
 *  功能清单：
 *    1. OAuth 2.0 认证管理（生成授权URL、交换Token、刷新Token）
 *    2. 按柜号搜索邮件（支持 from:sender containerNo 语法）
 *    3. 读取邮件详情（标题、正文、发件人、时间、附件列表）
 *    4. 下载并解析 Excel 附件（使用 ExcelJS）
 *
 *  使用方式：
 *    import { getAuthUrl, searchEmails, getEmailDetail } from "@/lib/gmail.ts";
 */

import { google } from "googleapis";
import ExcelJS from "exceljs";

// ============================================================
//  配置常量
// ============================================================

/** 从环境变量读取 Google OAuth 配置 */
const GOOGLE_CONFIG = {
  clientId: process.env.GOOGLE_CLIENT_ID || "",
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  redirectUri: process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/gmail/callback",
};

/** 默认搜索的发件人（可在环境变量中覆盖） */
const DEFAULT_SENDER = process.env.GMAIL_DEFAULT_SENDER || "wenyang@ggtransport.in";

/**
 * OAuth 2.0 请求的权限范围（Scopes）
 * 按最小权限原则：只申请我们需要的权限
 */
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",   // 只读邮件
  "https://www.googleapis.com/auth/drive.readonly",    // 读取附件（Drive）
];

// ============================================================
//  工具函数：创建 OAuth2 客户端实例
// ============================================================

/**
 * 创建一个 OAuth2 客户端
 *
 * @param accessToken - 可选的访问令牌（如果有则直接设置）
 * @param refreshToken - 可选的刷新令牌（如果有则同时设置）
 * @returns 配置好的 OAuth2 客户端实例
 *
 * @example
 * // 不带 Token（用于生成授权 URL）
 * const auth = createOAuth2Client();
 *
 * // 带 Token（用于调用 API）
 * const auth = createOAuth2Client("ya29.xxx", "1//xxx");
 */
function createOAuth2Client(accessToken?: string, refreshToken?: string) {
  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CONFIG.clientId,
    GOOGLE_CONFIG.clientSecret,
    GOOGLE_CONFIG.redirectUri
  );

  // 如果提供了 Token，设置到客户端中
  if (accessToken) {
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  }

  return oauth2Client;
}

// ============================================================
//  功能 1：生成 Google 授权 URL
// ============================================================

/**
 * 生成用户点击后跳转到 Google 登录页面的 URL
 *
 * @param state - 可选的状态参数（用于防止 CSRF 攻击，通常存用户ID）
 * @returns Google 授权页面 URL
 *
 * 流程说明：
 *   前端调用此函数获取 URL → 浏览器跳转到 Google → 用户登录并授权
 *   → Google 重定向回我们的回调地址（带上授权码）
 */
export function getAuthUrl(state?: string): string {
  const auth = createOAuth2Client();

  const url = auth.generateAuthUrl({
    access_type: "offline",        // 关键！offline 才能拿到 Refresh Token
    prompt: "consent",             // 每次都让用户确认（开发阶段建议开启）
    scope: SCOPES,
    state: state || "",            // CSRF 保护
  });

  return url;
}

// ============================================================
//  功能 2：用授权码换取 Token
// ============================================================

/**
 * 用 Google 回调返回的 authorizationCode 换取 access_token 和 refresh_token
 *
 * @param code - Google 回调 URL 中的 code 参数
 * @returns 包含 tokens 的对象
 *
 * @example
 * // 在 /api/gmail.ts/callback 中调用
 * const tokens = await exchangeCodeForTokens(req.url 中的 code 参数);
 * // tokens = { access_token: "ya29.xxx", refresh_token: "1//xxx", ... }
 */
export async function exchangeCodeForTokens(code: Promise<{
  access_token: string;
  refresh_token: string;
  expiry_date: number;
}>) {
  const auth = createOAuth2Client();
  const { tokens } = await auth.getToken(code);
  return tokens as {
    access_token: string;
    refresh_token?: string;
    expiry_date: number;
  };
}

// ============================================================
//  功能 3：刷新 Access Token
// ============================================================

/**
 * 当 Access Token 过期时，用 Refresh Token 获取新的 Access Token
 *
 * @param refreshToken - 之前保存的 refresh_token
 * @returns 新的 token 信息
 */
export async function refreshAccessToken(refreshToken: string) {
  const auth = createOAuth2Client();
  auth.setCredentials({ refresh_token: refreshToken });

  const { credentials } = await auth.refreshAccessToken();
  return credentials;
}

// ============================================================
//  功能 4：根据柜号搜索邮件（核心需求）
// ============================================================

/**
 * 根据集装箱号搜索 Gmail 邮件
 *
 * 搜索语法对应需求文档：
 *   from:{senderEmail} {containerNo}
 *   例：from:wenyang@ggtransport.in EGSU6027772
 *
 * @param containerNo - 集装箱号（如 "EGSU6027772"）
 * @param senderEmail - 发件人邮箱（可选，默认从环境变量读取）
 * @param accessToken - 用户的 OAuth Access Token
 * @param refreshToken - 用户的 OAuth Refresh Token（用于自动刷新）
 * @returns 匹配的邮件摘要列表
 *
 * @example
 * const results = await searchEmails("EGSU6027772", undefined, token, refreshToken);
 * // 返回值示例：
 * // [{
 * //   id: "18e4xxxxx",
 * //   threadId: "18e4xxxxx",
 * //   snippet: "Container EGSU6027772 has been dispatched...",
 * //   subject: "Container Dispatch Notice - EGSU6027772",
 * //   from: "wenyang@ggtransport.in",
 * //   date: "2026-06-01T10:30:00Z",
 * //   hasExcelAttachment: true
 * // }]
 */
export async function searchEmailsByContainer(
  containerNo: string,
  senderEmail?: string,
  accessToken?: string,
  refreshToken?: string
) {
  // 构建带自动刷新能力的 OAuth 客户端
  const auth = createOAuth2Client(accessToken, refreshToken);

  // 创建 Gmail API 客户端
  const gmail = google.gmail({ version: "v1", auth });

  // 构建 Gmail 搜索查询字符串
  // 这就是需求文档中的搜索条件格式
  const query = `from:${senderEmail || DEFAULT_SENDER} ${containerNo}`;

  console.log(`[Gmail] 搜索查询: ${query}`);

  // 调用 Gmail API 的 messages.list 接口
  const response = await gmail.users.messages.list({
    userId: "me",          // "me" 表示当前认证用户自己
    q: query,              // 搜索查询语句
    maxResults: 20,        // 最多返回 20 条结果
  });

  const messages = response.data.messages;

  // 如果没有搜到结果，返回空数组
  if (!messages || messages.length === 0) {
    return [];
  }

  // 遍历每封邮件，提取关键信息
  const results = [];
  for (const msg of messages) {
    if (!msg.id) continue;

    // 获取邮件完整数据（包含 headers 和 payload）
    const detail = await gmail.users.messages.get({
      userId: "me",
      id: msg.id,
      format: "metadata",     // metadata 格式只返回头部信息（更快）
      metadataHeaders: ["From", "Subject", "Date"],
    });

    // 从 headers 中提取我们需要的信息
    const headers = detail.data.payload?.headers || [];
    const getHeader = (name: string) =>
      headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

    const subject = getHeader("Subject");
    const from = getHeader("From");
    const dateStr = getHeader("Date");

    // 检查是否有 Excel 附件
    const hasExcelAttachment = checkHasExcelAttachment(detail.data.payload);

    results.push({
      id: msg.id,
      threadId: msg.threadId,
      snippet: detail.data.snippet || "",       // 邮件正文预览（前约100字符）
      subject,
      from,
      date: parseGmailDate(dateStr),
      hasExcelAttachment,
    });
  }

  return results;
}

// ============================================================
//  功能 5：获取单封邮件完整详情（含附件下载和 Excel 解析）
// ============================================================

/**
 * 邮件搜索结果中单条记录的类型定义
 */
export interface EmailSearchResult {
  id: string;
  threadId: string;
  snippet: string;
  subject: string;
  from: string;
  date: string;
  hasExcelAttachment: boolean;
}

/**
 * Excel 解析结果的类型定义
 */
export interface ParsedExcelData {
  fileName: string;
  sheetName: string;
  headers: string[];           // 表头
  rows: Record<string, string>[];  // 数据行（每行是一个对象）
  rowCount: number;            // 总行数
  columnCount: number;         // 总列数
}

/**
 * 邮件完整详情的类型定义
 */
export interface EmailDetail extends EmailSearchResult {
  bodyText: string;                   // 纯文本正文
  bodyHtml: string;                   // HTML 正文（如有）
  attachments: AttachmentInfo[];      // 附件列表
  excelData?: ParsedExcelData;        // 如果有 Excel 附件，包含解析后的数据
}

/**
 * 附件信息
 */
interface AttachmentInfo {
  filename: string;
  mimeType: string;
  attachmentId: string;
  size: number;
  isExcel: boolean;
}

/**
 * 获取单封邮件的完整详情
 *
 * 包括：正文内容、附件列表、以及 Excel 附件的解析结果
 *
 * @param messageId - 邮件 ID（从搜索结果中获得）
 * @param accessToken - OAuth Access Token
 * @param refreshToken - OAuth Refresh Token
 * @returns 邮件完整详情
 */
export async function getEmailDetail(
  messageId: string,
  accessToken: string,
  refreshToken?: string
): Promise<EmailDetail> {
  const auth = createOAuth2Client(accessToken, refreshToken);
  const gmail = google.gmail({ version: "v1", auth });

  // 获取完整邮件数据（full 格式包含正文和附件元信息）
  const response = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });

  const payload = response.data.payload!;
  const headers = payload.headers || [];

  // 提取基本信息
  const getHeader = (name: string) =>
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

  // 解析邮件正文
  const { textBody, htmlBody } = extractBody(payload);

  // 提取附件信息
  const attachments = extractAttachments(payload);

  // 如果有 Excel 附件，尝试下载并解析
  let excelData: ParsedExcelData | undefined;
  const excelAttachment = attachments.find((a) => a.isExcel);

  if (excelAttachment) {
    try {
      excelData = await downloadAndParseExcel(gmail, messageId, excelAttachment);
    } catch (error) {
      console.error(`[Gmail] Excel 解析失败:`, error);
      // 解析失败不阻断整体流程，只是 excelData 为 undefined
    }
  }

  return {
    id: messageId,
    threadId: response.data.threadId || "",
    snippet: response.data.snippet || "",
    subject: getHeader("Subject"),
    from: getHeader("From"),
    date: parseGmailDate(getHeader("Date")),
    bodyText: textBody,
    bodyHtml: htmlBody,
    attachments,
    excelData,
  };
}

// ============================================================
//  内部辅助函数
// ============================================================

/**
 * 检查邮件是否有 Excel 附件
 *
 * Gmail 邮件的 payload 结构是嵌套的树形结构：
 *   payload
 *   ├── parts[0] (text/plain 正文)
 *   ├── parts[1] (text/html 正文)
 *   └── parts[2] (attachment: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)
 */
function checkHasExcelAttachment(payload: any): boolean {
  if (!payload || !payload.parts) return false;

  return recursivelyCheckParts(payload.parts);
}

function recursivelyCheckParts(parts: any[]): boolean {
  for (const part of parts) {
    // 检查当前 part 是否是 Excel 文件
    if (part.mimeType && isExcelMimeType(part.mimeType)) {
      return true;
    }
    // 如果是 multipart（嵌套容器），递归检查子节点
    if (part.parts && Array.isArray(part.parts)) {
      if (recursivelyCheckParts(part.parts)) return true;
    }
  }
  return false;
}

/**
 * 判断 MIME 类型是否为 Excel 文件
 */
function isExcelMimeType(mimeType: string): boolean {
  const excelMimes = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",  // .xlsx
    "application/vnd.ms-excel",                                          // .xls
  ];
  return excelMimes.includes(mimeType);
}

/**
 * 从邮件 payload 中提取纯文本和 HTML 正文
 *
 * Gmail 邮件正文可能出现在：
 *   - payload.body（简单邮件，无多部分）
 *   - payload.parts[].body（多部分邮件，text/plain 或 text/html 部分）
 */
function extractBody(payload: any): { textBody: string; htmlBody: string } {
  let textBody = "";
  let htmlBody = "";

  function walkParts(parts: any[]) {
    for (const part of parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        // Gmail API 返回的正文是 Base64 编码的 URL-safe 字符串
        textBody = base64UrlDecode(part.body.data);
      }
      if (part.mimeType === "text/html" && part.body?.data) {
        htmlBody = base64UrlDecode(part.body.data);
      }
      // 递归处理嵌套部分
      if (part.parts) {
        walkParts(part.parts);
      }
    }
  }

  // 先检查顶层 body
  if (payload.body?.data) {
    if (payload.mimeType === "text/plain") textBody = base64UrlDecode(payload.body.data);
    if (payload.mimeType === "text/html") htmlBody = base64UrlDecode(payload.body.data);
  }

  // 再遍历 parts
  if (payload.parts) {
    walkParts(payload.parts);
  }

  return { textBody, htmlBody };
}

/**
 * 提取附件元信息列表（不下载附件体）
 */
function extractAttachments(payload: any): AttachmentInfo[] {
  const attachments: AttachmentInfo[] = [];

  function walkParts(parts: any[]) {
    for (const part of parts) {
      // 有 attachmentId 且有 filename → 这是附件
      if (part.body?.attachmentId && part.filename) {
        attachments.push({
          filename: part.filename,
          mimeType: part.mimeType,
          attachmentId: part.body.attachmentId,
          size: part.body.size || 0,
          isExcel: isExcelMimeType(part.mimeType),
        });
      }
      if (part.parts) {
        walkParts(part.parts);
      }
    }
  }

  if (payload.parts) {
    walkParts(payload.parts);
  }

  return attachments;
}

/**
 * 下载 Excel 附件并用 ExcelJS 解析
 *
 * @param gmail - 已认证的 Gmail API 客户端
 * @param messageId - 邮件 ID
 * @param attachment - 附件信息
 * @returns 解析后的 Excel 数据
 */
async function downloadAndParseExcel(
  gmail: any,
  messageId: string,
  attachment: AttachmentInfo
): Promise<ParsedExcelData> {
  // 第一步：通过 Gmail API 下载附件数据
  const res = await gmail.users.messages.attachments.get({
    userId: "me",
    id: messageId,
    attachmentId: attachment.attachmentId,
  });

  // 附件数据也是 Base64 URL-safe 编码
  const data = res.data.data;
  const buffer = Buffer.from(data!, "base64");

  // 第二步：用 ExcelJS 加载并解析
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  // 取第一个工作表
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("Excel 文件中没有工作表");
  }

  // 第三步：提取表头和数据行
  const headers: string[] = [];
  const rows: Record<string, string>[] = [];

  // ExcelJS 的 rowCount 包含空行，所以要用 actualRowCount 或逐行判断
  worksheet.eachRow((row, rowNumber) => {
    // 第一行作为表头
    if (rowNumber === 1) {
      row.eachCell((cell) => {
        headers.push(cell.value?.toString() || "");
      });
      return;
    }

    // 数据行：将每行转为 key-value 对象（key 是表头）
    const rowData: Record<string, string> = {};
    row.eachCell((cell, colNumber) => {
      const headerName = headers[colNumber - 1] || `col_${colNumber}`;
      rowData[headerName] = cell.value?.toString() || "";
    });
    rows.push(rowData);
  });

  return {
    fileName: attachment.fileName,
    sheetName: worksheet.name || "Sheet1",
    headers,
    rows,
    rowCount: rows.length,
    columnCount: headers.length,
  };
}

/**
 * Base64 URL-safe 解码
 *
 * Gmail API 使用的是 URL-safe Base64（把 + 换成 -，把 / 换成 _）
 * Node.js 的 Buffer.from 默认支持这种格式
 */
function base64UrlDecode(encoded: string): string {
  return Buffer.from(encoded, "base64").toString("utf-8");
}

/**
 * 解析 Gmail Date 头部格式
 *
 * Gmail 日期格式如：Fri, 01 Jun 2026 03:30:08 +0000
 * 我们将其转为 ISO 格式字符串
 */
function parseGmailDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    return date.toISOString();
  } catch {
    return dateStr; // 解析失败就返回原始字符串
  }
}
```

---

## 7. 第四步：创建 OAuth 授权接口

### 7.1 授权跳转接口

**创建文件：** `src/app/api/gmail/auth/route.ts`

```typescript
/**
 * ============================================================
 *  Gmail OAuth 授权跳转接口
 * ============================================================
 *
 *  路由：GET /api/gmail.ts/auth?state={userId}
 *
 *  功能：
 *    生成 Google OAuth 授权 URL，重定向用户到 Google 登录页面
 *
 *  调用时机：
 *    用户在前端点击「连接 Gmail」按钮时触发
 *
 *  流程：
 *    前端 fetch("/api/gmail.ts/auth") → 后端生成授权 URL → 重定向到 Google
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/gmail.ts";

export async function GET(request: NextRequest) {
  // 从查询参数获取 state（可用于 CSRF 防护和状态恢复）
  const state = request.nextUrl.searchParams.get("state") || undefined;

  // 生成 Google 授权 URL
  const authUrl = getAuthUrl(state);

  // 重定向用户到 Google 授权页面
  return NextResponse.redirect(authUrl);
}
```

### 7.2 OAuth 回调接口（最重要的一步）

**创建文件：** `src/app/api/gmail/callback/route.ts`

```typescript
/**
 * ============================================================
 *  Gmail OAuth 回调接口
 * ============================================================
 *
 *  路由：GET /api/gmail.ts/callback?code={authorizationCode}&state={state}
 *
 *  功能：
 *    接收 Google OAuth 回调，用授权码换取 Access Token 和 Refresh Token，
 *    然后将 Token 存储起来（本教程先存到内存/cookie，生产环境应存数据库）
 *
 *  这是整个 OAuth 流程中最关键的接口！
 */

import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/gmail.ts";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  // ---- 情况 1：用户拒绝了授权 ----
  if (error) {
    // 重定向回前端，带上错误信息
    return NextResponse.redirect(
      new URL(`/containers?gmail_error=${encodeURIComponent(error)}`, request.url)
    );
  }

  // ---- 情况 2：没有 code 参数（异常情况）----
  if (!code) {
    return NextResponse.redirect(
      new URL("/containers?gmail_error=missing_code", request.url)
    );
  }

  // ---- 情况 3：正常回调，用 code 换 Token ----
  try {
    const tokens = await exchangeCodeForTokens(code as any);

    console.log("[Gmail Callback] 成功获取 Token:");
    console.log("  - Access Token:", tokens.access_token?.substring(0, 20) + "...");
    console.log("  - Refresh Token:", tokens.refresh_token ? "已获取" : "未获取（可能已存在）");

    // ======== Token 存储策略 ========
    //
    // 方式 A（简单）：存入 Cookie（适合开发阶段）
    // 方式 B（推荐）：存入数据库 users 表的新字段
    // 方式 C（进阶）：使用 Redis 缓存
    //
    // 本教程演示方式 A + 方式 B 结合：

    // --- Cookie 方式：方便前端直接使用 ---
    const response = NextResponse.redirect(
      new URL("/containers?gmail_connected=true", request.url)
    );

    // 设置 HttpOnly Cookie 存储 Token（安全性更好，JavaScript 无法读取）
    response.cookies.set("gmail_access_token", tokens.access_token, {
      httpOnly: true,       // 防止 XSS 攻击
      secure: false,        // 开发环境用 http，生产环境改为 true
      sameSite: "lax",
      maxAge: 60 * 60,      // 1 小时（Access Token 有效期）
      path: "/",
    });

    if (tokens.refresh_token) {
      // Refresh Token 过期时间很长，可以存久一点
      response.cookies.set("gmail_refresh_token", tokens.refresh_token, {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,  // 7 天
        path: "/",
      });
    }

    // --- 同时输出到控制台，方便调试 ---
    // 生产环境中应该在这里写入数据库：
    // await prisma.users.update({
    //   where: { id: currentUserId },
    //   data: {
    //     gmail_access_token: tokens.access_token,
    //     gmail_refresh_token: tokens.refresh_token,
    //     gmail_token_expires_at: new Date(tokens.expiry_date),
    //   },
    // });

    return response;
  } catch (err: any) {
    console.error("[Gmail Callback] Token 交换失败:", err.message);
    return NextResponse.redirect(
      new URL(`/containers?gmail_error=${encodeURIComponent(err.message)}`, request.url)
    );
  }
}
```

---

## 8. 第五步：创建邮件搜索接口

**创建文件：** `src/app/api/gmail/search/route.ts`

```typescript
/**
 * ============================================================
 *  Gmail 邮件搜索接口
 * ============================================================
 *
 *  路由：GET /api/gmail.ts/search?containerNo=EGSU6027772&sender=xxx@xxx.com
 *
 *  功能：
 *    根据柜号搜索 Gmail 邮件，返回匹配的邮件列表
 *
 *  前置条件：
 *    用户必须已完成 Gmail OAuth 授权（Cookie 中有有效的 Token）
 *
 *  返回数据结构：
 *    {
 *      success: true,
 *      data: [{
 *        id: "邮件ID",
 *        subject: "邮件标题",
 *        from: "发件人",
 *        date: "发送时间",
 *        snippet: "正文预览",
 *        hasExcelAttachment: true/false
 *      }],
 *      total: 3
 *    }
 */

import { NextRequest, NextResponse } from "next/server";
import { searchEmailsByContainer } from "@/lib/gmail.ts";
import { requireUser } from "@/lib/require-user";
import { success, error } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  // ---- 1. 验证用户身份 ----
  const user = await requireUser(request);
  if (!user) return error("未登录", 401);

  // ---- 2. 获取搜索参数 ----
  const { searchParams } = new URL(request.url);
  const containerNo = searchParams.get("containerNo")?.trim();
  const sender = searchParams.get("sender")?.trim();

  // 校验必填参数
  if (!containerNo) {
    return error("缺少柜号参数 containerNo", 400);
  }

  // ---- 3. 从 Cookie 获取 Gmail Token ----
  const accessToken = request.cookies.get("gmail_access_token")?.value;
  const refreshToken = request.cookies.get("gmail_refresh_token")?.value;

  if (!accessToken) {
    return error(
      "尚未连接 Gmail，请先点击「连接 Gmail」按钮进行授权",
      401
    );
  }

  // ---- 4. 调用 Gmail API 搜索 ----
  try {
    const results = await searchEmailsByContainer(
      containerNo,
      sender,        // 可选，不传则用默认发件人
      accessToken,
      refreshToken
    );

    return success(results, {
      total: results.length,
      query: `from:${sender || "default"} ${containerNo}`,
    });
  } catch (err: any) {
    // 错误处理：可能是 Token 过期
    if (
      err.message?.includes("invalid_grant") ||
      err.message?.includes("401") ||
      err.message?.includes("unauthorized")
    ) {
      return error(
        "Gmail 授权已过期，请重新连接 Gmail",
        401,
        { needReconnect: true }
      );
    }

    console.error("[Gmail Search] 搜索失败:", err);
    return error(`邮件搜索失败: ${err.message}`, 500);
  }
}
```

---

## 9. 第六步：创建邮件详情接口（含 Excel 附件解析）

**创建文件：** `src/app/api/gmail/message/[id]/route.ts`

```typescript
/**
 * ============================================================
 *  Gmail 邮件详情接口（含 Excel 附件解析）
 * ============================================================
 *
 *  路由：GET /api/gmail.ts/message/{messageId}
 *
 *  功能：
 *    获取单封邮件的完整详情，包括：
 *    - 邮件正文（纯文本 + HTML）
 *    - 附件列表
 *    - Excel 附件的解析结果（表格数据）
 *
 *  ExcelJS 解析能力：
 *    支持 .xlsx（Excel 2007+）和 .xls（Excel 97-2003）格式
 *    自动提取第一个工作表的表头和数据行
 */

import { NextRequest, NextResponse } from "next/server";
import { getEmailDetail } from "@/lib/gmail.ts";
import { requireUser } from "@/lib/require-user";
import { success, error } from "@/lib/api-response";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ---- 1. 验证用户身份 ----
  const user = await requireUser(request);
  if (!user) return error("未登录", 401);

  // ---- 2. 获取邮件 ID ----
  const { id: messageId } = await params;
  if (!messageId) {
    return error("缺少邮件 ID", 400);
  }

  // ---- 3. 获取 Gmail Token ----
  const accessToken = request.cookies.get("gmail_access_token")?.value;
  const refreshToken = request.cookies.get("gmail_refresh_token")?.value;

  if (!accessToken) {
    return error("尚未连接 Gmail", 401);
  }

  // ---- 4. 获取邮件详情（含 Excel 解析）----
  try {
    const detail = await getEmailDetail(messageId, accessToken, refreshToken);

    return success(detail);
  } catch (err: any) {
    console.error("[Gmail Detail] 获取详情失败:", err);
    return error(`获取邮件详情失败: ${err.message}`, 500);
  }
}
```

---

## 10. 第七步：前端集成 — 搜索按钮 + 结果弹框

### 10.1 创建邮件搜索弹框组件

**创建文件：** `src/components/GmailSearchDialog.tsx`

```typescript
/**
 * ============================================================
 *  Gmail 邮件搜索弹框组件
 * ============================================================
 *
 *  功能：
 *    - 显示「搜索邮件」按钮
 *    - 弹出搜索结果列表
 *    - 点击邮件可展开查看详情
 *    - 如有 Excel 附件，以表格形式展示解析结果
 *
 *  使用方式：
 *    <GmailSearchDialog containerNo="EGSU6027772" />
 */

"use client";

import { useState, useCallback } from "react";
import { Mail, ExternalLink, FileSpreadsheet, AlertCircle, Loader2 } from "lucide-react";

// ============================================================
//  类型定义
// ============================================================

/** 搜索结果中的一条邮件记录 */
interface EmailItem {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  hasExcelAttachment: boolean;
}

/** Excel 解析后的表格数据 */
interface ExcelData {
  fileName: string;
  sheetName: string;
  headers: string[];
  rows: Record<string, string>[];
  rowCount: number;
  columnCount: number;
}

/** 邮件完整详情 */
interface EmailDetail extends EmailItem {
  bodyText: string;
  bodyHtml: string;
  attachments: Array<{ filename: string; mimeType: string; isExcel: boolean }>;
  excelData?: ExcelData;
}

// ============================================================
//  主组件
// ============================================================

interface GmailSearchDialogProps {
  /** 要搜索的柜号 */
  containerNo: string;
}

export default function GmailSearchDialog({ containerNo }: GmailSearchDialogProps) {
  // ---- 状态管理 ----
  const [isOpen, setIsOpen] = useState(false);           // 弹框开关
  const [loading, setLoading] = useState(false);          // 搜索加载中
  const [emails, setEmails] = useState<EmailItem[]>([]);  // 搜索结果
  const [error, setError] = useState<string>("");         // 错误信息
  const [selectedEmail, setSelectedEmail] = useState<EmailDetail | null>(null); // 选中的邮件详情
  const [detailLoading, setDetailLoading] = useState(false); // 详情加载中

  // ---- 搜索邮件 ----
  const handleSearch = useCallback(async () => {
    setLoading(true);
    setError("");
    setSelectedEmail(null);
    setEmails([]);

    try {
      const res = await fetch(
        `/api/gmail/search?containerNo=${encodeURIComponent(containerNo)}`
      );
      const json = await res.json();

      if (!res.ok) {
        // 特殊处理：需要重新授权的情况
        if (json.needReconnect) {
          setError("Gmail 授权已过期，请重新连接");
          return;
        }
        throw new Error(json.message || "搜索失败");
      }

      setEmails(json.data || []);
      if ((json.data || []).length === 0) {
        setError("未找到相关邮件");
      }
    } catch (err: any) {
      setError(err.message || "搜索出错");
    } finally {
      setLoading(false);
    }
  }, [containerNo]);

  // ---- 查看邮件详情 ----
  const handleViewDetail = useCallback(async (emailId: string) => {
    setDetailLoading(true);
    setSelectedEmail(null);

    try {
      const res = await fetch(`/api/gmail/message/${emailId}`);
      const json = await res.json();

      if (!res.ok) throw new Error(json.message || "获取详情失败");

      setSelectedEmail(json.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // ---- 打开弹框时自动搜索 ----
  const handleOpen = () => {
    setIsOpen(true);
    handleSearch();
  };

  // ---- 触发 Gmail 授权跳转 ----
  const handleConnectGmail = () => {
    window.location.href = "/api/gmail.ts/auth";
  };

  // ============================================================
  //  渲染
  // ============================================================

  if (!isOpen) {
    /* 未打开时：只显示一个搜索按钮 */
    return (
      <button
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md
                   bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
      >
        <Mail size={14} />
        搜索邮件
      </button>
    );
  }

  /* 弹框内容 */
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 遮罩层 */}
      <div className="absolute inset-0 bg-black/40" onClick={() => setIsOpen(false)} />

      {/* 弹框主体 */}
      <div className="relative bg-white rounded-xl shadow-2xl w-[900px] max-h-[80vh]
                      flex flex-col overflow-hidden">
        {/* ====== 头部 ====== */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Gmail 邮件搜索</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              柜号：<span className="font-mono text-blue-600">{containerNo}</span>
            </p>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="text-slate-400 hover:text-slate-600 text-lg"
          >
            &times;
          </button>
        </div>

        {/* ====== 内容区 ====== */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* 错误提示 */}
          {error && (
            <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-600 text-sm">
              <AlertCircle size={16} />
              {error}
              {error.includes("授权") && (
                <button
                  onClick={handleConnectGmail}
                  className="ml-auto underline hover:no-underline"
                >
                  去连接 Gmail
                </button>
              )}
            </div>
          )}

          {/* 搜索加载中 */}
          {loading && (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <Loader2 className="animate-spin mr-2" />
              正在搜索邮件...
            </div>
          )}

          {/* 搜索结果列表 */}
          {!loading && emails.length > 0 && !selectedEmail && (
            <div className="space-y-2">
              <div className="text-sm text-slate-500 mb-3">
                找到 {emails.length} 封相关邮件
              </div>
              {emails.map((email) => (
                <div
                  key={email.id}
                  onClick={() => handleViewDetail(email.id)}
                  className="p-4 rounded-lg border border-slate-200 cursor-pointer
                             hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-slate-800 truncate">
                        {email.subject || "(无主题)"}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        来自：{email.from} ·{" "}
                        {new Date(email.date).toLocaleString("zh-CN")}
                      </div>
                      <div className="text-xs text-slate-500 mt-1 line-clamp-1">
                        {email.snippet}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {email.hasExcelAttachment && (
                        <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">
                          <FileSpreadsheet size={12} /> Excel
                        </span>
                      )}
                      <ExternalLink size={14} className="text-slate-300" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 邮件详情视图 */}
          {selectedEmail && (
            <div className="space-y-4">
              {/* 详情头部：返回按钮 + 基本信息 */}
              <button
                onClick={() => setSelectedEmail(null)}
                className="text-sm text-blue-500 hover:text-blue-700"
              >
                &larr; 返回列表
              </button>

              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                <h4 className="font-semibold text-slate-800">{selectedEmail.subject}</h4>
                <div className="text-xs text-slate-500 mt-2 space-y-1">
                  <div>发件人：{selectedEmail.from}</div>
                  <div>时间：{new Date(selectedEmail.date).toLocaleString("zh-CN")}</div>
                  <div>
                    附件：
                    {selectedEmail.attachments.length > 0 ? (
                      selectedEmail.attachments.map((a) => (
                        <span
                          key={a.filename}
                          className={`inline-flex items-center gap-1 ml-2 px-2 py-0.5 rounded text-xs ${
                            a.isExcel ? "bg-green-50 text-green-600" : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {a.isExcel && <FileSpreadsheet size={10} />}
                          {a.filename}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400">无</span>
                    )}
                  </div>
                </div>
              </div>

              {/* 邮件正文 */}
              <div className="p-4 rounded-lg border border-slate-200">
                <h5 className="text-sm font-medium text-slate-700 mb-2">邮件正文</h5>
                <pre className="whitespace-pre-wrap text-sm text-slate-600 font-sans max-h-60 overflow-y-auto">
                  {selectedEmail.bodyText || selectedEmail.snippet || "(无文本内容)"}
                </pre>
              </div>

              {/* Excel 附件解析结果（核心亮点！） */}
              {detailLoading && (
                <div className="flex items-center justify-center py-8 text-slate-400">
                  <Loader2 className="animate-spin mr-2" />
                  正在解析 Excel 附件...
                </div>
              )}

              {selectedEmail.excelData && (
                <div className="rounded-lg border border-green-200 overflow-hidden">
                  <div className="bg-green-50 px-4 py-2 flex items-center gap-2 text-sm font-medium text-green-700">
                    <FileSpreadsheet size={16} />
                    Excel 附件：{selectedEmail.excelData.fileName}
                    <span className="text-green-500 font-normal">
                      （{selectedEmail.excelData.sheetName} · {selectedEmail.excelData.rowCount} 行 × {selectedEmail.excelData.columnCount} 列）
                    </span>
                  </div>

                  {/* 表格展示 Excel 数据 */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-green-50/50 border-b border-green-200">
                          {(selectedEmail.excelData.headers || []).map((h, i) => (
                            <th
                              key={i}
                              className="px-4 py-2 text-left text-xs font-semibold text-green-800 whitespace-nowrap"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-green-100">
                        {(selectedEmail.excelData.rows || []).map((row, ri) => (
                          <tr key={ri} className="hover:bg-green-50/20">
                            {(selectedEmail.excelData!.headers || []).map((h, ci) => (
                              <td
                                key={ci}
                                className="px-4 py-2 text-slate-700 whitespace-nowrap"
                              >
                                {row[h] || "-"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ====== 底部操作栏 ====== */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
          <button
            onClick={handleSearch}
            disabled={loading}
            className="text-sm text-blue-500 hover:text-blue-700 disabled:text-slate-300"
          >
            {loading ? "搜索中..." : "重新搜索"}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="px-4 py-1.5 text-sm rounded-md bg-slate-200 text-slate-700 hover:bg-slate-300"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 10.2 在集装箱页面集成搜索按钮

在你的集装箱管理页面 `src/app/containers/page.tsx` 中，找到每行的操作区域，添加搜索按钮：

```tsx
// 在 SortableTableRow 组件的操作列中添加：

import GmailSearchDialog from "@/components/GmailSearchDialog";

{/* 在操作按钮组中加入 */}
<GmailSearchDialog containerNo={row.container_no} />
```

具体位置参考你现有的操作按钮区域（编辑、删除按钮旁边）。

---

## 11. 第八步：端到端测试流程

完成以上所有步骤后，按以下顺序验证：

### 测试步骤清单

```
□ 步骤 1：启动开发服务器
  $ npm run dev
  → 访问 http://localhost:3000

□ 步骤 2：登录系统
  → 进入集装箱管理页面

□ 步骤 3：点击「搜索邮件」按钮
  → 应弹出 Gmail 搜索弹框
  → 如果未授权，应显示"尚未连接 Gmail"错误
  → 点击"去连接 Gmail"

□ 步骤 4：完成 Google OAuth 授权
  → 跳转到 Google 登录页
  → 选择/输入你的 Google 账号
  → 点击"允许"（授权读邮件权限）
  → 自动跳转回 localhost:3000/containers

□ 步骤 5：再次点击「搜索邮件」
  → 输入一个真实的柜号（或用默认的 EGSU6027772 测试）
  → 应显示搜索结果列表（或"未找到相关邮件"）

□ 步骤 6：点击某一封邮件
  → 展开邮件详情
  → 显示正文内容
  → 如果有 Excel 附件，显示解析后的表格

□ 步骤 7：查看终端日志
  → 应看到 [Gmail] 搜索查询: ... 日志
  → 应看到 Token 相关日志
```

### 测试用 Excel 文件

如果你手头没有真实邮件，可以用以下方式创建测试数据：

1. 自己给自己发一封邮件，附上一个 `.xlsx` 文件
2. 邮件主题或正文中包含某个柜号（如 `TEST001`）
3. 用这个柜号测试搜索功能

---

## 12. 常见问题排查手册

### 问题 1：`redirect_uri_mismatch` 错误

**现象：** Google 回调时报错 `redirect_uri_mismatch`

**原因：** Google Cloud Console 中配置的重定向 URI 与实际不一致

**解决：**
1. 进入 Google Cloud Console → 凭据 → 编辑 OAuth 客户端
2. 确认「已授权的重定向 URI」包含：`http://localhost:3000/api/gmail/callback`
3. 注意末尾不要有多余的斜杠

---

### 问题 2：拿不到 Refresh Token

**现象：** 首次授权能正常使用，但 1 小时后就报 401 错误

**原因：** Google 只在**第一次**授权时发放 Refresh Token。如果后续重复授权且用户之前已同意过，不会再次发放。

**解决：**
1. Google Cloud Console → OAuth 同意屏幕 → 测试用户 → 确保你的邮箱在里面
2. 在代码中确保 `prompt: "consent"`（已在 `getAuthUrl` 中设置）
3. 如果还是拿不到，去 [Google Account Permissions](https://myaccount.google.com/permissions) 撤销对你的应用的授权，然后重新授权一次

---

### 问题 3：`access_type: 'offline'` 的含义

这是一个高频面试问题，必须理解：

| 参数值 | 行为 | Refresh Token |
|--------|------|--------------|
| `access_type: "online"`（默认） | 只发放 Access Token | ❌ 不会发放 |
| `access_type: "offline"` | 发放 Access Token + Refresh Token | ✅ 会发放 |

> **记忆口诀：** offline = 离线也能用 = 有 Refresh Token 可以随时刷新

---

### 问题 4：Excel 解析返回空数据

**现象：** 邮件有 Excel 附件但 `excelData` 为空或 `rows` 为空数组

**排查方向：**
1. 检查附件 MIME 类型是否正确识别（`.xlsx` vs `.xls`）
2. 检查 Excel 文件是否有多个工作表（当前只解析第一个）
3. 检查 Excel 是否有合并单元格（ExcelJS 对复杂格式的支持有限）
4. 在终端打印 buffer 大小确认附件确实下载成功

```typescript
// 在 downloadAndParseExcel 中加一行调试
console.log("[Excel] 附件大小:", buffer.length, "bytes");
console.log("[Excel] 工作表数量:", workbook.worksheets.length);
```

---

### 问题 5：Gmail API 配额限制

**免费额度：**
- 每天每用户：250 次发送
- 每秒每用户：10 次读取（配额因项目而异）

**应对策略：**
- 搜索结果缓存（同一柜号 5 分钟内不重复搜索）
- 分页加载（不要一次拉太多邮件）
- 生产环境考虑申请提高配额

---

### 问题 6：从开发迁移到生产环境（Vercel 部署）

当你要部署到 Vercel 时，需要注意：

1. **更新重定向 URI：** 在 Google Cloud Console 中添加生产域名
   ```
   https://your-app.vercel.app/api/gmail/callback
   ```

2. **设置环境变量：** Vercel Dashboard → Settings → Environment Variables
   ```
   GOOGLE_CLIENT_ID=生产环境的 client_id
   GOOGLE_CLIENT_SECRET=生产环境的 client_secret
   GOOGLE_REDIRECT_URI=https://your-app.vercel.app/api/gmail/callback
   ```

3. **Cookie 安全设置：** 生产环境将 `secure: false` 改为 `secure: true`

4. **OAuth 同意屏幕：** 从「测试」状态改为「发布」状态（需要 Google 审核或验证域名）

---

## 附录 A：完整的文件清单

搭建完本模块后，项目中新增/修改的文件一览：

```
新增文件：
├── gmail-credentials.json                     # Google OAuth 凭据（不入 Git）
├── src/lib/gmail.ts                           # Gmail API 核心封装库
├── src/app/api/gmail/auth/route.ts            # OAuth 授权跳转接口
├── src/app/api/gmail/callback/route.ts        # OAuth 回调处理接口
├── src/app/api/gmail/search/route.ts          # 邮件搜索接口
├── src/app/api/gmail/message/[id]/route.ts    # 邮件详情接口
└── src/components/GmailSearchDialog.tsx       # 前端搜索弹框组件

修改文件：
├── .env                                       # 新增 Gmail 相关环境变量
├── .gitignore                                 # 忽略凭据文件
├── package.json                               # 新增 3 个依赖
└── src/app/containers/page.tsx                # 集成搜索按钮（小改）

新增依赖：
├── googleapis                                 # Google API 客户端
├── google-auth-library                        # OAuth 认证库
└── exceljs                                    # Excel 解析库
```

## 附录 B：技术选型对比备忘录

| 场景 | 推荐方案 | 替代方案 |
|------|---------|---------|
| Gmail API 调用 | `googleapis`（官方） | `node-imap`（IMAP 协议，需应用专用密码） |
| Excel 解析 | `exceljs`（功能全） | `xlsx`/`SheetJS`（轻量快） |
| Token 存储 | 数据库（生产推荐） | Cookie（开发够用） / Redis（高并发） |
| 部署平台 | Vercel（Next.js 官方推荐） | 自建服务器 / Railway / Render |

---

> **恭喜你走到这里！** 如果你按照本文档一步步敲完了所有代码，你已经掌握了：
> - Google Cloud Console 配置
> - OAuth 2.0 授权完整流程
> - Gmail REST API 的搜索、读取、附件下载
> - ExcelJS 解析 `.xlsx` 文件
> - Next.js API Routes 中集成第三方 Node.js 库
>
> 这些技能可以直接应用到任何需要对接 Google 服务的场景中（Google Calendar、Google Sheets、Google Drive 等）。
