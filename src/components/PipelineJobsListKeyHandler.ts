import type { ParsedKey } from '@opentui/core';
import type { PipelineJob, PipelineStage } from '../gitlabgraphql';
import type { MergeRequest } from '../components/MergeRequestPane';
import { loadJobLog } from '../pipelinejob-log';

interface PipelineKeyHandlerParams {
  key: ParsedKey;
  pipelineJobs: Array<{ stage: PipelineStage; job: PipelineJob }>;
  selectedPipelineJobIndex: number;
  setSelectedPipelineJobIndex: (index: number) => void;
  selectedMergeRequest: MergeRequest | undefined;
}

export const handlePipelineKeys = ({
  key,
  pipelineJobs,
  selectedPipelineJobIndex,
  setSelectedPipelineJobIndex,
  selectedMergeRequest
}: PipelineKeyHandlerParams): boolean => {
  if (pipelineJobs.length === 0) return false;

  switch (key.name) {
    case 'j':
    case 'down':
      setSelectedPipelineJobIndex(Math.min(selectedPipelineJobIndex + 1, pipelineJobs.length - 1));
      return true;
    case 'k':
    case 'up':
      setSelectedPipelineJobIndex(Math.max(selectedPipelineJobIndex - 1, 0));
      return true;
    case 'i':
      const selectedJob = pipelineJobs[selectedPipelineJobIndex];
      if (selectedJob && selectedMergeRequest) {
        loadJobLog(selectedMergeRequest, selectedJob.job);
      }
      return true;
    default:
      return false;
  }
};
