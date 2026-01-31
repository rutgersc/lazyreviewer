import type { MergeRequest } from "./mergerequest-schema";
import type { PipelineJob } from "../domain/merge-request-schema";
import { appAtomRuntime } from "../appLayerRuntime";
import { loadJobLogInternal } from "./open-pipelinejob-log";

export const loadJobLogAtom = appAtomRuntime.fn((args: { mergeRequest: MergeRequest, job: PipelineJob }) => {
  return loadJobLogInternal(
    { project: { ...args.mergeRequest.project } },
    { ...args.job });
});
