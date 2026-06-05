"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { ChevronDown, ChevronUp, Download, FileSpreadsheet, X } from "lucide-react";
import { toast } from "sonner";
import { DELIVERY_ITEM_COLUMNS } from "@/lib/delivery-items-export";

type DeliveryItem = {
  id: string;
  attachment_id?: string | null;
  container_no?: string | null;
  customer_code?: string | null;
  fba_id?: string | null;
  reference_id?: string | null;
  cbm?: string | null;
  weight?: string | null;
  carton_count?: number | null;
  warehouse_code?: string | null;
  delivery_method?: string | null;
  warning?: string | null;
};

type AttachmentInfo = {
  id: string;
  attachment_name?: string | null;
  parse_status?: string | null;
  error_message?: string | null;
};

type ParseResultDialogProps = {
  open: boolean;
  onClose: () => void;
  containerId: string | null;
};

const ITEM_COLUMNS = DELIVERY_ITEM_COLUMNS;

export default function ParseResultDialog({ open, onClose, containerId }: ParseResultDialogProps) {
  const [attachments, setAttachments] = useState<AttachmentInfo[]>([]);
  const [itemsByAttachment, setItemsByAttachment] = useState<Record<string, DeliveryItem[]>>({});
  const [loading, setLoading] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState(0);
  const [exportingId, setExportingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!containerId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/containers/${containerId}/items`);
      const json = await res.json();
      if (!res.ok) return;
      const atts: AttachmentInfo[] = json.data?.attachments ?? [];
      const items: DeliveryItem[] = json.data?.items ?? [];
      setAttachments(atts);
      const grouped: Record<string, DeliveryItem[]> = {};
      for (const att of atts) {
        grouped[att.id] = items.filter((item) => item.attachment_id === att.id);
      }
      if (atts.length === 0) {
        grouped.all = items;
      }
      setItemsByAttachment(grouped);
      setExpandedIndex(0);
    } finally {
      setLoading(false);
    }
  }, [containerId]);

  useEffect(() => {
    if (open && containerId) loadData();
  }, [open, containerId, loadData]);

  async function handleExport(attachmentId: string, attachmentName?: string | null) {
    if (!containerId) return;
    setExportingId(attachmentId);
    try {
      const res = await fetch(
        `/api/v1/containers/${containerId}/export?attachmentId=${encodeURIComponent(attachmentId)}`,
      );
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        toast.error(json?.message ?? "导出失败");
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
      const asciiMatch = disposition.match(/filename="([^"]+)"/i);
      const filename = utf8Match
        ? decodeURIComponent(utf8Match[1])
        : asciiMatch?.[1] ?? attachmentName ?? "export.xlsx";

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExportingId(null);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[85vh] w-full max-w-6xl flex-col rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-800">
            解析结果
            {containerId && (
              <span className="ml-2 text-sm font-normal text-slate-500">ID: {containerId}</span>
            )}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-slate-400 hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="py-16 text-center text-slate-500">加载中...</div>
          ) : attachments.length === 0 ? (
            <div className="py-16 text-center text-slate-500">暂无解析明细</div>
          ) : (
            <div className="space-y-3">
              {attachments.map((att, index) => {
                const isExpanded = expandedIndex === index;
                const rows = itemsByAttachment[att.id] ?? [];
                return (
                  <div
                    key={att.id}
                    className="overflow-hidden rounded-lg border border-slate-200"
                  >
                    <div className="flex items-center justify-between bg-slate-50 px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setExpandedIndex(isExpanded ? -1 : index)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left hover:opacity-80"
                      >
                        <FileSpreadsheet size={16} className="shrink-0 text-green-600" />
                        <span className="truncate font-medium text-slate-800">
                          {att.attachment_name || "未命名附件"}
                        </span>
                        <span className="shrink-0 text-xs text-slate-500">
                          {rows.length} 条明细 · {att.parse_status}
                        </span>
                      </button>
                      <div className="ml-3 flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handleExport(att.id, att.attachment_name)}
                          disabled={exportingId === att.id || rows.length === 0}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Download size={14} />
                          {exportingId === att.id ? "导出中..." : "导出"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setExpandedIndex(isExpanded ? -1 : index)}
                          className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
                          aria-label={isExpanded ? "收起" : "展开"}
                        >
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="overflow-x-auto border-t border-slate-200">
                        {att.error_message && (
                          <div className="bg-red-50 px-4 py-2 text-sm text-red-600">
                            {att.error_message}
                          </div>
                        )}
                        <table className="min-w-full text-sm">
                          <thead className="bg-white">
                            <tr>
                              {ITEM_COLUMNS.map((col) => (
                                <th
                                  key={col.key}
                                  className="whitespace-nowrap px-3 py-2 text-left font-medium text-slate-600"
                                >
                                  {col.label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {rows.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={ITEM_COLUMNS.length}
                                  className="px-4 py-8 text-center text-slate-400"
                                >
                                  无明细数据
                                </td>
                              </tr>
                            ) : (
                              rows.map((row) => (
                                <tr key={row.id} className={`border-t border-slate-100 ${row.warning ? "bg-amber-50" : ""}`}>
                                  {ITEM_COLUMNS.map((col) => (
                                    <td key={col.key} className="whitespace-nowrap px-3 py-2">
                                      {col.key === "warning" && row.warning ? (
                                        <span className="text-xs text-amber-700">{row.warning}</span>
                                      ) : (
                                        (row[col.key as keyof DeliveryItem] ?? "-")
                                      )}
                                    </td>
                                  ))}
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function formatLogTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return format(date, "yyyy-MM-dd HH:mm:ss");
}
