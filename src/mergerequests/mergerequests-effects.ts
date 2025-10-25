import type { MergeRequest, GitlabMergeRequest, JiraIssue } from "../schemas/mergeRequestSchema";
import { getGitlabMrs, getGitlabMrsByProject, getMrPipeline } from "../gitlab/gitlabgraphql";
import { getBitbucketPrs } from "../bitbucket/bitbucketapi";
import { parseRepositoryId } from "../providers/repositoryParser";
import { loadJiraTickets } from "../jira/jiraService";
import { type MergeRequestState, getSdk } from "../generated/gitlab-sdk";
import { ensurePipelineJobsInSettings } from "../settings/settings";
import { GraphQLClient } from "graphql-request";
import { Effect } from "effect";

function processMrsWithJira(mrs: GitlabMergeRequest[], tickets: JiraIssue[]): MergeRequest[] {
  ensurePipelineJobsInSettings(mrs);

  return mrs
    .map((mr): MergeRequest => ({
      ...mr,
      jiraIssues: mr.jiraIssueKeys.flatMap((jiraKey) =>
        tickets.filter((t) => t.key === jiraKey)
      ),
    }))
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export async function fetchMergeRequests(
  selectedUserSelectionEntry: string,
  selectedUsernames: string[],
  state: MergeRequestState = 'opened'
): Promise<MergeRequest[]> {
  if (selectedUsernames.length === 0) return [];

  const mrs = await getGitlabMrs(selectedUsernames, state);
  const jiraKeys = Array.from(new Set(mrs.flatMap((mr) => mr.jiraIssueKeys)));
  const tickets = await loadJiraTickets(jiraKeys);

  return processMrsWithJira(mrs, tickets);
}

  // export const fetchMergeRequestsByProjectEffect =  Effect.tryPromise({
  //   try: () => fetchMergeRequestsByProject(key.selectionEntry, key.projectPath, key.state),
  //   catch: (error) => new Error(`Failed to fetch project MRs: ${error}`)
  // })

export async function fetchMergeRequestsByProject(
  selectedUserSelectionEntry: string,
  projectPath: string,
  state: MergeRequestState = 'opened'
): Promise<MergeRequest[]> {
  // Parse the repository ID to determine provider
  const parsed = parseRepositoryId(projectPath);
  let mrs: GitlabMergeRequest[];

  if (parsed.provider === 'bitbucket') {
    console.log(`[MR] Fetching from BitBucket: ${parsed.workspace}/${parsed.repo}`);
    mrs = await getBitbucketPrs(parsed.workspace, parsed.repo, state);
  } else {
    console.log(`[MR] Fetching from GitLab: ${projectPath}`);
    mrs = await getGitlabMrsByProject(projectPath, state);
  }

  const jiraKeys = Array.from(new Set(mrs.flatMap((mr) => mr.jiraIssueKeys)));
  const tickets = await loadJiraTickets(jiraKeys);

  return processMrsWithJira(mrs, tickets);
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

  console.log(`[Pipeline] Pipeline fetched for MR ${iid}`);
}

export async function retargetMergeRequest(
  selectedUserSelectionEntry: string,
  mrId: string,
  projectPath: string,
  iid: string,
  newTargetBranch: string,
  state: MergeRequestState = 'opened'
): Promise<{ success: boolean; error?: string }> {
  console.log(`[Retarget] Updating MR ${iid} to target branch: ${newTargetBranch}`);

  const endpoint = `https://git.elabnext.com/api/graphql`;
  const token = process.env.GITLAB_TOKEN;
  const client = new GraphQLClient(endpoint, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const sdk = getSdk(client);

  try {
    const result = await sdk.UpdateMRTargetBranch({
      projectPath,
      iid,
      targetBranch: newTargetBranch
    });

    if (result.mergeRequestUpdate?.errors && result.mergeRequestUpdate.errors.length > 0) {
      const errorMsg = result.mergeRequestUpdate.errors.join(', ');
      console.error(`[Retarget] Failed to update MR ${iid}:`, errorMsg);
      return { success: false, error: errorMsg };
    }

    console.log(`[Retarget] Successfully updated target branch for MR ${iid} to ${newTargetBranch}`);
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Retarget] Exception while updating MR ${iid}:`, errorMsg);
    return { success: false, error: errorMsg };
  }
}
