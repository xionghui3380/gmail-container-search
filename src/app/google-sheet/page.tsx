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
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  GripVertical,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ContainerHistoryDialog from "@/components/ContainerHistoryDialog";
import GmailAuthNotifier from "@/components/GmailAuthNotifier";
import {
  type ColumnKey,
  type DataColumn,
  isDateColumn,
} from "@/lib/container-columns";
import {
  formatCellDate,
  formatCellDateTime,
  renderBoolean,
  renderOperationType,
  toDateInputValue,
  toDateTimeLocalValue,
} from "@/lib/google-sheet-cell-render";
import { useTablePreferences } from "@/hooks/useTablePreferences";

type ContainerRow = {
  id: string;
  container_no: string;
  container_type: string;
  weight?: string | number | null;
  terminal: string;
  customer: string;
  mbl?: string | null;
  operation_type: string;
  pickup_driver?: string | null;
  return_driver?: string | null;
  do_number?: string | null;
  order_date?: string | null;
  eta_date?: string | null;
  delivery_location?: string | null;
  lfd_date?: string | null;
  pickup_date?: string | null;
  forecast_window?: string | null;
  empty_report_date?: string | null;
  return_date?: string | null;
  appointment_no?: string | null;
  appointment_time?: string | null;
  warehouse_account?: string | null;
  backend_delivery?: boolean;
  appointment_colleague?: string | null;
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
  container_type: string;
  weight: string;
  mbl: string;
  container_no: string;
  terminal: string;
  customer: string;
  pickup_driver: string;
  return_driver: string;
  do_number: string;
  order_date: string;
  eta_date: string;
  operation_type: "fcl" | "lcl";
  delivery_location: string;
  lfd_date: string;
  pickup_date: string;
  forecast_window: string;
  empty_report_date: string;
  return_date: string;
  appointment_no: string;
  appointment_time: string;
  warehouse_account: string;
  backend_delivery: boolean;
  appointment_colleague: string;
};

type SortState = {
  column: ColumnKey | null;
  order: "asc" | "desc";
};

const emptyRowForm = (): RowForm => ({
  container_type: "40",
  weight: "",
  mbl: "",
  container_no: "",
  terminal: "",
  customer: "",
  pickup_driver: "",
  return_driver: "",
  do_number: "",
  order_date: "",
  eta_date: "",
  operation_type: "fcl",
  delivery_location: "",
  lfd_date: "",
  pickup_date: "",
  forecast_window: "",
  empty_report_date: "",
  return_date: "",
  appointment_no: "",
  appointment_time: "",
  warehouse_account: "",
  backend_delivery: false,
  appointment_colleague: "",
});

function rowToForm(row: ContainerRow): RowForm {
  return {
    container_type: row.container_type || "40",
    weight: row.weight != null && row.weight !== "" ? String(row.weight) : "",
    mbl: row.mbl ?? "",
    container_no: row.container_no,
    terminal: row.terminal,
    customer: row.customer,
    pickup_driver: row.pickup_driver ?? "",
    return_driver: row.return_driver ?? "",
    do_number: row.do_number ?? "",
    order_date: toDateInputValue(row.order_date),
    eta_date: toDateInputValue(row.eta_date),
    operation_type: row.operation_type === "lcl" ? "lcl" : "fcl",
    delivery_location: row.delivery_location ?? "",
    lfd_date: toDateInputValue(row.lfd_date),
    pickup_date: toDateInputValue(row.pickup_date),
    forecast_window: row.forecast_window ?? "",
    empty_report_date: toDateInputValue(row.empty_report_date),
    return_date: toDateInputValue(row.return_date),
    appointment_no: row.appointment_no ?? "",
    appointment_time: toDateTimeLocalValue(row.appointment_time),
    warehouse_account: row.warehouse_account ?? "",
    backend_delivery: row.backend_delivery ?? false,
    appointment_colleague: row.appointment_colleague ?? "",
  };
}

const inputClass =
  "h-8 w-full min-w-[72px] rounded border border-slate-200 px-2 text-sm outline-none focus:border-blue-400 whitespace-nowrap";

