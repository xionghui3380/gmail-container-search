"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { ArrowLeft, Download, Mail, RefreshCw, Search, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import DashboardLayout from "@/components/layout/DashboardLayout";
import GmailSearchDialog from "@/components/GmailSearchDialog";

type UserInfo = {
  fullName: string;
  role: "admin" | "operator" | "viewer";
};

type WarehouseSummary = {
  id: string;
  warehouse_code: string;
  total_cartons: number;
  item_count: number;
};

type DeliveryItem = {
  id: string;
  fba_id?: string | null;
  reference_id?: string | null;
  warehouse_code?: string | null;
  carton_count?: number | null;
  cbm?: string | null;
  weight?: string | null;
  delivery_method?: string | null;
  customer_note?: string | null;
  is_warning?: boolean;
};

type ParseLog = {
  id: string;
  step: string;
  status: "success" | "failed" | "warning";
  message?: string | null;
  created_at: string;
};

type ContainerDetail = {
  container_no: string;
  customer: string;
  operation_type: string;
  pickup_driver?: string | null;
  order_date?: string | null;
  eta_date?: string | null;
  lfd_date?: string | null;
  pickup_date?: string | null;
  parse_status: string;
  is_correct: boolean;
  error_message?: string | null;
  attachment_name?: string | null;
  warehouse_summaries: WarehouseSummary[];
};

const PARSE_STATUS_LABEL: Record<string, string> = {
  pending: "待解析",
  parsing: "解析中",
  success: "成功",
  failed: "失败",
  partial_success: "部分成功",
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  return format(new Date(value), "yyyy-MM-dd");
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return format(new Date(value), "yyyy-MM-dd HH:mm");
}

