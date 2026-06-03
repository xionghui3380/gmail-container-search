"use client";

import { LogOut } from "lucide-react";

type HeaderProps = {
  title: string;
  subtitle?: string;
  onLogout?: () => void;
};

export default function Header({ title, subtitle, onLogout }: HeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
      <div>
        <h1 className="text-base font-semibold text-slate-900">{title}</h1>
        {subtitle && (
          <p className="text-xs text-slate-500">{subtitle}</p>
        )}
      </div>

      {onLogout && (
        <button
          onClick={onLogout}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition-colors hover:bg-slate-50"
        >
          <LogOut size={15} />
          退出
        </button>
      )}
    </header>
  );
}
