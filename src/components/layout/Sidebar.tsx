"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Container, LayoutDashboard, Package, Users } from "lucide-react";

const navItems = [
  {
    href: "/containers",
    label: "集装箱管理",
    icon: Container,
  },
  {
    href: "/cargo",
    label: "货柜管理",
    icon: Package,
  },
  {
    href: "/customers",
    label: "客户管理",
    icon: Users,
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-52 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex h-14 items-center border-b border-slate-200 px-4">
        <LayoutDashboard className="mr-2 h-5 w-5 text-blue-600" />
        <span className="text-sm font-semibold text-slate-800">GNG 管理系统</span>
      </div>

      <nav className="flex-1 p-3">
        <ul className="space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    active
                      ? "bg-blue-50 font-medium text-blue-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
