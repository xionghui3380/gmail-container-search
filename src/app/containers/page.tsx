"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format } from "date-fns";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  GripVertical,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ContainerHistoryDialog from "@/components/ContainerHistoryDialog";
import GmailAuthNotifier from "@/components/GmailAuthNotifier";
import GmailSearchDialog from "@/components/GmailSearchDialog";
import {
  type ColumnKey,
  type DataColumn,
} from "@/lib/container-columns";
import { useTablePreferences } from "@/hooks/useTablePreferences";

type ContainerRow = {
  id: string;
  container_no: string;
  container_type: string;
  terminal: string;
  customer: string;
  mbl?: string | null;
  operation_type: string;
  lfd_date?: string | null;
  pickup_driver?: string | null;
  eta_date?: string | null;
  sort?: string | null;
};

type UserInfo = {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: "admin" | "operator" | "viewer";
};

type RowForm = {
  container_no: string;
  container_type: string;
  terminal: string;
  customer: string;
  mbl: string;
  operation_type: "fcl" | "lcl";
  eta_date: string;
  lfd_date: string;
  pickup_driver: string;
};

type SortState = {
  column: ColumnKey | null;
  order: "asc" | "desc";
};

const emptyRowForm = (): RowForm => ({
  container_no: "",
  container_type: "40",
  terminal: "",
  customer: "",
  mbl: "",
  operation_type: "fcl",
  eta_date: "",
  lfd_date: "",
  pickup_driver: "",
});

const inputClass =
  "h-8 w-full min-w-[72px] rounded border border-slate-200 px-2 text-sm outline-none focus:border-blue-400";

function toInputDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : format(date, "yyyy-MM-dd");
}

function rowToForm(row: ContainerRow): RowForm {
  return {
    container_no: row.container_no,
    container_type: row.container_type,
    terminal: row.terminal,
    customer: row.customer,
    mbl: row.mbl || "",
    operation_type: row.operation_type === "lcl" ? "lcl" : "fcl",
    eta_date: toInputDate(row.eta_date),
    lfd_date: toInputDate(row.lfd_date),
    pickup_driver: row.pickup_driver || "",
  };
}

function buildPayload(form: RowForm) {
  return {
    container_no: form.container_no.trim().toUpperCase(),
    container_type: form.container_type,
    terminal: form.terminal.trim(),
    customer: form.customer.trim(),
    mbl: form.mbl.trim() || null,
    operation_type: form.operation_type,
    eta_date: form.eta_date || null,
    lfd_date: form.lfd_date || null,
    pickup_driver: form.pickup_driver.trim() || null,
  };
}

function validateRowForm(form: RowForm) {
  if (!form.container_no.trim()) return "请填写柜号";
  if (!form.terminal.trim()) return "请填写码头";
  if (!form.customer.trim()) return "请填写客户";
  return null;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return format(new Date(value), "yyyy-MM-dd");
}

