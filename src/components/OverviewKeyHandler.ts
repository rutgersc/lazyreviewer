import type { ParsedKey } from '@opentui/core';
import type { Discussion } from '../gitlabgraphql';
import type { MergeRequest } from '../components/MergeRequestPane';
import { copyToClipboard } from '../utils/clipboard';
import { formatDiscussionsForClipboard } from '../utils/discussionFormatter';

interface OverviewKeyHandlerParams {
  key: ParsedKey;
  unresolvedDiscussions: Discussion[];
  selectedDiscussionIndex: number;
  setSelectedDiscussionIndex: (index: number) => void;
  selectedMergeRequest: MergeRequest | undefined;
  setCopyNotification: (message: string | null) => void;
}

export const handleOverviewKeys = ({
  key,
  unresolvedDiscussions,
  selectedDiscussionIndex,
  setSelectedDiscussionIndex,
  selectedMergeRequest,
  setCopyNotification
}: OverviewKeyHandlerParams): boolean => {
  if (unresolvedDiscussions.length === 0) return false;

  switch (key.name) {
    case 'j':
    case 'down':
      setSelectedDiscussionIndex(Math.min(selectedDiscussionIndex + 1, unresolvedDiscussions.length - 1));
      return true;
    case 'k':
    case 'up':
      setSelectedDiscussionIndex(Math.max(selectedDiscussionIndex - 1, 0));
      return true;
    case 'c':
      const discussion = unresolvedDiscussions[selectedDiscussionIndex];
      if (discussion && selectedMergeRequest?.webUrl) {
        const discussionUrl = `${selectedMergeRequest.webUrl}#note_${discussion.id}`;
        copyToClipboard(discussionUrl);
      }
      return true;
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
      return true;
    default:
      return false;
  }
};
