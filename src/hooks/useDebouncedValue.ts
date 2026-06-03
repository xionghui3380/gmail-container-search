/**
 * 防抖 Hook
 *
 * 当用户在搜索框中快速输入时，避免每次按键都发起 API 请求。
 * 等用户停止输入 delay 毫秒后，才更新返回值。
 *
 * 使用场景：搜索框输入 → 防抖 300ms → 触发 API 查询
 *
 * @example
 * const debouncedSearch = useDebouncedValue(searchText, 300);
 * useEffect(() => { loadRows(); }, [debouncedSearch]);
 */
import { useEffect, useState } from "react";

export function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
