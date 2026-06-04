"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useCustomerTablePreferences } from "@/hooks/useCustomerTablePreferences";
import {
  type CustomerColumnKey,
  type CustomerDataColumn,
} from "@/lib/customer-columns";

type CustomerRow = {
  id: string;
  name: string;
  contact?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  is_active?: boolean;
  remarks?: string | null;
  created_at?: string;
  updated_at?: string;
};

type UserInfo = {
  fullName: string;
  role: "admin" | "operator" | "viewer";
};

type RowForm = {
  name: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
  is_active: boolean;
};

type SortState = {
  column: CustomerColumnKey | null;
  order: "asc" | "desc";
};

const emptyRowForm = (): RowForm => ({
  name: "",
  contact: "",
  phone: "",
  email: "",
  address: "",
  is_active: true,
});

const inputClass =
  "h-8 w-full min-w-[72px] rounded border border-slate-200 px-2 text-sm outline-none focus:border-blue-400 whitespace-nowrap";

const cellNowrap = "whitespace-nowrap px-2 py-3";
const stickyActionTh =
  "sticky right-0 z-30 min-w-[5rem] whitespace-nowrap bg-slate-50 px-2 py-3 text-left font-medium shadow-[-6px_0_8px_-4px_rgba(15,23,42,0.12)]";
const stickyActionTdBase =
  "sticky right-0 z-20 min-w-[5rem] whitespace-nowrap px-2 py-3 shadow-[-6px_0_8px_-4px_rgba(15,23,42,0.12)]";

function rowToForm(row: CustomerRow): RowForm {
  return {
    name: row.name,
    contact: row.contact ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    address: row.address ?? "",
    is_active: row.is_active ?? true,
  };
}

function buildPayload(form: RowForm) {
  return {
    name: form.name.trim(),
    contact: form.contact.trim() || null,
    phone: form.phone.trim() || null,
    email: form.email.trim() || null,
    address: form.address.trim() || null,
    is_active: form.is_active,
  };
}

function validateRowForm(form: RowForm) {
  if (!form.name.trim()) return "请填写客户名称";
  return null;
}

function renderReadOnlyCell(row: CustomerRow, key: CustomerColumnKey) {
  if (key === "is_active") {
    return row.is_active ? "是" : "否";
  }
  const value = row[key];
  return value && String(value).trim() ? String(value) : "-";
}

function renderEditableInput(
  key: CustomerColumnKey,
  form: RowForm,
  onChange: <K extends keyof RowForm>(field: K, value: RowForm[K]) => void,
) {
  if (key === "is_active") {
    return (
      <input
        type="checkbox"
        checked={form.is_active}
        onChange={(e) => onChange("is_active", e.target.checked)}
        className="rounded border-slate-300"
      />
    );
  }
  return (
    <input
      value={form[key]}
      onChange={(e) => onChange(key, e.target.value)}
      className={inputClass}
      placeholder={key === "name" ? "客户名称" : undefined}
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
  row: CustomerRow;
  canWrite: boolean;
  selected: Set<string>;
  visibleColumns: CustomerDataColumn[];
  getWidth: (key: CustomerColumnKey) => number;
  isEditing: boolean;
  editForm: RowForm;
  saving: boolean;
  onToggleSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onStartEdit: () => void;
  onEditChange: <K extends keyof RowForm>(field: K, value: RowForm[K]) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
};

function DataRow({
  row,
  canWrite,
  selected,
  visibleColumns,
  getWidth,
  isEditing,
  editForm,
  saving,
  onToggleSelect,
  onDelete,
  onStartEdit,
  onEditChange,
  onSaveEdit,
  onCancelEdit,
}: DataRowProps) {
  return (
    <tr
      onDoubleClick={() => {
        if (canWrite && !isEditing) onStartEdit();
      }}
      className={`group border-b border-slate-100 ${
        isEditing ? "bg-amber-50/70" : "hover:bg-slate-50/80"
      }`}
      title={canWrite && !isEditing ? "双击编辑" : undefined}
    >
      {canWrite && (
        <td className={cellNowrap} onDoubleClick={(e) => e.stopPropagation()}>
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
          key={`${isEditing ? "edit" : "read"}-${row.id}-${column.key}`}
          style={{ minWidth: getWidth(column.key), width: getWidth(column.key) }}
          className={`${cellNowrap} text-slate-700`}
        >
          {isEditing
            ? renderEditableInput(column.key, editForm, onEditChange)
            : renderReadOnlyCell(row, column.key)}
        </td>
      ))}
      {canWrite && (
        <td
          className={`${stickyActionTdBase} ${
            isEditing ? "bg-amber-50" : "bg-white group-hover:bg-slate-50/80"
          }`}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          {isEditing ? (
            <ActionButtons saving={saving} onSave={onSaveEdit} onCancel={onCancelEdit} />
          ) : (
            <button
              type="button"
              onClick={() => onDelete(row.id)}
              className="text-red-500 hover:text-red-700 hover:underline"
            >
              删除
            </button>
          )}
        </td>
      )}
    </tr>
  );
}

