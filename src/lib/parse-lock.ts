import { prisma } from "@/lib/prisma";

const PARSING_STALE_MS = Number(process.env.PARSE_LOCK_STALE_MS ?? 10 * 60 * 1000);

async function releaseStaleParsingByOrder(orderId: number) {
  const staleBefore = new Date(Date.now() - PARSING_STALE_MS);
  const stale = await prisma.containers.findFirst({
    where: {
      order_id: orderId,
      parse_status: "parsing",
      created_at: { lt: staleBefore },
    },
    orderBy: { created_at: "desc" },
  });
  if (!stale) return;

  await prisma.containers.update({
    where: { id: stale.id },
    data: {
      parse_status: "failed",
      error_message: "解析超时，已自动标记失败，可重新检索",
    },
  });
}

async function releaseStaleParsingByContainerNo(containerNo: string) {
  const staleBefore = new Date(Date.now() - PARSING_STALE_MS);
  const stale = await prisma.containers.findFirst({
    where: {
      container_no: containerNo,
      parse_status: "parsing",
      created_at: { lt: staleBefore },
    },
    orderBy: { created_at: "desc" },
  });
  if (!stale) return;

  await prisma.containers.update({
    where: { id: stale.id },
    data: {
      parse_status: "failed",
      error_message: "解析超时，已自动标记失败，可重新解析",
    },
  });

  await prisma.container_parse_meta.updateMany({
    where: { container_no: containerNo, parse_status: "parsing" },
    data: {
      parse_status: "failed",
      error_message: "解析超时，已自动标记失败",
    },
  });
}

/** P0/P2：订单检索幂等 — 同一订单不允许并发 parsing */
export async function assertOrderNotParsing(orderId: number) {
  await releaseStaleParsingByOrder(orderId);
  const active = await prisma.containers.findFirst({
    where: { order_id: orderId, parse_status: "parsing" },
    orderBy: { created_at: "desc" },
  });
  if (active) {
    throw new Error(`该订单正在解析中（记录 #${active.id}），请稍后再试`);
  }
}

/** P0/P2：柜号解析幂等 — 同一柜号不允许并发 parsing */
export async function assertContainerNotParsing(containerNo: string) {
  const normalized = containerNo.trim().toUpperCase();
  await releaseStaleParsingByContainerNo(normalized);

  const activeContainer = await prisma.containers.findFirst({
    where: { container_no: normalized, parse_status: "parsing" },
    orderBy: { created_at: "desc" },
  });
  if (activeContainer) {
    throw new Error(`柜号 ${normalized} 正在解析中，请稍后再试`);
  }

  const meta = await prisma.container_parse_meta.findUnique({
    where: { container_no: normalized },
  });
  if (meta?.parse_status === "parsing") {
    throw new Error(`柜号 ${normalized} 正在解析中，请稍后再试`);
  }
}
