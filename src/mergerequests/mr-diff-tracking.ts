import { Data, Stream, Effect } from "effect";
import { Atom, Result } from "@effect-atom/atom-react";
import { EventStorage } from "../events/events";
import { appAtomRuntime } from "../appLayerRuntime";
import { allMrsProjection, type MrRelevantEvent } from "./all-mergerequests-projection";
import type { MergeRequestFieldsFragment } from "../graphql/mrs.generated";
import type { BitbucketPullRequest } from "../bitbucket/bitbucketapi";
import { MrGid } from "../gitlab/gitlab-schema";

type KnownMrInfo = { state: string; authorUsername?: string; projectFullPath: string };

export class OpenMrsTrackingState extends Data.TaggedClass("OpenMrsTrackingState")<{
  readonly knownMrsById: ReadonlyMap<MrGid, KnownMrInfo>
  readonly detectedMissingMrIds: ReadonlySet<MrGid>
}> {}

export const initialOpenMrsTrackingState = new OpenMrsTrackingState({
  knownMrsById: new Map(),
  detectedMissingMrIds: new Set()
})

// Exhaustive check helper - will cause compile error if a case is missed
const exhaustive = (_: never): never => {
  throw new Error(`Unhandled case: ${_}`);
};

export const projectOpenMrsAndDetectMissing = (
  state: OpenMrsTrackingState,
  event: MrRelevantEvent
): OpenMrsTrackingState => {
  switch (event.type) {
    case 'gitlab-user-mrs-fetched-event': {
      type AccState = {
        knownMrsById: ReadonlyMap<MrGid, KnownMrInfo>;
        detectedMissingMrIds: ReadonlySet<MrGid>
      };

      const initialState = {
        knownMrsById: state.knownMrsById,
        detectedMissingMrIds: state.detectedMissingMrIds,
      };
      const evolveDiff = (acc: AccState, username: string): AccState => {
          const userMrs = event.mrs.users?.nodes?.find(u => u?.username === username)?.authoredMergeRequests?.nodes || [];
          const validUserMrs = userMrs.filter((mr): mr is NonNullable<typeof mr> => !!(mr && mr.id));
          const incomingIds = new Set(validUserMrs.map(mr => MrGid(mr.id)));
          const currentMissing = new Set(acc.detectedMissingMrIds);
          const missingAfterArrivals = new Set(
              [...currentMissing].filter(id => !incomingIds.has(id))
          );
          // Add newly detected missing MRs
          const expectedIds = [...acc.knownMrsById.entries()]
            .filter(([, info]) => info.authorUsername === username && info.state === event.forState)
            .map(([id]) => id);
          const newlyMissing = expectedIds.filter(id => !incomingIds.has(id));

          const entriesToAdd = validUserMrs.map(
            (mr) =>
              [
                MrGid(mr.id),
                {
                  state: mr.state,
                  authorUsername: username,
                  projectFullPath:
                    mr.project?.fullPath ||
                    acc.knownMrsById.get(MrGid(mr.id))?.projectFullPath ||
                    "",
                },
              ] as const);

          return {
            knownMrsById: new Map([...acc.knownMrsById, ...entriesToAdd]),
            detectedMissingMrIds: new Set([...missingAfterArrivals, ...newlyMissing])
          };
      };

      const nextState = event.forUsernames.reduce(evolveDiff, initialState);

      return new OpenMrsTrackingState(nextState);
    }

    case 'gitlab-project-mrs-fetched-event': {
      const projectPath = event.forProjectPath;

      // 1. Identify incoming MRs
      const projectMrs = event.mrs.project?.mergeRequests?.nodes || [];
      const validProjectMrs = projectMrs.filter((mr): mr is NonNullable<typeof mr> => !!(mr && mr.id));
      const incomingIds = new Set(validProjectMrs.map(mr => MrGid(mr.id)));

      // 2. Compute new Known MRs Map (Immutable update)
      const entriesToAdd = validProjectMrs.map(mr => {
          const authorUsername = mr.author?.username || state.knownMrsById.get(MrGid(mr.id))?.authorUsername;
          return [
              MrGid(mr.id),
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

    case 'gitlab-single-mr-fetched-event': {
      const mr = event.mr.project?.mergeRequest;
      if (mr && mr.id) {
          // 1. Update Known MRs (Immutable update)
          const existing = state.knownMrsById.get(MrGid(mr.id));
          const updatedInfo = {
              state: mr.state,
              authorUsername: mr.author?.username || existing?.authorUsername,
              projectFullPath: mr.project?.fullPath || existing?.projectFullPath || event.forProjectPath
          };
          const newKnownMrsById = new Map([...state.knownMrsById, [MrGid(mr.id), updatedInfo]]);

          // 2. Update Missing MRs (Immutable update - remove reconciled MR)
          const newMissingMrIds = new Set(
              [...state.detectedMissingMrIds].filter(id => id !== MrGid(mr.id))
          );

          return new OpenMrsTrackingState({
              knownMrsById: newKnownMrsById,
              detectedMissingMrIds: newMissingMrIds
          });
      }
      return state;
    }

    case 'gitlab-mrs-fetched-event': {
      const projectPath = event.forProjectPath;
      const projectMrs = event.mrs.project?.mergeRequests?.nodes || [];
      const validMrs = projectMrs.filter((mr): mr is NonNullable<typeof mr> => !!(mr && mr.id));
      const incomingIds = new Set(validMrs.map(mr => MrGid(mr.id)));

      const entriesToAdd = validMrs.map(mr => {
        const existing = state.knownMrsById.get(MrGid(mr.id));
        return [
          MrGid(mr.id),
          {
            state: mr.state,
            authorUsername: mr.author?.username || existing?.authorUsername,
            projectFullPath: mr.project?.fullPath || existing?.projectFullPath || projectPath
          }
        ] as const;
      });

      const newKnownMrsById = new Map([...state.knownMrsById, ...entriesToAdd]);

      const newMissingMrIds = new Set(
        [...state.detectedMissingMrIds].filter(id => !incomingIds.has(id))
      );

      return new OpenMrsTrackingState({
        knownMrsById: newKnownMrsById,
        detectedMissingMrIds: newMissingMrIds
      });
    }

    case 'compacted-event': {
      // Initialize known MRs from compacted state
      // Compaction represents the full state, so we rebuild knownMrsById from it
      const newKnownMrsById = new Map<MrGid, {
        state: string
        authorUsername?: string
        projectFullPath: string
      }>();

      event.mrs.forEach((mr: MergeRequestFieldsFragment | BitbucketPullRequest) => {
        // Check if it's a GitLab MR (has 'iid' and 'project') vs Bitbucket PR
        // if ('iid' in mr && 'project' in mr) {
        //   // GitLab MR
        //   newKnownMrsById.set(MrGid(mr.id), {
        //     state: mr.state,
        //     authorUsername: mr.author?.username,
        //     projectFullPath: mr.project.fullPath
        //   });
        // } else if ('source' in mr && 'destination' in mr) {
        //   // Bitbucket PR - use destination repo full_name as id
        //   const id = `bitbucket:${mr.destination.repository.full_name}:${mr.id}`;
        //   newKnownMrsById.set(id, {
        //     state: mr.state,
        //     authorUsername: mr.author?.display_name,
        //     projectFullPath: mr.destination.repository.full_name
        //   });
        // }
      });

      // Clear missing MRs since we're starting fresh from compacted state
      return new OpenMrsTrackingState({
        knownMrsById: newKnownMrsById,
        detectedMissingMrIds: new Set()
      });
    }

    case 'jira-issues-fetched-event':
      // Jira events don't affect MR tracking
      return state;

    case 'jira-sprint-issues-fetched-event':
      return state; // TODOR: still fix this

    default:
      return exhaustive(event);
  }
}

export const missingMrsDiffAtom = appAtomRuntime.atom(
  (get) => {
    return Stream.unwrap(
      Effect.gen(function* () {
        return (yield* EventStorage.eventsStream).pipe(
          Stream.filter(allMrsProjection.isRelevantEvent),
          Stream.scan(
            initialOpenMrsTrackingState,
            (state: OpenMrsTrackingState, event) =>
              projectOpenMrsAndDetectMissing(state, event)
          )
        );
      })
    );
  },
  { initialValue: initialOpenMrsTrackingState }
).pipe(Atom.keepAlive);

export const isReconcilingAtom = Atom.make(false);
