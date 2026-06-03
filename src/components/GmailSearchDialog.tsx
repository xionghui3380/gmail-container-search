/**
 * ============================================================
 *  Gmail 邮件搜索弹框组件
 * ============================================================
 *
 *  功能：
 *    - 显示「搜索邮件」按钮（未打开时只显示按钮）
 *    - 弹出后自动按柜号搜索 Gmail 邮件
 *    - 展示搜索结果列表（标题、发件人、时间、是否有Excel附件）
 *    - 点击邮件可展开查看详情和 Excel 附件解析结果（表格形式）
 *
 *  使用方式：
 *    <GmailSearchDialog containerNo="EGSU6027772" />
 */

"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Mail, ExternalLink, FileSpreadsheet, AlertCircle, Loader2, Database } from "lucide-react";
import { toast } from "sonner";

// ============================================================
//  类型定义
// ============================================================

/** 搜索结果中的一条邮件记录 */
interface EmailItem {
    id: string;
    threadId: string;
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
    attachments: Array<{
        filename: string;
        mimeType: string;
        attachmentId: string;
        isExcel: boolean;
    }>;
    excelData?: ExcelData;
}

type WarehouseSummary = {
    warehouse_code: string;
    total_cartons: number;
    item_count: number;
};

type ParseResult = {
    containerNo: string;
    parseStatus: string;
    itemCount: number;
    summaryCount: number;
    summaries: WarehouseSummary[];
    warnings: string[];
    errorMessage?: string;
};

// ============================================================
//  主组件
// ============================================================

interface GmailSearchDialogProps {
    /** 要搜索的柜号 */
    containerNo: string;
    /** 解析入库成功后回调（如刷新列表） */
    onParsed?: () => void;
    /** 详情页链接，默认 /google-sheet/[柜号] */
    detailHref?: string;
}

