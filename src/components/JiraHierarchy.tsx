import { TextAttributes } from '@opentui/core';
import { Colors } from '../colors';
import type { JiraListItem } from '../jira/jira-hierarchy';

interface JiraHierarchyRowProps {
  item: JiraListItem;
  selected: boolean;
  onMouseDown?: () => void;
}

export function JiraHierarchyRow({ item, selected, onMouseDown }: JiraHierarchyRowProps) {
  return (
    <box
      id={`jira-item-${item.parentIssueIndex}-${item.subIndex}`}
      onMouseDown={onMouseDown}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 2,
        backgroundColor: selected ? Colors.SELECTED : 'transparent',
        marginLeft: item.indented ? 2 : 0
      }}
    >
      {item.indented && (
        <text style={{ fg: Colors.NEUTRAL, attributes: TextAttributes.DIM }} wrapMode='none'>
          ↳
        </text>
      )}
      <text style={{ fg: Colors.SUCCESS, attributes: TextAttributes.BOLD }} wrapMode='none'>
        {item.issue.key}
      </text>
      <text style={{ fg: Colors.WARNING, attributes: TextAttributes.DIM }} wrapMode='none'>
        {item.issue.fields.status.name}
      </text>
      <text style={{ fg: Colors.NEUTRAL, attributes: TextAttributes.DIM }} wrapMode='none'>
        {item.issue.fields.issuetype.name}
      </text>
      <text style={{ fg: Colors.PRIMARY }} wrapMode='none'>
        {item.issue.fields.summary}
      </text>
    </box>
  );
}
