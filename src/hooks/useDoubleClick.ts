import { useRef } from 'react';

interface UseDoubleClickOptions<T> {
  onSingleClick?: (item: T) => void;
  onDoubleClick?: (item: T) => void;
  latency?: number;
}

export function useDoubleClick<T>({ onSingleClick, onDoubleClick, latency = 300 }: UseDoubleClickOptions<T>) {
  const lastClickRef = useRef<{ item: T; time: number } | null>(null);

  const handleClick = (item: T) => {
    const now = Date.now();
    const lastClick = lastClickRef.current;

    if (lastClick && lastClick.item === item && (now - lastClick.time) < latency) {
      onDoubleClick?.(item);
      lastClickRef.current = null;
    } else {
      lastClickRef.current = { item, time: now };
      onSingleClick?.(item);
    }
  };

  return handleClick;
}

