import { Atom, Registry } from "@effect-atom/atom-react";
import { Effect } from "effect";
import type { Action } from "../actions/action-types";
import { parseKeyString } from "../actions/key-matcher";
import { appLayer } from "../appLayerRuntime";
import { allEventsAtom } from "../events/events-atom";
import { EventStorage } from "../eventstore/eventStorage";
import { activePaneAtom } from "../ui/navigation-atom";
import { ActivePane } from "../userselection/userSelection";
import { openFileInEditor } from "../utils/open-file";
import { resultToArray } from "../utils/result-helpers";
import { factsViewStyleAtom } from "../settings/settings-atom";
import {
  statusMessageAtom,
  currentEventChangesAtom,
  chronologicalChangesAtom,
  groupedEventsAtom,
  highlightedIndexAtom,
  scrollToEventIdRequestAtom,
  selectMrForChangeAtom,
  sublistFocusedAtom,
  sublistIndexAtom,
  viewConfigAtom,
  myJiraIssueKeysAtom,
} from "./facts/facts-shared";
import { currentUserIdAtom } from "../settings/settings-atom";

const getVisibleChronologicalChanges = (registry: Registry.Registry) => {
  const allChanges = registry.get(chronologicalChangesAtom);
  const config = registry.get(viewConfigAtom);
  const currentUser = registry.get(currentUserIdAtom);
  const myJiraIssueKeys = registry.get(myJiraIssueKeysAtom);
  return allChanges.filter(change => config.classify(change, currentUser, myJiraIssueKeys) !== 'hidden');
};

const chronologicalActions = (registry: Registry.Registry): Action[] => [
  {
    id: 'facts:chrono-nav-down',
    keys: [parseKeyString('j'), parseKeyString('down')],
    displayKey: 'j/k, ↑/↓',
    description: 'Navigate changes',
    handler: () => {
      const visibleChanges = getVisibleChronologicalChanges(registry);
      const currentIndex = registry.get(sublistIndexAtom);
      const newIndex = Math.min(currentIndex + 1, visibleChanges.length - 1);
      registry.set(sublistIndexAtom, newIndex);
      const change = visibleChanges[newIndex];
      if (change) {
        registry.set(selectMrForChangeAtom, change);
      }
    },
  },
  {
    id: 'facts:chrono-nav-up',
    keys: [parseKeyString('k'), parseKeyString('up')],
    displayKey: '',
    description: '',
    handler: () => {
      const visibleChanges = getVisibleChronologicalChanges(registry);
      const currentIndex = registry.get(sublistIndexAtom);
      const newIndex = Math.max(currentIndex - 1, 0);
      registry.set(sublistIndexAtom, newIndex);
      const change = visibleChanges[newIndex];
      if (change) {
        registry.set(selectMrForChangeAtom, change);
      }
    },
  },
  {
    id: 'facts:chrono-enter',
    keys: [parseKeyString('return')],
    displayKey: 'Enter',
    description: 'Go to MR pane',
    handler: () => {
      const visibleChanges = getVisibleChronologicalChanges(registry);
      const currentIndex = registry.get(sublistIndexAtom);
      const change = visibleChanges[currentIndex];
      if (change) {
        registry.set(selectMrForChangeAtom, change);
      }
      registry.set(activePaneAtom, ActivePane.MergeRequests);
    },
  },
  {
    id: 'facts:chrono-goto-bottom',
    keys: [parseKeyString('shift+g')],
    displayKey: 'G',
    description: 'Go to oldest',
    handler: () => {
      const visibleChanges = getVisibleChronologicalChanges(registry);
      registry.set(sublistIndexAtom, visibleChanges.length - 1);
    },
  },
  {
    id: 'facts:chrono-escape',
    keys: [parseKeyString('escape')],
    displayKey: 'Esc',
    description: 'Reset to top',
    handler: () => {
      registry.set(sublistIndexAtom, 0);
    },
  },
];

const eventGroupedSublistActions = (registry: Registry.Registry): Action[] => [
  {
    id: 'facts:sublist-nav-down',
    keys: [parseKeyString('j'), parseKeyString('down')],
    displayKey: 'j/k, ↑/↓',
    description: 'Navigate changes',
    handler: () => {
      const sublistIndex = registry.get(sublistIndexAtom);
      const currentEventChanges = registry.get(currentEventChangesAtom);
      const newIndex = Math.min(sublistIndex + 1, currentEventChanges.length - 1);
      const change = currentEventChanges[newIndex];

      registry.set(sublistIndexAtom, newIndex);
      if (change) {
        registry.set(selectMrForChangeAtom, change);
      }
    },
  },
  {
    id: 'facts:sublist-nav-up',
    keys: [parseKeyString('k'), parseKeyString('up')],
    displayKey: '',
    description: '',
    handler: () => {
      const sublistIndex = registry.get(sublistIndexAtom);
      const currentEventChanges = registry.get(currentEventChangesAtom);
      const newIndex = Math.max(sublistIndex - 1, 0);
      const change = currentEventChanges[newIndex];
      registry.set(sublistIndexAtom, newIndex);
      if (change) {
        registry.set(selectMrForChangeAtom, change);
      }
    },
  },
  {
    id: 'facts:sublist-enter',
    keys: [parseKeyString('return')],
    displayKey: 'Enter',
    description: 'Go to MR pane',
    handler: () => {
      registry.set(activePaneAtom, ActivePane.MergeRequests);
    },
  },
  {
    id: 'facts:sublist-escape',
    keys: [parseKeyString('escape')],
    displayKey: 'Esc',
    description: 'Exit sublist',
    handler: () => {
      registry.set(sublistFocusedAtom, false);
      registry.set(sublistIndexAtom, 0);
    },
  },
];

