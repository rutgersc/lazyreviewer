import { useRef } from 'react';
import { useAtom, useAtomValue, useAtomSet } from "@effect/atom-react";
import { TextAttributes } from '@opentui/core';
import { Colors } from '../../colors';
import { getAgeColor } from '../../utils/formatting';
import { allEventsAtom } from '../../events/events-atom';
import { resultToArray } from '../../utils/result-helpers';
import { nowAtom } from '../../ui/navigation-atom';
import { appViewAtom, currentUserIdAtom } from '../../settings/settings-atom';
import { viewConfigs } from '../../ui/view-config';
import type { Change } from '../../changetracking/change-tracking-projection';
import type { LazyReviewerEvent } from '../../events/events';
import {
  type EventGroup,
  emptyChange,
  getChangeDescription,
  formatRelativeTime,
  groupedEventsAtom,
  visibleDeltasByEventIdAtom,
  highlightedIndexAtom,
  sublistFocusedAtom,
  sublistIndexAtom,
  myJiraIssueKeysAtom,
  selectMrForChangeAtom,
  selectedMrIdentityAtom,
  isChangeForMr,
} from './facts-shared';

export default function EventGroupedChangesView() {
  const allEvents = resultToArray(useAtomValue(allEventsAtom));
  const [highlightedIndex, setHighlightedIndex] = useAtom(highlightedIndexAtom);
  const [sublistFocused, setSublistFocused] = useAtom(sublistFocusedAtom);
  const [sublistIndex, setSublistIndex] = useAtom(sublistIndexAtom);
  const groupedEvents = useAtomValue(groupedEventsAtom);
  const groupedDeltas = useAtomValue(visibleDeltasByEventIdAtom);
  const selectMrForChange = useAtomSet(selectMrForChangeAtom);
  const now = useAtomValue(nowAtom);
  const currentUser = useAtomValue(currentUserIdAtom);
  const myJiraIssueKeys = useAtomValue(myJiraIssueKeysAtom);
  const config = viewConfigs[useAtomValue(appViewAtom)];
  const mrIdentity = useAtomValue(selectedMrIdentityAtom);
  const lastClickRef = useRef<{ eventId: string; time: number } | null>(null);

  const getDeltas = (ev: LazyReviewerEvent | undefined): Change[] =>
    [...(groupedDeltas.get(ev?.eventId ?? "") ?? emptyChange)].reverse();

  return (
    <>
      {groupedEvents.map((group) => {
        if (group.type === 'range') {
          return renderRangeGroup(group, allEvents, highlightedIndex, setHighlightedIndex, setSublistFocused);
        }

        const originalIndex = group.startIndex;
        const event = group.event;
        const isHighlighted = highlightedIndex === originalIndex || (highlightedIndex === null && originalIndex === allEvents.length - 1);

        const displayIndex = ' ' + originalIndex.toString().padEnd(4, ' ');
        const rawEventDeltas = getDeltas(event);
        const classifiedDeltas = rawEventDeltas
          .map(change => ({ change, relevance: config.classify(change, currentUser, myJiraIssueKeys) }))
          .filter(({ relevance }) => relevance !== 'hidden');
        const eventRelevance: 'primary' | 'dimmed' =
          classifiedDeltas.some(d => d.relevance === 'primary') ? 'primary' : 'dimmed';
        const eventDeltas = classifiedDeltas.map(d => d.change);
        const hasEventDeltas = eventDeltas.length > 0;

        const headerStyle = config.eventHeader[eventRelevance];
        let color = headerStyle.fg;
        let headerAttributes = headerStyle.attributes;
        let backgroundColor: string | undefined = undefined;

        const isSelected = false;
        if (isSelected && isHighlighted) {
          color = Colors.SUCCESS;
          headerAttributes = 0;
          backgroundColor = Colors.STRIPE;
        } else if (isSelected) {
          color = Colors.SUCCESS;
          headerAttributes = 0;
        } else if (isHighlighted) {
          color = Colors.INFO;
          headerAttributes = 0;
          backgroundColor = Colors.STRIPE;
        }

        const handleEventClick = () => {
          const clickNow = Date.now();
          const lastClick = lastClickRef.current;
          const isDoubleClick = lastClick && lastClick.eventId === event.eventId && (clickNow - lastClick.time) < 300;

          lastClickRef.current = { eventId: event.eventId, time: clickNow };

          if (isDoubleClick && eventDeltas.length > 0) {
            setHighlightedIndex(originalIndex);
            setSublistFocused(true);
            setSublistIndex(0);
            const change = eventDeltas[0];
            if (change) {
              // TODOR:
              // selectMrForChange(change);
            }
          } else {
            setHighlightedIndex(originalIndex);
            setSublistFocused(false);
            const change = eventDeltas[0];
            if (change) {
              //TODOR:
              // selectMrForChange(change);
            }
          }
        };

        const handleChangeClick = (i: number, change: Change) => {
          setHighlightedIndex(originalIndex);
          setSublistFocused(true);
          setSublistIndex(i);
          selectMrForChange(change);
        };

        return (
          <box key={group.event.eventId} id={group.event.eventId} flexDirection="column" width="100%">
            <box height={1} width="100%" flexDirection="row" onMouseDown={handleEventClick}>
              <text fg={color} {...(backgroundColor !== undefined && { bg: backgroundColor })} {...(headerAttributes ? { style: { attributes: headerAttributes } } : {})} wrapMode="word">
                {displayIndex}
              </text>
              <text fg={color} {...(backgroundColor !== undefined && { bg: backgroundColor })} {...(headerAttributes ? { style: { attributes: headerAttributes } } : {})} wrapMode="word">
                {`>> ${event.type}`}
              </text>
            </box>
            {!hasEventDeltas && rawEventDeltas.length === 0 && (
              <box height={1} width="100%" flexDirection="row" onMouseDown={handleEventClick}>
                <text fg={Colors.TRACK} bg={Colors.BACKGROUND_ALT}>
                  {'      —'}
                </text>
                <box flexGrow={1} height={1} style={{ backgroundColor: Colors.BACKGROUND_ALT }} />
              </box>
            )}
            {classifiedDeltas.map(({ change, relevance }, i) => {
              const isSublistSelected = isHighlighted && sublistFocused && i === sublistIndex;
              const isMrMatch = !isSublistSelected && mrIdentity !== null && isChangeForMr(change, mrIdentity);
              const { color: changeColor, text } = getChangeDescription(change);
              const style = config.changeStyle[relevance === 'dimmed' ? 'dimmed' : 'primary'];

              const formattedDate = change.changedAt
                ? formatRelativeTime(change.changedAt, now).padEnd(3, ' ')
                : '?  ';
              const baseAgeColor = change.changedAt ? getAgeColor(change.changedAt, now) : Colors.SECONDARY;
              const dateFg = style.dateFg === 'USE_AGE_COLOR' ? baseAgeColor : style.dateFg;
              const changeFg = style.fg === 'USE_CHANGE_COLOR' ? changeColor : style.fg;

              return (
                <box
                  key={i}
                  height={1}
                  width="100%"
                  flexDirection='row'
                  onMouseDown={() => handleChangeClick(i, change)}
                  {...(isMrMatch ? { style: { border: ['left'] as const }, borderColor: Colors.NEUTRAL } : {})}
                >
                  <box width={isMrMatch ? 3 : 4} flexShrink={0} height={1}>
                    <text
                      wrapMode='none'
                      fg={isSublistSelected ? Colors.SUCCESS :dateFg}
                      bg={isSublistSelected ? Colors.TRACK : style.bg}
                      style={{attributes: TextAttributes.DIM | style.attributes}}
                    >
                      {isMrMatch ? '' : ' '}{formattedDate}
                    </text>
                  </box>
                  <text
                    wrapMode='none'
                    fg={isSublistSelected ? Colors.SUCCESS :changeFg}
                    bg={isSublistSelected ? Colors.TRACK : style.bg}
                    {...(style.attributes ? { style: { attributes: style.attributes } } : {})}
                  >
                    {' '}{text}
                  </text>
                </box>
              );
            })}
          </box>
        );
      })}
    </>
  );
}

