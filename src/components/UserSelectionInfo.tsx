import React from 'react';
import { TextAttributes } from '@opentui/core';
import type { UserSelectionEntry } from '../types/userSelection';

interface UserSelectionInfoProps {
  userSelection: UserSelectionEntry;
}

export default function UserSelectionInfo({ userSelection }: UserSelectionInfoProps) {
  return (
    <box style={{ flexDirection: "column", gap: 1 }}>
      <text
        style={{ fg: '#f8f8f2', attributes: TextAttributes.BOLD, marginBottom: 1 }}
        wrap={false}
      >
        User Selection Details
      </text>

      <box style={{ flexDirection: "column" }}>
        <text
          style={{ fg: '#f8f8f2', marginBottom: 1 }}
          wrap={false}
        >
          {`Name: ${userSelection.name}`}
        </text>

        <text
          style={{ fg: '#bd93f9', attributes: TextAttributes.BOLD }}
          wrap={false}
        >
          Selection:
        </text>

        {userSelection.selection.map((item, index) => (
          <text
            key={index}
            style={{ fg: '#8be9fd' }}
            wrap={false}
          >
            {`  ${item.type === 'userId' ? 'User' : 'Group'}: ${item.id}`}
          </text>
        ))}
      </box>
    </box>
  );
}