export default function GmailSearchDialog({
    containerNo,
    onParsed,
    detailHref,
}: GmailSearchDialogProps) {
    // ---- 状态管理 ----
    const [isOpen, setIsOpen] = useState(false);           // 弹框开关
    const [loading, setLoading] = useState(false);          // 搜索加载中
    const [emails, setEmails] = useState<EmailItem[]>([]);  // 搜索结果
    const [errorMsg, setErrorMsg] = useState<string>("");   // 错误信息
    const [selectedEmail, setSelectedEmail] = useState<EmailDetail | null>(null); // 选中的邮件详情
    const [detailLoading, setDetailLoading] = useState(false); // 详情加载中
    const [parsing, setParsing] = useState(false);
    const [parseResult, setParseResult] = useState<ParseResult | null>(null);

    // ---- 搜索邮件 ----
    const handleSearch = useCallback(async () => {
        setLoading(true);
        setErrorMsg("");
        setSelectedEmail(null);
        setParseResult(null);
        setEmails([]);

        try {
            const res = await fetch(
                `/api/v1/gmail/search?containerNo=${encodeURIComponent(containerNo)}`
            );
            const json = await res.json();

            if (!res.ok) {
                // 特殊处理：需要重新授权的情况
                if (json.meta?.needReconnect) {
                    setErrorMsg("Gmail 授权已过期，请重新连接");
                    return;
                }
                throw new Error(json.message || "搜索失败");
            }

            setEmails(json.data || []);
            if ((json.data || []).length === 0) {
                setErrorMsg("未找到相关邮件");
            }
        } catch (err: unknown) {
            setErrorMsg(err instanceof Error ? err.message : "搜索出错");
        } finally {
            setLoading(false);
        }
    }, [containerNo]);

    // ---- 查看邮件详情 ----
    const handleViewDetail = useCallback(async (emailId: string) => {
        setDetailLoading(true);
        setSelectedEmail(null);

        try {
            const res = await fetch(`/api/v1/gmail/message/${emailId}`);
            const json = await res.json();

            if (!res.ok) throw new Error(json.message || "获取详情失败");

            setSelectedEmail(json.data);
        } catch (err: unknown) {
            setErrorMsg(err instanceof Error ? err.message : "获取详情失败");
        } finally {
            setDetailLoading(false);
        }
    }, []);

    // ---- 解析附件并存库 ----
    const handleParseAttachment = useCallback(
        async (messageId: string, attachmentId: string, attachmentName: string) => {
            setParsing(true);
            setErrorMsg("");
            setParseResult(null);

            try {
                const res = await fetch(
                    `/api/v1/containers/by-no/${encodeURIComponent(containerNo)}/parse-attachment`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ messageId, attachmentId, attachmentName }),
                    },
                );
                const json = await res.json();

                if (!res.ok) {
                    if (json.meta?.needReconnect) {
                        setErrorMsg("Gmail 授权已过期，请重新连接");
                        return;
                    }
                    throw new Error(json.message || "解析入库失败");
                }

                setParseResult(json.data);
                toast.success(
                    `解析完成：${json.data.itemCount} 条明细，${json.data.summaryCount} 个仓库汇总`,
                );
                if (json.data.warnings?.length) {
                    toast.warning(json.data.warnings.slice(0, 3).join("；"));
                }
                onParsed?.();
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : "解析入库失败";
                setErrorMsg(msg);
                toast.error(msg);
            } finally {
                setParsing(false);
            }
        },
        [containerNo, onParsed],
    );

    // ---- 打开弹框时自动搜索 ----
    const handleOpen = () => {
        setIsOpen(true);
        handleSearch();
    };

    // ---- 触发 Gmail 授权跳转 ----
    const handleConnectGmail = () => {
        window.location.href = "/api/v1/gmail/auth";
    };

    // ============================================================
    //  渲染：未打开状态 — 只显示一个按钮
    // ============================================================

    if (!isOpen) {
        return (
            <button
                onClick={handleOpen}
                className="text-blue-500 hover:text-blue-700 hover:underline text-xs"
                title={`搜索柜号 ${containerNo} 的相关邮件`}
            >
                邮件
            </button>
        );
    }

    // ============================================================
    //  渲染：弹框内容
    // ============================================================

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* 遮罩层：点击关闭 */}
            <div className="absolute inset-0 bg-black/40" onClick={() => setIsOpen(false)} />

            {/* 弹框主体 */}
            <div className="relative bg-white rounded-xl shadow-2xl w-[900px] max-h-[80vh]
                            flex flex-col overflow-hidden">

                {/* ====== 头部 ====== */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                    <div>
                        <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                            <Mail size={18} />
                            Gmail 邮件搜索
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                            柜号：<span className="font-mono text-blue-600">{containerNo}</span>
                        </p>
                    </div>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="text-slate-400 hover:text-slate-600 text-xl leading-none cursor-pointer"
                    >
                        &times;
                    </button>
                </div>

                {/* ====== 内容区 ====== */}
                <div className="flex-1 overflow-y-auto p-6">

                    {/* 错误提示 */}
                    {errorMsg && (
                        <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-600 text-sm">
                            <AlertCircle size={16} />
                            <span>{errorMsg}</span>
                            {errorMsg.includes("授权") && (
                                <button
                                    onClick={handleConnectGmail}
                                    className="ml-auto underline hover:no-underline whitespace-nowrap font-medium"
                                >
                                    去连接 Gmail &rarr;
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
                                找到 <strong>{emails.length}</strong> 封相关邮件
                            </div>
                            {emails.map((email) => (
                                <div
                                    key={email.id}
                                    onClick={() => handleViewDetail(email.id)}
                                    className="p-4 rounded-lg border border-slate-200 cursor-pointer
                                               hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <div className="font-medium text-slate-800 truncate text-sm">
                                                {email.subject || "(无主题)"}
                                            </div>
                                            <div className="text-xs text-slate-400 mt-1">
                                                来自：{email.from} &middot;{" "}
                                                {email.date
                                                    ? new Date(email.date).toLocaleString("zh-CN", {
                                                          month: "2-digit",
                                                          day: "2-digit",
                                                          hour: "2-digit",
                                                          minute: "2-digit",
                                                      })
                                                    : ""}
                                            </div>
                                            <div className="text-xs text-slate-500 mt-1 line-clamp-1">
                                                {email.snippet}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
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
                            {/* 返回按钮 */}
                            <button
                                onClick={() => setSelectedEmail(null)}
                                className="text-sm text-blue-500 hover:text-blue-700 inline-flex items-center gap-1"
                            >
                                &larr; 返回列表
                            </button>

                            {/* 基本信息 */}
                            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                                <h4 className="font-semibold text-slate-800 text-sm">{selectedEmail.subject}</h4>
                                <div className="text-xs text-slate-500 mt-2 space-y-1">
                                    <div>发件人：{selectedEmail.from}</div>
                                    <div>时间：
                                        {new Date(selectedEmail.date).toLocaleString("zh-CN")}
                                    </div>
                                    <div className="flex items-center gap-1 flex-wrap">
                                        <span>附件：</span>
                                        {selectedEmail.attachments.length > 0 ? (
                                            selectedEmail.attachments.map((a) => (
                                                <span
                                                    key={`${a.attachmentId}-${a.filename}`}
                                                    className={`inline-flex items-center gap-1 ml-1 px-2 py-0.5 rounded text-xs ${
                                                        a.isExcel
                                                            ? "bg-green-50 text-green-600"
                                                            : "bg-slate-100 text-slate-600"
                                                    }`}
                                                >
                                                    {a.isExcel && <FileSpreadsheet size={10} />}
                                                    {a.filename}
                                                    {a.isExcel && (
                                                        <button
                                                            type="button"
                                                            disabled={parsing}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                void handleParseAttachment(
                                                                    selectedEmail.id,
                                                                    a.attachmentId,
                                                                    a.filename,
                                                                );
                                                            }}
                                                            className="ml-1 inline-flex items-center gap-0.5 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] text-white hover:bg-blue-700 disabled:opacity-60"
                                                        >
                                                            <Database size={10} />
                                                            {parsing ? "解析中..." : "解析入库"}
                                                        </button>
                                                    )}
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
                                <pre className="whitespace-pre-wrap text-sm text-slate-600 font-sans max-h-60 overflow-y-auto leading-relaxed">
                                    {selectedEmail.bodyText || selectedEmail.snippet || "(无文本内容)"}
                                </pre>
                            </div>

                            {/* 解析入库后的仓库汇总 */}
                            {parseResult && parseResult.summaries.length > 0 && (
                                <div className="rounded-lg border border-blue-200 overflow-hidden">
                                    <div className="bg-blue-50 px-4 py-2 text-sm font-medium text-blue-800">
                                        仓库汇总（已入库）
                                    </div>
                                    <table className="w-full text-sm">
                                        <thead className="bg-blue-50/50 text-left text-blue-700">
                                            <tr>
                                                <th className="px-4 py-2 font-medium">仓库代码</th>
                                                <th className="px-4 py-2 font-medium">总箱数</th>
                                                <th className="px-4 py-2 font-medium">明细行数</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {parseResult.summaries.map((row) => (
                                                <tr key={row.warehouse_code} className="border-t border-blue-100">
                                                    <td className="px-4 py-2 font-medium">{row.warehouse_code}</td>
                                                    <td className="px-4 py-2">{row.total_cartons}</td>
                                                    <td className="px-4 py-2">{row.item_count}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <div className="border-t border-blue-100 bg-blue-50/30 px-4 py-2 text-right">
                                        <Link
                                            href={detailHref ?? `/google-sheet/${encodeURIComponent(containerNo)}`}
                                            className="text-sm text-blue-600 hover:underline"
                                            onClick={() => setIsOpen(false)}
                                        >
                                            查看柜号详情页 →
                                        </Link>
                                    </div>
                                </div>
                            )}

                            {/* Excel 附件预览 */}
                            {detailLoading && (
                                <div className="flex items-center justify-center py-8 text-slate-400">
                                    <Loader2 className="animate-spin mr-2" />
                                    正在解析 Excel 附件...
                                </div>
                            )}

                            {selectedEmail.attachments.some((a) => a.isExcel) &&
                                !selectedEmail.excelData &&
                                !detailLoading && (
                                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                                    检测到 Excel 附件，但解析失败或附件为空，请检查文件格式。
                                </div>
                            )}

                            {selectedEmail.excelData && (
                                <div className="rounded-lg border border-green-200 overflow-hidden">
                                    {/* Excel 信息头部 */}
                                    <div className="bg-green-50 px-4 py-2 flex items-center gap-2 text-sm font-medium text-green-700">
                                        <FileSpreadsheet size={16} />
                                        <span>附件预览：{selectedEmail.excelData.fileName}</span>
                                        <span className="text-green-500 font-normal text-xs">
                                            （{selectedEmail.excelData.sheetName} ·{" "}
                                            {selectedEmail.excelData.rowCount} 行 &times;{" "}
                                            {selectedEmail.excelData.columnCount} 列）
                                        </span>
                                    </div>

                                    {/* 表格展示 Excel 数据 */}
                                    <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                                        <table className="w-full text-sm">
                                            <thead className="sticky top-0 z-10">
                                                <tr className="bg-green-50/70 border-b border-green-200">
                                                    {(selectedEmail.excelData.headers || []).map((h, i) => (
                                                        <th
                                                            key={i}
                                                            className="px-4 py-2.5 text-left text-xs font-semibold text-green-800 whitespace-nowrap"
                                                        >
                                                            {h}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-green-100">
                                                {(selectedEmail.excelData.rows || []).map((row, ri) => (
                                                    <tr key={ri} className="hover:bg-green-50/20 transition-colors">
                                                        {(selectedEmail.excelData!.headers || []).map((h, ci) => (
                                                            <td
                                                                key={ci}
                                                                className="px-4 py-2 text-slate-700 whitespace-nowrap text-xs"
                                                                title={row[h]}
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
                        className="px-4 py-1.5 text-sm rounded-md bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors"
                    >
                        关闭
                    </button>
                </div>
            </div>
        </div>
    );
}
