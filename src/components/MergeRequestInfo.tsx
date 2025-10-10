import { TextAttributes } from '@opentui/core';
import type { MergeRequest } from './MergeRequestPane';
import type { Discussion, DiscussionNote } from '../gitlab/gitlabgraphql';
import { formatCompactTime } from '../utils/formatting';
import { Colors } from '../colors';

interface MergeRequestInfoProps {
  mergeRequest: MergeRequest;
  selectedDiscussionIndex?: number;
}

export default function MergeRequestInfo({ mergeRequest, selectedDiscussionIndex = 0 }: MergeRequestInfoProps) {
  const renderDiscussionNote = (note: DiscussionNote, index: number) => {
    const isReply = index > 0; // First note is original, rest are replies
    const marginLeft = isReply ? 4 : 2;
    const marginLeftrrow = isReply ? "-> " : "";
    const authorColor = isReply ? '#8be9fd' : '#bd93f9';
    const textColor = isReply ? '#f1fa8c' : '#f8f8f2';

    const createdAt =`${formatCompactTime(note.createdAt)} (${note?.createdAt?.toLocaleDateString()} ${note?.createdAt?.toLocaleTimeString()}):`;

    const fileInfo = note.position?.filePath
      ? ` ${note.position.filePath}:${note.position.newLine || note.position.oldLine || '?'}`
      : '';

    return (
      <box
        key={note.id}
        style={{
          flexDirection: "column",
          width: "100%",
          padding: 0,
          marginBottom: 0 }}>
        <box style={{ flexDirection: "row", gap: 0, width: "100%" }}>
          <text
            style={{ fg: authorColor, attributes: TextAttributes.BOLD }}
            wrap={true}
          >
            {marginLeftrrow}{note.author}
          </text>
          <text
            style={{ fg: authorColor, attributes: TextAttributes.DIM }}
            wrap={true}
          >
            {createdAt}
          </text>
          {fileInfo && (
            <text
              style={{ fg: '#ffb86c', attributes: TextAttributes.DIM }}
              wrap={true}
            >
              {fileInfo}
            </text>
          )}
        </box>
        <box
          style={{
            marginLeft: marginLeft,
          }}>
          <text
            style={{ fg: textColor }}
            wrap={true}
          >
            {note.body}
          </text>
        </box>
      </box>
    );
  };

  const renderUnresolvedDiscussions = (discussions: Discussion[]) => {
    const unresolvedDiscussions = discussions.filter(d => d.resolvable && !d.resolved);

    if (unresolvedDiscussions.length === 0) {
      return (
        <text
          style={{ fg: '#50fa7b', attributes: TextAttributes.DIM }}
          wrap={true}
        >
          All discussions resolved ✓
        </text>
      );
    }

    return (
      <box style={{ flexDirection: "column", gap: 0, width: "100%" }}>
        <text
          style={{ fg: '#ff5555', attributes: TextAttributes.BOLD, marginBottom: 1 }}
          wrap={true}
        >
          {`Unresolved Discussions (${unresolvedDiscussions.length})`}
        </text>
        {unresolvedDiscussions.map((discussion, index) => {
          const isSelected = index === selectedDiscussionIndex;
          return (
            <box
              key={discussion.id}
              style={{
                flexDirection: "column",
                marginLeft: 2,
                marginBottom: 0,
                width: "100%",
                backgroundColor: isSelected ? Colors.SELECTED : '#1a1a1a',
                padding: 1,
                border: isSelected,
                borderColor: isSelected ? Colors.SUCCESS : undefined
              }}
            >
              {discussion.notes.map(renderDiscussionNote)}
            </box>
          );
        })}
      </box>
    );
  };

  return (
    <box style={{ flexDirection: "column", gap: 1, width: "100%" }}>
      <box style={{ marginBottom: 1, width: "100%" }}>
        {renderUnresolvedDiscussions(mergeRequest.discussions || [])}
      </box>
    </box>
  );
}