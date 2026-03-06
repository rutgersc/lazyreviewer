import { useRef } from 'react';
import { useAtom, useAtomValue, useAtomSet } from '@effect-atom/atom-react';
import { TextAttributes } from '@opentui/core';
import { Colors } from '../../colors';
import { getAgeColor } from '../../utils/formatting';
import { nowAtom } from '../../ui/navigation-atom';
import { appViewAtom, currentUserIdAtom } from '../../settings/settings-atom';
import { viewConfigs } from '../../ui/view-config';
import type { Change } from '../../changetracking/change-tracking-projection';
import {
  getChangeDescription,
  formatRelativeTime,
  chronologicalChangesAtom,
  sublistIndexAtom,
  myJiraIssueKeysAtom,
  selectMrForChangeAtom,
  selectedMrIdentityAtom,
  isChangeForMr,
} from './facts-shared';

export default function ChronologicalChangesView() {
  const allChanges = useAtomValue(chronologicalChangesAtom);
  const [selectedIndex, setSelectedIndex] = useAtom(sublistIndexAtom);
  const selectMrForChange = useAtomSet(selectMrForChangeAtom);
  const now = useAtomValue(nowAtom);
  const currentUser = useAtomValue(currentUserIdAtom);
  const myJiraIssueKeys = useAtomValue(myJiraIssueKeysAtom);
  const config = viewConfigs[useAtomValue(appViewAtom)];
  const mrIdentity = useAtomValue(selectedMrIdentityAtom);
  const lastClickRef = useRef<{ index: number; time: number } | null>(null);

  const classifiedChanges = allChanges
    .map(change => ({ change, relevance: config.classify(change, currentUser, myJiraIssueKeys) }))
    .filter(({ relevance }) => relevance !== 'hidden');

  const handleClick = (i: number, change: Change) => {
    const clickNow = Date.now();
    const lastClick = lastClickRef.current;
    const isDoubleClick = lastClick && lastClick.index === i && (clickNow - lastClick.time) < 300;

    lastClickRef.current = { index: i, time: clickNow };
    setSelectedIndex(i);

    if (isDoubleClick) {
      selectMrForChange(change);
    }
  };

  return (
    <>
      {classifiedChanges.map(({ change, relevance }, i) => {
        const isSelected = i === selectedIndex;
        const isMrMatch = !isSelected && mrIdentity !== null && isChangeForMr(change, mrIdentity);
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
            onMouseDown={() => handleClick(i, change)}
            style={isMrMatch ? { border: ['left'] } : undefined}
            borderColor={isMrMatch ? Colors.NEUTRAL : undefined}
          >
            <box width={isMrMatch ? 3 : 4} flexShrink={0} height={1}>
              <text
                wrapMode='none'
                fg={isSelected ? Colors.SUCCESS :dateFg}
                bg={isSelected ? Colors.TRACK : style.bg}
                style={{attributes: TextAttributes.DIM | style.attributes}}
              >
                {isMrMatch ? '' : ' '}{formattedDate}
              </text>
            </box>
            <text
              wrapMode='none'
              fg={isSelected ? Colors.SUCCESS :changeFg}
              bg={isSelected ? Colors.TRACK : style.bg}
              style={style.attributes ? { attributes: style.attributes } : undefined}
            >
              {' '}{text}
            </text>
          </box>
        );
      })}
    </>
  );
}
