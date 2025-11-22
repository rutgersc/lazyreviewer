import { Effect, Console } from "effect";
import { Result } from "@effect-atom/atom-react";
import { useAtomValue, useAtomSet, useAtom } from "@effect-atom/atom-react";
import { appAtomRuntime } from "../appLayerRuntime";
import { allMrsAtom } from "../store/appAtoms";
import { getSingleMrAsEvent } from "../gitlab/gitlab-graphql";
import { EventStorage } from "../events/events";
import { missingMrsDiffAtom, isReconcilingAtom } from "./mr-diff-tracking";
import { AllMrsState } from "./mergerequests-caching-effects";

export const reconcileMrsAtom = appAtomRuntime.fn((missingIds: string[], get) =>
  Effect.gen(function* () {
      yield* Console.log(`[Reconcile] Starting reconciliation for ${missingIds.length} MRs`);

      const allMrsResult = get(allMrsAtom);

      let allMrs: AllMrsState | null = null;
      if (Result.isSuccess(allMrsResult)) {
          allMrs = allMrsResult.value;
      }

      if (!allMrs) {
          return;
      }

      yield* Effect.forEach(missingIds, (id) =>
          Effect.gen(function*() {
              const mr = allMrs?.mrsByGid.get(id);
              if (mr) {
                   yield* Console.log(`[Reconcile] Fetching update for ${mr.title} (!${mr.iid})`);
                   const event = yield* getSingleMrAsEvent(mr.project.fullPath, mr.iid);
                   yield* EventStorage.appendEvent(event);
              } else {
                  yield* Console.log(`[Reconcile] Cannot reconcile MR ${id}: not found in cache`);
              }
          }).pipe(
              Effect.catchAll(err => Console.error(`[Reconcile] Failed to fetch MR ${id}`, err))
          )
      , { concurrency: 3 });

      yield* Console.log(`[Reconcile] Reconciliation complete`);
  })
);

export const useReconcileMissingMrs = () => {
    const stateResult = useAtomValue(missingMrsDiffAtom);
    const [isReconciling, setIsReconciling] = useAtom(isReconcilingAtom);
    const reconcileAction = useAtomSet(reconcileMrsAtom, { mode: 'promise' });

    const missingIds = Result.match(stateResult, {
        onSuccess: (success) => Array.from(success.value.detectedMissingMrIds),
        onFailure: () => [] as string[],
        onInitial: () => [] as string[]
    });

    const reconcile = () => {
        if (missingIds.length === 0) return Promise.resolve();
        setIsReconciling(true);
        return reconcileAction(missingIds).finally(() => {
            setIsReconciling(false);
        });
    };

    return {
        missingIds,
        reconcile,
        isReconciling
    };
};