function getLfdClass(lfd?: string | null) {
  if (!lfd) return "";
  const date = new Date(lfd);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lfdDay = new Date(date);
  lfdDay.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((lfdDay.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) {
    return "inline-block rounded bg-red-50 px-1.5 py-0.5 font-medium text-red-600";
  }
  if (diffDays <= 2) {
    return "inline-block rounded bg-amber-50 px-1.5 py-0.5 font-medium text-amber-700";
  }
  return "";
}

function renderReadOnlyCell(row: ContainerRow, key: ColumnKey) {
  switch (key) {
    case "container_no":
      return (
        <Link
          href={`/containers/${encodeURIComponent(row.container_no)}`}
          className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {row.container_no}
        </Link>
      );
    case "container_type":
      return row.container_type;
    case "terminal":
      return row.terminal;
    case "customer":
      return row.customer;
    case "mbl":
      return row.mbl || "-";
    case "operation_type":
      return row.operation_type === "fcl" ? "整柜" : "拆柜";
    case "eta_date":
      return formatDate(row.eta_date);
    case "lfd_date":
      return <span className={getLfdClass(row.lfd_date)}>{formatDate(row.lfd_date)}</span>;
    case "pickup_driver":
      return row.pickup_driver || "-";
    default:
      return "-";
  }
}

function renderEditableInput(
  key: ColumnKey,
  form: RowForm,
  onChange: <K extends keyof RowForm>(field: K, value: RowForm[K]) => void,
) {
  switch (key) {
    case "container_no":
      return (
        <input
          value={form.container_no}
          onChange={(e) => onChange("container_no", e.target.value.toUpperCase())}
          placeholder="柜号"
          className={inputClass}
        />
      );
    case "container_type":
      return (
        <select
          value={form.container_type}
          onChange={(e) => onChange("container_type", e.target.value)}
          className={inputClass}
        >
          <option value="40">40</option>
          <option value="45">45</option>
        </select>
      );
    case "terminal":
      return (
        <input
          value={form.terminal}
          onChange={(e) => onChange("terminal", e.target.value)}
          placeholder="码头"
          className={inputClass}
        />
      );
    case "customer":
      return (
        <input
          value={form.customer}
          onChange={(e) => onChange("customer", e.target.value)}
          placeholder="客户"
          className={inputClass}
        />
      );
    case "mbl":
      return (
        <input
          value={form.mbl}
          onChange={(e) => onChange("mbl", e.target.value)}
          placeholder="MBL"
          className={inputClass}
        />
      );
    case "operation_type":
      return (
        <select
          value={form.operation_type}
          onChange={(e) => onChange("operation_type", e.target.value as "fcl" | "lcl")}
          className={inputClass}
        >
          <option value="fcl">整柜</option>
          <option value="lcl">拆柜</option>
        </select>
      );
    case "eta_date":
      return (
        <input
          type="date"
          value={form.eta_date}
          onChange={(e) => onChange("eta_date", e.target.value)}
          className={inputClass}
        />
      );
    case "lfd_date":
      return (
        <input
          type="date"
          value={form.lfd_date}
          onChange={(e) => onChange("lfd_date", e.target.value)}
          className={inputClass}
        />
      );
    case "pickup_driver":
      return (
        <input
          value={form.pickup_driver}
          onChange={(e) => onChange("pickup_driver", e.target.value)}
          placeholder="提柜司机"
          className={inputClass}
        />
      );
  }
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
        onClick={onSave}
        disabled={saving}
        className="rounded border border-blue-600 bg-blue-600 px-2.5 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {saving ? "保存中..." : "保存"}
      </button>
      <button
        onClick={onCancel}
        disabled={saving}
        className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-60"
      >
        取消
      </button>
    </div>
  );
}

type SortableTableRowProps = {
  row: ContainerRow;
  canWrite: boolean;
  canDragRows: boolean;
  isEditing: boolean;
  selected: Set<string>;
  saving: boolean;
  visibleColumns: DataColumn[];
  editRow: RowForm;
  getWidth: (key: ColumnKey) => number;
  onToggleSelect: (id: string) => void;
  onStartEdit: (row: ContainerRow) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
  onViewHistory: (id: string) => void;
  onEditRowChange: (field: keyof RowForm, value: RowForm[keyof RowForm]) => void;
};

