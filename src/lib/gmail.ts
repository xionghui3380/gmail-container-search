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
 *    import { getAuthUrl, searchEmailsByContainer, getEmailDetail } from "@/lib/gmail";
 */

import { google, type gmail_v1 } from "googleapis";
import ExcelJS from "exceljs";

// ============================================================
//  配置常量
// ============================================================

/** 从环境变量读取 Google OAuth 配置 */
const GOOGLE_CONFIG = {
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    redirectUri: process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/v1/gmail/callback",
};

/** 默认搜索的发件人（可在环境变量中覆盖） */
const DEFAULT_SENDER = process.env.GMAIL_DEFAULT_SENDER || "wenyang@ggtransport.in";

/**
 * OAuth 2.0 请求的权限范围（Scopes）
 * 附件通过 Gmail API messages.attachments.get 下载，无需 Drive 权限
 */
const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];

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
export function getAuthUrl(state?: string, options?: { forceConsent?: boolean }) {
    const auth = createOAuth2Client();

    const url = auth.generateAuthUrl({
        access_type: "offline",
        scope: SCOPES,
        state: state || "",
        include_granted_scopes: true,
        ...(options?.forceConsent ? { prompt: "consent" as const } : {}),
    });

    return url;
}

// ============================================================
//  功能 2：用授权码换取 Token
// ============================================================

/**
 * 用 Google 回调返回的 authorizationCode 换取 access_token 和 refresh_token
 *
 * @param code - Google 回调 URL 中的 code 参数（字符串）
 * @returns 包含 tokens 的对象
 *
 * @example
 * // 在 /api/v1/gmail/callback 中调用
 * const tokens = await exchangeCodeForTokens(req.url 中的 code 参数);
 * // tokens = { access_token: "ya29.xxx", refresh_token: "1//xxx", ... }
 */
