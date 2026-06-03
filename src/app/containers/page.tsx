"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { FileText, RefreshCw, RotateCw, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ParseResultDialog from "@/components/ParseResultDialog";
import { useParseResultTablePreferences } from "@/hooks/useParseResultTablePreferences";
import {
  formatParseStatus,
  isParseResultDateColumn,
  type ParseResultColumnKey,
} from "@/lib/parse-result-columns";

type ParseRow = Record<string, string | number | null | undefined> & {
  id: string;
  batch_no?: string | null;
  container_no: string;
  parse_status?: string | null;
};

function formatCell(value: unknown, key: ParseResultColumnKey) {
  if (key === "parse_status") return formatParseStatus(String(value ?? ""));
  if (isParseResultDateColumn(key)) {
    if (!value) return "-";
    const date = new Date(String(value));
    return Number.isNaN(date.getTime())
      ? "-"
      : format(date, key === "email_date" ? "yyyy-MM-dd HH:mm" : "yyyy-MM-dd");
  }
  return value != null && String(value).trim() ? String(value) : "-";
}

function ParseResultsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<ParseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [containerNo, setContainerNo] = useState(searchParams.get("containerNo") ?? "");
  const [batchNo, setBatchNo] = useState(searchParams.get("batchNo") ?? "");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [dialogId, setDialogId] = useState<string | null>(null);
  const [reparsingId, setReparsingId] = useState<string | null>(null);
  const pageSize = 50;

  const { visibleColumns, getWidth } = useParseResultTablePreferences();

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (containerNo.trim()) params.set("containerNo", containerNo.trim());
      if (batchNo.trim()) params.set("batchNo", batchNo.trim());
      const res = await fetch(`/api/v1/containers?${params}`);
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.message ?? "加载失败");
        return;
      }
      setRows(json.data ?? []);
      setTotal(json.pagination?.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [page, containerNo, batchNo]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  async function handleReparse(id: string) {
    setReparsingId(id);
    try {
      const res = await fetch(`/api/v1/containers/${id}/reparse`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        if (json.meta?.needReconnect) toast.error("请先连接 Gmail");
        else toast.error(json.message ?? "解析失败");
        return;
      }
      toast.success(`解析完成：${json.data.itemCount ?? 0} 条明细`);
      loadRows();
    } finally {
      setReparsingId(null);
    }
  }

  function goParseLogs(row: ParseRow) {
    const params = new URLSearchParams({
      containerId: row.id,
      containerNo: row.container_no,
    });
    if (row.batch_no) params.set("batchNo", String(row.batch_no));
    router.push(`/parse-logs?${params}`);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <DashboardLayout title="解析结果" subtitle="Gmail 邮件解析记录">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={containerNo}
          onChange={(e) => {
            setContainerNo(e.target.value);
            setPage(1);
          }}
          placeholder="柜号"
          className="h-9 w-36 rounded-md border border-slate-200 px-3 text-sm"
        />
        <input
          value={batchNo}
          onChange={(e) => {
            setBatchNo(e.target.value);
            setPage(1);
          }}
          placeholder="批次号"
          className="h-9 w-44 rounded-md border border-slate-200 px-3 text-sm"
        />
        <button
          type="button"
          onClick={() => {
            setPage(1);
            loadRows();
          }}
          className="inline-flex h-9 items-center gap-1 rounded-md bg-blue-600 px-4 text-sm text-white"
        >
          <Search size={15} /> 搜索
        </button>
        <button type="button" onClick={loadRows} className="inline-flex h-9 items-center gap-1 rounded-md border px-3 text-sm">
          <RefreshCw size={15} /> 刷新
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <div className="h-[600px] overflow-x-auto">
          <table className="w-max min-w-full text-sm">
            <thead className="sticky top-0 bg-slate-50">
              <tr className="border-b text-left text-slate-600">
                {visibleColumns.map((col) => (
                  <th
                    key={col.key}
                    style={{ minWidth: getWidth(col.key) }}
                    className="whitespace-nowrap px-2 py-3 font-medium"
                  >
                    {col.label}
                  </th>
                ))}
                <th className="sticky right-0 min-w-[220px] bg-slate-50 px-2 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={visibleColumns.length + 1} className="py-16 text-center text-slate-400">
                    加载中...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length + 1} className="py-16 text-center text-slate-400">
                    暂无数据
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b hover:bg-slate-50/80">
                    {visibleColumns.map((col) => (
                      <td key={col.key} className="whitespace-nowrap px-2 py-3">
                        {formatCell(row[col.key], col.key)}
                      </td>
                    ))}
                    <td className="sticky right-0 whitespace-nowrap bg-white px-2 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={reparsingId === row.id}
                          onClick={() => handleReparse(row.id)}
                          className="text-blue-600 hover:underline disabled:opacity-50"
                        >
                          <RotateCw size={12} className="mr-0.5 inline" />
                          {reparsingId === row.id ? "解析中" : "重新解析"}
                        </button>
                        <button
                          type="button"
                          onClick={() => goParseLogs(row)}
                          className="text-slate-600 hover:underline"
                        >
                          <FileText size={12} className="mr-0.5 inline" />
                          解析日志
                        </button>
                        <button
                          type="button"
                          onClick={() => setDialogId(row.id)}
                          className="text-green-600 hover:underline"
                        >
                          查看结果
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-between px-4 py-3 text-sm text-slate-500">
        <span>
          共 {total} 条，第 {page}/{totalPages} 页
        </span>
        <div className="flex gap-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border px-3 py-1 disabled:opacity-40">
            上一页
          </button>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded border px-3 py-1 disabled:opacity-40">
            下一页
          </button>
        </div>
      </div>

      <ParseResultDialog open={!!dialogId} containerId={dialogId} onClose={() => setDialogId(null)} />
    </DashboardLayout>
  );
}

export default function ParseResultsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-400">加载中...</div>}>
      <ParseResultsContent />
    </Suspense>
  );
}
