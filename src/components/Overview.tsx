import { TextAttributes, type ParsedKey } from '@opentui/core';
import { useKeyboard } from '@opentui/react';
import { useState } from 'react';
import MergeRequestInfo from './MergeRequestInfo';
import UserSelectionInfo from './UserSelectionInfo';
import { ActivePane } from '../userselection/userSelection';
import { Colors } from '../colors';
import type { MergeRequest } from '../mergerequests/mergeRequestSchema';
import type { UserSelectionEntry } from '../userselection/userSelection';
import { copyToClipboard } from '../system/clipboard-effect';
import { formatDiscussionsForClipboard } from '../gitlab/display/gitlabDiscussionFormatter';
import { useAtom, useAtomValue } from '@effect-atom/atom-react';
import { infoPaneTabAtom, selectedDiscussionIndexAtom, activeModalAtom } from '../store/appAtoms';

interface OverviewProps {
  activePane: ActivePane;
  selectedMergeRequest: MergeRequest | undefined;
  selectedUserSelectionEntry: UserSelectionEntry | undefined;
}

export default function Overview({
  activePane,
  selectedMergeRequest,
  selectedUserSelectionEntry
}: OverviewProps) {
  const infoPaneTab = useAtomValue(infoPaneTabAtom);
  const activeModal = useAtomValue(activeModalAtom);
  const [selectedDiscussionIndex, setSelectedDiscussionIndex] = useAtom(selectedDiscussionIndexAtom);
  const [copyNotification, setCopyNotification] = useState<string | null>(null);

  const unresolvedDiscussions = selectedMergeRequest?.discussions.filter(d => d.resolvable && !d.resolved) || [];

  useKeyboard((key: ParsedKey) => {
    if (activePane !== ActivePane.InfoPane || infoPaneTab !== 'overview') return;
    if (activeModal !== 'none') return;
    if (unresolvedDiscussions.length === 0) return;

    switch (key.name) {
      case 'j':
      case 'down':
        setSelectedDiscussionIndex(Math.min(selectedDiscussionIndex + 1, unresolvedDiscussions.length - 1));
        break;
      case 'k':
      case 'up':
        setSelectedDiscussionIndex(Math.max(selectedDiscussionIndex - 1, 0));
        break;
      case 'c':
        const discussion = unresolvedDiscussions[selectedDiscussionIndex];
        if (discussion && selectedMergeRequest?.webUrl) {
          const discussionUrl = `${selectedMergeRequest.webUrl}#note_${discussion.id}`;
          copyToClipboard(discussionUrl);
        }
        break;
      case 'i':
        if (selectedMergeRequest) {
          const formattedDiscussions = formatDiscussionsForClipboard(selectedMergeRequest);
          copyToClipboard(formattedDiscussions).then((success) => {
            if (success) {
              setCopyNotification('Copied discussions!');
              setTimeout(() => setCopyNotification(null), 2000);
            } else {
              setCopyNotification('Copy failed!');
              setTimeout(() => setCopyNotification(null), 2000);
            }
          });
        }
        break;
    }
  });

  const content = (() => {
    if ((activePane === ActivePane.MergeRequests || activePane === ActivePane.InfoPane) && selectedMergeRequest) {
      return <MergeRequestInfo mergeRequest={selectedMergeRequest} selectedDiscussionIndex={selectedDiscussionIndex} />;
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
      {content}
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
