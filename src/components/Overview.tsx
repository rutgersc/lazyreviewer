import { TextAttributes } from '@opentui/core';
import { useRef, useEffect } from 'react';
import MergeRequestInfo from './MergeRequestInfo';
import { Colors } from '../colors';
import type { MergeRequest } from '../mergerequests/mergerequest-schema';
import { useAtom, Atom } from '@effect-atom/atom-react';
import { useDiscussionScroll } from '../hooks/useDiscussionScroll';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { overviewCursorIndexAtom, unresolvedExpandedAtom, resolvedExpandedAtom, scrollToDiscussionRequestAtom, buildSelectableItems, findCursorForItem } from './overview-selection';

// Atoms for overview pane state
export const copyNotificationAtom = Atom.make<string | null>(null);

interface OverviewProps {
  selectedMergeRequest: MergeRequest | undefined;
}

export default function Overview({
  selectedMergeRequest,
}: OverviewProps) {
  const [, setOverviewCursorIndex] = useAtom(overviewCursorIndexAtom);
  const [, setUnresolvedExpanded] = useAtom(unresolvedExpandedAtom);
  const [, setResolvedExpanded] = useAtom(resolvedExpandedAtom);
  const [copyNotification] = useAtom(copyNotificationAtom);
  const [scrollToDiscussionRequest, setScrollToDiscussionRequest] = useAtom(scrollToDiscussionRequestAtom);
  const { scrollBoxRef, scrollToId } = useAutoScroll({ lookahead: 2 });

  // Reset state when the selected MR changes
  const prevMrIdRef = useRef(selectedMergeRequest?.id);
  if (prevMrIdRef.current !== selectedMergeRequest?.id) {
    prevMrIdRef.current = selectedMergeRequest?.id;
    setResolvedExpanded(selectedMergeRequest?.state === 'merged');
    setUnresolvedExpanded(true);
    setOverviewCursorIndex(0);
  }

  // Handle scroll requests from actions and MergeRequestInfo clicks
  useEffect(() => {
    if (scrollToDiscussionRequest !== null) {
      scrollToId(scrollToDiscussionRequest);
      setScrollToDiscussionRequest(null);
    }
  }, [scrollToDiscussionRequest, scrollToId, setScrollToDiscussionRequest]);

  const discussions = selectedMergeRequest?.discussions ?? [];
  const unresolvedDiscussions = discussions.filter(d => d.resolvable && !d.resolved);
  const resolvedDiscussions = discussions.filter(d => d.resolvable && d.resolved);

  // Store current values in refs for the scroll handler to access
  const unresolvedDiscussionsRef = useRef(unresolvedDiscussions);
  unresolvedDiscussionsRef.current = unresolvedDiscussions;
  const resolvedDiscussionsRef = useRef(resolvedDiscussions);
  resolvedDiscussionsRef.current = resolvedDiscussions;
  const unresolvedExpandedRef = useRef(false);
  const resolvedExpandedRef = useRef(false);
  // Keep refs in sync via reading atoms is not possible here; use effect-free pattern
  // These refs are only used by the scroll handler registered once below
  const scrollToIdRef = useRef(scrollToId);
  scrollToIdRef.current = scrollToId;
  const setOverviewCursorIndexRef = useRef(setOverviewCursorIndex);
  setOverviewCursorIndexRef.current = setOverviewCursorIndex;
  const setUnresolvedExpandedRef = useRef(setUnresolvedExpanded);
  setUnresolvedExpandedRef.current = setUnresolvedExpanded;
  const setResolvedExpandedRef = useRef(setResolvedExpanded);
  setResolvedExpandedRef.current = setResolvedExpanded;

  // Register scroll handler once - uses refs to access current values
  // Returns true if discussion was found and scrolled to, false otherwise
  const { registerHandler } = useDiscussionScroll();
  const handlerRegistered = useRef(false);
  if (!handlerRegistered.current) {
    handlerRegistered.current = true;
    registerHandler(({ noteId }) => {
      const unresolved = unresolvedDiscussionsRef.current;
      const resolved = resolvedDiscussionsRef.current;

      // First check unresolved discussions
      const unresolvedIndex = unresolved.findIndex(discussion =>
        discussion.notes.some(note => note.id === noteId)
      );
      if (unresolvedIndex >= 0) {
        setUnresolvedExpandedRef.current(true);
        const items = buildSelectableItems(unresolved.length, resolved.length, true, resolvedExpandedRef.current);
        const cursor = findCursorForItem(items, { type: 'unresolved-discussion', index: unresolvedIndex });
        setOverviewCursorIndexRef.current(cursor >= 0 ? cursor : 0);
        requestAnimationFrame(() => {
          scrollToIdRef.current(`discussion-${unresolvedIndex}`);
        });
        return true;
      }

      // Then check resolved discussions
      const resolvedIndex = resolved.findIndex(discussion =>
        discussion.notes.some(note => note.id === noteId)
      );
      if (resolvedIndex >= 0) {
        setResolvedExpandedRef.current(true);
        const items = buildSelectableItems(unresolved.length, resolved.length, unresolvedExpandedRef.current, true);
        const cursor = findCursorForItem(items, { type: 'resolved-discussion', index: resolvedIndex });
        setOverviewCursorIndexRef.current(cursor >= 0 ? cursor : 0);
        requestAnimationFrame(() => {
          scrollToIdRef.current(`resolved-discussion-${resolvedIndex}`);
        });
        return true;
      }

      return false;
    });
  }

  const content = (() => {
    if (selectedMergeRequest) {
      return <MergeRequestInfo />;
    }

    return (
      <box style={{ flexDirection: "column", gap: 1, justifyContent: "flex-start", alignItems: "flex-start", flexGrow: 1 }}>
        <text style={{ fg: Colors.SECONDARY, attributes: TextAttributes.DIM }} wrapMode='none'>
          No selection
        </text>
      </box>
    );
  })();

  return (
    <box style={{ flexDirection: "column", position: "relative", flexGrow: 1 }}>
      <scrollbox
        ref={scrollBoxRef}
        style={{
          flexGrow: 1,
          width: "100%",
          contentOptions: { backgroundColor: Colors.BACKGROUND },
          scrollbarOptions: {
            trackOptions: { foregroundColor: Colors.NEUTRAL, backgroundColor: Colors.TRACK },
          },
        }}
      >
        {content}
      </scrollbox>
      {copyNotification && (
        <box
          style={{
            position: "absolute",
            top: 3,
            right: 3,
            padding: 1,
            border: true,
            borderColor: Colors.SUCCESS,
            backgroundColor: Colors.BACKGROUND,
            zIndex: 1000,
          }}
        >
          <text
            style={{ fg: Colors.SUCCESS, attributes: TextAttributes.BOLD }}
            wrapMode='none'
          >
            {copyNotification}
          </text>
        </box>
      )}
    </box>
  );
}
