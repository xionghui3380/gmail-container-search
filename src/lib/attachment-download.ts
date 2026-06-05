import { encodeContentDisposition } from "@/lib/delivery-items-export";

function attachmentContentType(filename?: string | null) {
  const name = (filename ?? "").trim().toLowerCase();
  if (name.endsWith(".csv")) return "text/csv; charset=utf-8";
  if (name.endsWith(".xls")) return "application/vnd.ms-excel";
  return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
}

function attachmentDownloadFilename(filename?: string | null) {
  const name = (filename ?? "").trim();
  return name || "attachment.xlsx";
}

export function attachmentDownloadHeaders(filename?: string | null) {
  const downloadName = attachmentDownloadFilename(filename);
  return {
    "Content-Type": attachmentContentType(filename),
    "Content-Disposition": encodeContentDisposition(downloadName),
  };
}
