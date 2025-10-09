import type { ParsedKey } from '@opentui/core';
import type { Event } from '../components/ActivityLog';
import type { MergeRequest } from '../components/MergeRequestPane';
import { openUrl } from '../utils/url';
import { copyToClipboard } from '../utils/clipboard';
import { loadJobLog } from '../pipelinejob-log';

interface ActivityKeyHandlerParams {
  key: ParsedKey;
  activityEvents: Event[];
  selectedActivityIndex: number;
  setSelectedActivityIndex: (index: number) => void;
  selectedMergeRequest: MergeRequest | undefined;
}

export const handleActivityKeys = ({
  key,
  activityEvents,
  selectedActivityIndex,
  setSelectedActivityIndex,
  selectedMergeRequest
}: ActivityKeyHandlerParams): boolean => {
  if (activityEvents.length === 0) return false;

  switch (key.name) {
    case 'j':
    case 'down':
      setSelectedActivityIndex(Math.min(selectedActivityIndex + 1, activityEvents.length - 1));
      return true;
    case 'k':
    case 'up':
      setSelectedActivityIndex(Math.max(selectedActivityIndex - 1, 0));
      return true;
    case 'i':
    case 'return':
      const selectedEvent = activityEvents[selectedActivityIndex];
      if (selectedEvent && selectedMergeRequest) {
        if (selectedEvent.type === 'pipeline' && selectedEvent.actionData?.job) {
          loadJobLog(selectedMergeRequest, selectedEvent.actionData.job);
        } else if (selectedEvent.actionData?.url) {
          openUrl(selectedEvent.actionData.url);
        }
      }
      return true;
    case 'c':
      const event = activityEvents[selectedActivityIndex];
      if (event?.actionData?.url) {
        copyToClipboard(event.actionData.url);
      }
      return true;
    default:
      return false;
  }
};
