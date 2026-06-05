"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { RefreshCw, Search, ArrowLeft, Download } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import DashboardLayout from "@/components/layout/DashboardLayout";

type DeliveryItem = {
  id: string;
  container_no: string;
  batch_no?: string | null;
  customer_code?: string | null;
  fba_id?: string | null;
  reference_id?: string | null;
  cbm?: number | string | null;
  weight?: number | string | null;
  carton_count?: number | null;
  warehouse_code?: string | null;
  delivery_method?: string | null;
  warning?: string | null;
  is_warning?: boolean;
  from_file_id?: string | number | null;
};

const COLUMNS: { key: keyof DeliveryItem; label: string }[] = [
  { key: "container_no", label: "柜号" },
  { key: "warehouse_code", label: "仓库代码" },
  { key: "fba_id", label: "FBA ID" },
  { key: "reference_id", label: "PO ID" },
  { key: "customer_code", label: "客户代码" },
  { key: "carton_count", label: "箱数" },
  { key: "weight", label: "重量" },
  { key: "cbm", label: "体积" },
  { key: "delivery_method", label: "派送方式" },
  { key: "warning", label: "警告" },
];

function WarehouseDetailContent() {
  const searchParams = useSearchParams();
  const initialWarehouseCode = searchParams.get("warehouseCode") ?? "";
  const isExact = searchParams.get("exact") === "true";

  const [rows, setRows] = useState<DeliveryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchWarehouseCode, setSearchWarehouseCode] = useState(initialWarehouseCode);
  const [exactMatch, setExactMatch] = useState(isExact);
  const [searchFbaId, setSearchFbaId] = useState(searchParams.get("fbaId") ?? "");
  const [searchRefId, setSearchRefId] = useState(searchParams.get("referenceId") ?? "");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const pageSize = 50;

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (searchWarehouseCode.trim()) {
        params.set("warehouseCode", searchWarehouseCode.trim());
      }
      if (exactMatch) {
        params.set("warehouseCodeExact", "true");
      }
      if (searchFbaId.trim()) params.set("fbaId", searchFbaId.trim());
      if (searchRefId.trim()) params.set("referenceId", searchRefId.trim());

      const res = await fetch(`/api/v1/delivery-items?${params}`);
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
  }, [page, searchWarehouseCode, exactMatch, searchFbaId, searchRefId]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const isRowAbnormal = (row: DeliveryItem) =>
    row.is_warning ||
    !row.warehouse_code ||
    row.carton_count == null ||
    row.carton_count === 0 ||
    !row.container_no;

  async function handleDownloadAttachment(fromFileId: string | number) {
    setDownloadingId(String(fromFileId));
    try {
      const res = await fetch(`/api/v1/attachments/${fromFileId}/download`);
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        toast.error(json?.message ?? "下载失败");
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
      const asciiMatch = disposition.match(/filename="([^"]+)"/i);
      const filename = utf8Match
        ? decodeURIComponent(utf8Match[1])
        : asciiMatch?.[1] ?? "attachment.xlsx";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <DashboardLayout
      title={`仓库明细 - ${initialWarehouseCode || "(空)"}`}
      subtitle="基于最新数据（非历史）的仓库明细记录"
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link
          href="/warehouse-summaries"
          className="inline-flex h-9 items-center gap-1 rounded-md border px-3 text-sm hover:bg-slate-50"
        >
          <ArrowLeft size={15} /> 返回汇总
        </Link>
        <input
          value={searchWarehouseCode}
          onChange={(e) => {
            setSearchWarehouseCode(e.target.value);
            setExactMatch(false);
            setPage(1);
          }}
          placeholder="搜索仓库代码"
          className="h-9 w-40 rounded-md border px-3 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setPage(1);
              loadRows();
            }
          }}
        />
        <input
          value={searchFbaId}
          onChange={(e) => {
            setSearchFbaId(e.target.value);
            setPage(1);
          }}
          placeholder="搜索 FBA ID"
          className="h-9 w-40 rounded-md border px-3 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setPage(1);
              loadRows();
            }
          }}
        />
        <input
          value={searchRefId}
          onChange={(e) => {
            setSearchRefId(e.target.value);
            setPage(1);
          }}
          placeholder="搜索 PO ID"
          className="h-9 w-40 rounded-md border px-3 text-sm"
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
        <button
          type="button"
          onClick={loadRows}
          className="inline-flex h-9 items-center gap-1 rounded-md border px-3 text-sm hover:bg-slate-50"
        >
          <RefreshCw size={15} /> 刷新
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="border-b text-left text-slate-600">
                {COLUMNS.map((col) => (
                  <th key={col.key} className="whitespace-nowrap px-3 py-3">
                    {col.label}
                  </th>
                ))}
                <th className="whitespace-nowrap px-3 py-3 text-center">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={COLUMNS.length + 1} className="py-16 text-center text-slate-400">
                    加载中...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length + 1} className="py-16 text-center text-slate-400">
                    暂无数据
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const abnormal = isRowAbnormal(row);
                  return (
                    <tr
                      key={String(row.id)}
                      className={`border-b hover:bg-slate-50 ${abnormal ? "bg-red-50 hover:bg-red-100" : ""}`}
                    >
                      {COLUMNS.map((col) => (
                        <td key={col.key} className="whitespace-nowrap px-3 py-2">
                          {col.key === "warning" && row.warning ? (
                            <span className="text-xs text-amber-700">{row.warning}</span>
                          ) : (
                            (row[col.key] ?? "-")
                          )}
                        </td>
                      ))}
                      <td className="whitespace-nowrap px-3 py-2 text-center">
                        {row.from_file_id ? (
                          <button
                            type="button"
                            onClick={() => void handleDownloadAttachment(row.from_file_id!)}
                            disabled={downloadingId === String(row.from_file_id)}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Download size={14} />
                            {downloadingId === String(row.from_file_id) ? "下载中..." : "下载附件"}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
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
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded border px-3 py-1 disabled:opacity-40 hover:bg-slate-50"
          >
            上一页
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded border px-3 py-1 disabled:opacity-40 hover:bg-slate-50"
          >
            下一页
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function WarehouseDetailPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-400">加载中...</div>}>
      <WarehouseDetailContent />
    </Suspense>
  );
}
