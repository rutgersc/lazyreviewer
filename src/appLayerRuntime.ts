import { Layer, Effect, Scope, Stream, ServiceMap } from "effect"
import * as NodeServices from "@effect/platform-node/NodeServices"
import { Atom } from "effect/unstable/reactivity"
import { EventStorage, type AnyLazyReviewerEvent } from "./events/events"
import { JiraScrollService } from "./jira/jira-scroll-service"
import { DiscussionScrollService } from "./discussion/discussion-scroll-service"
import { BackgroundSyncService } from "./notifications/background-sync-service"
import { PipelineJobMonitor } from "./gitlab/gitlab-pipeline-job-monitor-backgroundworker"
import { MrStateService } from "./mergerequests/mr-state-service"
import { BgSyncReadModelService } from "./notifications/bg-sync-read-model"
import { SettingsService } from "./settings/settings"
import { UserSettingsService } from "./settings/user-filter-presets"
import { type Projection, project } from "./utils/define-projection"

const nodeServicesLayer = NodeServices.layer

const settingsServiceLayer = Layer.effect(SettingsService)(SettingsService.make).pipe(
  Layer.provide(nodeServicesLayer)
)

const userSettingsServiceLayer = Layer.effect(UserSettingsService)(UserSettingsService.make).pipe(
  Layer.provide(nodeServicesLayer)
)

const eventStorageLayer = Layer.effect(EventStorage)(EventStorage.make).pipe(
  Layer.provide(nodeServicesLayer)
)

const mrStateServiceLayer = Layer.effect(MrStateService)(MrStateService.make).pipe(
  Layer.provide(eventStorageLayer)
)

const bgSyncReadModelLayer = Layer.effect(BgSyncReadModelService)(BgSyncReadModelService.make).pipe(
  Layer.provide(eventStorageLayer)
)

const pipelineJobMonitorLayer = Layer.effect(PipelineJobMonitor)(PipelineJobMonitor.make).pipe(
  Layer.provide(mrStateServiceLayer),
  Layer.provide(eventStorageLayer),
  Layer.provide(settingsServiceLayer),
)

export const appLayer = Layer.mergeAll(
  pipelineJobMonitorLayer,
  eventStorageLayer,
  nodeServicesLayer,
  settingsServiceLayer,
  userSettingsServiceLayer,
  Layer.effect(JiraScrollService)(JiraScrollService.make),
  Layer.effect(DiscussionScrollService)(DiscussionScrollService.make),
  Layer.effect(BackgroundSyncService)(BackgroundSyncService.make),
  mrStateServiceLayer,
  bgSyncReadModelLayer
)

// Build a shared runtime using the atom system's memoMap
// This ensures services are shared between atoms and standalone effects
type AppLayerContext = Layer.Success<typeof appLayer>
let _appServiceMapPromise: Promise<ServiceMap.ServiceMap<AppLayerContext>> | undefined
const buildServiceMap = Effect.gen(function* () {
  const scope = yield* Scope.make()
  return yield* Layer.buildWithMemoMap(appLayer, Atom.runtime.memoMap, scope)
})

export const getAppServiceMap = (): Promise<ServiceMap.ServiceMap<AppLayerContext>> => {
  if (!_appServiceMapPromise) {
    _appServiceMapPromise = Effect.runPromise(buildServiceMap)
  }
  return _appServiceMapPromise
}

export const runWithAppServices = async <A, E>(effect: Effect.Effect<A, E, AppLayerContext>): Promise<A> => {
  const serviceMap = await getAppServiceMap()
  return Effect.runPromiseWith(serviceMap)(effect)
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