export default function CargoDetailPage({ params }: { params: { containerNo: string } }) {
  const router = useRouter();
  const containerNo = decodeURIComponent(params.containerNo).toUpperCase();
  const uploadRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<UserInfo | null>(null);
  const [detail, setDetail] = useState<ContainerDetail | null>(null);
  const [items, setItems] = useState<DeliveryItem[]>([]);
  const [logs, setLogs] = useState<ParseLog[]>([]);
  const [itemTotal, setItemTotal] = useState(0);
  const [itemPage, setItemPage] = useState(1);
  const [itemSearch, setItemSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [uploading, setUploading] = useState(false);

  const canWrite = user?.role === "admin" || user?.role === "operator";
  const pageSize = 20;

  const loadUser = useCallback(async () => {
    const res = await fetch("/api/v1/auth/me");
    if (!res.ok) {
      router.push("/login?redirect=/cargo");
      return;
    }
    const json = await res.json();
    setUser(json.data.user);
  }, [router]);

  const loadDetail = useCallback(async () => {
    const res = await fetch(`/api/v1/containers/by-no/${encodeURIComponent(containerNo)}`);
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.message ?? "加载失败");
      return;
    }
    setDetail(json.data);
  }, [containerNo]);

  const loadItems = useCallback(async () => {
    const qs = new URLSearchParams({ page: String(itemPage), pageSize: String(pageSize) });
    if (itemSearch.trim()) qs.set("search", itemSearch.trim());
    const res = await fetch(
      `/api/v1/containers/by-no/${encodeURIComponent(containerNo)}/items?${qs}`,
    );
    const json = await res.json();
    if (res.ok) {
      setItems(json.data ?? []);
      setItemTotal(json.pagination?.total ?? 0);
    }
  }, [containerNo, itemPage, itemSearch]);

  const loadLogs = useCallback(async () => {
    const res = await fetch(
      `/api/v1/parse-logs?containerNo=${encodeURIComponent(containerNo)}&pageSize=20`,
    );
    const json = await res.json();
    if (res.ok) setLogs(json.data ?? []);
  }, [containerNo]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadDetail(), loadItems(), loadLogs()]);
    } finally {
      setLoading(false);
    }
  }, [loadDetail, loadItems, loadLogs]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);
  useEffect(() => {
    loadAll();
  }, [loadAll]);
  useEffect(() => {
    loadItems();
  }, [loadItems]);

  async function handleLogout() {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.push("/login");
  }

  async function handleParseEmail() {
    setParsing(true);
    try {
      const res = await fetch(
        `/api/v1/containers/by-no/${encodeURIComponent(containerNo)}`,
        { method: "POST" },
      );
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.message ?? "Gmail 解析失败");
        return;
      }
      toast.success(`Gmail 解析：${json.data.itemCount} 条明细`);
      await loadAll();
    } finally {
      setParsing(false);
    }
  }

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(
        `/api/v1/containers/by-no/${encodeURIComponent(containerNo)}/parse-upload`,
        { method: "POST", body: formData },
      );
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.message ?? "上传解析失败");
        return;
      }
      toast.success(`上传解析：${json.data.itemCount} 条明细，${json.data.summaryCount} 个仓库`);
      await loadAll();
    } finally {
      setUploading(false);
      if (uploadRef.current) uploadRef.current.value = "";
    }
  }

  const itemTotalPages = Math.max(1, Math.ceil(itemTotal / pageSize));

  return (
    <DashboardLayout
      title={`货柜 ${containerNo}`}
      subtitle={user ? `${user.fullName}（${user.role}）` : "加载中..."}
      onLogout={handleLogout}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link
          href="/cargo"
          className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm hover:bg-slate-50"
        >
          <ArrowLeft size={15} />
          返回货柜管理
        </Link>
        <button onClick={loadAll} className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm hover:bg-slate-50">
          <RefreshCw size={15} />
          刷新
        </button>
        {canWrite && (
          <>
            <GmailSearchDialog
              containerNo={containerNo}
              detailHref={`/cargo/${encodeURIComponent(containerNo)}`}
              onParsed={loadAll}
            />
            <button
              onClick={handleParseEmail}
              disabled={parsing}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-blue-600 px-3 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
            >
              <Mail size={15} />
              {parsing ? "Gmail解析中..." : "Gmail 自动解析"}
            </button>
            <input
              ref={uploadRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleUpload(f);
              }}
            />
            <button
              onClick={() => uploadRef.current?.click()}
              disabled={uploading}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-emerald-600 px-3 text-sm text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              <Upload size={15} />
              {uploading ? "上传解析中..." : "上传派送表解析"}
            </button>
          </>
        )}
        <a
          href={`/api/v1/containers/by-no/${encodeURIComponent(containerNo)}/export?type=summary`}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm hover:bg-slate-50"
        >
          <Download size={15} />
          导出汇总 CSV
        </a>
        <a
          href={`/api/v1/containers/by-no/${encodeURIComponent(containerNo)}/export?type=items`}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm hover:bg-slate-50"
        >
          <Download size={15} />
          导出明细 CSV
        </a>
      </div>

      {loading && !detail ? (
        <div className="rounded-lg border bg-white p-12 text-center text-slate-400">加载中...</div>
      ) : detail ? (
        <div className="space-y-4">
          <section className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <h2 className="font-semibold">柜号基础信息</h2>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">
                {PARSE_STATUS_LABEL[detail.parse_status] ?? detail.parse_status}
              </span>
              <span
                className={`rounded px-2 py-0.5 text-xs ${
                  detail.is_correct ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                }`}
              >
                {detail.is_correct ? "已获取附件数据" : "未正确获取"}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <InfoItem label="柜号" value={detail.container_no} />
              <InfoItem label="客户" value={detail.customer} />
              <InfoItem label="提柜司机" value={detail.pickup_driver || "-"} />
              <InfoItem label="订单日期" value={formatDate(detail.order_date)} />
              <InfoItem label="ETA" value={formatDate(detail.eta_date)} />
              <InfoItem
                label="操作方式"
                value={detail.operation_type === "fcl" ? "整柜" : "拆柜"}
              />
              <InfoItem label="LFD" value={formatDate(detail.lfd_date)} />
              <InfoItem label="提柜日期" value={formatDate(detail.pickup_date)} />
            </div>
            {detail.attachment_name && (
              <p className="mt-3 text-sm text-slate-600">
                附件来源：<span className="font-medium">{detail.attachment_name}</span>
              </p>
            )}
          </section>

          <section className="rounded-lg border bg-white shadow-sm">
            <h2 className="border-b px-4 py-3 font-semibold">
              分货汇总（送货仓点 · 箱数）
            </h2>
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-2">仓库代码</th>
                  <th className="px-4 py-2">总箱数</th>
                  <th className="px-4 py-2">明细行数</th>
                </tr>
              </thead>
              <tbody>
                {detail.warehouse_summaries.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-400">
                      暂无汇总，请上传派送表或连接 Gmail 解析
                    </td>
                  </tr>
                ) : (
                  detail.warehouse_summaries.map((row) => (
                    <tr key={row.id} className="border-t">
                      <td className="px-4 py-2 font-medium">{row.warehouse_code}</td>
                      <td className="px-4 py-2">{row.total_cartons}</td>
                      <td className="px-4 py-2">{row.item_count}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>

          <section className="rounded-lg border bg-white shadow-sm">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="font-semibold">派送明细（{itemTotal}）</h2>
              <div className="flex gap-2">
                <input
                  value={itemSearch}
                  onChange={(e) => {
                    setItemSearch(e.target.value);
                    setItemPage(1);
                  }}
                  placeholder="搜索仓库/FBA"
                  className="h-8 w-40 rounded border px-2 text-sm"
                />
                <button onClick={loadItems} className="rounded border px-2 text-sm">
                  <Search size={14} className="inline" /> 搜索
                </button>
              </div>
            </div>
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="px-3 py-2">FBA ID</th>
                  <th className="px-3 py-2">Reference</th>
                  <th className="px-3 py-2">体积</th>
                  <th className="px-3 py-2">重量</th>
                  <th className="px-3 py-2">箱数</th>
                  <th className="px-3 py-2">仓库代码</th>
                  <th className="px-3 py-2">派送方式</th>
                  <th className="px-3 py-2">客人备注</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr
                    key={row.id}
                    className={`border-t ${row.is_warning ? "bg-amber-50" : ""}`}
                  >
                    <td className="px-3 py-2">{row.fba_id || "-"}</td>
                    <td className="px-3 py-2">{row.reference_id || "-"}</td>
                    <td className="px-3 py-2">{row.cbm ?? "-"}</td>
                    <td className="px-3 py-2">{row.weight ?? "-"}</td>
                    <td className="px-3 py-2">{row.carton_count ?? "-"}</td>
                    <td className="px-3 py-2">{row.warehouse_code || "-"}</td>
                    <td className="px-3 py-2">{row.delivery_method || "-"}</td>
                    <td className="px-3 py-2">{row.customer_note || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {itemTotalPages > 1 && (
              <div className="flex justify-end gap-2 border-t px-4 py-2 text-sm text-slate-500">
                <button
                  disabled={itemPage <= 1}
                  onClick={() => setItemPage((p) => p - 1)}
                  className="rounded border px-2 py-1 disabled:opacity-40"
                >
                  上一页
                </button>
                <span>
                  {itemPage}/{itemTotalPages}
                </span>
                <button
                  disabled={itemPage >= itemTotalPages}
                  onClick={() => setItemPage((p) => p + 1)}
                  className="rounded border px-2 py-1 disabled:opacity-40"
                >
                  下一页
                </button>
              </div>
            )}
          </section>

          <section className="rounded-lg border bg-white shadow-sm">
            <h2 className="border-b px-4 py-3 font-semibold">解析日志</h2>
            <div className="divide-y">
              {logs.map((log) => (
                <div key={log.id} className="flex flex-wrap gap-3 px-4 py-2 text-sm">
                  <span className="text-slate-400">{formatDateTime(log.created_at)}</span>
                  <span>{log.step}</span>
                  <span>{log.status}</span>
                  {log.message && <span className="text-slate-600">{log.message}</span>}
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <div className="rounded-lg border bg-white p-12 text-center text-slate-400">柜号不存在</div>
      )}
    </DashboardLayout>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
