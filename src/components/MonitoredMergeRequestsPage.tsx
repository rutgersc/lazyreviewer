import { TextAttributes, type ParsedKey } from '@opentui/core';
import { useKeyboard } from '@opentui/react';
import { Atom, AsyncResult } from "effect/unstable/reactivity"
import { useAtomValue, useAtomSet } from "@effect/atom-react";
import { Colors } from '../colors';
import { monitoredMergeRequestsAtom, toggleMonitorMergeRequestAtom } from '../settings/settings-atom';
import { allMrsAtom } from '../mergerequests/mergerequests-atom';
;
import { useAutoScroll } from '../hooks/useAutoScroll';
import { openUrl } from '../system/open-url';
import { copyToClipboard } from '../system/clipboard';
import { formatCompactTime } from '../utils/formatting';
import { nowAtom } from '../ui/navigation-atom';
import type { MergeRequest } from '../mergerequests/mergerequest-schema';

interface MonitoredMergeRequestsPageProps {
  onClose: () => void;
}

const selectedMonitoredIndexAtom = Atom.make<number>(0);

const monitoredMrsListAtom = Atom.make((get) => {
  const allMrsResult = get(allMrsAtom);
  const monitoredIds = get(monitoredMergeRequestsAtom);

  return AsyncResult.match(allMrsResult, {
    onInitial: () => [] as MergeRequest[],
    onSuccess: (state) =>
      Array.from(state.value.mrsByGid.values())
        .filter((mr) => monitoredIds.has(mr.id))
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()),
    onFailure: () => [] as MergeRequest[],
  });
});

export default function MonitoredMergeRequestsPage({ onClose }: MonitoredMergeRequestsPageProps) {
  const monitoredMrs = useAtomValue(monitoredMrsListAtom);
  const selectedIndex = useAtomValue(selectedMonitoredIndexAtom);
  const setSelectedIndex = useAtomSet(selectedMonitoredIndexAtom);
  const toggleMonitor = useAtomSet(toggleMonitorMergeRequestAtom);
  const now = useAtomValue(nowAtom);

  const { scrollBoxRef, scrollToId } = useAutoScroll({ lookahead: 2 });

  const selectedMr = monitoredMrs[selectedIndex];

  useKeyboard((key: ParsedKey) => {
    switch (key.name) {
      case 'escape':
      case 'q':
        onClose();
        break;
      case 'j':
      case 'down':
        if (selectedIndex < monitoredMrs.length - 1) {
          const newIndex = selectedIndex + 1;
          setSelectedIndex(newIndex);
          const mr = monitoredMrs[newIndex];
          if (mr) scrollToId(`monitored-mr-${mr.id}`);
        }
        break;
      case 'k':
      case 'up':
        if (selectedIndex > 0) {
          const newIndex = selectedIndex - 1;
          setSelectedIndex(newIndex);
          const mr = monitoredMrs[newIndex];
          if (mr) scrollToId(`monitored-mr-${mr.id}`);
        }
        break;
      case 'o':
      case 'return':
        if (selectedMr) {
          openUrl(selectedMr.webUrl);
        }
        break;
      case 'c':
        if (selectedMr) {
          copyToClipboard(selectedMr.sourcebranch);
        }
        break;
      case 'backspace':
      case 'm':
        if (selectedMr) {
          toggleMonitor(selectedMr.id);
          if (selectedIndex >= monitoredMrs.length - 1 && selectedIndex > 0) {
            setSelectedIndex(selectedIndex - 1);
          }
        }
        break;
    }
  });

  const renderMr = (mr: MergeRequest, index: number) => {
    const isSelected = index === selectedIndex;

    return (
      <box
        key={mr.id}
        id={`monitored-mr-${mr.id}`}
        style={{
          flexDirection: 'column',
          backgroundColor: isSelected ? Colors.TRACK : 'transparent',
          paddingLeft: 1,
          paddingRight: 1,
        }}
      >
        <box style={{ flexDirection: 'row', gap: 1 }}>
          <text style={{ fg: Colors.ACCENT }} wrapMode='none'>|</text>
          <text style={{ fg: Colors.SECONDARY }} wrapMode='none'>
            {formatCompactTime(mr.updatedAt, now)}
          </text>
          <text style={{ fg: Colors.NEUTRAL }} wrapMode='none'>
            {mr.author}
          </text>
          <text style={{ fg: Colors.PRIMARY, attributes: TextAttributes.BOLD, flexShrink: 1 }} wrapMode='none'>
            {mr.title.length > 80 ? mr.title.slice(0, 80) + '...' : mr.title}
          </text>
        </box>
        <box style={{ flexDirection: 'row', gap: 1, paddingLeft: 2 }}>
          <text style={{ fg: Colors.INFO }} wrapMode='none'>
            {mr.project.name}
          </text>
          <text style={{ fg: Colors.SUPPORTING }} wrapMode='none'>
            {mr.sourcebranch}
          </text>
          <text style={{ fg: mr.approvedBy.length > 0 ? Colors.SUCCESS : Colors.PRIMARY }} wrapMode='none'>
            {mr.approvedBy.length > 0 ? `+${mr.approvedBy.length}` : ''}
          </text>
          <text style={{ fg: mr.unresolvedDiscussions > 0 ? Colors.ERROR : Colors.SUCCESS }} wrapMode='none'>
            {mr.unresolvedDiscussions > 0 ? `${mr.unresolvedDiscussions} unresolved` : ''}
          </text>
        </box>
      </box>
    );
  };

  return (
    <box
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: Colors.BACKGROUND,
        flexDirection: 'column',
        zIndex: 1000,
      }}
    >
      <box
        style={{
          flexDirection: 'column',
          padding: 1,
        }}
      >
        <box
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
          }}
        >
          <text style={{ fg: Colors.ACCENT, attributes: TextAttributes.BOLD }} wrapMode='none'>
            Monitored Merge Requests ({monitoredMrs.length})
          </text>
          <text style={{ fg: Colors.SUPPORTING }} wrapMode='none'>
            q: close | j/k: nav | o: open | c: copy branch | m: unmonitor
          </text>
        </box>
        <text style={{ fg: Colors.NEUTRAL }} wrapMode='none'>
          {'─'.repeat(100)}
        </text>
      </box>

      {monitoredMrs.length === 0 && (
        <box style={{ padding: 2 }}>
          <text style={{ fg: Colors.SUPPORTING }} wrapMode='none'>
            No monitored merge requests. Press 'm' on any MR to start monitoring it.
          </text>
        </box>
      )}

      {monitoredMrs.length > 0 && (
        <scrollbox
          ref={scrollBoxRef}
          style={{
            flexGrow: 1,
            contentOptions: { backgroundColor: Colors.BACKGROUND },
            scrollbarOptions: {
              trackOptions: { foregroundColor: Colors.NEUTRAL, backgroundColor: Colors.TRACK },
            },
          }}
        >
          <box style={{ flexDirection: 'column' }}>
            {monitoredMrs.map((mr, index) => renderMr(mr, index))}
          </box>
        </scrollbox>
      )}
    </box>
  );
}
