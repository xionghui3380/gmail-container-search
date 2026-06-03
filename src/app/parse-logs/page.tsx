"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { RefreshCw, Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import DashboardLayout from "@/components/layout/DashboardLayout";

type LogRow = {
  id: string;
  container_id?: string | null;
  attachment_id?: number | null;
  container_no: string;
  batch_no?: string | null;
  step?: string | null;
  status?: string | null;
  message?: string | null;
  created_at?: string;
};

function ParseLogsContent() {
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [containerNo, setContainerNo] = useState(searchParams.get("containerNo") ?? "");
  const [batchNo, setBatchNo] = useState(searchParams.get("batchNo") ?? "");
  const [containerId] = useState(searchParams.get("containerId") ?? "");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 50;

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (containerNo.trim()) params.set("containerNo", containerNo.trim());
      if (batchNo.trim()) params.set("batchNo", batchNo.trim());
      if (containerId) params.set("containerId", containerId);
      const res = await fetch(`/api/v1/parse-logs?${params}`);
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
  }, [page, containerNo, batchNo, containerId]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <DashboardLayout title="解析日志" subtitle="邮件检索与附件解析过程记录">
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          value={containerNo}
          onChange={(e) => {
            setContainerNo(e.target.value);
            setPage(1);
          }}
          placeholder="柜号"
          className="h-9 w-36 rounded-md border px-3 text-sm"
        />
        <input
          value={batchNo}
          onChange={(e) => {
            setBatchNo(e.target.value);
            setPage(1);
          }}
          placeholder="批次号"
          className="h-9 w-44 rounded-md border px-3 text-sm"
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
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="border-b text-left text-slate-600">
              <th className="px-3 py-3">时间</th>
              <th className="px-3 py-3">柜号</th>
              <th className="px-3 py-3">批次</th>
              <th className="px-3 py-3">步骤</th>
              <th className="px-3 py-3">状态</th>
              <th className="px-3 py-3">信息</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="py-16 text-center text-slate-400">
                  加载中...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-16 text-center text-slate-400">
                  暂无日志
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b hover:bg-slate-50">
                  <td className="whitespace-nowrap px-3 py-2">
                    {row.created_at
                      ? format(new Date(row.created_at), "yyyy-MM-dd HH:mm:ss")
                      : "-"}
                  </td>
                  <td className="px-3 py-2">{row.container_no}</td>
                  <td className="px-3 py-2">{row.batch_no ?? "-"}</td>
                  <td className="px-3 py-2">{row.step ?? "-"}</td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        row.status === "failed"
                          ? "text-red-600"
                          : row.status === "warning"
                            ? "text-amber-600"
                            : "text-green-600"
                      }
                    >
                      {row.status ?? "-"}
                    </span>
                  </td>
                  <td className="max-w-md truncate px-3 py-2" title={row.message ?? ""}>
                    {row.message ?? "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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
    </DashboardLayout>
  );
}

export default function ParseLogsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-400">加载中...</div>}>
      <ParseLogsContent />
    </Suspense>
  );
}