export async function exchangeCodeForTokens(code: string) {
    const auth = createOAuth2Client();
    const tokens = await auth.getToken(code);
    return tokens.tokens as {
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
 * const results = await searchEmailsByContainer("EGSU6027772", undefined, token, refreshToken);
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

    // 构建 Gmail 搜索查询字符串（需求文档中的格式）
    const query = `from:${senderEmail || DEFAULT_SENDER} ${containerNo}`;

    console.log(`[Gmail] 搜索查询: ${query}`);

    // 调用 Gmail API 的 messages.list 接口
    const response = await gmail.users.messages.list({
        userId: "me",
        q: query,
        maxResults: 20,
    });

    const messages = response.data.messages;

    // 如果没有搜到结果，返回空数组
    if (!messages || messages.length === 0) {
        return [];
    }

    // 遍历每封邮件，提取关键信息
    const results: EmailSearchResult[] = [];
    for (const msg of messages) {
        if (!msg.id) continue;

        // 获取邮件完整数据（包含 headers 和 payload）
        const detail = await gmail.users.messages.get({
            userId: "me",
            id: msg.id,
            format: "metadata",
            metadataHeaders: ["From", "Subject", "Date"],
        });

        // 从 headers 中提取我们需要的信息
        const headers = detail.data.payload?.headers || [];

        /** 安全获取指定名称的 header 值（处理 name 为 undefined 的情况） */
        const getHeader = (name: string) =>
            headers.find((h) => (h.name || "").toLowerCase() === name.toLowerCase())?.value || "";

        const subject = getHeader("Subject");
        const from = getHeader("From");
        const dateStr = getHeader("Date");

        // 检查是否有 Excel 附件
        const hasExcelAttachment = checkHasExcelAttachment(detail.data.payload);

        results.push({
            id: msg.id,
            threadId: msg.threadId || "",
            snippet: detail.data.snippet || "",
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
    headers: string[];
    rows: Record<string, string>[];
    rowCount: number;
    columnCount: number;
}

/**
 * 邮件完整详情的类型定义
 */
export interface EmailDetail extends EmailSearchResult {
    bodyText: string;
    bodyHtml: string;
    attachments: AttachmentInfo[];
    excelData?: ParsedExcelData;
}

/**
 * 附件信息类型定义
 */
export interface AttachmentInfo {
    filename: string;
    mimeType: string;
    attachmentId: string;
    size: number;
    isExcel: boolean;
}

type MessagePart = gmail_v1.Schema$MessagePart;

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

    /** 安全获取指定名称的 header 值 */
    const getHeader = (name: string) =>
        headers.find((h) => (h.name || "").toLowerCase() === name.toLowerCase())?.value || "";

    // 解析邮件正文
    const { textBody, htmlBody } = extractBody(payload);

    // 提取附件信息
    const attachments = extractAttachments(payload);

    // 如果有 Excel 附件，尝试下载并解析
    let excelData: ParsedExcelData | undefined;
    const excelAttachment = attachments.find((a) => a.isExcel);

    if (excelAttachment) {
        try {
            excelData = await downloadAndParseExcel(
                gmail,
                messageId,
                excelAttachment,
                accessToken,
                refreshToken,
            );
        } catch (error) {
            console.error("[Gmail] Excel 解析失败:", error);
            // 解析失败不阻断整体流程，excelData 保持为 undefined
        }
    }

    return {
        id: messageId,
        threadId: response.data.threadId || "",
        snippet: response.data.snippet || "",
        subject: getHeader("Subject"),
        from: getHeader("From"),
        date: parseGmailDate(getHeader("Date")),
        hasExcelAttachment: attachments.some((item) => item.isExcel),
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
 *   └── parts[2] (attachment: .xlsx / .xls)
 */
function checkHasExcelAttachment(payload?: MessagePart | null): boolean {
    if (!payload?.parts) return false;
    return recursivelyCheckParts(payload.parts);
}

function recursivelyCheckParts(parts: MessagePart[]): boolean {
    for (const part of parts) {
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

/** 判断 MIME 类型是否为 Excel 文件 */
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
function extractBody(payload: MessagePart): { textBody: string; htmlBody: string } {
    let textBody = "";
    let htmlBody = "";

    function walkParts(parts: MessagePart[]) {
        for (const part of parts) {
            if (part.mimeType === "text/plain" && part.body?.data) {
                textBody = base64UrlDecode(part.body.data);
            }
            if (part.mimeType === "text/html" && part.body?.data) {
                htmlBody = base64UrlDecode(part.body.data);
            }
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
function extractAttachments(payload: MessagePart): AttachmentInfo[] {
    const attachments: AttachmentInfo[] = [];

    function walkParts(parts: MessagePart[]) {
        for (const part of parts) {
            // 有 attachmentId 且有 filename → 这是附件
            if (part.body?.attachmentId && part.filename) {
                attachments.push({
                    filename: part.filename,
                    mimeType: part.mimeType || "",
                    attachmentId: part.body.attachmentId,
                    size: part.body.size || 0,
                    isExcel: isExcelMimeType(part.mimeType || ""),
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
export async function downloadAttachmentBuffer(
    messageId: string,
    attachmentId: string,
    accessToken: string,
    refreshToken?: string,
): Promise<Buffer> {
    const auth = createOAuth2Client(accessToken, refreshToken);
    const gmail = google.gmail({ version: "v1", auth });
    const res = await gmail.users.messages.attachments.get({
        userId: "me",
        messageId,
        id: attachmentId,
    });
    const data = res.data.data;
    if (!data) throw new Error("附件数据为空");
    return Buffer.from(data, "base64");
}

/** 多封邮件时选择最适合解析的一封（优先有 Excel 附件，次选 snippet 更长） */
export async function pickBestEmailForParse(
    emails: EmailSearchResult[],
    accessToken: string,
    refreshToken?: string,
): Promise<EmailSearchResult> {
    if (emails.length === 1) return emails[0];

    const withExcel = emails.filter((e) => e.hasExcelAttachment);
    const pool = withExcel.length > 0 ? withExcel : emails;

    let best = pool[0];
    let bestScore = -1;

    for (const email of pool) {
      let score = email.hasExcelAttachment ? 1000 : 0;
      score += (email.snippet?.length ?? 0);
      if (email.date) score += 1;
      try {
        const detail = await getEmailDetail(email.id, accessToken, refreshToken);
        score += detail.attachments.filter((a) => a.isExcel).length * 500;
        score += detail.attachments.reduce((sum, a) => sum + (a.size ?? 0), 0) / 1000;
      } catch {
        // ignore detail fetch errors for ranking
      }
      if (score > bestScore) {
        bestScore = score;
        best = email;
      }
    }

    return best;
}

async function downloadAndParseExcel(
    gmail: gmail_v1.Gmail,
    messageId: string,
    attachment: AttachmentInfo,
    accessToken: string,
    refreshToken?: string,
): Promise<ParsedExcelData> {
    const buffer = await downloadAttachmentBuffer(
        messageId,
        attachment.attachmentId,
        accessToken,
        refreshToken,
    );

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

    // 取第一个工作表
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
        throw new Error("Excel 文件中没有工作表");
    }

    // 第三步：提取表头和数据行
    const headers: string[] = [];
    const rows: Record<string, string>[] = [];

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
        fileName: attachment.filename,
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
 * 转为 ISO 格式字符串
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
