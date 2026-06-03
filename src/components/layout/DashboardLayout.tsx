"use client";

import type { ReactNode } from "react";
import Header from "./Header";
import Sidebar from "./Sidebar";

type DashboardLayoutProps = {
  title: string;
  subtitle?: string;
  onLogout?: () => void;
  children: ReactNode;
};

export default function DashboardLayout({
  title,
  subtitle,
  onLogout,
  children,
}: DashboardLayoutProps) {
  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header title={title} subtitle={subtitle} onLogout={onLogout} />
        <main className="flex-1 overflow-auto p-4">{children}</main>
      </div>
    </div>
  );
}
