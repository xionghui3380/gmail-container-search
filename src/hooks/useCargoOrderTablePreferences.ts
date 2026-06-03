"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CARGO_ORDER_COLUMN_ORDER_STORAGE_KEY,
  CARGO_ORDER_COLUMN_WIDTH_STORAGE_KEY,
  CARGO_ORDER_COLUMNS,
  getDefaultCargoOrderColumnOrder,
  getDefaultCargoOrderColumnWidths,
  type CargoOrderColumnKey,
} from "@/lib/cargo-order-columns";

const MIN_WIDTH = 80;
const MAX_WIDTH = 500;

export function useCargoOrderTablePreferences() {
  const [columnOrder, setColumnOrder] = useState<CargoOrderColumnKey[]>(
    getDefaultCargoOrderColumnOrder,
  );
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(
    getDefaultCargoOrderColumnWidths,
  );
  const [draggingColumn, setDraggingColumn] = useState<CargoOrderColumnKey | null>(null);
  const [resizing, setResizing] = useState<{
    key: CargoOrderColumnKey;
    startX: number;
    startWidth: number;
  } | null>(null);

  useEffect(() => {
    try {
      const savedOrder = localStorage.getItem(CARGO_ORDER_COLUMN_ORDER_STORAGE_KEY);
      if (savedOrder) {
        const parsed = JSON.parse(savedOrder) as CargoOrderColumnKey[];
        const valid = parsed.filter((key) => CARGO_ORDER_COLUMNS.some((col) => col.key === key));
        if (valid.length === CARGO_ORDER_COLUMNS.length) setColumnOrder(valid);
      }
      const savedWidths = localStorage.getItem(CARGO_ORDER_COLUMN_WIDTH_STORAGE_KEY);
      if (savedWidths) {
        setColumnWidths({ ...getDefaultCargoOrderColumnWidths(), ...JSON.parse(savedWidths) });
      }
    } catch {
      // ignore
    }
  }, []);

  const visibleColumns = columnOrder
    .map((key) => CARGO_ORDER_COLUMNS.find((col) => col.key === key))
    .filter(Boolean) as typeof CARGO_ORDER_COLUMNS;

  const persistOrder = useCallback((order: CargoOrderColumnKey[]) => {
    setColumnOrder(order);
    localStorage.setItem(CARGO_ORDER_COLUMN_ORDER_STORAGE_KEY, JSON.stringify(order));
  }, []);

  const handleColumnDrop = useCallback(
    (targetKey: CargoOrderColumnKey) => {
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
    (key: CargoOrderColumnKey, clientX: number) => {
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
        localStorage.setItem(CARGO_ORDER_COLUMN_WIDTH_STORAGE_KEY, JSON.stringify(prev));
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
    (key: CargoOrderColumnKey) => columnWidths[key] ?? 120,
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
