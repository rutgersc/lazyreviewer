import { useRef, useCallback } from 'react';

interface UseDoubleClickOptions<T> {
  onSingleClick?: (item: T) => void;
  onDoubleClick?: (item: T) => void;
  latency?: number;
}

export function useDoubleClick<T>({ onSingleClick, onDoubleClick, latency = 300 }: UseDoubleClickOptions<T>) {
  const lastClickRef = useRef<{ item: T; time: number } | null>(null);
  const onSingleClickRef = useRef(onSingleClick);
  const onDoubleClickRef = useRef(onDoubleClick);

  onSingleClickRef.current = onSingleClick;
  onDoubleClickRef.current = onDoubleClick;

  const handleClick = useCallback((item: T) => {
    const now = Date.now();
    const lastClick = lastClickRef.current;

    if (lastClick && lastClick.item === item && (now - lastClick.time) < latency) {
      onDoubleClickRef.current?.(item);
      lastClickRef.current = null;
    } else {
      lastClickRef.current = { item, time: now };
      onSingleClickRef.current?.(item);
    }
  }, [latency]);

  return handleClick;
}

