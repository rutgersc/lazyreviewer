import { useRef } from 'react';
import { ScrollBoxRenderable } from '@opentui/core';

interface UseAutoScrollOptions {
  itemHeight: number;
  lookahead?: number;
}

export function useAutoScroll({ itemHeight, lookahead = 3 }: UseAutoScrollOptions) {
  const scrollBoxRef = useRef<ScrollBoxRenderable | null>(null);

  const scrollToItem = (index: number) => {
    if (!scrollBoxRef.current) return;

    const targetY = index * itemHeight;

    // Get current viewport info
    const viewportHeight = scrollBoxRef.current.viewport?.height || 10;
    const currentScrollTop = scrollBoxRef.current.scrollTop || 0;

    // Calculate viewport boundaries
    const viewportTop = currentScrollTop;
    const viewportBottom = currentScrollTop + viewportHeight;

    // Calculate lookahead boundaries (scroll before reaching edge)
    const lookaheadDistance = lookahead * itemHeight;
    const itemTop = targetY;
    const itemBottom = targetY + itemHeight;

    // Check if we need to scroll up (when item + lookahead would be above viewport)
    const upScrollThreshold = viewportTop + lookaheadDistance;
    if (itemTop < upScrollThreshold) {
      // Scroll up to keep the item + lookahead visible
      const newScrollTop = Math.max(0, itemTop - lookaheadDistance);
      scrollBoxRef.current.scrollTo(newScrollTop);
      return;
    }

    // Check if we need to scroll down (when item + lookahead would be below viewport)
    const downScrollThreshold = viewportBottom - lookaheadDistance;
    if (itemBottom > downScrollThreshold) {
      // Scroll down to keep the item + lookahead visible
      const newScrollTop = itemBottom + lookaheadDistance - viewportHeight;
      scrollBoxRef.current.scrollTo(newScrollTop);
    }
  };

  return {
    scrollBoxRef,
    scrollToItem
  };
}