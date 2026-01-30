import { TextAttributes } from '@opentui/core';
import type { Discussion, DiscussionNote } from '../gitlab/gitlab-schema';
import type { MergeRequest } from '../mergerequests/mergerequest-schema';
import { formatCompactTime } from '../utils/formatting';
import { Colors } from '../colors';
import { useDoubleClick } from '../hooks/useDoubleClick';

interface MergeRequestInfoProps {
  mergeRequest: MergeRequest;
  selectedDiscussionIndex?: number;
  onSelectDiscussion?: (index: number) => void;
  onOpenDiscussion?: (index: number) => void;
  resolvedExpanded: boolean;
  onToggleResolvedExpanded: () => void;
}

export default function MergeRequestInfo({ mergeRequest, selectedDiscussionIndex = 0, onSelectDiscussion, onOpenDiscussion, resolvedExpanded, onToggleResolvedExpanded }: MergeRequestInfoProps) {

  const handleDiscussionClick = useDoubleClick<number>({
    onSingleClick: (index) => onSelectDiscussion?.(index),
    onDoubleClick: (index) => onOpenDiscussion?.(index)
  });

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
            wrapMode='word'
          >
            {marginLeftrrow}{note.author}
          </text>
          <text
            style={{ fg: authorColor, attributes: TextAttributes.DIM }}
            wrapMode='word'
          >
            {createdAt}
          </text>
        </box>
        {fileInfo && (
          <box>
            <text
              style={{ fg: '#ffb86c', attributes: TextAttributes.DIM }}
              wrapMode='word'
            >
              {fileInfo}
            </text>
          </box>
        )}
        <box
          style={{
            marginLeft: marginLeft,
          }}>
          <text
            style={{ fg: textColor }}
            wrapMode='word'
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
          style={{ fg: '#50fa7b' }}
          wrapMode='word'
        >
          All discussions resolved ✓
        </text>
      );
    }

    return (
      <box style={{ flexDirection: "column", gap: 0, width: "100%" }}>
        <text
          style={{ fg: '#ff5555', attributes: TextAttributes.BOLD, marginBottom: 1 }}
          wrapMode='word'
        >
          {`Unresolved Discussions (${unresolvedDiscussions.length})`}
        </text>
        {unresolvedDiscussions.map((discussion, index) => {
          const isSelected = index === selectedDiscussionIndex;
          return (
            <box
              key={discussion.id}
              id={`discussion-${index}`}
              onMouseDown={() => handleDiscussionClick(index)}
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

  const renderResolvedDiscussions = (discussions: Discussion[]) => {
    const resolvedDiscussions = discussions.filter(d => d.resolvable && d.resolved);

    if (resolvedDiscussions.length === 0) return null;

    const toggleLabel = resolvedExpanded ? '▼' : '▶';

    return (
      <box style={{ flexDirection: "column", gap: 0, width: "100%" }}>
        <text
          onMouseDown={() => onToggleResolvedExpanded()}
          style={{ fg: '#50fa7b', attributes: TextAttributes.BOLD, marginBottom: 1 }}
          wrapMode='word'
        >
          {`${toggleLabel} Resolved Discussions (${resolvedDiscussions.length})`}
        </text>
        {resolvedExpanded && resolvedDiscussions.map((discussion, index) => (
          <box
            key={discussion.id}
            id={`resolved-discussion-${index}`}
            style={{
              flexDirection: "column",
              marginLeft: 2,
              marginBottom: 0,
              width: "100%",
              backgroundColor: '#1a1a1a',
              padding: 1,
            }}
          >
            {discussion.notes.map(renderDiscussionNote)}
          </box>
        ))}
      </box>
    );
  };

  return (
    <box style={{ flexDirection: "column", gap: 1, width: "100%" }}>
      {/* Branch Information */}
      <box style={{ flexDirection: "column", marginLeft: 0, marginTop: 1, width: "100%" }}>
        <box style={{ flexDirection: "row", gap: 0, marginLeft: 0 }}>
          <text style={{ fg: Colors.NEUTRAL }} wrapMode='none'>
            Source:
          </text>
          <text style={{ marginLeft: 1, fg: Colors.INFO, attributes: TextAttributes.BOLD }} wrapMode='none'>
            {mergeRequest.sourcebranch}
          </text>
        </box>

        <box style={{ flexDirection: "row", marginLeft: 0 }}>
          <text style={{ fg: Colors.NEUTRAL }} wrapMode='none'>
            Target:
          </text>
          <text style={{ marginLeft: 1, fg: Colors.INFO, attributes: TextAttributes.BOLD }} wrapMode='none'>
            {mergeRequest.targetbranch}
          </text>
        </box>
      </box>

      <box style={{ marginBottom: 1, width: "100%" }}>
        {renderUnresolvedDiscussions(mergeRequest.discussions || [])}
      </box>

      <box style={{ marginBottom: 1, width: "100%" }}>
        {renderResolvedDiscussions(mergeRequest.discussions || [])}
      </box>
    </box>
  );
}