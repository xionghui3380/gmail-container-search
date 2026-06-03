"use client";

import { useCallback, useEffect, useState } from "react";
import {
  COLUMN_ORDER_STORAGE_KEY,
  COLUMN_WIDTH_STORAGE_KEY,
  DATA_COLUMNS,
  getDefaultColumnOrder,
  getDefaultColumnWidths,
  type ColumnKey,
} from "@/lib/container-columns";

const MIN_WIDTH = 80;
const MAX_WIDTH = 500;

export function useTablePreferences() {
  const [columnOrder, setColumnOrder] = useState<ColumnKey[]>(getDefaultColumnOrder);
  const [columnWidths, setColumnWidths] =
    useState<Record<string, number>>(getDefaultColumnWidths);
  const [draggingColumn, setDraggingColumn] = useState<ColumnKey | null>(null);
  const [resizing, setResizing] = useState<{
    key: ColumnKey;
    startX: number;
    startWidth: number;
  } | null>(null);

  useEffect(() => {
    try {
      const savedOrder = localStorage.getItem(COLUMN_ORDER_STORAGE_KEY);
      if (savedOrder) {
        const parsed = JSON.parse(savedOrder) as ColumnKey[];
        const valid = parsed.filter((key) =>
          DATA_COLUMNS.some((col) => col.key === key),
        );
        if (valid.length === DATA_COLUMNS.length) setColumnOrder(valid);
      }
      const savedWidths = localStorage.getItem(COLUMN_WIDTH_STORAGE_KEY);
      if (savedWidths) {
        setColumnWidths({ ...getDefaultColumnWidths(), ...JSON.parse(savedWidths) });
      }
    } catch {
      // ignore invalid localStorage
    }
  }, []);

  const visibleColumns = columnOrder
    .map((key) => DATA_COLUMNS.find((col) => col.key === key))
    .filter(Boolean) as typeof DATA_COLUMNS;

  const persistOrder = useCallback((order: ColumnKey[]) => {
    setColumnOrder(order);
    localStorage.setItem(COLUMN_ORDER_STORAGE_KEY, JSON.stringify(order));
  }, []);

  const handleColumnDrop = useCallback(
    (targetKey: ColumnKey) => {
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
    (key: ColumnKey, clientX: number) => {
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
        localStorage.setItem(COLUMN_WIDTH_STORAGE_KEY, JSON.stringify(prev));
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
    (key: ColumnKey) => columnWidths[key] ?? 120,
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
