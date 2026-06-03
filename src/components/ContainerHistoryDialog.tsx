"use client";

import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { X, ChevronDown, ChevronUp, User, Clock, Hash } from "lucide-react";
import { type ColumnKey, DATA_COLUMNS } from "@/lib/container-columns";
import { renderSnapshotValue } from "@/lib/google-sheet-cell-render";

type HistoryRecord = {
  id: string;
  container_id: string;
  version: number;
  snapshot: Record<string, unknown>;
  operated_by: string;
  created_at: string;
  users?: {
    id: string;
    username: string;
    full_name: string;
  };
};

type ContainerHistoryDialogProps = {
  open: boolean;
  onClose: () => void;
  containerId: string | null;
};

function renderSnapshotCell(snapshot: Record<string, unknown>, key: ColumnKey) {
  const value = snapshot[key];
  if (key === "container_no") {
    return <span className="font-medium text-slate-800">{renderSnapshotValue(key, value)}</span>;
  }
  return renderSnapshotValue(key, value);
}

export default function ContainerHistoryDialog({
  open,
  onClose,
  containerId,
}: ContainerHistoryDialogProps) {
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number>(-1);

  useEffect(() => {
    if (open && containerId) {
      loadHistory();
      setExpandedIndex(-1);
    }
  }, [open, containerId]);

  async function loadHistory() {
    if (!containerId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/google-sheet/${containerId}/history`);
      const json = await res.json();
      if (res.ok) {
        setHistory(json.data || []);
      }
    } catch (err) {
      console.error("[History] Load error:", err);
    } finally {
      setLoading(false);
    }
  }

  const handleToggleExpand = useCallback((index: number) => {
    setExpandedIndex((prev) => (prev === index ? -1 : index));
  }, []);

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
            历史记录
            {containerId && (
              <span className="ml-2 text-sm font-normal text-slate-500">
                (ID: {containerId})
              </span>
            )}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-slate-500">加载中...</div>
            </div>
          ) : history.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-slate-500">暂无历史记录</div>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((record, index) => {
                const isExpanded = expandedIndex === index;

                return (
                  <div
                    key={`history-${index}`}
                    className="overflow-hidden rounded-lg border border-slate-200 bg-white"
                  >
                    <div
                      className="flex cursor-pointer items-center justify-between px-4 py-3 hover:bg-slate-50 active:bg-slate-100 select-none"
                      onClick={() => handleToggleExpand(index)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleToggleExpand(index);
                        }
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">
                          <Hash size={14} />
                          V{record.version}
                        </span>

                        <span className="flex items-center gap-1.5 text-sm text-slate-600">
                          <User size={14} />
                          {record.users?.full_name || record.users?.username || "未知用户"}
                        </span>

                        <span className="flex items-center gap-1.5 text-sm text-slate-500">
                          <Clock size={14} />
                          {format(new Date(record.created_at), "yyyy-MM-dd HH:mm:ss")}
                        </span>
                      </div>

                      <span className="flex shrink-0 items-center gap-1.5 text-sm">
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${isExpanded ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                          {isExpanded ? '已展开' : '查看详情'}
                        </span>
                        {isExpanded ? (
                          <ChevronUp size={16} className="text-green-600" />
                        ) : (
                          <ChevronDown size={16} className="text-slate-400" />
                        )}
                      </span>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-slate-200 bg-slate-50 p-4">
                        <div className="mb-2 text-xs font-medium text-slate-500">
                          版本 V{record.version} 数据快照 · {format(new Date(record.created_at), "yyyy-MM-dd HH:mm:ss")}
                        </div>
                        <div className="overflow-x-auto rounded border border-slate-200 bg-white">
                          <table className="w-full text-left text-sm">
                            <thead>
                              <tr className="border-b border-slate-200 bg-slate-50">
                                {DATA_COLUMNS.map((col) => (
                                  <th key={col.key} className="whitespace-nowrap px-3 py-2 text-xs font-medium text-slate-600">
                                    {col.label}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              <tr className="border-b border-slate-100 hover:bg-blue-50/30">
                                {DATA_COLUMNS.map((col) => (
                                  <td key={col.key} className="whitespace-nowrap px-3 py-2 text-slate-700">
                                    {renderSnapshotCell(record.snapshot, col.key)}
                                  </td>
                                ))}
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