function SortableTableRow({
  row,
  canWrite,
  canDragRows,
  isEditing,
  selected,
  saving,
  visibleColumns,
  editRow,
  getWidth,
  onToggleSelect,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onViewHistory,
  onEditRowChange,
}: SortableTableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: row.id,
    disabled: !canDragRows || isEditing,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      onDoubleClick={() => onStartEdit(row)}
      className={`border-b border-slate-100 ${
        isEditing
          ? "border-t-2 border-amber-200 bg-amber-50/50"
          : isDragging
            ? "relative z-10 bg-white opacity-90 shadow-md"
            : canWrite
              ? "cursor-pointer hover:bg-slate-50/80"
              : "hover:bg-slate-50/80"
      }`}
      title={
        canDragRows && !isEditing
          ? "拖拽左侧手柄调整顺序，双击编辑"
          : canWrite && !isEditing
            ? "双击编辑"
            : undefined
      }
    >
      {canWrite && (
        <td className="px-2 py-3" onDoubleClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={selected.has(row.id)}
            onChange={() => onToggleSelect(row.id)}
            className="rounded border-slate-300"
          />
        </td>
      )}
      {canDragRows && (
        <td
          className="cursor-grab px-1 py-3 text-center active:cursor-grabbing"
          onDoubleClick={(e) => e.stopPropagation()}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={14} className="mx-auto text-slate-400" />
        </td>
      )}

      {isEditing ? (
        <>
          {visibleColumns.map((column) => (
            <td
              key={`edit-${row.id}-${column.key}`}
              style={{ width: getWidth(column.key) }}
              className="px-2 py-2"
            >
              {renderEditableInput(column.key, editRow, (field, value) =>
                onEditRowChange(field, value),
              )}
            </td>
          ))}
          <td className="px-2 py-2" onDoubleClick={(e) => e.stopPropagation()}>
            <ActionButtons saving={saving} onSave={onSaveEdit} onCancel={onCancelEdit} />
          </td>
        </>
      ) : (
        <>
          {visibleColumns.map((column) => (
            <td
              key={`read-${row.id}-${column.key}`}
              style={{ width: getWidth(column.key) }}
              className="truncate px-2 py-3 text-slate-700"
            >
              {renderReadOnlyCell(row, column.key)}
            </td>
          ))}
          {canWrite && (
            <td className="px-2 py-3" onDoubleClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onViewHistory(row.id)}
                  className="text-blue-500 hover:text-blue-700 hover:underline"
                >
                  历史
                </button>
                <span className="text-slate-300">|</span>
                {/* Gmail 邮件搜索按钮：根据柜号自动搜索相关邮件 */}
                <GmailSearchDialog containerNo={row.container_no} />
                <span className="text-slate-300">|</span>
                <button
                  onClick={() => onDelete(row.id)}
                  className="text-red-500 hover:text-red-700 hover:underline"
                >
                  删除
                </button>
              </div>
            </td>
          )}
        </>
      )}
    </tr>
  );
}

