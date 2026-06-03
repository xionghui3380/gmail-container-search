import { format } from "date-fns";

/** 生成解析批次号：柜号-时间戳 */
export function generateBatchNo(containerNo: string) {
  const ts = format(new Date(), "yyyyMMddHHmmss");
  return `${containerNo.trim().toUpperCase()}-${ts}`;
}
