import { Effect, Console } from "effect";
import { Result } from "@effect-atom/atom-react";
import { useAtomValue, useAtomSet, useAtom } from "@effect-atom/atom-react";
import { appAtomRuntime } from "../appLayerRuntime";
import { allMrsAtom } from "../mergerequests/mergerequests-atom";
import { getMrsAsEvent } from "../gitlab/gitlab-graphql";
import { EventStorage } from "../events/events";
import { missingMrsDiffAtom, isReconcilingAtom } from "./mr-diff-tracking";
import type { AllMrsState } from "./all-mergerequests-projection";
import type { MrGid } from "../gitlab/gitlab-schema";

export const reconcileMrsAtom = appAtomRuntime.fn((missingIds: MrGid[], get) =>
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

      const mrsToFetch = missingIds
        .map(gid => allMrs?.mrsByGid.get(gid))
        .filter(mr => mr != null);

      const mrsByProject = mrsToFetch.reduce((acc, mr) => {
        const projectPath = mr.project.fullPath;
        const existing = acc.get(projectPath) ?? [];
        return acc.set(projectPath, [...existing, mr.iid]);
      }, new Map<string, string[]>());

      yield* Effect.forEach(
        Array.from(mrsByProject.entries()),
        ([projectPath, iids]) =>
          Effect.gen(function* () {
            yield* Console.log(`[Reconcile] Fetching ${iids.length} MRs for project ${projectPath}`);
            const event = yield* getMrsAsEvent(projectPath, iids);
            yield* EventStorage.appendEvent(event);
          }).pipe(
            Effect.catchAll(err => Console.error(`[Reconcile] Failed to fetch MRs for ${projectPath}`, err))
          ),
        { concurrency: 3 }
      );

      yield* Console.log(`[Reconcile] Reconciliation complete`);
  })
);

export const useReconcileMissingMrs = () => {
    const stateResult = useAtomValue(missingMrsDiffAtom);
    const [isReconciling, setIsReconciling] = useAtom(isReconcilingAtom);
    const reconcileAction = useAtomSet(reconcileMrsAtom, { mode: 'promise' });

    const missingIds = Result.match(stateResult, {
        onInitial: () => [] as MrGid[],
        onSuccess: (success) => Array.from(success.value.detectedMissingMrIds),
        onFailure: () => [] as MrGid[]
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


