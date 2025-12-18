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

// Pagination state
export const jobHistoryEndCursorAtom = Atom.make<string | null>(null);
export const jobHistoryHasNextPageAtom = Atom.make<boolean>(false);

export const selectedPipelineJobIndexAtom = Atom.make<number>(0);

export const loadJobLogAtom = appAtomRuntime.fn((args: {
  mergeRequest: MergeRequest,
  job: PipelineJob }) =>
  loadJobLog(args.mergeRequest, args.job)
);

export const fetchJobHistoryAtom = appAtomRuntime.fn((_: void, get) =>
  Effect.gen(function* () {
    const selectedMr = get(selectedMrAtom);
    const selectedPipelineJobIndex = get(selectedPipelineJobIndexAtom);
    const limit = get(jobHistoryLimitAtom);

    if (!selectedMr) {
      yield* Console.log('[JobHistory] No MR selected');
      return { job: null, history: [] as any[], pageInfo: { hasNextPage: false, endCursor: null as string | null } };
    }

    const jobs = selectedMr.pipeline.stage.flatMap((stage: any) => stage.jobs);
    const selectedJob = jobs[selectedPipelineJobIndex];

    if (!selectedJob) {
      yield* Console.log('[JobHistory] No job selected');
      return { job: null, history: [] as any[], pageInfo: { hasNextPage: false, endCursor: null as string | null } };
    }

    yield* Console.log(`[JobHistory] Fetching history for ${selectedJob.name} (limit: ${limit})`);

    const result = yield* fetchJobHistory(
      selectedMr.project.fullPath,
      selectedJob.name,
      limit,
      null // Initial fetch always starts from the beginning
    );

    yield* Console.log(`[JobHistory] Fetched ${result.history.length} entries`);

    return { job: selectedJob, history: result.history, pageInfo: result.pageInfo };
  })
);

// Load more pages using cursor-based pagination
export const loadMoreJobHistoryAtom = appAtomRuntime.fn((_: void, get) =>
  Effect.gen(function* () {
    const selectedMr = get(selectedMrAtom);
    const selectedPipelineJobIndex = get(selectedPipelineJobIndexAtom);
    const limit = get(jobHistoryLimitAtom);
    const endCursor = get(jobHistoryEndCursorAtom);
    const hasNextPage = get(jobHistoryHasNextPageAtom);
    const currentHistory = get(jobHistoryDataAtom);

    if (!hasNextPage) {
      yield* Console.log('[JobHistory] No more pages to load');
      return { history: currentHistory, pageInfo: { hasNextPage: false, endCursor: null as string | null }, appended: false };
    }

    if (!selectedMr) {
      yield* Console.log('[JobHistory] No MR selected');
      return { history: currentHistory, pageInfo: { hasNextPage: false, endCursor: null as string | null }, appended: false };
    }

    const jobs = selectedMr.pipeline.stage.flatMap((stage: any) => stage.jobs);
    const selectedJob = jobs[selectedPipelineJobIndex];

    if (!selectedJob) {
      yield* Console.log('[JobHistory] No job selected');
      return { history: currentHistory, pageInfo: { hasNextPage: false, endCursor: null as string | null }, appended: false };
    }

    yield* Console.log(`[JobHistory] Loading more for ${selectedJob.name} (cursor: ${endCursor})`);

    const result = yield* fetchJobHistory(
      selectedMr.project.fullPath,
      selectedJob.name,
      limit,
      endCursor
    );

    yield* Console.log(`[JobHistory] Fetched ${result.history.length} more entries`);

    // Append new entries to existing history
    const newHistory = [...currentHistory, ...result.history];

    return { history: newHistory, pageInfo: result.pageInfo, appended: true };
  })
);
