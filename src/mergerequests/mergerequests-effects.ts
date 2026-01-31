import type { MergeRequest } from "../domain/merge-request-schema";
import { getGitlabMrsAsEvent, getGitlabMrsByProject, getMrPipelineAsEvent } from "../gitlab/gitlab-graphql";
import { getBitbucketPrs } from "../bitbucket/bitbucketapi";
import type { MergeRequestState } from "../domain/merge-request-state";
import { ProjectMRCacheKey } from "./decide-fetch-mrs";
import { getSdk as getUpdateMrTargetBranchSdk } from "../graphql/update-mr-target-branch.generated";
import { SettingsService } from "../settings/settings";
import { GraphQLClient } from "graphql-request";
import { Effect, Console, Data } from "effect";
import { EventStorage } from "../events/events";
import { projectGitlabUserMrsFetchedEvent } from "../gitlab/gitlab-projections";

const processMrs = (mrs: MergeRequest[]) =>
  SettingsService.ensurePipelineJobsInSettings(mrs).pipe(
    Effect.as(mrs.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()))
  );

export const fetchMergeRequests = Effect.fn("getGitlabMrs")(function* (
  selectedUsernames: readonly string[],
  state: MergeRequestState = "opened"
) {
  if (selectedUsernames.length === 0) return [];

  const mrs =  projectGitlabUserMrsFetchedEvent(yield* getGitlabMrsAsEvent(selectedUsernames as string[], state));

  return yield* processMrs(mrs);
});

export class FetchMergeRequestsByProjectError extends Data.TaggedError("FetchMergeRequestsByProjectError")<{
  cause: unknown;
}> { }

export const fetchMergeRequestsByProject = Effect.fn("fetchMergeRequestsByProject")(function* (
  { repository, state }: ProjectMRCacheKey
) {
  let mrs: MergeRequest[];

  if (repository.provider === 'bitbucket') {
    yield* Console.log(`Fetching from BitBucket: ${repository.workspace}/${repository.repo}`);
    mrs = yield* getBitbucketPrs(repository.workspace, repository.repo, state);
  } else {
    yield* Console.log(`Fetching from GitLab: ${repository.id}`);
    mrs = yield* getGitlabMrsByProject(repository.id, state);
  }

  yield* Console.log(`Fetched ${mrs.length} merge requests`);

  return yield* processMrs(mrs);
})

export const refetchMrPipeline = Effect.fn("refetchMrPipeline")(function* (
  mrId: string,
  projectPath: string,
  iid: string,
) {
  yield* Console.log(`[Pipeline] Refetching pipeline for MR ${iid} (${mrId})`);

  const pipelineEvent = yield* getMrPipelineAsEvent(projectPath, iid);
  yield* EventStorage.appendEvent(pipelineEvent);
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
