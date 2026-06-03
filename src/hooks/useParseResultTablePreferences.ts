"use client";

import { useCallback, useEffect, useState } from "react";
import {
  PARSE_RESULT_COLUMN_ORDER_STORAGE_KEY,
  PARSE_RESULT_COLUMN_WIDTH_STORAGE_KEY,
  PARSE_RESULT_COLUMNS,
  getDefaultParseResultColumnOrder,
  getDefaultParseResultColumnWidths,
  type ParseResultColumnKey,
} from "@/lib/parse-result-columns";

const MIN_WIDTH = 80;
const MAX_WIDTH = 500;

export function useParseResultTablePreferences() {
  const [columnOrder, setColumnOrder] = useState<ParseResultColumnKey[]>(
    getDefaultParseResultColumnOrder,
  );
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(
    getDefaultParseResultColumnWidths,
  );
  const [draggingColumn, setDraggingColumn] = useState<ParseResultColumnKey | null>(null);
  const [resizing, setResizing] = useState<{
    key: ParseResultColumnKey;
    startX: number;
    startWidth: number;
  } | null>(null);

  useEffect(() => {
    try {
      const savedOrder = localStorage.getItem(PARSE_RESULT_COLUMN_ORDER_STORAGE_KEY);
      if (savedOrder) {
        const parsed = JSON.parse(savedOrder) as ParseResultColumnKey[];
        const valid = parsed.filter((key) =>
          PARSE_RESULT_COLUMNS.some((col) => col.key === key),
        );
        if (valid.length === PARSE_RESULT_COLUMNS.length) setColumnOrder(valid);
      }
      const savedWidths = localStorage.getItem(PARSE_RESULT_COLUMN_WIDTH_STORAGE_KEY);
      if (savedWidths) {
        setColumnWidths({ ...getDefaultParseResultColumnWidths(), ...JSON.parse(savedWidths) });
      }
    } catch {
      // ignore
    }
  }, []);

  const visibleColumns = columnOrder
    .map((key) => PARSE_RESULT_COLUMNS.find((col) => col.key === key))
    .filter(Boolean) as typeof PARSE_RESULT_COLUMNS;

  const persistOrder = useCallback((order: ParseResultColumnKey[]) => {
    setColumnOrder(order);
    localStorage.setItem(PARSE_RESULT_COLUMN_ORDER_STORAGE_KEY, JSON.stringify(order));
  }, []);

  const handleColumnDrop = useCallback(
    (targetKey: ParseResultColumnKey) => {
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
    (key: ParseResultColumnKey, clientX: number) => {
      setResizing({ key, startX: clientX, startWidth: columnWidths[key] ?? 120 });
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
        localStorage.setItem(PARSE_RESULT_COLUMN_WIDTH_STORAGE_KEY, JSON.stringify(prev));
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
    (key: ParseResultColumnKey) => columnWidths[key] ?? 120,
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