export default function CustomersPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize] = useState(50);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isAddingRow, setIsAddingRow] = useState(false);
  const [newRow, setNewRow] = useState<RowForm>(emptyRowForm);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<RowForm>(emptyRowForm);
  const [saving, setSaving] = useState(false);
  const [sortState, setSortState] = useState<SortState>({ column: null, order: "desc" });

  const {
    visibleColumns,
    draggingColumn,
    setDraggingColumn,
    handleColumnDrop,
    startResize,
    getWidth,
    resizing,
  } = useCustomerTablePreferences();

  const canWrite = useMemo(
    () => user?.role === "admin" || user?.role === "operator",
    [user],
  );

  const loadUser = useCallback(async () => {
    const res = await fetch("/api/v1/auth/me");
    if (!res.ok) {
      router.push("/login?redirect=/customers");
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
      if (keyword.trim()) params.set("keyword", keyword.trim());
      if (sortState.column) {
        params.set("sortBy", sortState.column);
        params.set("sortOrder", sortState.order);
      }

      const res = await fetch(`/api/v1/customers?${params.toString()}`);
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
  }, [page, pageSize, sortState, keyword]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  function handleSortClick(key: CustomerColumnKey) {
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
    if (editingRowId) return;
    setNewRow(emptyRowForm());
    setIsAddingRow(true);
  }

  function handleCancelAdd() {
    setIsAddingRow(false);
    setNewRow(emptyRowForm());
  }

  function handleStartEdit(row: CustomerRow) {
    if (isAddingRow || editingRowId) return;
    setEditingRowId(row.id);
    setEditForm(rowToForm(row));
  }

  function handleCancelEdit() {
    setEditingRowId(null);
    setEditForm(emptyRowForm());
  }

  async function handleSaveEdit() {
    if (!editingRowId) return;
    const message = validateRowForm(editForm);
    if (message) {
      toast.error(message);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/customers/${editingRowId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(editForm)),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.message ?? "保存失败");
        if (json.errors?.[0]?.message) toast.error(json.errors[0].message);
        return;
      }
      toast.success("保存成功");
      handleCancelEdit();
      loadRows();
    } finally {
      setSaving(false);
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
      const res = await fetch("/api/v1/customers", {
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

  async function handleDelete(id: string) {
    if (!confirm("确认删除该记录？")) return;
    const res = await fetch(`/api/v1/customers/${id}`, { method: "DELETE" });
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
    const res = await fetch("/api/v1/customers/batch", {
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

  function renderSortIcon(key: CustomerColumnKey) {
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
      title="客户管理"
      subtitle={user ? `${user.fullName}（${user.role}）` : "加载中..."}
      onLogout={handleLogout}
    >
      <div className="mb-4 flex items-center gap-3">
        <input
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value);
            setPage(1);
          }}
          placeholder="客户名称/联系人/电话"
          className="h-9 w-52 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
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
              disabled={isAddingRow || Boolean(editingRowId)}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={15} />
              新建
            </button>
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
                      onClick={() => column.sortable && handleSortClick(column.key)}
                      className={`flex w-full items-center gap-1 whitespace-nowrap text-left ${
                        column.sortable ? "hover:text-blue-600" : ""
                      }`}
                    >
                      <span>{column.label}</span>
                      {column.sortable && renderSortIcon(column.key)}
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
                    isEditing={editingRowId === row.id}
                    editForm={editForm}
                    saving={saving}
                    onToggleSelect={toggleSelect}
                    onDelete={handleDelete}
                    onStartEdit={() => handleStartEdit(row)}
                    onEditChange={(field, value) =>
                      setEditForm((prev) => ({ ...prev, [field]: value }))
                    }
                    onSaveEdit={handleSaveEdit}
                    onCancelEdit={handleCancelEdit}
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
