import { useRef, useCallback } from 'react';

export function useCellRefs<T extends string>() {
  const cellRefs = useRef<Map<string, HTMLElement>>(new Map());
  const refCallbacks = useRef<Map<string, (el: HTMLElement | null) => void>>(new Map());

  const setCellRef = useCallback((rowId: string, col: T) => {
    const key = `${rowId}-${col}`;
    if (!refCallbacks.current.has(key)) {
      refCallbacks.current.set(key, (el: HTMLElement | null) => {
        if (el) cellRefs.current.set(key, el);
        else cellRefs.current.delete(key);
      });
    }
    return refCallbacks.current.get(key)!;
  }, []);

  const getCellRef = useCallback((rowId: string, col: T) => {
    return cellRefs.current.get(`${rowId}-${col}`);
  }, []);

  return { setCellRef, getCellRef };
}
