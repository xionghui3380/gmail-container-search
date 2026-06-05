/** 批次号统一使用 containers.id */
export function containerBatchNo(containerId: number) {
  return String(containerId);
}

/** @deprecated 使用 containerBatchNo(container.id) */
export function generateBatchNo(containerNo: string) {
  void containerNo;
  throw new Error("generateBatchNo 已废弃，请使用 containerBatchNo(containers.id)");
}
