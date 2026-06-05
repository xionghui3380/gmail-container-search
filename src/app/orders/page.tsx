"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useOrderTablePreferences } from "@/hooks/useOrderTablePreferences";
import {
  type OrderColumnKey,
  type OrderDataColumn,
  isOrderDateColumn,
} from "@/lib/order-columns";
import Link from "next/link";

type OrderRow = {
  id: string;
  container_no: string;
  operation_type?: string | null;
  customer?: string | null;
  order_date?: string | null;
  eta?: string | null;
  pickup_date?: string | null;
  created_at?: string;
  updated_at?: string;
};

type UserInfo = {
  fullName: string;
  role: "admin" | "operator" | "viewer";
};

type RowForm = {
  container_no: string;
  operation_type: string;
  customer: string;
  order_date: string;
  eta: string;
  pickup_date: string;
};

type SortState = {
  column: OrderColumnKey | null;
  order: "asc" | "desc";
};

const emptyRowForm = (): RowForm => ({
  container_no: "",
  operation_type: "",
  customer: "",
  order_date: "",
  eta: "",
  pickup_date: "",
});

const inputClass =
  "h-8 w-full min-w-[72px] rounded border border-slate-200 px-2 text-sm outline-none focus:border-blue-400 whitespace-nowrap";

const containerNoInvalidClass =
  "border-red-400 bg-red-50 text-red-600 placeholder:text-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-400";

function isContainerNoEmpty(value: string) {
  return !value.trim();
}

const cellNowrap = "whitespace-nowrap px-2 py-3";
const stickyActionTh =
  "sticky right-0 z-30 min-w-[7.5rem] whitespace-nowrap bg-slate-50 px-2 py-3 text-left font-medium shadow-[-6px_0_8px_-4px_rgba(15,23,42,0.12)]";
const stickyActionTdBase =
  "sticky right-0 z-20 min-w-[7.5rem] whitespace-nowrap px-2 py-3 shadow-[-6px_0_8px_-4px_rgba(15,23,42,0.12)]";

function toDateInputValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return format(date, "yyyy-MM-dd");
}

function formatCellDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return format(date, "yyyy-MM-dd");
}

function rowToForm(row: OrderRow): RowForm {
  return {
    container_no: row.container_no,
    operation_type: row.operation_type ?? "",
    customer: row.customer ?? "",
    order_date: toDateInputValue(row.order_date),
    eta: toDateInputValue(row.eta),
    pickup_date: toDateInputValue(row.pickup_date),
  };
}

function buildPayload(form: RowForm) {
  return {
    container_no: form.container_no.trim().toUpperCase(),
    operation_type: form.operation_type.trim() || null,
    customer: form.customer.trim() || null,
    order_date: form.order_date || null,
    eta: form.eta || null,
    pickup_date: form.pickup_date || null,
  };
}

function validateRowForm(form: RowForm) {
  if (!form.container_no.trim()) return "请填写柜号";
  return null;
}

function isRowFormUnchanged(row: OrderRow, draft: RowForm) {
  const baseline = rowToForm(row);
  return (Object.keys(baseline) as (keyof RowForm)[]).every(
    (key) => baseline[key] === draft[key],
  );
}

function renderReadOnlyCell(row: OrderRow, key: OrderColumnKey) {
  if (isOrderDateColumn(key)) {
    return formatCellDate(row[key]);
  }
  const value = row[key];
  return value && String(value).trim() ? String(value) : "-";
}

