import type { MergeRequest } from "./mergerequest-schema";
import type { PipelineJob } from "../domain/merge-request-schema";
import { appAtomRuntime } from "../appLayerRuntime";
import { loadJobLogInternal, downloadJobTrace } from "./open-pipelinejob-log";
import { Atom } from "@effect-atom/atom-react";

export const jobLogDownloadSignalAtom = Atom.make(0);

export const loadJobLogAtom = appAtomRuntime.fn((args: { mergeRequest: MergeRequest, job: PipelineJob }) => {
  return loadJobLogInternal(
    { project: { ...args.mergeRequest.project }, sourcebranch: args.mergeRequest.sourcebranch },
    { ...args.job });
});

export const downloadJobTraceAtom = appAtomRuntime.fn((args: { mergeRequest: MergeRequest, job: PipelineJob }) => {
  return downloadJobTrace(
    { project: { ...args.mergeRequest.project }, sourcebranch: args.mergeRequest.sourcebranch },
    { ...args.job });
});
