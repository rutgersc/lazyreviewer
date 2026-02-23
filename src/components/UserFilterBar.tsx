import { TextAttributes } from '@opentui/core';
import { Colors } from '../colors';
import { useAtomValue, useAtomSet } from '@effect-atom/atom-react';
import { userFilterUsernamesAtom, userFilterGroupIdsAtom } from '../settings/settings-atom';
import { groupsAtom } from '../data/data-atom';
import { activeModalAtom } from '../ui/navigation-atom';

export default function UserFilterBar() {
  const userFilter = useAtomValue(userFilterUsernamesAtom);
  const groupIds = useAtomValue(userFilterGroupIdsAtom);
  const groups = useAtomValue(groupsAtom);
  const setActiveModal = useAtomSet(activeModalAtom);

  const groupNames = groupIds
    .map(id => groups.find(g => g.id.id === id)?.name)
    .filter((name): name is string => name != null);

  return (
    <box style={{ minHeight: 1, maxHeight: 2, overflow: "hidden" }}>
      <box style={{ flexDirection: "row", columnGap: 1, rowGap: 0, flexWrap: "wrap" }}>
        <text style={{ fg: Colors.PRIMARY }} wrapMode='none'>
          Filter:
        </text>
        {groupNames.map(name => (
          <box
            key={`g-${name}`}
            onMouseDown={() => setActiveModal('userFilter')}
            style={{ backgroundColor: Colors.TRACK, paddingLeft: 1, paddingRight: 1 }}
          >
            <text style={{ fg: Colors.INFO, attributes: TextAttributes.BOLD }} wrapMode='none'>
              {name}
            </text>
          </box>
        ))}
        {userFilter.map(username => (
          <box
            key={`u-${username}`}
            onMouseDown={() => setActiveModal('userFilter')}
            style={{ backgroundColor: Colors.TRACK, paddingLeft: 1, paddingRight: 1 }}
          >
            <text style={{ fg: Colors.INFO, attributes: TextAttributes.BOLD }} wrapMode='none'>
              {username}
            </text>
          </box>
        ))}
        <text
          onMouseDown={() => setActiveModal('userFilter')}
          style={{ fg: Colors.INFO }}
          wrapMode='none'
        >
          [+]
        </text>
      </box>
    </box>
  );
}
