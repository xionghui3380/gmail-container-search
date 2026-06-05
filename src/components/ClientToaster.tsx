"use client";

import { Toaster } from "sonner";

export default function ClientToaster() {
  return (
    <Toaster
      richColors
      position="top-center"
      duration={4000}
      closeButton
      visibleToasts={3}
    />
  );
}
