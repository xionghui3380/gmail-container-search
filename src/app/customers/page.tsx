"use client";

/**
 * 客户管理页面 - 单表 CRUD 完整示例
 *
 * 这是一个教学页面，展示了一个标准单表 CRUD 的完整实现：
 * - C (Create)：点击"新增"按钮 → 弹出表单 → 填写 → 保存
 * - R (Read)：分页列表展示 + 搜索
 * - U (Update)：点击"编辑"按钮 → 弹出表单 → 修改 → 保存
 * - D (Delete)：点击"删除"按钮 → 确认 → 软删除
 *
 * 涉及的技术点：
 * 1. useState 管理页面状态（列表、分页、搜索、弹框）
 * 2. useEffect 加载数据
 * 3. fetch 调用 REST API
 * 4. Tailwind CSS 样式
 * 5. sonner toast 提示
 * 6. 权限控制（canWrite）
 */
import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { Pencil, Plus, Search, RefreshCw, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import DashboardLayout from "@/components/layout/DashboardLayout";

type Customer = {
  id: string;
  name: string;
  contact: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  is_active: boolean;
  remarks: string | null;
  created_at: string;
  creator?: { full_name: string } | null;
};

type CustomerForm = {
  name: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
  is_active: boolean;
  remarks: string;
};

type UserInfo = {
  id: string;
  fullName: string;
  role: "admin" | "operator" | "viewer";
};

const emptyForm: CustomerForm = {
  name: "",
  contact: "",
  phone: "",
  email: "",
  address: "",
  is_active: true,
  remarks: "",
};

export default function CustomersPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [rows, setRows] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const canWrite = user?.role === "admin" || user?.role === "operator";

  const loadUser = useCallback(async () => {
    const res = await fetch("/api/v1/auth/me");
    if (!res.ok) { router.push("/login"); return; }
    const json = await res.json();
    setUser(json.data.user);
  }, [router]);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/v1/customers?${params}`);
      const json = await res.json();
      if (!res.ok) { toast.error(json.message); return; }
      setRows(json.data);
      setTotal(json.pagination?.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { loadUser(); }, [loadUser]);
  useEffect(() => { loadRows(); }, [loadRows]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(row: Customer) {
    setEditingId(row.id);
    setForm({
      name: row.name,
      contact: row.contact || "",
      phone: row.phone || "",
      email: row.email || "",
      address: row.address || "",
      is_active: row.is_active,
      remarks: row.remarks || "",
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error("请填写客户名称"); return; }
    setSaving(true);
    try {
      const url = editingId ? `/api/v1/customers/${editingId}` : "/api/v1/customers";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          contact: form.contact.trim() || null,
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          address: form.address.trim() || null,
          is_active: form.is_active,
          remarks: form.remarks.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.message ?? "保存失败"); return; }
      toast.success(editingId ? "更新成功" : "创建成功");
      setDialogOpen(false);
      loadRows();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("确认删除该客户？")) return;
    const res = await fetch(`/api/v1/customers/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) { toast.error(json.message); return; }
    toast.success("已删除");
    loadRows();
  }

  return (
    <DashboardLayout
      title="客户管理"
      subtitle={user ? `${user.fullName}（${user.role}）` : "加载中..."}
      onLogout={async () => { await fetch("/api/v1/auth/logout", { method: "POST" }); router.push("/login"); router.refresh(); }}
    >
      {/* 搜索栏 + 操作按钮 */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex flex-1 items-center gap-2">
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="搜索客户名称 / 联系人 / 电话"
            className="h-9 w-80 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
          />
          <button onClick={() => { setPage(1); loadRows(); }} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700">
            <Search size={15} /> 搜索
          </button>
          <button onClick={loadRows} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50">
            <RefreshCw size={15} /> 刷新
          </button>
        </div>
        {canWrite && (
          <button onClick={openCreate} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-green-600 px-4 text-sm font-medium text-white hover:bg-green-700">
            <Plus size={15} /> 新增客户
          </button>
        )}
      </div>

      {/* 数据表格 */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr className="text-left text-slate-600">
                <th className="px-4 py-3 font-medium">客户名称</th>
                <th className="px-4 py-3 font-medium">联系人</th>
                <th className="px-4 py-3 font-medium">电话</th>
                <th className="px-4 py-3 font-medium">邮箱</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium">创建人</th>
                <th className="px-4 py-3 font-medium">创建时间</th>
                {canWrite && <th className="px-4 py-3 font-medium">操作</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={canWrite ? 8 : 7} className="px-4 py-16 text-center text-slate-400">加载中...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={canWrite ? 8 : 7} className="px-4 py-16 text-center text-slate-400">暂无数据</td></tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-medium text-slate-800">{row.name}</td>
                    <td className="px-4 py-3 text-slate-700">{row.contact || "-"}</td>
                    <td className="px-4 py-3 text-slate-700">{row.phone || "-"}</td>
                    <td className="px-4 py-3 text-slate-700">{row.email || "-"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${row.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {row.is_active ? "启用" : "停用"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{row.creator?.full_name || "-"}</td>
                    <td className="px-4 py-3 text-slate-500">{format(new Date(row.created_at), "yyyy-MM-dd HH:mm")}</td>
                    {canWrite && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <button onClick={() => openEdit(row)} className="text-blue-500 hover:text-blue-700"><Pencil size={15} /></button>
                          <button onClick={() => handleDelete(row.id)} className="text-red-500 hover:text-red-700"><Trash2 size={15} /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-500">
          <span>共 {total} 条，第 {page}/{totalPages} 页</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-md border border-slate-200 bg-white px-3 py-1 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">上一页</button>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-md border border-slate-200 bg-white px-3 py-1 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">下一页</button>
          </div>
        </div>
      </div>

      {/* 新增/编辑弹框 */}
      {dialogOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4" onClick={() => setDialogOpen(false)}>
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">{editingId ? "编辑客户" : "新增客户"}</h2>
              <button onClick={() => setDialogOpen(false)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100"><X size={20} /></button>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">客户名称 *</span>
                <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">联系人</span>
                  <input value={form.contact} onChange={(e) => setForm((p) => ({ ...p, contact: e.target.value }))} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">电话</span>
                  <input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
                </label>
              </div>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">邮箱</span>
                <input value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">地址</span>
                <input value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">备注</span>
                <textarea value={form.remarks} onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))} rows={2} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))} className="rounded border-slate-300" />
                启用
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setDialogOpen(false)} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">取消</button>
              <button onClick={handleSave} disabled={saving} className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60">{saving ? "保存中..." : "保存"}</button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
