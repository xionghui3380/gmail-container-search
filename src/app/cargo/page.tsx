"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { Mail, RefreshCw, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import DashboardLayout from "@/components/layout/DashboardLayout";
import GmailAuthNotifier from "@/components/GmailAuthNotifier";
import GmailSearchDialog from "@/components/GmailSearchDialog";

type ContainerRow = {
  id: string;
  container_no: string;
  customer: string;
  operation_type: string;
  pickup_driver?: string | null;
  eta_date?: string | null;
  lfd_date?: string | null;
  order_date?: string | null;
  pickup_date?: string | null;
  parse_status: string;
  is_correct: boolean;
  warehouse_summaries?: Array<{
    warehouse_code: string;
    total_cartons: number;
  }>;
};

type UserInfo = {
  fullName: string;
  role: "admin" | "operator" | "viewer";
};

const PARSE_STATUS: Record<string, string> = {
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

function UploadParseButton({
  containerNo,
  onDone,
}: {
  containerNo: string;
  onDone: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
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
        toast.error(json.message ?? "解析失败");
        return;
      }
      toast.success(
        `${containerNo}：${json.data.itemCount} 条明细，${json.data.summaryCount} 个仓库汇总`,
      );
      onDone();
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="text-xs text-emerald-600 hover:text-emerald-800 hover:underline disabled:opacity-50"
      >
        {uploading ? "解析中..." : "上传解析"}
      </button>
    </>
  );
}

export default function CargoPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [rows, setRows] = useState<ContainerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [containerNo, setContainerNo] = useState("");
  const [customer, setCustomer] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize] = useState(50);
  const [gmailConnected, setGmailConnected] = useState(false);

  const canWrite = user?.role === "admin" || user?.role === "operator";

  const loadUser = useCallback(async () => {
    const res = await fetch("/api/v1/auth/me");
    if (!res.ok) {
      router.push("/login?redirect=/cargo");
      return;
    }
    const json = await res.json();
    setUser(json.data.user);
  }, [router]);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (containerNo.trim()) params.set("containerNo", containerNo.trim());
      if (customer.trim()) params.set("customer", customer.trim());

      const res = await fetch(`/api/v1/cargo/containers?${params}`);
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
  }, [page, pageSize, containerNo, customer]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    fetch("/api/v1/gmail/status")
      .then((r) => r.json())
      .then((j) => setGmailConnected(Boolean(j.data?.connected)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  async function handleLogout() {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function renderSummary(row: ContainerRow) {
    const list = row.warehouse_summaries ?? [];
    if (list.length === 0) return <span className="text-slate-400">-</span>;
    return (
      <span className="text-xs text-slate-600">
        {list.map((s) => `${s.warehouse_code}:${s.total_cartons}`).join(" · ")}
      </span>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <DashboardLayout
      title="货柜管理"
      subtitle={user ? `${user.fullName}（${user.role}）· 派送表解析与仓库汇总` : "加载中..."}
      onLogout={handleLogout}
    >
      <Suspense fallback={null}>
        <GmailAuthNotifier onConnected={() => setGmailConnected(true)} />
      </Suspense>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={containerNo}
          onChange={(e) => {
            setContainerNo(e.target.value);
            setPage(1);
          }}
          placeholder="柜号"
          className="h-9 w-36 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-400"
        />
        <input
          value={customer}
          onChange={(e) => {
            setCustomer(e.target.value);
            setPage(1);
          }}
          placeholder="客户"
          className="h-9 w-36 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-400"
        />
        <button
          onClick={() => {
            setPage(1);
            loadRows();
          }}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-blue-600 px-4 text-sm text-white hover:bg-blue-700"
        >
          <Search size={15} />
          搜索
        </button>
        <button
          onClick={loadRows}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-sm hover:bg-slate-50"
        >
          <RefreshCw size={15} />
          刷新
        </button>
        <button
          onClick={() => {
            window.location.href = "/api/v1/gmail/auth";
          }}
          className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm ${
            gmailConnected
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          <Mail size={15} />
          {gmailConnected ? "Gmail 已连接" : "连接 Gmail"}
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-3 py-3 font-medium">柜号</th>
                <th className="px-3 py-3 font-medium">客户</th>
                <th className="px-3 py-3 font-medium">操作方式</th>
                <th className="px-3 py-3 font-medium">提柜司机</th>
                <th className="px-3 py-3 font-medium">ETA</th>
                <th className="px-3 py-3 font-medium">LFD</th>
                <th className="px-3 py-3 font-medium">解析状态</th>
                <th className="px-3 py-3 font-medium">分货汇总</th>
                {canWrite && <th className="px-3 py-3 font-medium">操作</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={canWrite ? 9 : 8} className="px-4 py-16 text-center text-slate-400">
                    加载中...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={canWrite ? 9 : 8} className="px-4 py-16 text-center text-slate-400">
                    暂无数据
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                    <td className="px-3 py-3">
                      <Link
                        href={`/cargo/${encodeURIComponent(row.container_no)}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {row.container_no}
                      </Link>
                    </td>
                    <td className="px-3 py-3">{row.customer}</td>
                    <td className="px-3 py-3">
                      {row.operation_type === "fcl" ? "整柜" : "拆柜"}
                    </td>
                    <td className="px-3 py-3">{row.pickup_driver || "-"}</td>
                    <td className="px-3 py-3">{formatDate(row.eta_date)}</td>
                    <td className="px-3 py-3">{formatDate(row.lfd_date)}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${
                          row.parse_status === "success"
                            ? "bg-green-100 text-green-700"
                            : row.parse_status === "failed"
                              ? "bg-red-100 text-red-700"
                              : row.parse_status === "partial_success"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {PARSE_STATUS[row.parse_status] ?? row.parse_status}
                      </span>
                    </td>
                    <td className="px-3 py-3 max-w-[200px] truncate">{renderSummary(row)}</td>
                    {canWrite && (
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <GmailSearchDialog
                            containerNo={row.container_no}
                            detailHref={`/cargo/${encodeURIComponent(row.container_no)}`}
                            onParsed={loadRows}
                          />
                          <span className="text-slate-300">|</span>
                          <UploadParseButton containerNo={row.container_no} onDone={loadRows} />
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-500">
          <span>
            共 {total} 条，第 {page}/{totalPages} 页
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded border px-3 py-1 disabled:opacity-40"
            >
              上一页
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded border px-3 py-1 disabled:opacity-40"
            >
              下一页
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