const cellNowrap = "whitespace-nowrap px-2 py-3";
const stickyActionTh =
  "sticky right-0 z-30 min-w-[7.5rem] whitespace-nowrap bg-slate-50 px-2 py-3 text-left font-medium shadow-[-6px_0_8px_-4px_rgba(15,23,42,0.12)]";
const stickyActionTdBase =
  "sticky right-0 z-20 min-w-[7.5rem] whitespace-nowrap px-2 py-3 shadow-[-6px_0_8px_-4px_rgba(15,23,42,0.12)]";

function parseWeight(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  return Number.isNaN(num) ? null : num;
}

function buildPayload(form: RowForm) {
  return {
    container_type: form.container_type,
    weight: parseWeight(form.weight),
    mbl: form.mbl.trim() || null,
    container_no: form.container_no.trim().toUpperCase(),
    terminal: form.terminal.trim(),
    customer: form.customer.trim(),
    pickup_driver: form.pickup_driver.trim() || null,
    return_driver: form.return_driver.trim() || null,
    do_number: form.do_number.trim() || null,
    order_date: form.order_date || null,
    eta_date: form.eta_date || null,
    operation_type: form.operation_type,
    delivery_location: form.delivery_location.trim() || null,
    lfd_date: form.lfd_date || null,
    pickup_date: form.pickup_date || null,
    forecast_window: form.forecast_window.trim() || null,
    empty_report_date: form.empty_report_date || null,
    return_date: form.return_date || null,
    appointment_no: form.appointment_no.trim() || null,
    appointment_time: form.appointment_time || null,
    warehouse_account: form.warehouse_account.trim() || null,
    backend_delivery: form.backend_delivery,
    appointment_colleague: form.appointment_colleague.trim() || null,
  };
}

function validateRowForm(form: RowForm) {
  if (!form.container_no.trim()) return "请填写柜号";
  if (!form.terminal.trim()) return "请填写码头";
  if (!form.customer.trim()) return "请填写客户";
  return null;
}

function formatDate(value?: string | null) {
  return formatCellDate(value);
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
          href={`/google-sheet/${encodeURIComponent(row.container_no)}`}
          className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {row.container_no}
        </Link>
      );
    case "container_type":
      return row.container_type;
    case "weight":
      return row.weight != null && row.weight !== "" ? String(row.weight) : "-";
    case "terminal":
      return row.terminal;
    case "customer":
      return row.customer;
    case "mbl":
      return row.mbl || "-";
    case "operation_type":
      return renderOperationType(row.operation_type);
    case "lfd_date":
      return (
        <span className={getLfdClass(row.lfd_date)}>{formatDate(row.lfd_date)}</span>
      );
    case "appointment_time":
      return formatCellDateTime(row.appointment_time);
    case "backend_delivery":
      return renderBoolean(row.backend_delivery);
    default:
      if (isDateColumn(key)) {
        return formatDate(row[key as keyof ContainerRow] as string | null);
      }
      return (row[key as keyof ContainerRow] as string | null | undefined) || "-";
  }
}

function isRowFormUnchanged(row: ContainerRow, draft: RowForm) {
  const baseline = rowToForm(row);
  return (Object.keys(baseline) as (keyof RowForm)[]).every(
    (key) => baseline[key] === draft[key],
  );
}

