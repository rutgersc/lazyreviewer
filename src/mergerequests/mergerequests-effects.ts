import type { MergeRequest } from "../domain/merge-request-schema";
import { getGitlabMrsAsEvent, getGitlabMrsByProject, getMrPipelineAsEvent } from "../gitlab/gitlab-graphql";
import { getBitbucketPrs } from "../bitbucket/bitbucketapi";
import type { MergeRequestState } from "../domain/merge-request-state";
import { ProjectMRCacheKey } from "./decide-fetch-mrs";
import { SettingsService } from "../settings/settings";
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

