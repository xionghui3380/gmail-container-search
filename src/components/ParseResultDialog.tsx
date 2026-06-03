"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { ChevronDown, ChevronUp, FileSpreadsheet, X } from "lucide-react";

type DeliveryItem = {
  id: string;
  attachment_id?: string | null;
  customer_code?: string | null;
  fba_id?: string | null;
  reference_id?: string | null;
  cbm?: string | null;
  weight?: string | null;
  carton_count?: number | null;
  warehouse_code?: string | null;
  delivery_method?: string | null;
  customer_note?: string | null;
  actual_carton_count?: number | null;
  pallet_count?: number | null;
  warehouse_note?: string | null;
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

const ITEM_COLUMNS = [
  { key: "customer_code", label: "客户代码" },
  { key: "fba_id", label: "FBA" },
  { key: "reference_id", label: "Reference" },
  { key: "warehouse_code", label: "仓库" },
  { key: "carton_count", label: "箱数" },
  { key: "cbm", label: "CBM" },
  { key: "weight", label: "重量" },
  { key: "delivery_method", label: "派送方式" },
] as const;

export default function ParseResultDialog({ open, onClose, containerId }: ParseResultDialogProps) {
  const [attachments, setAttachments] = useState<AttachmentInfo[]>([]);
  const [itemsByAttachment, setItemsByAttachment] = useState<Record<string, DeliveryItem[]>>({});
  const [loading, setLoading] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState(0);

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
                    <button
                      type="button"
                      onClick={() => setExpandedIndex(isExpanded ? -1 : index)}
                      className="flex w-full items-center justify-between bg-slate-50 px-4 py-3 text-left hover:bg-slate-100"
                    >
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet size={16} className="text-green-600" />
                        <span className="font-medium text-slate-800">
                          {att.attachment_name || "未命名附件"}
                        </span>
                        <span className="text-xs text-slate-500">
                          {rows.length} 条明细 · {att.parse_status}
                        </span>
                      </div>
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
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
                                <tr key={row.id} className="border-t border-slate-100">
                                  {ITEM_COLUMNS.map((col) => (
                                    <td key={col.key} className="whitespace-nowrap px-3 py-2">
                                      {row[col.key] ?? "-"}
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
