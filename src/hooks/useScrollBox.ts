import { useRef, useEffect } from 'react';
import type { ScrollBoxRenderable } from '@opentui/core';

export type ScrollDirection = 'up' | 'down';
export type ScrollFunction = (direction: ScrollDirection) => void;

interface UseScrollBoxOptions {
  /** Number of lines to scroll per action (default: 3) */
  scrollAmount?: number;
}

// Module-level registry - no React state needed!
const scrollRefs = new Map<string, ScrollFunction>();

/**
 * Hook to register a scrollbox that can be controlled remotely.
 * Returns a ref to attach to the scrollbox element.
 *
 * @param id - Unique identifier for this scrollbox
 * @param options - Configuration options
 *
 * @example
 * const scrollBoxRef = useScrollBox('infoPane', { scrollAmount: 5 });
 * return <scrollbox ref={scrollBoxRef}>...</scrollbox>
 */
export function useScrollBox(
  id: string,
  options: UseScrollBoxOptions = {}
) {
  const { scrollAmount = 3 } = options;
  const scrollBoxRef = useRef<ScrollBoxRenderable>(null);
  const scrollAmountRef = useRef(scrollAmount);
  const currentOffsetRef = useRef(0);

  // Keep scroll amount ref in sync with prop
  scrollAmountRef.current = scrollAmount;

  useEffect(() => {
    const scroll: ScrollFunction = (direction) => {
      if (!scrollBoxRef.current?.scrollTo) return;

      // Track offset ourselves to avoid stale closures
      const amount = scrollAmountRef.current;
      const newOffset = direction === 'down'
        ? currentOffsetRef.current + amount
        : Math.max(0, currentOffsetRef.current - amount);

      currentOffsetRef.current = newOffset;
      scrollBoxRef.current.scrollTo(newOffset);
    };

    // Register on mount
    scrollRefs.set(id, scroll);

    // Unregister on unmount
    return () => {
      scrollRefs.delete(id);
    };
  }, []); // No dependencies! ✨

  return scrollBoxRef;
}

/**
 * Get a registered scroll function by ID.
 * Can be called from anywhere (doesn't need to be in a React component).
 *
 * @param id - The ID of the scrollbox to control
 * @returns The scroll function, or null if not registered
 *
 * @example
 * const scrollInfoPane = getScroller('infoPane');
 * scrollInfoPane?.('down');
 */
export function getScroller(id: string): ScrollFunction | null {
  return scrollRefs.get(id) || null;
}
