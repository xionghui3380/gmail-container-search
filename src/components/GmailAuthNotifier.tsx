"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

type GmailAuthNotifierProps = {
  onConnected?: () => void;
};

export default function GmailAuthNotifier({ onConnected }: GmailAuthNotifierProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const gmailOk = searchParams.get("gmail_connected");
    const gmailError = searchParams.get("gmail_error");

    if (gmailOk === "true") {
      toast.success("Gmail 连接成功，可以搜索邮件了");
      onConnected?.();
      router.replace("/containers");
      return;
    }

    if (gmailError) {
      toast.error(`Gmail 授权失败：${decodeURIComponent(gmailError)}`);
      router.replace("/containers");
    }
  }, [searchParams, router, onConnected]);

  return null;
}
