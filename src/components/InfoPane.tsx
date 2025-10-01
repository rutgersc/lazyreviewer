import { TextAttributes } from '@opentui/core';
import { useRef, useEffect } from 'react';
import JiraIssueInfo from './JiraIssueInfo';
import MergeRequestInfo from './MergeRequestInfo';
import UserSelectionInfo from './UserSelectionInfo';
import { useAppStore } from '../store/appStore';
import { ActivePane } from '../types/userSelection';

interface InfoPaneProps {
  // No props needed - everything comes from store!
}

export default function InfoPane({}: InfoPaneProps) {
  const { selectedDetailItem, activePane, infoPaneScrollOffset } = useAppStore();
  const scrollBoxRef = useRef<any>(null);

  const selectedMergeRequest = useAppStore(state => state.mergeRequests[state.selectedMergeRequest]);
  const selectedUserSelectionEntry = useAppStore(state => state.userSelections[state.selectedUserSelectionEntry]);

  // Sync scroll position when offset changes
  useEffect(() => {
    if (scrollBoxRef.current && typeof scrollBoxRef.current.scrollTo === 'function') {
      scrollBoxRef.current.scrollTo(infoPaneScrollOffset);
    }
  }, [infoPaneScrollOffset]);

  const renderEmptyState = () => {
    return (
      <box style={{ flexDirection: "column", gap: 1, justifyContent: "flex-start", alignItems: "flex-start", flexGrow: 1 }}>
        <text style={{ fg: '#bd93f9', attributes: TextAttributes.DIM }} wrap={false}>
          No selection
        </text>
      </box>
    );
  };

  return (
    <box style={{ flexDirection: "column", padding: 2, flexGrow: 1, alignItems: "flex-start", height: "100%" }}>
      <text style={{ fg: '#f8f8f2', marginBottom: 2, attributes: TextAttributes.BOLD }} wrap={false}>
        Information
      </text>

      <scrollbox
        ref={scrollBoxRef}
        style={{
          flexGrow: 1,
          width: "100%",
          contentOptions: {
            backgroundColor: '#282a36',
          },
          scrollbarOptions: {
            trackOptions: {
              foregroundColor: '#bd93f9',
              backgroundColor: '#44475a',
            },
          },
        }}
        focused={false}
      >
        {selectedDetailItem?.type === 'jira'
          ? <JiraIssueInfo issue={selectedDetailItem.issue} />
          : (activePane === ActivePane.MergeRequests || activePane === ActivePane.MergeRequestDetails) && selectedMergeRequest
            ? <MergeRequestInfo mergeRequest={selectedMergeRequest} />
            : (activePane === ActivePane.UserSelection && selectedUserSelectionEntry)
              ? <UserSelectionInfo userSelection={selectedUserSelectionEntry} />
              : renderEmptyState()}
      </scrollbox>
    </box>
  );
}