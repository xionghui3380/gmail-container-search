import type { Metadata } from "next";
import ClientToaster from "@/components/ClientToaster";
import "./globals.css";

export const metadata: Metadata = {
  title: "集装箱操作管理系统",
  description: "Container Operation Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        {children}
        <ClientToaster />
      </body>
    </html>
  );
}
