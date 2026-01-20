import { Stream, Effect } from "effect";
import { MrStateService } from "../mergerequests/mr-state-service";
import { ensurePipelineJobsInSettings } from "./settings";

export const ensurePipelineJobPriorityInSettings = Effect.gen(function* () {
  const mrStateService = yield* MrStateService
  return yield* mrStateService.changes.pipe(
    Stream.debounce("4 seconds"),
    Stream.tap(state => Effect.gen(function* () {
      const mrs = state.mrsByGid.values().toArray();
      ensurePipelineJobsInSettings(mrs);
    })),
    Stream.runDrain,
  )
})