function renderEditableInput(
  key: OrderColumnKey,
  form: RowForm,
  onChange: <K extends keyof RowForm>(field: K, value: RowForm[K]) => void,
  options?: { onBlur?: () => void; disabled?: boolean },
) {
  const onBlur = options?.onBlur;
  const disabled = options?.disabled ?? false;

  if (key === "container_no") {
    return (
      <input
        value={form.container_no}
        onChange={(e) => onChange("container_no", e.target.value.toUpperCase())}
        onBlur={onBlur}
        disabled={disabled}
        placeholder="柜号"
        className={`${inputClass} ${isContainerNoEmpty(form.container_no) ? containerNoInvalidClass : ""}`}
      />
    );
  }
  if (key === "operation_type") {
    return (
      <select
        value={form.operation_type}
        onChange={(e) => onChange("operation_type", e.target.value)}
        onBlur={onBlur}
        disabled={disabled}
        className={inputClass}
      >
        <option value="">-</option>
        <option value="整柜">整柜</option>
        <option value="拆柜">拆柜</option>
      </select>
    );
  }
  if (isOrderDateColumn(key)) {
    return (
      <input
        type="date"
        value={form[key]}
        onChange={(e) => onChange(key, e.target.value)}
        onBlur={onBlur}
        disabled={disabled}
        className={inputClass}
      />
    );
  }
  return (
    <input
      value={form[key]}
      onChange={(e) => onChange(key, e.target.value)}
      onBlur={onBlur}
      disabled={disabled}
      className={inputClass}
    />
  );
}

function ActionButtons({
  saving,
  onSave,
  onCancel,
}: {
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="rounded border border-blue-600 bg-blue-600 px-2.5 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {saving ? "保存中..." : "保存"}
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-60"
      >
        取消
      </button>
    </div>
  );
}

type DataRowProps = {
  row: OrderRow;
  canWrite: boolean;
  selected: Set<string>;
  visibleColumns: OrderDataColumn[];
  getWidth: (key: OrderColumnKey) => number;
  rowDraft: RowForm;
  saving: boolean;
  onToggleSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onDraftChange: <K extends keyof RowForm>(field: K, value: RowForm[K]) => void;
  onCellBlur: () => void;
  onSearch?: () => void;
  searching?: boolean;
};

function DataRow({
  row,
  canWrite,
  selected,
  visibleColumns,
  getWidth,
  rowDraft,
  saving,
  onToggleSelect,
  onDelete,
  onDraftChange,
  onCellBlur,
  onSearch,
  searching,
}: DataRowProps) {
  return (
    <tr className="group border-b border-slate-100 hover:bg-slate-50/80">
      {canWrite && (
        <td className={cellNowrap}>
          <input
            type="checkbox"
            checked={selected.has(row.id)}
            onChange={() => onToggleSelect(row.id)}
            className="rounded border-slate-300"
          />
        </td>
      )}
      {visibleColumns.map((column) => (
        <td
          key={`${row.id}-${column.key}`}
          style={{ minWidth: getWidth(column.key), width: getWidth(column.key) }}
          className={`${cellNowrap} text-slate-700`}
        >
          {canWrite ? (
            renderEditableInput(column.key, rowDraft, onDraftChange, {
              onBlur: onCellBlur,
              disabled: saving,
            })
          ) : (
            renderReadOnlyCell(row, column.key)
          )}
        </td>
      ))}
      {canWrite && (
        <td className={`${stickyActionTdBase} bg-white group-hover:bg-slate-50/80`}>
          <div className="flex items-center gap-2 whitespace-nowrap">
            {onSearch && (
              <button
                type="button"
                onClick={onSearch}
                disabled={searching || saving}
                className="text-blue-600 hover:text-blue-700 hover:underline disabled:opacity-50"
              >
                <Mail size={12} className="mr-0.5 inline" />
                {searching ? "检索中..." : "检索"}
              </button>
            )}
            {onSearch && <span className="text-slate-300">|</span>}
            <button
              type="button"
              onClick={() => onDelete(row.id)}
              disabled={saving}
              className="text-red-500 hover:text-red-700 hover:underline disabled:opacity-50"
            >
              删除
            </button>
          </div>
        </td>
      )}
    </tr>
  );
}

