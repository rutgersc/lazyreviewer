import { TextAttributes, SyntaxStyle, parseColor } from '@opentui/core';
import { useMemo } from 'react';
import type { Discussion, DiscussionNote } from '../domain/merge-request-schema';
import { formatCompactTime } from '../utils/formatting';
import { Colors } from '../colors';
import { useDoubleClick } from '../hooks/useDoubleClick';
import { useAtom, useAtomValue } from '@effect-atom/atom-react';
import { selectedMrAtom } from '../mergerequests/mergerequests-atom';
import { openUrl } from '../system/open-url';
import {
  overviewCursorIndexAtom,
  unresolvedExpandedAtom,
  resolvedExpandedAtom,
  scrollToDiscussionRequestAtom,
  overviewSelectableItemsAtom,
  currentSelectionAtom,
  findCursorForItem,
  getScrollId,
  itemsEqual,
} from './overview-selection';
import type { SelectableItem } from './overview-selection';

export default function MergeRequestInfo() {
  const mergeRequest = useAtomValue(selectedMrAtom);
  const selection = useAtomValue(currentSelectionAtom);
  const selectableItems = useAtomValue(overviewSelectableItemsAtom);
  const [unresolvedExpanded, setUnresolvedExpanded] = useAtom(unresolvedExpandedAtom);
  const [resolvedExpanded, setResolvedExpanded] = useAtom(resolvedExpandedAtom);
  const [, setOverviewCursorIndex] = useAtom(overviewCursorIndexAtom);
  const [, setScrollRequest] = useAtom(scrollToDiscussionRequestAtom);

  const handleClickItem = (item: SelectableItem) => {
    const cursor = findCursorForItem(selectableItems, item);
    if (cursor >= 0) {
      setOverviewCursorIndex(cursor);
      setScrollRequest(getScrollId(item));
    }
  };

  const handleOpenDiscussion = (item: SelectableItem) => {
    if (!mergeRequest?.webUrl) return;
    const discussions = mergeRequest.discussions ?? [];
    let discussion;
    if (item.type === 'unresolved-discussion') {
      discussion = discussions.filter(d => d.resolvable && !d.resolved)[item.index];
    } else if (item.type === 'resolved-discussion') {
      discussion = discussions.filter(d => d.resolvable && d.resolved)[item.index];
    }
    if (discussion) {
      openUrl(`${mergeRequest.webUrl}#note_${discussion.id}`);
    }
  };

  const handleUnresolvedClick = useDoubleClick<number>({
    onSingleClick: (index) => handleClickItem({ type: 'unresolved-discussion', index }),
    onDoubleClick: (index) => handleOpenDiscussion({ type: 'unresolved-discussion', index }),
  });

  const handleResolvedClick = useDoubleClick<number>({
    onSingleClick: (index) => handleClickItem({ type: 'resolved-discussion', index }),
    onDoubleClick: (index) => handleOpenDiscussion({ type: 'resolved-discussion', index }),
  });

  const isSelected = (item: SelectableItem): boolean => {
    if (!selection) return false;
    return itemsEqual(item, selection);
  };

  const markdownStyle = useMemo(() => SyntaxStyle.fromStyles({
    "markup.heading.1": { fg: parseColor(Colors.ACCENT), bold: true },
    "markup.heading.2": { fg: parseColor(Colors.ACCENT), bold: true },
    "markup.heading.3": { fg: parseColor(Colors.ACCENT), bold: true },
    "markup.heading.4": { fg: parseColor(Colors.ACCENT) },
    "markup.heading.5": { fg: parseColor(Colors.ACCENT) },
    "markup.heading.6": { fg: parseColor(Colors.ACCENT) },
    "markup.heading": { fg: parseColor(Colors.ACCENT), bold: true },
    "markup.strong": { bold: true },
    "markup.italic": { italic: true },
    "markup.raw": { fg: parseColor(Colors.WARNING) },
    "markup.raw.block": { fg: parseColor(Colors.WARNING) },
    "markup.link": { fg: parseColor(Colors.INFO) },
    "markup.link.url": { fg: parseColor(Colors.INFO), underline: true },
    "markup.link.label": { fg: parseColor(Colors.INFO) },
    "markup.list": { fg: parseColor(Colors.NEUTRAL) },
    "markup.list.checked": { fg: parseColor(Colors.SUCCESS) },
    "markup.list.unchecked": { fg: parseColor(Colors.ERROR) },
    "markup.quote": { fg: parseColor(Colors.DIM), italic: true },
    "markup.strikethrough": { fg: parseColor(Colors.DIM), dim: true },
    "punctuation.special": { fg: parseColor(Colors.DIM) },
  }), []);

  if (!mergeRequest) return null;

  const renderDiscussionNote = (note: DiscussionNote, index: number) => {
    const isReply = index > 0; // First note is original, rest are replies
    const marginLeft = isReply ? 4 : 2;
    const marginLeftrrow = isReply ? "-> " : "";
    const authorColor = isReply ? Colors.INFO : Colors.NEUTRAL;
    const textColor = isReply ? Colors.SECONDARY : Colors.PRIMARY;

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
              style={{ fg: Colors.WARNING, attributes: TextAttributes.DIM }}
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
          style={{ fg: Colors.SUCCESS }}
          wrapMode='word'
        >
          All discussions resolved ✓
        </text>
      );
    }

    const headerSelected = isSelected({ type: 'unresolved-header' });
    const toggleLabel = unresolvedExpanded ? '▼' : '▶';

    return (
      <box style={{ flexDirection: "column", gap: 0, width: "100%" }}>
        <box
          id="unresolved-header"
          onMouseDown={() => {
            handleClickItem({ type: 'unresolved-header' });
            setUnresolvedExpanded(!unresolvedExpanded);
          }}
          style={{
            marginBottom: 1,
            backgroundColor: headerSelected ? Colors.SELECTED : undefined,
          }}
        >
          <text
            style={{
              fg: Colors.ERROR,
              attributes: TextAttributes.BOLD,
            }}
            wrapMode='word'
          >
            {`${toggleLabel} Unresolved Discussions (${unresolvedDiscussions.length})`}
          </text>
        </box>
        {unresolvedExpanded && unresolvedDiscussions.map((discussion, index) => {
          const selected = isSelected({ type: 'unresolved-discussion', index });
          return (
            <box
              key={discussion.id}
              id={`discussion-${index}`}
              onMouseDown={() => handleUnresolvedClick(index)}
              style={{
                flexDirection: "column",
                marginLeft: 2,
                marginBottom: 0,
                width: "100%",
                backgroundColor: selected ? Colors.SELECTED : Colors.BACKGROUND_ALT,
                padding: 1,
                border: selected,
                borderColor: selected ? Colors.SUCCESS : undefined
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

    const headerSelected = isSelected({ type: 'resolved-header' });
    const toggleLabel = resolvedExpanded ? '▼' : '▶';

    return (
      <box style={{ flexDirection: "column", gap: 0, width: "100%" }}>
        <box
          id="resolved-header"
          onMouseDown={() => {
            handleClickItem({ type: 'resolved-header' });
            setResolvedExpanded(!resolvedExpanded);
          }}
          style={{
            marginBottom: 1,
            backgroundColor: headerSelected ? Colors.SELECTED : undefined,
          }}
        >
          <text
            style={{
              fg: Colors.SUCCESS,
              attributes: TextAttributes.BOLD,
            }}
            wrapMode='word'
          >
            {`${toggleLabel} Resolved Discussions (${resolvedDiscussions.length})`}
          </text>
        </box>
        {resolvedExpanded && resolvedDiscussions.map((discussion, index) => {
          const selected = isSelected({ type: 'resolved-discussion', index });
          return (
            <box
              key={discussion.id}
              id={`resolved-discussion-${index}`}
              onMouseDown={() => handleResolvedClick(index)}
              style={{
                flexDirection: "column",
                marginLeft: 2,
                marginBottom: 0,
                width: "100%",
                backgroundColor: selected ? Colors.SELECTED : Colors.BACKGROUND_ALT,
                padding: 1,
                border: selected,
                borderColor: selected ? Colors.SUCCESS : undefined
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

      {mergeRequest.description && (
        <box style={{ width: "100%", marginBottom: 1 }}>
          <code
            content={mergeRequest.description}
            filetype="markdown"
            syntaxStyle={markdownStyle}
            style={{ width: "100%" }}
          />
        </box>
      )}

      <box style={{ marginBottom: 1, width: "100%" }}>
        {renderUnresolvedDiscussions(mergeRequest.discussions || [])}
      </box>

      <box style={{ marginBottom: 1, width: "100%" }}>
        {renderResolvedDiscussions(mergeRequest.discussions || [])}
      </box>
    </box>
  );
}
