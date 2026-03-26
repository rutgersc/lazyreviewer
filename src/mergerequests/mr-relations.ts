import type { MergeRequest } from "./mergerequest-schema";
import type { JiraIssue } from "../jira/jira-schema";
import type { MrGid } from "../domain/identifiers";

export type RelationType =
  | { readonly _tag: 'stack-base' }
  | { readonly _tag: 'stacked-on-this' }
  | { readonly _tag: 'same-ticket' }
  | { readonly _tag: 'sibling-ticket' };

export type SelectedMrContext = {
  readonly selectedMr: MergeRequest;
  readonly selectedKeys: ReadonlySet<string>;
  readonly selectedTicketKey: string | undefined;
  readonly selectedParentKey: string | undefined;
};

export const buildSelectedMrContext = (selectedMr: MergeRequest, jiraIssuesMap: ReadonlyMap<string, JiraIssue>): SelectedMrContext => {
  const selectedKeys = new Set(selectedMr.jiraIssueKeys);
  const selectedIssues = selectedMr.jiraIssueKeys.flatMap(k => {
    const issue = jiraIssuesMap.get(k);
    return issue ? [issue] : [];
  });
  const selectedTicketKey = selectedIssues[0]?.key;
  const selectedIsSubtask = selectedIssues[0]?.fields.issuetype.name.toLowerCase().includes('sub-task');
  const selectedParentKey = selectedIsSubtask ? selectedIssues[0]?.fields.parent?.key : undefined;
  return { selectedMr, selectedKeys, selectedTicketKey, selectedParentKey };
};

export const getRelationType = (ctx: SelectedMrContext, mr: MergeRequest, jiraIssuesMap: ReadonlyMap<string, JiraIssue>): RelationType | null => {
  const sameProject = ctx.selectedMr.project.fullPath === mr.project.fullPath;
  if (sameProject && ctx.selectedMr.targetbranch === mr.sourcebranch) return { _tag: 'stack-base' };
  if (sameProject && mr.targetbranch === ctx.selectedMr.sourcebranch) return { _tag: 'stacked-on-this' };

  const mrIssues = mr.jiraIssueKeys.flatMap(k => {
    const issue = jiraIssuesMap.get(k);
    return issue ? [issue] : [];
  });
  const mrTicketKey = mrIssues[0]?.key;

  if (ctx.selectedTicketKey && mrTicketKey === ctx.selectedTicketKey) return { _tag: 'same-ticket' };

  if (ctx.selectedParentKey) {
    const mrParentKey = mrIssues[0]?.fields.parent?.key;
    if (mrParentKey === ctx.selectedParentKey) return { _tag: 'sibling-ticket' };
  }

  if (mr.jiraIssueKeys.some(key => ctx.selectedKeys.has(key))) return { _tag: 'same-ticket' };

  return null;
};

export const relationTagOrder: readonly RelationType['_tag'][] = ['stack-base', 'stacked-on-this', 'same-ticket', 'sibling-ticket'];

export const getOutOfViewRelatedGids = (
  selectedMr: MergeRequest,
  jiraIssuesMap: ReadonlyMap<string, JiraIssue>,
  visibleGids: ReadonlySet<MrGid>,
  allMrsByGid: ReadonlyMap<MrGid, MergeRequest>,
): ReadonlySet<MrGid> => {
  const ctx = buildSelectedMrContext(selectedMr, jiraIssuesMap);
  const gids = new Set<MrGid>();

  for (const mr of allMrsByGid.values()) {
    if (visibleGids.has(mr.id)) continue;
    if (mr.id === selectedMr.id) continue;
    if (mr.state !== 'opened') continue;

    const rel = getRelationType(ctx, mr, jiraIssuesMap);
    if (rel) gids.add(mr.id);
  }
  return gids;
};
