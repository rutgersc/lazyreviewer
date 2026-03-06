import { useEffect } from 'react';
import { useAtom, useAtomValue, useAtomSet } from '@effect-atom/atom-react';
import { ActivePane } from '../userselection/userSelection';
import { activePaneAtom } from '../ui/navigation-atom';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { appViewAtom, factsViewStyleAtom, notificationSettingsAtom, toggleNotificationsAtom, showBranchNamesAtom, factsSelectionActiveAtom } from '../settings/settings-atom';
import { viewConfigs } from '../ui/view-config';
import EventGroupedChangesView from './facts/EventGroupedChangesView';
import ChronologicalChangesView from './facts/ChronologicalChangesView';
import {
  scrollToEventIdRequestAtom,
  statusMessageAtom,
} from './facts/facts-shared';
import { Colors } from '../colors';

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
  const [factsSelectionActive, setFactsSelectionActive] = useAtom(factsSelectionActiveAtom);

  useEffect(() => {
    if (scrollToEventIdRequest) {
      scrollToId(scrollToEventIdRequest);
      setScrollToEventIdRequest(null);
    }
  }, [scrollToEventIdRequest, scrollToId, setScrollToEventIdRequest]);

  const reviewColor = appView === 'review' ? viewConfigs.review.modeIndicator.labelColor : Colors.DIM;
  const focusColor = appView === 'focus' ? viewConfigs.focus.modeIndicator.labelColor : Colors.DIM;

  const notifColor = notificationSettings.enabled ? Colors.SECONDARY : Colors.DIM;
  const chronoColor = factsViewStyle === 'chronological' ? Colors.SECONDARY : Colors.DIM;
  const eventsColor = factsViewStyle === 'grouped' ? Colors.SECONDARY : Colors.DIM;
  const branchColor = showBranchNames ? Colors.SECONDARY : Colors.DIM;
  const titleColor = showBranchNames ? Colors.DIM : Colors.SECONDARY;
  const filteredColor = factsSelectionActive ? Colors.SECONDARY : Colors.DIM;
  const allColor = factsSelectionActive ? Colors.DIM : Colors.SECONDARY;

  const modeIndicatorBox = () => (
    <box key="mode-indicator" width="100%" height={6} flexDirection="column">
      <box height={1} flexDirection="row"
           onMouseDown={() => setAppView(appView === 'review' ? 'focus' : 'review')}>
        <text fg={Colors.TRACK} wrapMode="none">{' [v] '}</text>
        <text fg={reviewColor} wrapMode="none">{'review'}</text>
        <text fg={Colors.TRACK} wrapMode="none">{' / '}</text>
        <text fg={focusColor} wrapMode="none">{'focus'}</text>
      </box>
      <box height={1} flexDirection="row"
           onMouseDown={() => setFactsViewStyle(factsViewStyle === 'grouped' ? 'chronological' : 'grouped')}>
        <text fg={Colors.TRACK} wrapMode="none">{' [c] '}</text>
        <text fg={chronoColor} wrapMode="none">{'chronological'}</text>
        <text fg={Colors.TRACK} wrapMode="none">{' / '}</text>
        <text fg={eventsColor} wrapMode="none">{'events'}</text>
      </box>
      <box height={1} flexDirection="row"
           onMouseDown={() => toggleNotifications()}>
        <text fg={Colors.TRACK} wrapMode="none">{' [n] '}</text>
        <text fg={notifColor} wrapMode="none">{notificationSettings.enabled ? 'notifications' : 'notifications off'}</text>
      </box>
      <box height={1} flexDirection="row"
           onMouseDown={() => setShowBranchNames(!showBranchNames)}>
        <text fg={Colors.TRACK} wrapMode="none">{' [B] '}</text>
        <text fg={titleColor} wrapMode="none">{'title'}</text>
        <text fg={Colors.TRACK} wrapMode="none">{' / '}</text>
        <text fg={branchColor} wrapMode="none">{'branch'}</text>
      </box>
      <box height={1} flexDirection="row"
           onMouseDown={() => setFactsSelectionActive(!factsSelectionActive)}>
        <text fg={Colors.TRACK} wrapMode="none">{' [s] '}</text>
        <text fg={filteredColor} wrapMode="none">{'filtered'}</text>
        <text fg={Colors.TRACK} wrapMode="none">{' / '}</text>
        <text fg={allColor} wrapMode="none">{'all'}</text>
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
          <text fg={Colors.WARNING} wrapMode="word">{statusMessage}</text>
        </box>
      )}
      <scrollbox
        ref={scrollBoxRef}
        style={{
          flexGrow: 1,
          contentOptions: {
            backgroundColor: Colors.BACKGROUND,
          },
          viewportOptions: {
            backgroundColor: Colors.BACKGROUND,
          },
          scrollbarOptions: {
            width: 1,
            trackOptions: {
              foregroundColor: Colors.NEUTRAL,
              backgroundColor: Colors.BACKGROUND_ALT,
            },
          },
        }}
      >
        {factsViewStyle === 'chronological' ? <ChronologicalChangesView /> : <EventGroupedChangesView />}
      </scrollbox>
    </box>
  );
}
