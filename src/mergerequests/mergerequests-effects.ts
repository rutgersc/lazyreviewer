import type { MergeRequest } from "../components/MergeRequestPane";
import { getGitlabMrs, getGitlabMrsByProject, getMrPipeline, type GitlabMergeRequest } from "../gitlab/gitlabgraphql";
import { loadJiraTickets, type JiraIssue } from "../jira/jiraService";
import { loadCache, saveCache } from "../system/diskCache";
import { type MergeRequestState } from "../generated/gitlab-sdk";

function buildCacheKeys(selectedUserSelectionEntry: string, state: MergeRequestState) {
  const fixedEntry = selectedUserSelectionEntry.replace(' ', '-');
  return `mrs_${state}_${fixedEntry}`;
}

function processMrsWithJira(mrs: GitlabMergeRequest[], tickets: JiraIssue[]): MergeRequest[] {
  return mrs
    .map((mr): MergeRequest => ({
      ...mr,
      jiraIssues: mr.jiraIssueKeys.flatMap((jiraKey) =>
        tickets.filter((t) => t.key === jiraKey)
      ),
    }))
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

function getMrCacheFile(key: string) {
  return `debug/${key}_gitlab.json`;
}

function getJiraCacheFile(key: string) {
  return `debug/${key}_jira.json`;
}

export async function fetchMergeRequests(
  selectedUserSelectionEntry: string,
  selectedUsernames: string[],
  state: MergeRequestState = 'opened'
): Promise<MergeRequest[]> {
  if (selectedUsernames.length === 0) return [];

  const mrKey = buildCacheKeys(selectedUserSelectionEntry, state);
  const mrCacheFile = getMrCacheFile(mrKey);
  const jiraCacheFile = getJiraCacheFile(mrKey);

  const mrs = await getGitlabMrs(selectedUsernames, state);
  const jiraKeys = Array.from(new Set(mrs.flatMap((mr) => mr.jiraIssueKeys)));
  const tickets = await loadJiraTickets(jiraKeys);

  saveCache(mrCacheFile, mrs);
  saveCache(jiraCacheFile, tickets);

  return processMrsWithJira(mrs, tickets);
}

export async function fetchMergeRequestsByProject(
  selectedUserSelectionEntry: string,
  projectPath: string,
  state: MergeRequestState = 'opened'
): Promise<MergeRequest[]> {
  const mrKey = buildCacheKeys(selectedUserSelectionEntry, state);
  const mrCacheFile = getMrCacheFile(mrKey);
  const jiraCacheFile = getJiraCacheFile(mrKey);

  const mrs = await getGitlabMrsByProject(projectPath, state);
  const jiraKeys = Array.from(new Set(mrs.flatMap((mr) => mr.jiraIssueKeys)));
  const tickets = await loadJiraTickets(jiraKeys);

  saveCache(mrCacheFile, mrs);
  saveCache(jiraCacheFile, tickets);

  return processMrsWithJira(mrs, tickets);
}

export async function loadMergeRequests(
  selectedUserSelectionEntry: string,
  state: MergeRequestState = 'opened'
): Promise<MergeRequest[]> {
  const mrKey = buildCacheKeys(selectedUserSelectionEntry, state);
  const mrCacheFile = getMrCacheFile(mrKey);
  const jiraCacheFile = getJiraCacheFile(mrKey);

  const mrs = loadCache<GitlabMergeRequest[]>(mrCacheFile) ?? [];
  const tickets = loadCache<JiraIssue[]>(jiraCacheFile) ?? [];

  return processMrsWithJira(mrs, tickets);
}

export function getCachedMergeRequests(
  selectedUserSelectionEntry: string,
  state: MergeRequestState = 'opened'
): MergeRequest[] {

  const mrKey = buildCacheKeys(selectedUserSelectionEntry, state);
  const mrCacheFile = getMrCacheFile(mrKey);

  const cachedMrs = loadCache<GitlabMergeRequest[]>(mrCacheFile);
  if (!cachedMrs) {
    console.log(`[MR] No cache found for key: ${mrKey}`);
    return [];
  }

  const jiraKeys = Array.from(new Set(cachedMrs.flatMap((mr) => mr.jiraIssueKeys)));
  let cachedTickets: JiraIssue[] = [];
  if (jiraKeys.length > 0) {
    const jiraCacheFile = getJiraCacheFile(mrKey);
    cachedTickets = loadCache<JiraIssue[]>(jiraCacheFile) ?? [];
  }

  const result = processMrsWithJira(cachedMrs, cachedTickets);
  console.log(`[MR] Loaded ${result.length} MRs from cache for key: ${mrKey}`);
  return result;
}

export async function refetchMrPipeline(
  selectedUserSelectionEntry: string,
  mrId: string,
  projectPath: string,
  iid: string,
  state: MergeRequestState = 'opened'
): Promise<void> {
  console.log(`[Pipeline] Refetching pipeline for MR ${iid} (${mrId})`);

  const pipeline = await getMrPipeline(projectPath, iid);
  if (!pipeline) {
    console.log(`[Pipeline] No pipeline data returned for MR ${iid}`);
    return;
  }

  const mrKey = buildCacheKeys(selectedUserSelectionEntry, state);
  const mrCacheFile = getMrCacheFile(mrKey);

  const cachedMrs = loadCache<GitlabMergeRequest[]>(mrCacheFile);
  if (!cachedMrs) {
    console.log(`[Pipeline] No cache found, cannot update pipeline`);
    return;
  }

  const updatedMrs = cachedMrs.map(mr => {
    if (mr.id === mrId) {
      console.log(`[Pipeline] Updated pipeline for MR ${iid}`);
      return { ...mr, pipeline };
    }
    return mr;
  });

  saveCache(mrCacheFile, updatedMrs);
  console.log(`[Pipeline] Cache updated for MR ${iid}`);
}
