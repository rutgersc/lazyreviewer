import { TextAttributes } from '@opentui/core';
import { useRef, useEffect, useState, useCallback } from 'react';
import MergeRequestInfo from './MergeRequestInfo';
import UserSelectionInfo from './UserSelectionInfo';
import { ActivePane } from '../userselection/userSelection';
import { Colors } from '../colors';
import type { MergeRequest } from '../mergerequests/mergerequest-schema';
import { useAtom, useAtomValue, Atom } from '@effect-atom/atom-react';
import { selectedDiscussionIndexAtom } from '../mergerequests/mergerequests-atom';
import { useDiscussionScroll } from '../hooks/useDiscussionScroll';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { openUrl } from '../system/open-url';
import { selectedUserSelectionEntryAtom } from '../userselection/userselection-atom';

// Atoms for overview pane state
export const copyNotificationAtom = Atom.make<string | null>(null);
export const scrollToDiscussionRequestAtom = Atom.make<number | null>(null);

interface OverviewProps {
  activePane: ActivePane;
  selectedMergeRequest: MergeRequest | undefined;
}

export default function Overview({
  activePane,
  selectedMergeRequest,
}: OverviewProps) {
  const [selectedDiscussionIndex, setSelectedDiscussionIndex] = useAtom(selectedDiscussionIndexAtom);
  const [copyNotification, setCopyNotification] = useAtom(copyNotificationAtom);
  const [scrollToDiscussionRequest, setScrollToDiscussionRequest] = useAtom(scrollToDiscussionRequestAtom);
  const { scrollBoxRef, scrollToId } = useAutoScroll({ lookahead: 2 });
  const selectedUserSelectionEntry = useAtomValue(selectedUserSelectionEntryAtom);

  const isMerged = selectedMergeRequest?.state === 'merged';
  const [resolvedExpanded, setResolvedExpanded] = useState(isMerged ?? false);
  const handleToggleResolvedExpanded = useCallback(() => setResolvedExpanded(prev => !prev), []);

  // Reset resolved expanded state when the selected MR changes
  const prevMrIdRef = useRef(selectedMergeRequest?.id);
  if (prevMrIdRef.current !== selectedMergeRequest?.id) {
    prevMrIdRef.current = selectedMergeRequest?.id;
    setResolvedExpanded(selectedMergeRequest?.state === 'merged');
  }

  const handleSelectDiscussion = (index: number) => {
      setSelectedDiscussionIndex(index);
      scrollToId(`discussion-${index}`);
  };

  // Handle scroll requests from actions
  useEffect(() => {
    if (scrollToDiscussionRequest !== null) {
      scrollToId(`discussion-${scrollToDiscussionRequest}`);
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
  const scrollToIdRef = useRef(scrollToId);
  scrollToIdRef.current = scrollToId;
  const setSelectedDiscussionIndexRef = useRef(setSelectedDiscussionIndex);
  setSelectedDiscussionIndexRef.current = setSelectedDiscussionIndex;
  const setResolvedExpandedRef = useRef(setResolvedExpanded);
  setResolvedExpandedRef.current = setResolvedExpanded;

  // Register scroll handler once - uses refs to access current values
  // Returns true if discussion was found and scrolled to, false otherwise
  const { registerHandler } = useDiscussionScroll();
  const handlerRegistered = useRef(false);
  if (!handlerRegistered.current) {
    handlerRegistered.current = true;
    registerHandler(({ noteId }) => {
      // First check unresolved discussions
      const unresolved = unresolvedDiscussionsRef.current;
      const unresolvedIndex = unresolved.findIndex(discussion =>
        discussion.notes.some(note => note.id === noteId)
      );
      if (unresolvedIndex >= 0) {
        setSelectedDiscussionIndexRef.current(unresolvedIndex);
        scrollToIdRef.current(`discussion-${unresolvedIndex}`);
        return true;
      }

      // Then check resolved discussions
      const resolved = resolvedDiscussionsRef.current;
      const resolvedIndex = resolved.findIndex(discussion =>
        discussion.notes.some(note => note.id === noteId)
      );
      if (resolvedIndex >= 0) {
        setResolvedExpandedRef.current(true);
        // Schedule scroll after expansion renders
        requestAnimationFrame(() => {
          scrollToIdRef.current(`resolved-discussion-${resolvedIndex}`);
        });
        return true;
      }

      return false;
    });
  }

  const handleOpenDiscussion = (index: number) => {
      const discussion = unresolvedDiscussions[index];
      if (discussion && selectedMergeRequest?.webUrl) {
          const discussionUrl = `${selectedMergeRequest.webUrl}#note_${discussion.id}`;
          openUrl(discussionUrl);
      }
  };

  const content = (() => {
    // Always show MR info when there's a selected MR
    if (selectedMergeRequest) {
      return <MergeRequestInfo
          mergeRequest={selectedMergeRequest}
          selectedDiscussionIndex={selectedDiscussionIndex}
          onSelectDiscussion={handleSelectDiscussion}
          onOpenDiscussion={handleOpenDiscussion}
          resolvedExpanded={resolvedExpanded}
          onToggleResolvedExpanded={handleToggleResolvedExpanded}
      />;
    }

    if (activePane === ActivePane.UserSelection && selectedUserSelectionEntry) {
      return <UserSelectionInfo userSelection={selectedUserSelectionEntry} />;
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
          contentOptions: { backgroundColor: '#282a36' },
          scrollbarOptions: {
            trackOptions: { foregroundColor: '#bd93f9', backgroundColor: '#44475a' },
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
