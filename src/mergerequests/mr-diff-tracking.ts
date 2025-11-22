import { Data, Stream, Effect } from "effect";
import { Atom } from "@effect-atom/atom-react";
import { EventStorage, type Event } from "../events/events";
import { appAtomRuntime } from "../appLayerRuntime";
import type { MrRelevantEvent } from "./mergerequests-caching-effects";

export class OpenMrsTrackingState extends Data.TaggedClass("OpenMrsTrackingState")<{
  readonly knownMrsById: ReadonlyMap<string, {
    state: string
    authorUsername?: string
    projectFullPath: string
  }>
  readonly detectedMissingMrIds: ReadonlySet<string>
}> {}

export const initialOpenMrsTrackingState = new OpenMrsTrackingState({
  knownMrsById: new Map(),
  detectedMissingMrIds: new Set()
})

export const projectOpenMrsAndDetectMissing = (
  state: OpenMrsTrackingState,
  event: MrRelevantEvent
): OpenMrsTrackingState => {
  if (event.type === 'gitlab-user-mrs-fetched-event') {
    const nextState = event.forUsernames.reduce(
      (acc, username) => {

        const userMrs = event.mrs.users?.nodes?.find(u => u?.username === username)?.authoredMergeRequests?.nodes || [];
        const validUserMrs = userMrs.filter((mr): mr is NonNullable<typeof mr> => !!(mr && mr.id));
        const incomingIds = new Set(validUserMrs.map(mr => mr.id));
        const currentMissing = new Set(acc.detectedMissingMrIds);
        const missingAfterArrivals = new Set(
            [...currentMissing].filter(id => !incomingIds.has(id))
        );
        // Add newly detected missing MRs
        const expectedIds = [...acc.knownMrsById.entries()]
          .filter(([, info]) => info.authorUsername === username && info.state === event.forState)
          .map(([id]) => id);
        const newlyMissing = expectedIds.filter(id => !incomingIds.has(id));

        const entriesToAdd = validUserMrs.map(mr => [
          mr.id,
          {
              state: mr.state,
              authorUsername: username,
              projectFullPath: mr.project?.fullPath || acc.knownMrsById.get(mr.id)?.projectFullPath || ""
          }
        ] as const);

        return {
          knownMrsById: new Map([...acc.knownMrsById, ...entriesToAdd]),
          detectedMissingMrIds: new Set([...missingAfterArrivals, ...newlyMissing])
        };
      },
      {
        knownMrsById: state.knownMrsById,
        detectedMissingMrIds: state.detectedMissingMrIds
      }
    );

    return new OpenMrsTrackingState(nextState);
  }

  if (event.type === 'gitlab-project-mrs-fetched-event') {
    const projectPath = event.forProjectPath;

    // 1. Identify incoming MRs
    const projectMrs = event.mrs.project?.mergeRequests?.nodes || [];
    const validProjectMrs = projectMrs.filter((mr): mr is NonNullable<typeof mr> => !!(mr && mr.id));
    const incomingIds = new Set(validProjectMrs.map(mr => mr.id));

    // 2. Compute new Known MRs Map (Immutable update)
    const entriesToAdd = validProjectMrs.map(mr => {
        const authorUsername = mr.author?.username || state.knownMrsById.get(mr.id)?.authorUsername;
        return [
            mr.id,
            {
                state: mr.state,
                authorUsername: authorUsername,
                projectFullPath: projectPath
            }
        ] as const;
    });

    const newKnownMrsById = new Map([...state.knownMrsById, ...entriesToAdd]);

    // 3. Identify expected MRs based on PREVIOUS known state
    const expectedIds = [...state.knownMrsById.entries()]
      .filter(([, info]) => info.projectFullPath === projectPath && info.state === event.forState)
      .map(([id]) => id);

    // 4. Compute new Missing MR IDs (Immutable update)
    const currentMissing = new Set(state.detectedMissingMrIds);

    // Remove incoming MRs from missing list
    const missingAfterArrivals = new Set(
        [...currentMissing].filter(id => !incomingIds.has(id))
    );

    // Add newly detected missing MRs
    const newlyMissing = expectedIds.filter(id => !incomingIds.has(id));

    const newMissingMrIds = new Set([...missingAfterArrivals, ...newlyMissing]);

    return new OpenMrsTrackingState({
      knownMrsById: newKnownMrsById,
      detectedMissingMrIds: newMissingMrIds
    });
  }

  if (event.type === 'gitlab-single-mr-fetched-event') {
    const mr = event.mr.project?.mergeRequest;
    if (mr && mr.id) {
        // 1. Update Known MRs (Immutable update)
        const existing = state.knownMrsById.get(mr.id);
        const updatedInfo = {
            state: mr.state,
            authorUsername: mr.author?.username || existing?.authorUsername,
            projectFullPath: mr.project?.fullPath || existing?.projectFullPath || event.forProjectPath
        };
        const newKnownMrsById = new Map([...state.knownMrsById, [mr.id, updatedInfo]]);

        // 2. Update Missing MRs (Immutable update - remove reconciled MR)
        const newMissingMrIds = new Set(
            [...state.detectedMissingMrIds].filter(id => id !== mr.id)
        );

        return new OpenMrsTrackingState({
            knownMrsById: newKnownMrsById,
            detectedMissingMrIds: newMissingMrIds
        });
    }
  }

  return state;
}

export const missingMrsDiffAtom = appAtomRuntime.atom(
  Stream.unwrap(
    Effect.gen(function* () {
      const stream = yield* EventStorage.eventsStream;

      const isMrRelevantEvent = (event: Event): event is MrRelevantEvent => {
        return event.type === 'gitlab-user-mrs-fetched-event' ||
               event.type === 'gitlab-project-mrs-fetched-event' ||
               event.type === 'gitlab-single-mr-fetched-event';
      };

      return stream.pipe(
        Stream.filter(isMrRelevantEvent),
        Stream.scan(
          initialOpenMrsTrackingState,
          (state: OpenMrsTrackingState, event) =>
            projectOpenMrsAndDetectMissing(state, event)
        )
      );
    })
  ),
  { initialValue: initialOpenMrsTrackingState }
).pipe(Atom.keepAlive);

export const isReconcilingAtom = Atom.make(false);
