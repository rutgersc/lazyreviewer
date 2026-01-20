import { Path } from "@effect/platform"
import { Layer, Effect, Runtime, Scope, Stream } from "effect"
import * as FileSystem from "@effect/platform-node/NodeFileSystem"
import * as CommandExecutor from "@effect/platform-node/NodeCommandExecutor"
import { Atom } from "@effect-atom/atom-react"
import { EventStorage, type AnyLazyReviewerEvent } from "./events/events"
import { JiraScrollService } from "./jira/jira-scroll-service"
import { DiscussionScrollService } from "./discussion/discussion-scroll-service"
import { BackgroundSyncService } from "./notifications/background-sync-service"
import { PipelineJobMonitor } from "./gitlab/gitlab-pipeline-job-monitor-backgroundworker"
import { MrStateService } from "./mergerequests/mr-state-service"
import { type Projection, project } from "./utils/define-projection"

const fileSystemLayer = Layer.merge(FileSystem.layer, Path.layer)
const commandExecutorLayer = CommandExecutor.layer.pipe(
  Layer.provide(fileSystemLayer)
)

const eventStorageLayer = EventStorage.Default.pipe(
  Layer.provide(fileSystemLayer)
)

const mrStateServiceLayer = MrStateService.Default.pipe(
  Layer.provide(eventStorageLayer)
)

const pipelineJobMonitorLayer = PipelineJobMonitor.Default.pipe(
  Layer.provide(mrStateServiceLayer),
  Layer.provide(eventStorageLayer),
)

export const appLayer = Layer.mergeAll(
  pipelineJobMonitorLayer,
  eventStorageLayer,
  fileSystemLayer,
  commandExecutorLayer,
  JiraScrollService.Default,
  DiscussionScrollService.Default,
  BackgroundSyncService.Default,
  mrStateServiceLayer
)

// Build a shared runtime using the atom system's memoMap
// This ensures services are shared between atoms and standalone effects
type AppLayerContext = Layer.Layer.Success<typeof appLayer>
let _appRuntimePromise: Promise<Runtime.Runtime<AppLayerContext>> | undefined
const buildRuntime = Effect.gen(function* () {
  const scope = yield* Scope.make()
  const context = yield* Layer.buildWithMemoMap(appLayer, Atom.runtime.memoMap, scope)
  return Runtime.make({
    context,
    fiberRefs: Runtime.defaultRuntime.fiberRefs,
    runtimeFlags: Runtime.defaultRuntime.runtimeFlags
  })
})

export const getAppRuntime = (): Promise<Runtime.Runtime<AppLayerContext>> => {
  if (!_appRuntimePromise) {
    _appRuntimePromise = Effect.runPromise(buildRuntime)
  }
  return _appRuntimePromise
}

// Atom runtime - shares services via the same memoMap
export const appAtomRuntime = Atom.runtime(appLayer)

export const makeProjectedAtomFromProjection = <S, E extends AnyLazyReviewerEvent>(
  stream: Effect.Effect<Stream.Stream<AnyLazyReviewerEvent, never, never>, never, EventStorage>,
  projection: Projection<S, E>
) => {
  return appAtomRuntime.atom(
    Stream.unwrap(stream).pipe(project(projection)),
    { initialValue: projection.initialState }
  );
};
