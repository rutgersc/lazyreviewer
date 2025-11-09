import type { MergeRequest } from "./mergeRequestSchema";
import type { GitlabMergeRequest } from "../gitlab/gitlab-schema";
import type { JiraIssue } from "../jira/jira-schema";
import { getGitlabMrs, getGitlabMrsByProject, getMrPipeline, getMrPipelineAsEvent } from "../gitlab/gitlabgraphql";
import { getBitbucketPrs } from "../bitbucket/bitbucketapi";
import { parseRepositoryId } from "./repositoryParser";
import { loadJiraTickets } from "../jira/jiraService";
import type { MergeRequestState } from "../graphql/generated/gitlab-base-types";
import { getSdk as getUpdateMrTargetBranchSdk } from "../graphql/update-mr-target-branch.generated";
import { ensurePipelineJobsInSettings } from "../settings/settings";
import { GraphQLClient } from "graphql-request";
import { Effect, Console, Data } from "effect";
import type { MRCacheKey, ProjectMRCacheKey } from "./mergerequests-caching-effects";
import { EventStorage } from "../events/events";

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

export const fetchMergeRequests = Effect.fn("getGitlabMrs")(function* (
  selectedUsernames: readonly string[],
  state: MergeRequestState = "opened"
) {
  if (selectedUsernames.length === 0) return [];

  const mrs = yield* getGitlabMrs(selectedUsernames as string[], state);
  const jiraKeys = Array.from(new Set(mrs.flatMap((mr) => mr.jiraIssueKeys)));
  const tickets = yield* loadJiraTickets(jiraKeys);

  return processMrsWithJira(mrs, tickets);
});

export class FetchMergeRequestsByProjectError extends Data.TaggedError("FetchMergeRequestsByProjectError")<{
  cause: unknown;
}> { }

export const fetchMergeRequestsByProject = Effect.fn("fetchMergeRequestsByProject")(function* (
  { projectPath, state }: ProjectMRCacheKey
) {
  const parsed = parseRepositoryId(projectPath);
  let mrs: GitlabMergeRequest[];

  if (parsed.provider === 'bitbucket') {
    yield* Console.log(`Fetching from BitBucket: ${parsed.workspace}/${parsed.repo}`);
    mrs = yield* getBitbucketPrs(parsed.workspace, parsed.repo, state);
  } else {
    yield* Console.log(`Fetching from GitLab: ${projectPath}`);
    mrs = yield* getGitlabMrsByProject(projectPath, state);
  }

  yield* Console.log(`Fetched ${mrs.length} merge requests`);

  const jiraKeys = Array.from(new Set(mrs.flatMap((mr) => mr.jiraIssueKeys)));
  yield* Console.log(`Loading ${jiraKeys.length} Jira tickets`);
  const tickets = yield* loadJiraTickets(jiraKeys);

  return processMrsWithJira(mrs, tickets);
})

export const refetchMrPipeline = Effect.fn("refetchMrPipeline")(function* (
  selectedUserSelectionEntry: string,
  mrId: string,
  projectPath: string,
  iid: string,
  state: MergeRequestState = 'opened'
) {
  yield* Console.log(`[Pipeline] Refetching pipeline for MR ${iid} (${mrId})`);

  const eventStorage = yield* EventStorage;
  const pipelineEvent = yield* getMrPipelineAsEvent(projectPath, iid);

  yield* eventStorage.appendEvent(pipelineEvent);
  yield* Console.log(`[Pipeline] Pipeline event appended for MR ${iid}`);
})

export class RetargetMergeRequestError extends Data.TaggedError("RetargetMergeRequestError")<{
  cause: unknown;
}> { }

export const retargetMergeRequest = Effect.fn("retargetMergeRequest")(function* (
  selectedUserSelectionEntry: string,
  mrId: string,
  projectPath: string,
  iid: string,
  newTargetBranch: string,
  state: MergeRequestState = 'opened'
) {
  yield* Console.log(`[Retarget] Updating MR ${iid} to target branch: ${newTargetBranch}`);

  const endpoint = `https://git.elabnext.com/api/graphql`;
  const token = process.env.GITLAB_TOKEN;
  const client = new GraphQLClient(endpoint, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const sdk = getUpdateMrTargetBranchSdk(client);

  const result = yield* Effect.tryPromise({
    try: () => sdk.UpdateMRTargetBranch({
      projectPath,
      iid,
      targetBranch: newTargetBranch
    }),
    catch: cause => new RetargetMergeRequestError({ cause })
  });

  if (result.mergeRequestUpdate?.errors && result.mergeRequestUpdate.errors.length > 0) {
    const errorMsg = result.mergeRequestUpdate.errors.join(', ');
    yield* Console.error(`[Retarget] Failed to update MR ${iid}:`, errorMsg);
    return { success: false, error: errorMsg };
  }

  yield* Console.log(`[Retarget] Successfully updated target branch for MR ${iid} to ${newTargetBranch}`);
  return { success: true };
})
