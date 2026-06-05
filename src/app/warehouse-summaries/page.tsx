"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { RefreshCw, Search, ChevronRight } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import DashboardLayout from "@/components/layout/DashboardLayout";

type SummaryRow = {
  warehouse_code: string;
  item_count: number;
  total_cartons: number;
  total_weight: number;
  total_cbm: number;
};

function WarehouseSummariesContent() {
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [warehouseCode, setWarehouseCode] = useState(searchParams.get("warehouseCode") ?? "");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 50;

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (warehouseCode.trim()) params.set("warehouseCode", warehouseCode.trim());
      const res = await fetch(`/api/v1/warehouse-summaries?${params}`);
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
  }, [page, warehouseCode]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <DashboardLayout title="仓库信息汇总" subtitle="基于最新数据（非历史）按仓库代码统计">
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          value={warehouseCode}
          onChange={(e) => {
            setWarehouseCode(e.target.value);
            setPage(1);
          }}
          placeholder="搜索仓库代码"
          className="h-9 w-48 rounded-md border px-3 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setPage(1);
              loadRows();
            }
          }}
        />
        <button
          type="button"
          onClick={() => {
            setPage(1);
            loadRows();
          }}
          className="inline-flex h-9 items-center gap-1 rounded-md bg-blue-600 px-4 text-sm text-white hover:bg-blue-700"
        >
          <Search size={15} /> 搜索
        </button>
        <button type="button" onClick={loadRows} className="inline-flex h-9 items-center gap-1 rounded-md border px-3 text-sm hover:bg-slate-50">
          <RefreshCw size={15} /> 刷新
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="border-b text-left text-slate-600">
              <th className="px-3 py-3">仓库代码</th>
              <th className="px-3 py-3">明细行数</th>
              <th className="px-3 py-3">总箱数</th>
              <th className="px-3 py-3">总重量</th>
              <th className="px-3 py-3">总体积(CBM)</th>
              <th className="px-3 py-3 text-center">操作</th>
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
                  暂无数据
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr key={`${row.warehouse_code}-${idx}`} className="border-b hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium">{row.warehouse_code}</td>
                  <td className="px-3 py-2">{row.item_count}</td>
                  <td className="px-3 py-2">{row.total_cartons}</td>
                  <td className="px-3 py-2">{row.total_weight}</td>
                  <td className="px-3 py-2">{row.total_cbm}</td>
                  <td className="px-3 py-2 text-center">
                    <Link
                      href={`/warehouse-summaries/detail?warehouseCode=${encodeURIComponent(row.warehouse_code === "(空)" ? "" : row.warehouse_code)}&exact=true`}
                      className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                    >
                      查看明细 <ChevronRight size={14} />
                    </Link>
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
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border px-3 py-1 disabled:opacity-40 hover:bg-slate-50">
            上一页
          </button>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded border px-3 py-1 disabled:opacity-40 hover:bg-slate-50">
            下一页
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function WarehouseSummariesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-400">加载中...</div>}>
      <WarehouseSummariesContent />
    </Suspense>
  );
}
