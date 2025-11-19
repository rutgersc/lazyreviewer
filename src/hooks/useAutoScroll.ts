import { useRef } from 'react';
import { ScrollBoxRenderable } from '@opentui/core';

interface UseAutoScrollOptions {
  lookahead?: number;
}

export function useAutoScroll({ lookahead = 2 }: UseAutoScrollOptions = {}) {
  const scrollBoxRef = useRef<ScrollBoxRenderable | null>(null);

  const scrollToItem = (index: number) => {
    if (!scrollBoxRef.current) return;

    const scrollBox = scrollBoxRef.current;
    const children = scrollBox.content.getChildren();
    const targetChild = children[index];

    if (!targetChild) return;

    // Use computed layout for accuracy
    const itemLayout = targetChild.getLayoutNode().getComputedLayout();
    const itemTop = itemLayout.top;
    const itemHeight = itemLayout.height;

    const viewportLayout = scrollBox.viewport.getLayoutNode().getComputedLayout();
    const viewportHeight = viewportLayout.height;
    const currentScrollTop = scrollBox.scrollTop;

    const viewportTop = currentScrollTop;
    const viewportBottom = currentScrollTop + viewportHeight;

    // Check if we need to scroll up
    if (itemTop < viewportTop + lookahead) {
      const newScrollTop = Math.max(0, itemTop - lookahead);
      scrollBox.scrollTo(newScrollTop);
      return;
    }

    // Check if we need to scroll down
    if (itemTop + itemHeight > viewportBottom - lookahead) {
      const newScrollTop = itemTop + itemHeight - viewportHeight + lookahead;
      scrollBox.scrollTo(newScrollTop);
    }
  };

  return {
    scrollBoxRef,
    scrollToItem
  };
}
