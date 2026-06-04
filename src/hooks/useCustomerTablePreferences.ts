"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CUSTOMER_COLUMN_ORDER_STORAGE_KEY,
  CUSTOMER_COLUMN_WIDTH_STORAGE_KEY,
  CUSTOMER_COLUMNS,
  getDefaultCustomerColumnOrder,
  getDefaultCustomerColumnWidths,
  type CustomerColumnKey,
} from "@/lib/customer-columns";

const MIN_WIDTH = 80;
const MAX_WIDTH = 500;

export function useCustomerTablePreferences() {
  const [columnOrder, setColumnOrder] = useState<CustomerColumnKey[]>(getDefaultCustomerColumnOrder);
  const [columnWidths, setColumnWidths] =
    useState<Record<string, number>>(getDefaultCustomerColumnWidths);
  const [draggingColumn, setDraggingColumn] = useState<CustomerColumnKey | null>(null);
  const [resizing, setResizing] = useState<{
    key: CustomerColumnKey;
    startX: number;
    startWidth: number;
  } | null>(null);

  useEffect(() => {
    try {
      const savedOrder = localStorage.getItem(CUSTOMER_COLUMN_ORDER_STORAGE_KEY);
      if (savedOrder) {
        const parsed = JSON.parse(savedOrder) as CustomerColumnKey[];
        const valid = parsed.filter((key) => CUSTOMER_COLUMNS.some((col) => col.key === key));
        if (valid.length === CUSTOMER_COLUMNS.length) setColumnOrder(valid);
      }
      const savedWidths = localStorage.getItem(CUSTOMER_COLUMN_WIDTH_STORAGE_KEY);
      if (savedWidths) {
        setColumnWidths({ ...getDefaultCustomerColumnWidths(), ...JSON.parse(savedWidths) });
      }
    } catch {
      // ignore
    }
  }, []);

  const visibleColumns = columnOrder
    .map((key) => CUSTOMER_COLUMNS.find((col) => col.key === key))
    .filter(Boolean) as typeof CUSTOMER_COLUMNS;

  const persistOrder = useCallback((order: CustomerColumnKey[]) => {
    setColumnOrder(order);
    localStorage.setItem(CUSTOMER_COLUMN_ORDER_STORAGE_KEY, JSON.stringify(order));
  }, []);

  const handleColumnDrop = useCallback(
    (targetKey: CustomerColumnKey) => {
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
    (key: CustomerColumnKey, clientX: number) => {
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
        localStorage.setItem(CUSTOMER_COLUMN_WIDTH_STORAGE_KEY, JSON.stringify(prev));
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
    (key: CustomerColumnKey) => columnWidths[key] ?? 120,
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
