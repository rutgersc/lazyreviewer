import { Atom } from "effect/unstable/reactivity";
import { selectedMrAtom, selectedMergeRequestJiraIssuesAtom } from "../mergerequests/mergerequests-atom";
import { buildJiraListItems } from "../jira/jira-hierarchy";
import { commentsNewestFirst, jiraCommentUrl, jiraIssueUrl } from "../jira/jira-display";
import type { JiraIssue } from "../jira/jira-schema";

export const overviewCursorIndexAtom = Atom.make<number>(0);
export const unresolvedExpandedAtom = Atom.make<boolean>(true);
export const resolvedExpandedAtom = Atom.make<boolean>(false);
export const jiraCommentsExpandedAtom = Atom.make<ReadonlySet<string>>(new Set<string>() satisfies ReadonlySet<string>);
export const scrollToDiscussionRequestAtom = Atom.make<string | null>(null);

export type JiraCommentSection = {
  issueKey: string;
  commentCount: number;
};

export type JiraHierarchyRowRef = {
  parentIssueIndex: number;
  subIndex: number;
};

export type OverviewSections = {
  unresolvedCount: number;
  resolvedCount: number;
  unresolvedExpanded: boolean;
  resolvedExpanded: boolean;
  jiraHierarchyRows: readonly JiraHierarchyRowRef[];
  jiraCommentSections: readonly JiraCommentSection[];
  jiraCommentsExpanded: ReadonlySet<string>;
};

export const overviewSectionsAtom = Atom.make((get): OverviewSections => {
  const selectedMr = get(selectedMrAtom);
  const discussions = selectedMr?.discussions ?? [];
  const jiraIssues = get(selectedMergeRequestJiraIssuesAtom);

  return {
    unresolvedCount: discussions.filter(d => d.resolvable && !d.resolved).length,
    resolvedCount: discussions.filter(d => d.resolvable && d.resolved).length,
    unresolvedExpanded: get(unresolvedExpandedAtom),
    resolvedExpanded: get(resolvedExpandedAtom),
    jiraHierarchyRows: buildJiraListItems(jiraIssues).map(({ parentIssueIndex, subIndex }) => ({ parentIssueIndex, subIndex })),
    jiraCommentSections: jiraIssues.map(issue => ({
      issueKey: issue.key,
      commentCount: issue.fields.comment.comments.length,
    })),
    jiraCommentsExpanded: get(jiraCommentsExpandedAtom),
  };
});

export const overviewSelectableItemsAtom = Atom.make((get) =>
  buildSelectableItems(get(overviewSectionsAtom))
);

export const currentSelectionAtom = Atom.make((get) => {
  const items = get(overviewSelectableItemsAtom);
  const cursor = get(overviewCursorIndexAtom);
  return items[Math.min(cursor, Math.max(0, items.length - 1))];
});

export type SelectableItem =
  | { type: 'jira-issue'; parentIssueIndex: number; subIndex: number }
  | { type: 'unresolved-header' }
  | { type: 'unresolved-discussion'; index: number }
  | { type: 'resolved-header' }
  | { type: 'resolved-discussion'; index: number }
  | { type: 'jira-comments-header'; issueKey: string }
  | { type: 'jira-comment'; issueKey: string; index: number }

export function buildSelectableItems(sections: OverviewSections): SelectableItem[] {
  const { unresolvedCount, resolvedCount, unresolvedExpanded, resolvedExpanded, jiraHierarchyRows, jiraCommentSections, jiraCommentsExpanded } = sections;

  const range = (count: number) => Array.from({ length: count }, (_, index) => index);

  const hierarchyItems: SelectableItem[] = jiraHierarchyRows.map(({ parentIssueIndex, subIndex }) => ({ type: 'jira-issue', parentIssueIndex, subIndex }));

  const unresolvedItems: SelectableItem[] = unresolvedCount === 0 ? [] : [
    { type: 'unresolved-header' },
    ...(unresolvedExpanded ? range(unresolvedCount).map((index): SelectableItem => ({ type: 'unresolved-discussion', index })) : []),
  ];

  const resolvedItems: SelectableItem[] = resolvedCount === 0 ? [] : [
    { type: 'resolved-header' },
    ...(resolvedExpanded ? range(resolvedCount).map((index): SelectableItem => ({ type: 'resolved-discussion', index })) : []),
  ];

  const jiraItems: SelectableItem[] = jiraCommentSections.flatMap(({ issueKey, commentCount }) => [
    { type: 'jira-comments-header', issueKey } satisfies SelectableItem,
    ...(jiraCommentsExpanded.has(issueKey)
      ? range(commentCount).map((index): SelectableItem => ({ type: 'jira-comment', issueKey, index }))
      : []),
  ]);

  return [...hierarchyItems, ...unresolvedItems, ...resolvedItems, ...jiraItems];
}

// Scroll ids are unique per item, so they double as the identity comparison.
export function itemsEqual(a: SelectableItem, b: SelectableItem): boolean {
  return getScrollId(a) === getScrollId(b);
}

export function findCursorForItem(items: SelectableItem[], target: SelectableItem): number {
  return items.findIndex(item => itemsEqual(item, target));
}

export function getScrollId(item: SelectableItem): string {
  switch (item.type) {
    case 'jira-issue': return `jira-item-${item.parentIssueIndex}-${item.subIndex}`;
    case 'unresolved-header': return 'unresolved-header';
    case 'unresolved-discussion': return `discussion-${item.index}`;
    case 'resolved-header': return 'resolved-header';
    case 'resolved-discussion': return `resolved-discussion-${item.index}`;
    case 'jira-comments-header': return `jira-comments-header-${item.issueKey}`;
    case 'jira-comment': return `jira-comment-${item.issueKey}-${item.index}`;
  }
}

export function jiraUrlForItem(item: SelectableItem, jiraIssues: readonly JiraIssue[]): string | null {
  if (item.type === 'jira-issue') {
    const row = buildJiraListItems(jiraIssues)
      .find(r => r.parentIssueIndex === item.parentIssueIndex && r.subIndex === item.subIndex);
    return row ? jiraIssueUrl(row.issue) : null;
  }

  if (item.type === 'jira-comment') {
    const issue = jiraIssues.find(i => i.key === item.issueKey);
    const comment = issue && commentsNewestFirst(issue)[item.index];
    return issue && comment ? jiraCommentUrl(issue, comment.id) : null;
  }

  return null;
}

export function toggleJiraCommentsExpanded(expanded: ReadonlySet<string>, issueKey: string): ReadonlySet<string> {
  const next = new Set(expanded);
  if (!next.delete(issueKey)) next.add(issueKey);
  return next;
}
