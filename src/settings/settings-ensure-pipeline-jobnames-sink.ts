import { Stream, Effect } from "effect";
import { MrStateService } from "../mergerequests/mr-state-service";
import { SettingsService } from "./settings";

export const ensurePipelineJobPriorityInSettings = Effect.gen(function* () {
  const mrStateService = yield* MrStateService
  const settingsService = yield* SettingsService
  return yield* mrStateService.changes.pipe(
    Stream.debounce("4 seconds"),
    Stream.tap(state =>
      settingsService.ensurePipelineJobsInSettings(state.mrsByGid.values().toArray())
    ),
    Stream.runDrain,
  )
})
