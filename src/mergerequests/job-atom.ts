import { Atom } from "@effect-atom/atom-react";
import { Effect, Console } from "effect";
import { appAtomRuntime } from "../appLayerRuntime";
import type { MergeRequest } from "./mergerequest-schema";
import { loadJobLog } from './pipelinejob-log-effects';
import { fetchJobHistory, type PipelineJob } from '../gitlab/gitlab-graphql';
import { selectedMrAtom } from "./mergerequests-atom";

export const jobHistoryDataAtom = Atom.make<any[]>([]);
export const jobHistoryLoadingAtom = Atom.make<boolean>(false);
export const selectedJobForHistoryAtom = Atom.make<string | null>(null);
export const jobHistoryLimitAtom = Atom.make<number>(15);

export const selectedPipelineJobIndexAtom = Atom.make<number>(0);

export const loadJobLogAtom = appAtomRuntime.fn((args: {
  mergeRequest: MergeRequest,
  job: PipelineJob }) =>
  loadJobLog(args.mergeRequest, args.job)
);

export const fetchJobHistoryAtom = appAtomRuntime.fn((_, get) =>
  Effect.gen(function* () {
    const selectedMr = get(selectedMrAtom);
    const selectedPipelineJobIndex = get(selectedPipelineJobIndexAtom);
    const limit = get(jobHistoryLimitAtom);

    if (!selectedMr) {
      yield* Console.log('[JobHistory] No MR selected');
      return { job: null, history: [] };
    }

    const jobs = selectedMr.pipeline.stage.flatMap((stage: any) => stage.jobs);
    const selectedJob = jobs[selectedPipelineJobIndex];

    if (!selectedJob) {
      yield* Console.log('[JobHistory] No job selected');
      return { job: null, history: [] };
    }

    yield* Console.log(`[JobHistory] Fetching history for ${selectedJob.name} (limit: ${limit})`);

    const history = yield* fetchJobHistory(
      selectedMr.project.fullPath,
      selectedJob.name,
      limit
    );

    yield* Console.log(`[JobHistory] Fetched ${history.length} entries`);

    return { job: selectedJob, history };
  })
);

export const incrementJobHistoryLimitAtom = Atom.writable(
  (get) => get(jobHistoryLimitAtom),
  (ctx, _?: void) => {
    const currentLimit = ctx.get(jobHistoryLimitAtom);
    const newLimit = currentLimit + 15;
    ctx.set(jobHistoryLimitAtom, newLimit);
    return newLimit;
  }
);
