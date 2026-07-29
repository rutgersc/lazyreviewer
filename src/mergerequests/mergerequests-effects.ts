import { getMrPipelineAsEvent } from "../gitlab/gitlab-graphql";
import { Effect, Console } from "effect";
import { EventStorage } from "../events/events";

export const refetchMrPipeline = Effect.fn("refetchMrPipeline")(function* (
  mrId: string,
  projectPath: string,
  iid: string,
) {
  yield* Console.log(`[Pipeline] Refetching pipeline for MR ${iid} (${mrId})`);

  const eventStorage = yield* EventStorage
  const pipelineEvent = yield* getMrPipelineAsEvent(projectPath, iid);
  yield* eventStorage.appendEvent(pipelineEvent);
})
