import { Stream, Effect } from "effect";
import { MrStateService } from "../mergerequests/mr-state-service";
import { SettingsService } from "./settings";

export const ensurePipelineJobPriorityInSettings = Effect.gen(function* () {
  const mrStateService = yield* MrStateService
  return yield* mrStateService.changes.pipe(
    Stream.debounce("4 seconds"),
    Stream.tap(state =>
      SettingsService.ensurePipelineJobsInSettings(state.mrsByGid.values().toArray())
    ),
    Stream.runDrain,
  )
})
