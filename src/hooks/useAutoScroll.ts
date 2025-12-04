import { useRef, type RefObject } from 'react';
import { ScrollBoxRenderable, Renderable } from '@opentui/core';

interface UseAutoScrollOptions {
  lookahead?: number;
}

export function useAutoScroll(
  { lookahead = 2 }: UseAutoScrollOptions = {},
  providedRef?: RefObject<ScrollBoxRenderable | null>
) {
  const internalRef = useRef<ScrollBoxRenderable | null>(null);
  const scrollBoxRef = providedRef || internalRef;

  const calculateScroll = (itemTop: number, itemHeight: number, scrollBox: ScrollBoxRenderable) => {
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
       if (itemHeight > viewportHeight) {
           scrollBox.scrollTo(itemTop - lookahead);
       } else {
           const newScrollTop = itemTop + itemHeight - viewportHeight + lookahead;
           scrollBox.scrollTo(newScrollTop);
       }
    }
  };

  const scrollToItem = (index: number) => {
    if (!scrollBoxRef.current) return;

    const scrollBox = scrollBoxRef.current;
    const children = scrollBox.content.getChildren();
    const targetChild = children[index];

    if (!targetChild) return;

    const itemLayout = targetChild.getLayoutNode().getComputedLayout();
    calculateScroll(itemLayout.top, itemLayout.height, scrollBox);
  };

  const scrollToId = (id: string) => {
    if (!scrollBoxRef.current) return;
    const scrollBox = scrollBoxRef.current;

    const target = scrollBox.content.findDescendantById(id);
    if (!target) return;

    let current = target as Renderable;
    let accumulatedTop = 0;

    while (current && current !== scrollBox.content) {
        const layout = current.getLayoutNode().getComputedLayout();
        accumulatedTop += layout.top;
        // @ts-ignore
        current = current.parent as Renderable;
    }

    if (current !== scrollBox.content) return;

    const itemHeight = (target as Renderable).getLayoutNode().getComputedLayout().height;
    calculateScroll(accumulatedTop, itemHeight, scrollBox);
  };

  return {
    scrollBoxRef,
    scrollToItem,
    scrollToId
  };
}