export default function ContainersPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [rows, setRows] = useState<ContainerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [containerNo, setContainerNo] = useState("");
  const [mbl, setMbl] = useState("");
  const [customer, setCustomer] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize] = useState(50);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isAddingRow, setIsAddingRow] = useState(false);
  const [newRow, setNewRow] = useState<RowForm>(emptyRowForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<RowForm>(emptyRowForm);
  const [saving, setSaving] = useState(false);
  const [sortState, setSortState] = useState<SortState>({ column: null, order: "asc" });
  const [reordering, setReordering] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyContainerId, setHistoryContainerId] = useState<string | null>(null);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const rowDragSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const {
    visibleColumns,
    draggingColumn,
    setDraggingColumn,
    handleColumnDrop,
    startResize,
    getWidth,
    resizing,
  } = useTablePreferences();

  const canWrite = useMemo(
    () => user?.role === "admin" || user?.role === "operator",
    [user],
  );

  const canDragRows = useMemo(
    () => canWrite && !sortState.column && !isAddingRow && !editingId && !loading,
    [canWrite, sortState.column, isAddingRow, editingId, loading],
  );

  const loadUser = useCallback(async () => {
    const res = await fetch("/api/v1/auth/me");
    if (!res.ok) {
      router.push("/login");
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
      if (mbl.trim()) params.set("mbl", mbl.trim());
      if (customer.trim()) params.set("customer", customer.trim());
      if (sortState.column) {
        params.set("sortBy", sortState.column);
        params.set("sortOrder", sortState.order);
      }

      const res = await fetch(`/api/v1/containers?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.message ?? "加载失败");
        return;
      }
      setRows(json.data);
      setTotal(json.pagination?.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, sortState, containerNo, mbl, customer]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  useEffect(() => {
    fetch("/api/v1/gmail/status")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.data?.connected) setGmailConnected(true);
      })
      .catch(() => undefined);
  }, []);

  function handleSortClick(key: ColumnKey) {
    setPage(1);
    setSortState((prev) => {
      if (prev.column !== key) return { column: key, order: "asc" };
      if (prev.order === "asc") return { column: key, order: "desc" };
      return { column: null, order: "asc" };
    });
  }

  async function persistRowOrder(nextRows: ContainerRow[]) {
    const orderedIds = nextRows.map((r) => r.id);
    setRows(nextRows);
    setReordering(true);
    try {
      const res = await fetch("/api/v1/containers/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page, pageSize, ids: orderedIds }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.message ?? "排序保存失败");
        loadRows();
        return;
      }
      toast.success("排序已保存");
    } finally {
      setReordering(false);
    }
  }

  function handleRowDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = rows.findIndex((r) => r.id === active.id);
    const newIndex = rows.findIndex((r) => r.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    persistRowOrder(arrayMove(rows, oldIndex, newIndex));
  }

  async function handleLogout() {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function handleStartAdd() {
    setEditingId(null);
    setNewRow(emptyRowForm());
    setIsAddingRow(true);
  }

  function handleCancelAdd() {
    setIsAddingRow(false);
    setNewRow(emptyRowForm());
  }

  function handleStartEdit(row: ContainerRow) {
    if (!canWrite || isAddingRow) return;
    setIsAddingRow(false);
    setEditingId(row.id);
    setEditRow(rowToForm(row));
  }

  function handleCancelEdit() {
    setEditingId(null);
    setEditRow(emptyRowForm());
  }

  async function handleSaveAdd() {
    const message = validateRowForm(newRow);
    if (message) {
      toast.error(message);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/v1/containers", {
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

  async function handleSaveEdit() {
    if (!editingId) return;
    const message = validateRowForm(editRow);
    if (message) {
      toast.error(message);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/v1/containers/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(editRow)),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.message ?? "保存失败");
        if (json.errors?.[0]?.message) toast.error(json.errors[0].message);
        return;
      }
      toast.success("更新成功");
      handleCancelEdit();
      loadRows();
    } finally {
      setSaving(false);
    }
  }

  function handleViewHistory(id: string) {
    setHistoryContainerId(id);
    setHistoryDialogOpen(true);
  }

  async function handleDelete(id: string) {
    if (!confirm("确认删除该记录？")) return;
    const res = await fetch(`/api/v1/containers/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.message ?? "删除失败");
      return;
    }
    toast.success("已删除");
    loadRows();
  }

  async function handleImportExcel(file: File) {
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/v1/containers/import", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.message ?? "导入失败");
        return;
      }
      toast.success(
        `导入完成：新增 ${json.data.created}，更新 ${json.data.updated}，跳过 ${json.data.skipped}`,
      );
      if (json.data.errors?.length) {
        toast.warning(`有 ${json.data.errors.length} 行未入库`);
      }
      setPage(1);
      loadRows();
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  async function handleBatchDelete() {
    if (selected.size === 0) return;
    if (!confirm(`确认删除选中的 ${selected.size} 条记录？`)) return;
    const res = await fetch("/api/v1/containers/batch", {
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

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderSortIcon(key: ColumnKey) {
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
  const fixedColCount = canWrite ? (canDragRows ? 3 : 2) : 0;
  const colSpan = visibleColumns.length + fixedColCount;
  const showEmpty = !loading && rows.length === 0 && !isAddingRow;

  return (
    <DashboardLayout
      title="集装箱管理"
      subtitle={user ? `${user.fullName}（${user.role}）` : "加载中..."}
      onLogout={handleLogout}
    >
      <Suspense fallback={null}>
        <GmailAuthNotifier onConnected={() => setGmailConnected(true)} />
      </Suspense>
      <div className="mb-4 flex items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <input
            value={containerNo}
            onChange={(e) => {
              setContainerNo(e.target.value);
              setPage(1);
            }}
            placeholder="柜号"
            className="h-9 w-36 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
          />
          <input
            value={mbl}
            onChange={(e) => {
              setMbl(e.target.value);
              setPage(1);
            }}
            placeholder="MBL"
            className="h-9 w-40 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
          />
          <input
            value={customer}
            onChange={(e) => {
              setCustomer(e.target.value);
              setPage(1);
            }}
            placeholder="客户"
            className="h-9 w-40 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
          />
          <button
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
            onClick={loadRows}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw size={15} />
            刷新
          </button>
          <button
            onClick={() => {
              window.location.href = "/api/v1/gmail/auth";
            }}
            className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm transition-colors ${
              gmailConnected
                ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
            title={gmailConnected ? "Gmail 已连接，点击可重新授权" : "连接 Gmail 以搜索邮件"}
          >
            <Mail size={15} />
            {gmailConnected ? "Gmail 已连接" : "连接 Gmail"}
          </button>

          {canWrite && (
            <>
              <input
                ref={importInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleImportExcel(file);
                }}
              />
              <button
                onClick={() => importInputRef.current?.click()}
                disabled={importing}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                <Upload size={15} />
                {importing ? "导入中..." : "导入 Excel"}
              </button>
              <button
                onClick={handleStartAdd}
                disabled={isAddingRow || editingId !== null}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={15} />
                新建
              </button>
              <button
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
      </div>

      <DndContext
        sensors={rowDragSensors}
        collisionDetection={closestCenter}
        onDragEnd={handleRowDragEnd}
      >
        <SortableContext
          items={rows.map((row) => row.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className={`h-[600px] overflow-x-auto ${resizing ? "select-none" : ""}`}>
              <table className="min-w-full table-fixed text-sm">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                    {canWrite && (
                      <th className="w-12 px-2 py-3 font-medium">选择</th>
                    )}
                    {canDragRows && (
                      <th className="w-10 px-1 py-3 font-medium" title="拖拽调整 sort 顺序">
                        <GripVertical size={14} className="mx-auto text-slate-400" />
                      </th>
                    )}
                    {visibleColumns.map((column) => (
                      <th
                        key={column.key}
                        draggable
                        onDragStart={() => setDraggingColumn(column.key)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => handleColumnDrop(column.key)}
                        style={{ width: getWidth(column.key) }}
                        className={`relative px-2 py-3 font-medium ${
                          draggingColumn === column.key ? "opacity-50" : ""
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleSortClick(column.key)}
                          className="flex w-full items-center gap-1 text-left hover:text-blue-600"
                          title="点击列排序；第三次恢复 sort 默认排序"
                        >
                          <span className="truncate">{column.label}</span>
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
                    {canWrite && (
                      <th className="w-28 px-2 py-3 font-medium">操作</th>
                    )}
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
                      <SortableTableRow
                        key={row.id}
                        row={row}
                        canWrite={canWrite}
                        canDragRows={canDragRows}
                        isEditing={editingId === row.id}
                        selected={selected}
                        saving={saving}
                        visibleColumns={visibleColumns}
                        editRow={editRow}
                        getWidth={getWidth}
                        onToggleSelect={toggleSelect}
                        onStartEdit={handleStartEdit}
                        onSaveEdit={handleSaveEdit}
                        onCancelEdit={handleCancelEdit}
                        onDelete={handleDelete}
                        onViewHistory={handleViewHistory}
                        onEditRowChange={(field, value) =>
                          setEditRow((prev) => ({ ...prev, [field]: value }))
                        }
                      />
                    ))
                  )}

                  {isAddingRow && canWrite && (
                    <tr className="border-t-2 border-blue-200 bg-blue-50/40">
                      <td className="px-2 py-2 text-xs text-slate-400">新增一行</td>
                      {canDragRows && <td />}
                      {visibleColumns.map((column) => (
                        <td
                          key={`new-${column.key}`}
                          style={{ width: getWidth(column.key) }}
                          className="px-2 py-2"
                        >
                          {renderEditableInput(column.key, newRow, (field, value) =>
                            setNewRow((prev) => ({ ...prev, [field]: value })),
                          )}
                        </td>
                      ))}
                      <td className="px-2 py-2">
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
        </SortableContext>
      </DndContext>

      <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-500">
        <span>
          共 {total} 条，第 {page}/{totalPages} 页
          {!sortState.column && " · 默认按 sort 排序"}
          {canDragRows && " · 可拖拽行调整顺序"}
          {reordering && " · 保存排序中..."}
        </span>
        <div className="flex gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-md border border-slate-200 bg-white px-3 py-1 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            上一页
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-md border border-slate-200 bg-white px-3 py-1 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            下一页
          </button>
        </div>
      </div>

      <ContainerHistoryDialog
        open={historyDialogOpen}
        onClose={() => {
          setHistoryDialogOpen(false);
          setHistoryContainerId(null);
        }}
        containerId={historyContainerId}
      />
    </DashboardLayout>
  );
}
