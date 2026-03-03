import { useEffect } from 'react';
import { useAtom, useAtomValue, useAtomSet } from '@effect-atom/atom-react';
import { ActivePane } from '../userselection/userSelection';
import { activePaneAtom } from '../ui/navigation-atom';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { appViewAtom, factsViewStyleAtom, notificationSettingsAtom, toggleNotificationsAtom, showBranchNamesAtom } from '../settings/settings-atom';
import { viewConfigs } from '../ui/view-config';
import EventGroupedChangesView from './facts/EventGroupedChangesView';
import ChronologicalChangesView from './facts/ChronologicalChangesView';
import {
  scrollToEventIdRequestAtom,
  statusMessageAtom,
} from './facts/facts-shared';

// Re-export atoms for backward compat with FactsPaneActions.ts and other consumers
export {
  sublistFocusedAtom,
  sublistIndexAtom,
  highlightedIndexAtom,
  currentEventChangesAtom,
  chronologicalChangesAtom,
  scrollToEventIdRequestAtom,
  statusMessageAtom,
  groupedEventsAtom,
  selectMrForChangeAtom,
  displayEventsAtom,
} from './facts/facts-shared';
export type { EventGroup } from './facts/facts-shared';

export default function FactsPane() {
  const [, setActivePane] = useAtom(activePaneAtom);
  const statusMessage = useAtomValue(statusMessageAtom);
  const { scrollBoxRef, scrollToId } = useAutoScroll({ lookahead: 2 });
  const [scrollToEventIdRequest, setScrollToEventIdRequest] = useAtom(scrollToEventIdRequestAtom);
  const [appView, setAppView] = useAtom(appViewAtom);
  const [factsViewStyle, setFactsViewStyle] = useAtom(factsViewStyleAtom);
  const notificationSettings = useAtomValue(notificationSettingsAtom);
  const toggleNotifications = useAtomSet(toggleNotificationsAtom, { mode: 'promiseExit' });
  const [showBranchNames, setShowBranchNames] = useAtom(showBranchNamesAtom);

  useEffect(() => {
    if (scrollToEventIdRequest) {
      scrollToId(scrollToEventIdRequest);
      setScrollToEventIdRequest(null);
    }
  }, [scrollToEventIdRequest, scrollToId, setScrollToEventIdRequest]);

  const reviewColor = appView === 'review' ? viewConfigs.review.modeIndicator.labelColor : '#6272a4';
  const focusColor = appView === 'focus' ? viewConfigs.focus.modeIndicator.labelColor : '#6272a4';

  const notifColor = notificationSettings.enabled ? '#f1fa8c' : '#6272a4';
  const chronoColor = factsViewStyle === 'chronological' ? '#f1fa8c' : '#6272a4';
  const eventsColor = factsViewStyle === 'grouped' ? '#f1fa8c' : '#6272a4';
  const branchColor = showBranchNames ? '#f1fa8c' : '#6272a4';
  const titleColor = showBranchNames ? '#6272a4' : '#f1fa8c';

  const modeIndicatorBox = () => (
    <box key="mode-indicator" width="100%" height={5} flexDirection="column">
      <box height={1} flexDirection="row"
           onMouseDown={() => setAppView(appView === 'review' ? 'focus' : 'review')}>
        <text fg="#44475a" wrapMode="none">{' [v] '}</text>
        <text fg={reviewColor} wrapMode="none">{'review'}</text>
        <text fg="#44475a" wrapMode="none">{' / '}</text>
        <text fg={focusColor} wrapMode="none">{'focus'}</text>
      </box>
      <box height={1} flexDirection="row"
           onMouseDown={() => setFactsViewStyle(factsViewStyle === 'grouped' ? 'chronological' : 'grouped')}>
        <text fg="#44475a" wrapMode="none">{' [c] '}</text>
        <text fg={chronoColor} wrapMode="none">{'chronological'}</text>
        <text fg="#44475a" wrapMode="none">{' / '}</text>
        <text fg={eventsColor} wrapMode="none">{'events'}</text>
      </box>
      <box height={1} flexDirection="row"
           onMouseDown={() => toggleNotifications()}>
        <text fg="#44475a" wrapMode="none">{' [n] '}</text>
        <text fg={notifColor} wrapMode="none">{notificationSettings.enabled ? 'notifications' : 'notifications off'}</text>
      </box>
      <box height={1} flexDirection="row"
           onMouseDown={() => setShowBranchNames(!showBranchNames)}>
        <text fg="#44475a" wrapMode="none">{' [B] '}</text>
        <text fg={titleColor} wrapMode="none">{'title'}</text>
        <text fg="#44475a" wrapMode="none">{' / '}</text>
        <text fg={branchColor} wrapMode="none">{'branch'}</text>
      </box>
    </box>
  );

  return (
    <box
      flexDirection="column"
      height="100%"
      width="100%"
      onMouseDown={() => setActivePane(ActivePane.Facts)}
    >
      {modeIndicatorBox()}
      {statusMessage && (
        <box height={1} width="100%" flexDirection="row">
          <text fg="#ffb86c" wrapMode="word">{statusMessage}</text>
        </box>
      )}
      <scrollbox
        ref={scrollBoxRef}
        style={{
          flexGrow: 1,
          contentOptions: {
            backgroundColor: '#282a36',
          },
          viewportOptions: {
            backgroundColor: '#282a36',
          },
          scrollbarOptions: {
            width: 1,
            trackOptions: {
              foregroundColor: '#bd93f9',
              backgroundColor: '#1e1f29',
            },
          },
        }}
      >
        {factsViewStyle === 'chronological' ? <ChronologicalChangesView /> : <EventGroupedChangesView />}
      </scrollbox>
    </box>
  );
}
