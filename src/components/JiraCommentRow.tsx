import { TextAttributes } from '@opentui/core';
import { extractTextFromJiraComment, type JiraComment } from '../jira/jira-service';
import { formatCompactTime } from '../utils/formatting';
import { Colors } from '../colors';

interface JiraCommentRowProps {
  comment: JiraComment;
  id: string;
  selected: boolean;
  onMouseDown?: () => void;
}

export function JiraCommentRow({ comment, id, selected, onMouseDown }: JiraCommentRowProps) {
  const created = new Date(comment.created);

  return (
    <box
      id={id}
      onMouseDown={onMouseDown}
      style={{
        flexDirection: "column",
        marginLeft: 2,
        width: "100%",
        backgroundColor: selected ? Colors.SELECTED : Colors.BACKGROUND_ALT,
        padding: 1,
      }}
    >
      <box style={{ flexDirection: "row", gap: 0, width: "100%" }}>
        <text style={{ fg: Colors.INFO, attributes: TextAttributes.BOLD }} wrapMode='word'>
          {comment.author.displayName}
        </text>
        <text style={{ fg: Colors.NEUTRAL, attributes: TextAttributes.DIM }} wrapMode='word'>
          {` ${formatCompactTime(created)} (${created.toLocaleDateString()} ${created.toLocaleTimeString()}):`}
        </text>
      </box>
      <box style={{ marginLeft: 4 }}>
        <text style={{ fg: Colors.SECONDARY }} wrapMode='word'>
          {extractTextFromJiraComment(comment)}
        </text>
      </box>
    </box>
  );
}