function renderRangeGroup(
  group: EventGroup,
  allEvents: readonly LazyReviewerEvent[],
  highlightedIndex: number | null,
  setHighlightedIndex: (index: number | null) => void,
  setSublistFocused: (focused: boolean) => void,
) {
  const currentHighlight = highlightedIndex === null ? allEvents.length - 1 : highlightedIndex;
  const isHighlighted = currentHighlight >= group.startIndex && currentHighlight <= group.endIndex;
  const isSelected = false;

  let color = Colors.PRIMARY;
  let backgroundColor: string | undefined = undefined;

  if (isSelected && isHighlighted) {
    color = Colors.SUCCESS;
    backgroundColor = Colors.STRIPE;
  } else if (isSelected) {
    color = Colors.SUCCESS;
  } else if (isHighlighted) {
    color = Colors.INFO;
    backgroundColor = Colors.STRIPE;
  }

  const handleRangeClick = () => {
    setHighlightedIndex(group.startIndex);
    setSublistFocused(false);
  };

  return (
    <box key={group.event.eventId} id={group.event.eventId} flexDirection="column" width="100%">
      <box height={1} width="100%" flexDirection="row" onMouseDown={handleRangeClick}>
        <text fg={color} {...(backgroundColor !== undefined && { bg: backgroundColor })} wrapMode="word">
          {`${group.startIndex.toString().padStart(4, ' ')}...${group.endIndex.toString().padEnd(4, ' ')} | (no changes)`}
        </text>
      </box>
      <box height={1} width="100%" flexDirection="row" onMouseDown={handleRangeClick}>
        <text fg={isHighlighted ? color : Colors.TRACK} bg={Colors.BACKGROUND_ALT}>
          {'      —'}
        </text>
        <box flexGrow={1} height={1} style={{ backgroundColor: Colors.BACKGROUND_ALT }} />
      </box>
    </box>
  );
}
