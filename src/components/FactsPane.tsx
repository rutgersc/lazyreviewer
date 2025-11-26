import { useState } from 'react';
import { useKeyboard } from '@opentui/react';
import { useAtom, useAtomValue, useAtomSet } from '@effect-atom/atom-react';
import { ActivePane } from '../userselection/userSelection';
import { activePaneAtom } from '../ui/navigation-atom';
import { allEventsAtom, selectedEventIndexAtom, compactStateUpToSelectedEventAtom } from '../events/events-atom';
import { resultToArray } from '../utils/result-helpers';

export default function FactsPane() {
  const [activePane] = useAtom(activePaneAtom);
  const events = resultToArray(useAtomValue(allEventsAtom));
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useAtom(selectedEventIndexAtom);
  const [compactionMessage, setCompactionMessage] = useState<string | null>(null);
  const compactState = useAtomSet(compactStateUpToSelectedEventAtom, { mode: 'promise' });

  const isActive = activePane === ActivePane.Facts;

  // We want to display newest events at the top.
  const reversedEvents = [...events].reverse();
  const displayEvents = reversedEvents.slice(0, 100);

  useKeyboard(async (key) => {
    if (!isActive) return;

    if (key.name === 'j' || key.name === 'down') {
        // Move visually down -> Older -> Decrease index (just highlight)
        setHighlightedIndex(prev => {
            const current = prev === null ? events.length - 1 : prev;
            return Math.max(current - 1, 0);
        });
    } else if (key.name === 'k' || key.name === 'up') {
        // Move visually up -> Newer -> Increase index (just highlight)
        setHighlightedIndex(prev => {
            const current = prev === null ? events.length - 1 : prev;
            const next = current + 1;
            if (next >= events.length - 1) {
                return null; // Snap to live
            }
            return next;
        });
    } else if (key.name === 'space' || key.name === 'return') {
        // Space/Enter - activate time-travel to this event
        // This sets the global selected event index for time-travel
        setSelectedIndex(highlightedIndex);
    } else if (key.name === 'escape') {
        // Escape - return to live mode
        setSelectedIndex(null);
        setHighlightedIndex(null);
    } else if (key.name === 'g') {
        if (key.shift) {
             // G - bottom (visually) -> Oldest -> Index 0
             setHighlightedIndex(0);
        } else {
             // g - top (visually) -> Newest -> Live -> null
             setHighlightedIndex(null);
        }
    } else if (key.name === 'c') {
        // c - compact state up to selected event
        const indexToCompact = selectedIndex !== null ? selectedIndex : highlightedIndex;
        setCompactionMessage('Compacting...');
        try {
            const result = await compactState(indexToCompact);
            setCompactionMessage(result.message);
            setTimeout(() => setCompactionMessage(null), 3000);
        } catch (error) {
            setCompactionMessage(`Compaction failed: ${error}`);
            setTimeout(() => setCompactionMessage(null), 3000);
        }
    }
  });

  return (
    <box flexDirection="column" height="100%" width="100%">
        {compactionMessage && (
            <box height={1} width="100%" flexDirection="row">
                <text fg="#ffb86c" wrapMode="word">
                    {compactionMessage}
                </text>
            </box>
        )}
        {displayEvents.map((event, reversedIndex) => {
            const originalIndex = events.length - 1 - reversedIndex;

            // Check if this event is highlighted (navigation cursor)
            const isHighlighted = highlightedIndex === originalIndex || (highlightedIndex === null && originalIndex === events.length - 1);

            // Check if this event is selected (time-travel active point)
            const isSelected = selectedIndex === originalIndex || (selectedIndex === null && originalIndex === events.length - 1);

            // Determine colors based on state
            let color = '#f8f8f2'; // default white
            let backgroundColor = undefined;

            if (isSelected && isHighlighted) {
                // Both selected and highlighted - most prominent
                color = '#50fa7b'; // green
                backgroundColor = isActive ? '#44475a' : undefined;
            } else if (isSelected) {
                // Selected (time-travel active) - green
                color = '#50fa7b'; // green
            } else if (isHighlighted && isActive) {
                // Just highlighted (navigation cursor) - cyan with background
                color = '#8be9fd'; // cyan
                backgroundColor = '#44475a';
            }

            // Only show index if not active, show type/details if active
            const displayIndex = originalIndex.toString().padStart(4, ' ');

            return (
                <box key={originalIndex} height={1} width="100%" flexDirection="row">
                    <text
                        fg={color}
                        bg={backgroundColor}
                        wrapMode="word"
                    >
                        {displayIndex}
                    </text>
                    {isActive && (
                        <text
                            fg={color}
                            bg={backgroundColor}
                            wrapMode="word"
                        >
                             {` | ${event.type}`}
                        </text>
                    )}
                </box>
            );
        })}
    </box>
  );
}