function renderEditableInput(
  key: ColumnKey,
  form: RowForm,
  onChange: <K extends keyof RowForm>(field: K, value: RowForm[K]) => void,
  options?: { onBlur?: () => void; disabled?: boolean },
) {
  const onBlur = options?.onBlur;
  const disabled = options?.disabled ?? false;
  switch (key) {
    case "container_no":
      return (
        <input
          value={form.container_no}
          onChange={(e) => onChange("container_no", e.target.value.toUpperCase())}
          onBlur={onBlur}
          disabled={disabled}
          placeholder="柜号"
          className={inputClass}
        />
      );
    case "container_type":
      return (
        <select
          value={form.container_type}
          onChange={(e) => onChange("container_type", e.target.value)}
          onBlur={onBlur}
          disabled={disabled}
          className={inputClass}
        >
          <option value="40">40</option>
          <option value="45">45</option>
        </select>
      );
    case "weight":
      return (
        <input
          type="number"
          step="0.01"
          min="0"
          value={form.weight}
          onChange={(e) => onChange("weight", e.target.value)}
          onBlur={onBlur}
          disabled={disabled}
          placeholder="重量"
          className={inputClass}
        />
      );
    case "operation_type":
      return (
        <select
          value={form.operation_type}
          onChange={(e) => onChange("operation_type", e.target.value as "fcl" | "lcl")}
          onBlur={onBlur}
          disabled={disabled}
          className={inputClass}
        >
          <option value="fcl">整柜</option>
          <option value="lcl">拆柜</option>
        </select>
      );
    case "backend_delivery":
      return (
        <label className="flex h-8 items-center justify-center gap-1.5 text-sm">
          <input
            type="checkbox"
            checked={form.backend_delivery}
            onChange={(e) => onChange("backend_delivery", e.target.checked)}
            onBlur={onBlur}
            disabled={disabled}
            className="rounded border-slate-300"
          />
          是
        </label>
      );
    case "appointment_time":
      return (
        <input
          type="datetime-local"
          value={form.appointment_time}
          onChange={(e) => onChange("appointment_time", e.target.value)}
          onBlur={onBlur}
          disabled={disabled}
          className={inputClass}
        />
      );
    default:
      if (isDateColumn(key)) {
        const field = key as keyof RowForm;
        return (
          <input
            type="date"
            value={form[field] as string}
            onChange={(e) => onChange(field, e.target.value as RowForm[typeof field])}
            onBlur={onBlur}
            disabled={disabled}
            className={inputClass}
          />
        );
      }
      {
        const textFields: Partial<Record<ColumnKey, keyof RowForm>> = {
          terminal: "terminal",
          customer: "customer",
          mbl: "mbl",
          pickup_driver: "pickup_driver",
          return_driver: "return_driver",
          do_number: "do_number",
          delivery_location: "delivery_location",
          forecast_window: "forecast_window",
          appointment_no: "appointment_no",
          warehouse_account: "warehouse_account",
          appointment_colleague: "appointment_colleague",
        };
        const field = textFields[key];
        if (field) {
          return (
            <input
              value={form[field] as string}
              onChange={(e) => onChange(field, e.target.value as RowForm[typeof field])}
              onBlur={onBlur}
              disabled={disabled}
              className={inputClass}
            />
          );
        }
      }
      return null;
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
  selected: Set<string>;
  visibleColumns: DataColumn[];
  getWidth: (key: ColumnKey) => number;
  rowDraft: RowForm;
  saving: boolean;
  onToggleSelect: (id: string) => void;
  onViewHistory: (id: string) => void;
  onDelete: (id: string) => void;
  onDraftChange: <K extends keyof RowForm>(field: K, value: RowForm[K]) => void;
  onCellBlur: () => void;
};

function SortableTableRow({
  row,
  canWrite,
  canDragRows,
  selected,
  visibleColumns,
  getWidth,
  rowDraft,
  saving,
  onToggleSelect,
  onViewHistory,
  onDelete,
  onDraftChange,
  onCellBlur,
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
    disabled: !canDragRows || saving,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`group border-b border-slate-100 ${
        isDragging
          ? "relative z-10 bg-white opacity-90 shadow-md"
          : "hover:bg-slate-50/80"
      }`}
      title={canDragRows ? "拖拽左侧手柄调整顺序" : undefined}
    >
      {canWrite && (
        <td className="px-2 py-3">
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
          {...attributes}
          {...listeners}
        >
          <GripVertical size={14} className="mx-auto text-slate-400" />
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
        <td
          className={`${stickyActionTdBase} ${
            isDragging ? "bg-white" : "bg-white group-hover:bg-slate-50/80"
          }`}
        >
          <div className="flex items-center gap-2 whitespace-nowrap">
            <Link
              href={`/google-sheet/${encodeURIComponent(row.container_no)}`}
              className="text-blue-500 hover:text-blue-700 hover:underline"
            >
              详情
            </Link>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={() => onViewHistory(row.id)}
              className="text-blue-500 hover:text-blue-700 hover:underline"
            >
              历史
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={() => onDelete(row.id)}
              disabled={saving}
              className="text-red-500 hover:text-red-700 hover:underline disabled:opacity-50"
            >
              {saving ? "保存中..." : "删除"}
            </button>
          </div>
        </td>
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
  const [rowDrafts, setRowDrafts] = useState<Record<string, RowForm>>({});
  const [savingRowId, setSavingRowId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sortState, setSortState] = useState<SortState>({ column: null, order: "asc" });
  const [reordering, setReordering] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyContainerId, setHistoryContainerId] = useState<string | null>(null);

  const saveTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pendingSaveRef = useRef<Set<string>>(new Set());
  const rowsRef = useRef(rows);
  const rowDraftsRef = useRef(rowDrafts);

  rowsRef.current = rows;
  rowDraftsRef.current = rowDrafts;

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
    () => canWrite && !sortState.column && !isAddingRow && !loading,
    [canWrite, sortState.column, isAddingRow, loading],
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

      const res = await fetch(`/api/v1/google-sheet?${params.toString()}`);
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
    setRowDrafts(Object.fromEntries(rows.map((row) => [row.id, rowToForm(row)])));
  }, [rows]);

  useEffect(() => {
    const timers = saveTimerRef.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
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
      const res = await fetch("/api/v1/google-sheet/reorder", {
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
      const res = await fetch(`/api/v1/google-sheet/${rowId}`, {
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
        [rowId]: rowToForm({ ...row, ...json.data } as ContainerRow),
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
      const res = await fetch("/api/v1/google-sheet", {
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

  function handleViewHistory(id: string) {
    setHistoryContainerId(id);
    setHistoryDialogOpen(true);
  }

  async function handleDelete(id: string) {
    if (!confirm("确认删除该记录？")) return;
    const res = await fetch(`/api/v1/google-sheet/${id}`, { method: "DELETE" });
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
    const res = await fetch("/api/v1/google-sheet/batch", {
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
      title="google_sheet"
      subtitle={user ? `${user.fullName}（${user.role}）` : "加载中..."}
      onLogout={handleLogout}
    >
      <Suspense fallback={null}>
        <GmailAuthNotifier />
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

          {canWrite && (
            <>
              <button
                onClick={handleStartAdd}
                disabled={isAddingRow}
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
              <table className="w-max min-w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50">
                  <tr className="border-b border-slate-200 text-left text-slate-600">
                    {canWrite && (
                      <th className={`${cellNowrap} w-12 font-medium`}>选择</th>
                    )}
                    {canDragRows && (
                      <th
                        className={`${cellNowrap} w-10 px-1 font-medium`}
                        title="拖拽调整 sort 顺序"
                      >
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
                        style={{ minWidth: getWidth(column.key), width: getWidth(column.key) }}
                        className={`relative ${cellNowrap} bg-slate-50 font-medium ${
                          draggingColumn === column.key ? "opacity-50" : ""
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleSortClick(column.key)}
                          className="flex w-full items-center gap-1 whitespace-nowrap text-left hover:text-blue-600"
                          title="点击列排序；第三次恢复 sort 默认排序"
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
                    {canWrite && (
                      <th className={stickyActionTh}>操作</th>
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
                        selected={selected}
                        visibleColumns={visibleColumns}
                        getWidth={getWidth}
                        rowDraft={rowDrafts[row.id] ?? rowToForm(row)}
                        saving={savingRowId === row.id}
                        onToggleSelect={toggleSelect}
                        onViewHistory={handleViewHistory}
                        onDelete={handleDelete}
                        onDraftChange={(field, value) => updateRowDraft(row.id, field, value)}
                        onCellBlur={() => void handleCellBlur(row.id)}
                      />
                    ))
                  )}

                  {isAddingRow && canWrite && (
                    <tr className="border-t-2 border-blue-200 bg-blue-50/40">
                      <td className={`${cellNowrap} text-xs text-slate-400`}>新增一行</td>
                      {canDragRows && <td className={cellNowrap} />}
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