export default function OrdersPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [containerNo, setContainerNo] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize] = useState(50);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isAddingRow, setIsAddingRow] = useState(false);
  const [newRow, setNewRow] = useState<RowForm>(emptyRowForm);
  const [rowDrafts, setRowDrafts] = useState<Record<string, RowForm>>({});
  const [savingRowId, setSavingRowId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchingId, setSearchingId] = useState<string | null>(null);
  const [batchSearching, setBatchSearching] = useState(false);
  const [sortState, setSortState] = useState<SortState>({ column: null, order: "desc" });

  const saveTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pendingSaveRef = useRef<Set<string>>(new Set());
  const rowsRef = useRef(rows);
  const rowDraftsRef = useRef(rowDrafts);

  rowsRef.current = rows;
  rowDraftsRef.current = rowDrafts;

  const {
    visibleColumns,
    draggingColumn,
    setDraggingColumn,
    handleColumnDrop,
    startResize,
    getWidth,
    resizing,
  } = useOrderTablePreferences();

  const canWrite = useMemo(
    () => user?.role === "admin" || user?.role === "operator",
    [user],
  );

  const loadUser = useCallback(async () => {
    const res = await fetch("/api/v1/auth/me");
    if (!res.ok) {
      router.push("/login?redirect=/orders");
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
      if (sortState.column) {
        params.set("sortBy", sortState.column);
        params.set("sortOrder", sortState.order);
      }

      const res = await fetch(`/api/v1/orders?${params.toString()}`);
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
  }, [page, pageSize, sortState, containerNo]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  useEffect(() => {
    setRowDrafts(Object.fromEntries(rows.map((row) => [row.id, rowToForm(row)])));
  }, [rows]);

  useEffect(() => {
    const timers = saveTimerRef.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

  function handleSortClick(key: OrderColumnKey) {
    setPage(1);
    setSortState((prev) => {
      if (prev.column !== key) return { column: key, order: "asc" };
      if (prev.order === "asc") return { column: key, order: "desc" };
      return { column: null, order: "desc" };
    });
  }

  async function handleLogout() {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function handleStartAdd() {
    setNewRow(emptyRowForm());
    setIsAddingRow(true);
  }

  function handleCancelAdd() {
    setIsAddingRow(false);
    setNewRow(emptyRowForm());
  }

  function updateRowDraft<K extends keyof RowForm>(
    rowId: string,
    field: K,
    value: RowForm[K],
  ) {
    setRowDrafts((prev) => ({
      ...prev,
      [rowId]: { ...(prev[rowId] ?? emptyRowForm()), [field]: value },
    }));
  }

  function handleCellBlur(rowId: string) {
    if (!canWrite) return;

    clearTimeout(saveTimerRef.current[rowId]);
    saveTimerRef.current[rowId] = setTimeout(() => {
      void persistRowDraft(rowId);
    }, 400);
  }

  async function persistRowDraft(rowId: string) {
    if (savingRowId === rowId) {
      pendingSaveRef.current.add(rowId);
      return;
    }

    const row = rowsRef.current.find((item) => item.id === rowId);
    const draft = rowDraftsRef.current[rowId];
    if (!row || !draft || isRowFormUnchanged(row, draft)) return;

    const message = validateRowForm(draft);
    if (message) {
      toast.error(message);
      setRowDrafts((prev) => ({ ...prev, [rowId]: rowToForm(row) }));
      return;
    }

    setSavingRowId(rowId);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);

    try {
      const res = await fetch(`/api/v1/orders/${rowId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(draft)),
        signal: controller.signal,
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.message ?? "保存失败");
        if (json.errors?.[0]?.message) toast.error(json.errors[0].message);
        setRowDrafts((prev) => ({ ...prev, [rowId]: rowToForm(row) }));
        return;
      }
      setRows((prev) =>
        prev.map((item) => (item.id === rowId ? { ...item, ...json.data } : item)),
      );
      setRowDrafts((prev) => ({
        ...prev,
        [rowId]: rowToForm({ ...row, ...json.data } as OrderRow),
      }));
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        toast.error("保存超时，请检查网络或数据库连接后重试");
      } else {
        toast.error("保存失败，请稍后重试");
      }
      setRowDrafts((prev) => ({ ...prev, [rowId]: rowToForm(row) }));
    } finally {
      clearTimeout(timeoutId);
      setSavingRowId(null);
      if (pendingSaveRef.current.has(rowId)) {
        pendingSaveRef.current.delete(rowId);
        void persistRowDraft(rowId);
      }
    }
  }

  async function handleSaveAdd() {
    const message = validateRowForm(newRow);
    if (message) {
      toast.error(message);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/v1/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(newRow)),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.message ?? "保存失败");
        if (json.errors?.[0]?.message) toast.error(json.errors[0].message);
        return;
      }
      toast.success("保存成功");
      handleCancelAdd();
      setPage(1);
      loadRows();
    } finally {
      setSaving(false);
    }
  }

  async function handleSearch(row: OrderRow) {
    setSearchingId(row.id);
    try {
      const res = await fetch(`/api/v1/orders/${row.id}/search`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        if (json.meta?.needReconnect) {
          toast.error("请先连接 Gmail");
          window.open("/api/v1/gmail/auth", "_blank");
        } else {
          toast.error(json.message ?? "检索失败");
        }
        return;
      }
      const data = json.data;
      if (data.parseStatus === "failed") {
        toast.error(data.errorMessage ?? "解析失败");
      } else {
        toast.success(
          `解析完成：${data.itemCount ?? 0} 条明细，批次 ${data.batchNo ?? ""}`,
        );
      }
    } finally {
      setSearchingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("确认删除该记录？")) return;
    const res = await fetch(`/api/v1/orders/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.message ?? "删除失败");
      return;
    }
    toast.success("已删除");
    loadRows();
  }

  async function handleBatchDelete() {
    if (selected.size === 0) return;
    if (!confirm(`确认删除选中的 ${selected.size} 条记录？`)) return;
    const res = await fetch("/api/v1/orders/batch", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selected) }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.message ?? "批量删除失败");
      return;
    }
    toast.success(`已删除 ${json.data.deleted} 条`);
    setSelected(new Set());
    loadRows();
  }

  async function handleBatchSearch() {
    if (selected.size === 0) return;
    if (!confirm(`确认对选中的 ${selected.size} 条订单执行批量检索？`)) return;

    setBatchSearching(true);
    try {
      const res = await fetch("/api/v1/orders/batch-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: Array.from(selected) }),
      });
      const json = await res.json();

      if (!res.ok) {
        if (json.meta?.needReconnect) {
          toast.error("Gmail 未连接或已过期，请先连接 Gmail");
          window.open("/api/v1/gmail/auth", "_blank");
        } else {
          toast.error(json.message ?? "批量检索失败");
        }
        return;
      }

      const { succeeded = 0, failed = 0, results = [] } = json.data ?? {};
      const details: string[] = [];
      if (failed > 0) {
        const failedItems = results
          .filter((r: { status: string; errorMessage?: string }) => r.status === "failed")
          .slice(0, 3)
          .map((r: { orderId: number; errorMessage?: string }) => `订单 ${r.orderId}：${r.errorMessage ?? "未知错误"}`);
        details.push(...failedItems);
      }

      toast.success(
        `批量检索完成：${succeeded} 条成功，${failed} 条失败`,
        {
          description: details.length > 0 ? details.join("\n") : undefined,
          duration: 6000,
        },
      );
      setSelected(new Set());
      loadRows();
    } finally {
      setBatchSearching(false);
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderSortIcon(key: OrderColumnKey) {
    if (sortState.column !== key) {
      return <ArrowUpDown size={12} className="text-slate-300" />;
    }
    return sortState.order === "asc" ? (
      <ArrowUp size={12} className="text-blue-600" />
    ) : (
      <ArrowDown size={12} className="text-blue-600" />
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const fixedColCount = canWrite ? 2 : 0;
  const colSpan = visibleColumns.length + fixedColCount;
  const showEmpty = !loading && rows.length === 0 && !isAddingRow;

  return (
    <DashboardLayout
      title="订单管理"
      subtitle={user ? `${user.fullName}（${user.role}）` : "加载中..."}
      onLogout={handleLogout}
    >
      <div className="mb-4 flex items-center gap-3">
        <input
          value={containerNo}
          onChange={(e) => {
            setContainerNo(e.target.value);
            setPage(1);
          }}
          placeholder="柜号"
          className="h-9 w-40 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
        />
        <button
          type="button"
          onClick={() => {
            setPage(1);
            loadRows();
          }}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Search size={15} />
          搜索
        </button>
        <button
          type="button"
          onClick={loadRows}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw size={15} />
          刷新
        </button>
        {canWrite && (
          <>
            <button
              type="button"
              onClick={handleStartAdd}
              disabled={isAddingRow}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={15} />
              新建
            </button>
            <button
              type="button"
              onClick={() => void handleBatchSearch()}
              disabled={selected.size === 0 || batchSearching}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-amber-500 px-3 text-sm font-medium text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Zap size={15} />
              {batchSearching ? "批量检索中..." : "批量检索"}
            </button>
            {batchSearching && (
              <Link
                href="/containers"
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 text-sm text-blue-700 hover:bg-blue-100"
              >
                查看解析进度 →
              </Link>
            )}
            <button
              type="button"
              onClick={handleBatchDelete}
              disabled={selected.size === 0}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-400 disabled:cursor-not-allowed disabled:opacity-60 enabled:text-red-500 enabled:hover:border-red-200 enabled:hover:bg-red-50"
            >
              <Trash2 size={15} />
              批量删除
            </button>
          </>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className={`h-[600px] overflow-x-auto ${resizing ? "select-none" : ""}`}>
          <table className="w-max min-w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50">
              <tr className="border-b border-slate-200 text-left text-slate-600">
                {canWrite && <th className={`${cellNowrap} w-12 font-medium`}>选择</th>}
                {visibleColumns.map((column) => (
                  <th
                    key={column.key}
                    draggable
                    onDragStart={() => setDraggingColumn(column.key)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleColumnDrop(column.key)}
                    style={{ minWidth: getWidth(column.key), width: getWidth(column.key) }}
                    className={`relative ${cellNowrap} bg-slate-50 font-medium ${
                      draggingColumn === column.key ? "opacity-50" : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSortClick(column.key)}
                      className="flex w-full items-center gap-1 whitespace-nowrap text-left hover:text-blue-600"
                    >
                      <span>{column.label}</span>
                      {renderSortIcon(column.key)}
                    </button>
                    <div
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        startResize(column.key, e.clientX);
                      }}
                      className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-blue-400"
                    />
                  </th>
                ))}
                {canWrite && <th className={stickyActionTh}>操作</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={colSpan} className="px-4 py-16 text-center text-slate-400">
                    加载中...
                  </td>
                </tr>
              ) : showEmpty ? (
                <tr>
                  <td colSpan={colSpan} className="px-4 py-16 text-center text-slate-400">
                    暂无数据
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <DataRow
                    key={row.id}
                    row={row}
                    canWrite={canWrite}
                    selected={selected}
                    visibleColumns={visibleColumns}
                    getWidth={getWidth}
                    rowDraft={rowDrafts[row.id] ?? rowToForm(row)}
                    saving={savingRowId === row.id}
                    onToggleSelect={toggleSelect}
                    onDelete={handleDelete}
                    onDraftChange={(field, value) => updateRowDraft(row.id, field, value)}
                    onCellBlur={() => void handleCellBlur(row.id)}
                    onSearch={() => handleSearch(row)}
                    searching={searchingId === row.id}
                  />
                ))
              )}

              {isAddingRow && canWrite && (
                <tr className="border-t-2 border-blue-200 bg-blue-50/40">
                  <td className={`${cellNowrap} text-xs text-slate-400`}>新增一行</td>
                  {visibleColumns.map((column) => (
                    <td
                      key={`new-${column.key}`}
                      style={{ minWidth: getWidth(column.key), width: getWidth(column.key) }}
                      className={`${cellNowrap} py-2`}
                    >
                      {renderEditableInput(column.key, newRow, (field, value) =>
                        setNewRow((prev) => ({ ...prev, [field]: value })),
                      )}
                    </td>
                  ))}
                  <td className={`${stickyActionTdBase} bg-blue-50 py-2`}>
                    <ActionButtons
                      saving={saving}
                      onSave={handleSaveAdd}
                      onCancel={handleCancelAdd}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-500">
        <span>
          共 {total} 条，第 {page}/{totalPages} 页
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-md border border-slate-200 bg-white px-3 py-1 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            上一页
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-md border border-slate-200 bg-white px-3 py-1 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            下一页
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
