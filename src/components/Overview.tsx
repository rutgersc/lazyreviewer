import { TextAttributes } from '@opentui/core';
import MergeRequestInfo from './MergeRequestInfo';
import UserSelectionInfo from './UserSelectionInfo';
import { ActivePane } from '../types/userSelection';
import { Colors } from '../constants/colors';
import type { MergeRequest } from './MergeRequestPane';
import type { UserSelectionEntry } from '../types/userSelection';

interface OverviewProps {
  activePane: ActivePane;
  selectedMergeRequest: MergeRequest | undefined;
  selectedUserSelectionEntry: UserSelectionEntry | undefined;
  selectedDiscussionIndex: number;
}

export default function Overview({
  activePane,
  selectedMergeRequest,
  selectedUserSelectionEntry,
  selectedDiscussionIndex
}: OverviewProps) {
  if ((activePane === ActivePane.MergeRequests || activePane === ActivePane.InfoPane) && selectedMergeRequest) {
    return <MergeRequestInfo mergeRequest={selectedMergeRequest} selectedDiscussionIndex={selectedDiscussionIndex} />;
  }

  if (activePane === ActivePane.UserSelection && selectedUserSelectionEntry) {
    return <UserSelectionInfo userSelection={selectedUserSelectionEntry} />;
  }

  return (
    <box style={{ flexDirection: "column", gap: 1, justifyContent: "flex-start", alignItems: "flex-start", flexGrow: 1 }}>
      <text style={{ fg: Colors.SECONDARY, attributes: TextAttributes.DIM }} wrap={false}>
        No selection
      </text>
    </box>
  );
}
