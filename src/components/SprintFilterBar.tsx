import { TextAttributes } from '@opentui/core';
import { Colors } from '../colors';
import { useAtomValue, useAtomSet } from '@effect-atom/atom-react';
import { sprintFilterAtom, setSprintFilterAtom } from '../settings/settings-atom';

export default function SprintFilterBar() {
  const sprintFilter = useAtomValue(sprintFilterAtom);
  const setSprintFilter = useAtomSet(setSprintFilterAtom);

  if (!sprintFilter) return null;

  return (
    <box style={{ minHeight: 1, maxHeight: 1, overflow: "hidden" }}>
      <box style={{ flexDirection: "row", columnGap: 1, rowGap: 0 }}>
        <text style={{ fg: Colors.PRIMARY }} wrapMode='none'>
          Sprint:
        </text>
        <box
          onMouseDown={() => setSprintFilter(null)}
          style={{ backgroundColor: Colors.TRACK, paddingLeft: 1, paddingRight: 1 }}
        >
          <text style={{ fg: Colors.INFO, attributes: TextAttributes.BOLD }} wrapMode='none'>
            {sprintFilter.name}
          </text>
        </box>
        <text
          onMouseDown={() => setSprintFilter(null)}
          style={{ fg: Colors.ERROR }}
          wrapMode='none'
        >
          [x]
        </text>
      </box>
    </box>
  );
}
