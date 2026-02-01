import type { MergeRequestState } from "../graphql/generated/gitlab-base-types";
import { getSdk as getUpdateMrTargetBranchSdk } from "../graphql/update-mr-target-branch.generated";
import { GraphQLClient } from "graphql-request";
import { Effect, Console, Data } from "effect";
import { EventStorage } from "../events/events";
import { getMrPipelineAsEvent } from "../gitlab/gitlab-graphql";

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
