"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ORDER_COLUMN_ORDER_STORAGE_KEY,
  ORDER_COLUMN_WIDTH_STORAGE_KEY,
  ORDER_COLUMNS,
  getDefaultOrderColumnOrder,
  getDefaultOrderColumnWidths,
  type OrderColumnKey,
} from "@/lib/order-columns";

const MIN_WIDTH = 80;
const MAX_WIDTH = 500;

export function useOrderTablePreferences() {
  const [columnOrder, setColumnOrder] = useState<OrderColumnKey[]>(getDefaultOrderColumnOrder);
  const [columnWidths, setColumnWidths] =
    useState<Record<string, number>>(getDefaultOrderColumnWidths);
  const [draggingColumn, setDraggingColumn] = useState<OrderColumnKey | null>(null);
  const [resizing, setResizing] = useState<{
    key: OrderColumnKey;
    startX: number;
    startWidth: number;
  } | null>(null);

  useEffect(() => {
    try {
      const savedOrder = localStorage.getItem(ORDER_COLUMN_ORDER_STORAGE_KEY);
      if (savedOrder) {
        const parsed = JSON.parse(savedOrder) as OrderColumnKey[];
        const valid = parsed.filter((key) => ORDER_COLUMNS.some((col) => col.key === key));
        if (valid.length === ORDER_COLUMNS.length) setColumnOrder(valid);
      }
      const savedWidths = localStorage.getItem(ORDER_COLUMN_WIDTH_STORAGE_KEY);
      if (savedWidths) {
        setColumnWidths({ ...getDefaultOrderColumnWidths(), ...JSON.parse(savedWidths) });
      }
    } catch {
      // ignore
    }
  }, []);

  const visibleColumns = columnOrder
    .map((key) => ORDER_COLUMNS.find((col) => col.key === key))
    .filter(Boolean) as typeof ORDER_COLUMNS;

  const persistOrder = useCallback((order: OrderColumnKey[]) => {
    setColumnOrder(order);
    localStorage.setItem(ORDER_COLUMN_ORDER_STORAGE_KEY, JSON.stringify(order));
  }, []);

  const handleColumnDrop = useCallback(
    (targetKey: OrderColumnKey) => {
      if (!draggingColumn || draggingColumn === targetKey) return;
      const next = [...columnOrder];
      const from = next.indexOf(draggingColumn);
      const to = next.indexOf(targetKey);
      if (from < 0 || to < 0) return;
      next.splice(from, 1);
      next.splice(to, 0, draggingColumn);
      persistOrder(next);
      setDraggingColumn(null);
    },
    [columnOrder, draggingColumn, persistOrder],
  );

  const startResize = useCallback(
    (key: OrderColumnKey, clientX: number) => {
      setResizing({
        key,
        startX: clientX,
        startWidth: columnWidths[key] ?? 120,
      });
    },
    [columnWidths],
  );

  useEffect(() => {
    if (!resizing) return;

    function onMove(event: MouseEvent) {
      const delta = event.clientX - resizing!.startX;
      const nextWidth = Math.min(
        MAX_WIDTH,
        Math.max(MIN_WIDTH, resizing!.startWidth + delta),
      );
      setColumnWidths((prev) => ({ ...prev, [resizing!.key]: nextWidth }));
    }

    function onUp() {
      setColumnWidths((prev) => {
        localStorage.setItem(ORDER_COLUMN_WIDTH_STORAGE_KEY, JSON.stringify(prev));
        return prev;
      });
      setResizing(null);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [resizing]);

  const getWidth = useCallback(
    (key: OrderColumnKey) => columnWidths[key] ?? 120,
    [columnWidths],
  );

  return {
    visibleColumns,
    draggingColumn,
    setDraggingColumn,
    handleColumnDrop,
    startResize,
    getWidth,
    resizing: !!resizing,
  };
}
