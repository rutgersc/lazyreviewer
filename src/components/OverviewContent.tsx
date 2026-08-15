import { TextAttributes } from '@opentui/core';
import type { Discussion, DiscussionNote } from '../domain/merge-request-schema';
import type { JiraIssue } from '../jira/jira-schema';
import { formatCompactTime } from '../utils/formatting';
import { Colors } from '../colors';
import { useDoubleClick } from '../hooks/useDoubleClick';
import { useAtom, useAtomValue } from "@effect/atom-react";
import { selectedMrAtom, selectedMergeRequestJiraIssuesAtom } from '../mergerequests/mergerequests-atom';
import { openUrl } from '../system/open-url';
import { JiraHierarchyRow } from './JiraHierarchy';
import { buildJiraListItems } from '../jira/jira-hierarchy';
import { JiraCommentRow } from './JiraCommentRow';
import { commentsNewestFirst } from '../jira/jira-display';
import {
  overviewCursorIndexAtom,
  unresolvedExpandedAtom,
  resolvedExpandedAtom,
  jiraCommentsExpandedAtom,
  scrollToDiscussionRequestAtom,
  overviewSelectableItemsAtom,
  currentSelectionAtom,
  findCursorForItem,
  getScrollId,
  itemsEqual,
  toggleJiraCommentsExpanded,
  jiraUrlForItem,
} from './overview-selection';
import type { SelectableItem } from './overview-selection';

// useDoubleClick compares its payload by reference, and rows are rebuilt every render,
// so clicks travel as a string key that indexes back into a lookup.
const itemKey = (item: SelectableItem) => getScrollId(item);

export default function OverviewContent() {
  const mergeRequest = useAtomValue(selectedMrAtom);
  const jiraIssues = useAtomValue(selectedMergeRequestJiraIssuesAtom);
  const selection = useAtomValue(currentSelectionAtom);
  const selectableItems = useAtomValue(overviewSelectableItemsAtom);
  const [unresolvedExpanded, setUnresolvedExpanded] = useAtom(unresolvedExpandedAtom);
  const [resolvedExpanded, setResolvedExpanded] = useAtom(resolvedExpandedAtom);
  const [jiraCommentsExpanded, setJiraCommentsExpanded] = useAtom(jiraCommentsExpandedAtom);
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

  const jiraListItems = buildJiraListItems(jiraIssues);

  const itemByKey = new Map<string, SelectableItem>(selectableItems.map(item => [itemKey(item), item]));

  const handleJiraClick = useDoubleClick<string>({
    onSingleClick: (key) => {
      const item = itemByKey.get(key);
      if (item) handleClickItem(item);
    },
    onDoubleClick: (key) => {
      const item = itemByKey.get(key);
      const url = item && jiraUrlForItem(item, jiraIssues);
      if (url) openUrl(url);
    },
  });

  const isSelected = (item: SelectableItem): boolean => {
    if (!selection) return false;
    return itemsEqual(item, selection);
  };

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

  const renderSectionHeader = (
    item: SelectableItem,
    label: string,
    color: string,
    expanded: boolean,
    onToggle: () => void,
  ) => (
    <box
      id={getScrollId(item)}
      onMouseDown={() => {
        handleClickItem(item);
        onToggle();
      }}
      style={{
        marginBottom: 1,
        ...(isSelected(item) && { backgroundColor: Colors.SELECTED }),
      }}
    >
      <text style={{ fg: color, attributes: TextAttributes.BOLD }} wrapMode='word'>
        {`${expanded ? '▼' : '▶'} ${label}`}
      </text>
    </box>
  );

  const renderJiraHierarchy = () => {
    if (jiraIssues.length === 0) {
      return (
        <text style={{ fg: Colors.NEUTRAL, attributes: TextAttributes.DIM }} wrapMode='none'>
          No Jira tickets
        </text>
      );
    }

    return (
      <box style={{ flexDirection: "column", gap: 0, width: "100%" }}>
        {jiraListItems.map(item => {
          const selectable: SelectableItem = { type: 'jira-issue', parentIssueIndex: item.parentIssueIndex, subIndex: item.subIndex };
          return (
            <JiraHierarchyRow
              key={`${item.parentIssueIndex}-${item.subIndex}`}
              item={item}
              selected={isSelected(selectable)}
              onMouseDown={() => handleJiraClick(itemKey(selectable))}
            />
          );
        })}
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

    return (
      <box style={{ flexDirection: "column", gap: 0, width: "100%" }}>
        {renderSectionHeader(
          { type: 'unresolved-header' },
          `Unresolved Discussions (${unresolvedDiscussions.length})`,
          Colors.ERROR,
          unresolvedExpanded,
          () => setUnresolvedExpanded(!unresolvedExpanded),
        )}
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
                ...(selected && { borderColor: Colors.SUCCESS }),
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

    return (
      <box style={{ flexDirection: "column", gap: 0, width: "100%" }}>
        {renderSectionHeader(
          { type: 'resolved-header' },
          `Resolved Discussions (${resolvedDiscussions.length})`,
          Colors.SUCCESS,
          resolvedExpanded,
          () => setResolvedExpanded(!resolvedExpanded),
        )}
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
                ...(selected && { borderColor: Colors.SUCCESS }),
              }}
            >
              {discussion.notes.map(renderDiscussionNote)}
            </box>
          );
        })}
      </box>
    );
  };

  const renderJiraComments = (issue: JiraIssue) => {
    const comments = commentsNewestFirst(issue);
    const expanded = jiraCommentsExpanded.has(issue.key);

    return (
      <box key={issue.key} style={{ flexDirection: "column", gap: 0, width: "100%", marginBottom: 1 }}>
        {renderSectionHeader(
          { type: 'jira-comments-header', issueKey: issue.key },
          `${issue.key} Comments (${comments.length})`,
          Colors.INFO,
          expanded,
          () => setJiraCommentsExpanded(toggleJiraCommentsExpanded(jiraCommentsExpanded, issue.key)),
        )}
        {expanded && comments.map((comment, index) => (
          <JiraCommentRow
            key={comment.id}
            comment={comment}
            id={getScrollId({ type: 'jira-comment', issueKey: issue.key, index })}
            selected={isSelected({ type: 'jira-comment', issueKey: issue.key, index })}
            onMouseDown={() => handleJiraClick(itemKey({ type: 'jira-comment', issueKey: issue.key, index }))}
          />
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

      <box style={{ width: "100%" }}>
        {renderJiraHierarchy()}
      </box>

      <box style={{ marginBottom: 1, width: "100%" }}>
        {renderUnresolvedDiscussions(mergeRequest.discussions || [])}
      </box>

      <box style={{ marginBottom: 1, width: "100%" }}>
        {renderResolvedDiscussions(mergeRequest.discussions || [])}
      </box>

      <box style={{ flexDirection: "column", gap: 0, width: "100%" }}>
        {jiraIssues.map(renderJiraComments)}
      </box>
    </box>
  );
}