const eventGroupedActions = (registry: Registry.Registry): Action[] => [
  {
    id: 'facts:nav-down',
    keys: [parseKeyString('j'), parseKeyString('down')],
    displayKey: 'j/k, ↑/↓',
    description: 'Navigate events',
    handler: () => {
      const allEvents = resultToArray(registry.get(allEventsAtom));
      const highlightedIndex = registry.get(highlightedIndexAtom);
      const groupedEvents = registry.get(groupedEventsAtom);

      const current = highlightedIndex === null ? allEvents.length - 1 : highlightedIndex;
      const currentGroupIndex = groupedEvents.findIndex(g =>
        current >= g.startIndex && current <= g.endIndex
      );
      if (currentGroupIndex >= groupedEvents.length - 1) {
        return;
      } else if (currentGroupIndex < 0) {
        registry.set(highlightedIndexAtom, Math.max(current - 1, 0));
      } else {
        const nextGroup = groupedEvents[currentGroupIndex + 1];
        const newIndex = nextGroup ? nextGroup.endIndex : 0;
        registry.set(highlightedIndexAtom, newIndex);
        if (nextGroup) {
          registry.set(scrollToEventIdRequestAtom, nextGroup.event.eventId);
        }
      }
    },
  },
  {
    id: 'facts:nav-up',
    keys: [parseKeyString('k'), parseKeyString('up')],
    displayKey: '',
    description: '',
    handler: () => {
      const allEvents = resultToArray(registry.get(allEventsAtom));
      const highlightedIndex = registry.get(highlightedIndexAtom);
      const groupedEvents = registry.get(groupedEventsAtom);

      const current = highlightedIndex === null ? allEvents.length - 1 : highlightedIndex;
      const currentGroupIndex = groupedEvents.findIndex(g =>
        current >= g.startIndex && current <= g.endIndex
      );
      if (currentGroupIndex <= 0) {
        registry.set(highlightedIndexAtom, null);
        const firstGroup = groupedEvents[0];
        if (firstGroup) {
          registry.set(scrollToEventIdRequestAtom, firstGroup.event.eventId);
        }
      } else {
        const prevGroup = groupedEvents[currentGroupIndex - 1];
        const newIndex = prevGroup ? prevGroup.startIndex : allEvents.length - 1;
        registry.set(highlightedIndexAtom, newIndex);
        if (prevGroup) {
          registry.set(scrollToEventIdRequestAtom, prevGroup.event.eventId);
        }
      }
    },
  },
  {
    id: 'facts:enter',
    keys: [parseKeyString('return')],
    displayKey: 'Enter',
    description: 'Focus on changes',
    handler: () => {
      const currentEventChanges = registry.get(currentEventChangesAtom);
      if (currentEventChanges.length > 0) {
        registry.set(sublistFocusedAtom, true);
        registry.set(sublistIndexAtom, 0);
        const change = currentEventChanges[0];
        if (change) {
          registry.set(selectMrForChangeAtom, change);
        }
      }
    },
  },
  {
    id: 'facts:escape',
    keys: [parseKeyString('escape')],
    displayKey: 'Esc',
    description: 'Reset highlight',
    handler: () => {
      registry.set(highlightedIndexAtom, null);
    },
  },
  {
    id: 'facts:goto-bottom',
    keys: [parseKeyString('shift+g')],
    displayKey: 'G',
    description: 'Go to oldest',
    handler: () => {
      const groupedEvents = registry.get(groupedEventsAtom);
      const lastGroupIndex = groupedEvents.length - 1;
      const oldestGroup = groupedEvents[lastGroupIndex];
      registry.set(highlightedIndexAtom, oldestGroup ? oldestGroup.startIndex : 0);
      if (oldestGroup) {
        registry.set(scrollToEventIdRequestAtom, oldestGroup.event.eventId);
      }
    },
  },
  {
    id: 'facts:open-editor',
    keys: [parseKeyString('e')],
    displayKey: 'e',
    description: 'Open event in editor',
    handler: async () => {
      const allEvents = resultToArray(registry.get(allEventsAtom));
      const highlightedIndex = registry.get(highlightedIndexAtom);
      const eventIndex = highlightedIndex ?? allEvents.length - 1;

      registry.set(statusMessageAtom, 'Opening event in editor...');
      try {
        const filePath = await Effect.runPromise(
          EventStorage.getEventFilePath(eventIndex).pipe(
            Effect.provide(appLayer)
          )
        );
        await Effect.runPromise(
          openFileInEditor(filePath).pipe(
            Effect.provide(appLayer)
          )
        );
        registry.set(statusMessageAtom, `Opened: ${filePath}`);
        setTimeout(() => registry.set(statusMessageAtom, null), 3000);
      } catch (error) {
        registry.set(statusMessageAtom, `Failed to open: ${error}`);
        setTimeout(() => registry.set(statusMessageAtom, null), 3000);
      }
    },
  },
];

export const factsPaneActionsAtom: Atom.Atom<Action[]> = Atom.make(get => {
    const factsViewStyle = get(factsViewStyleAtom);
    const registry = get.registry;

    if (factsViewStyle === 'chronological') {
      return chronologicalActions(registry);
    }

    const sublistFocused = get(sublistFocusedAtom);
    return sublistFocused
      ? eventGroupedSublistActions(registry)
      : eventGroupedActions(registry);
});