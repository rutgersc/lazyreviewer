import type { PipelineJob, PipelineStage } from '../merge-request-schema';
import type { JobImportance } from '../../settings/settings';

export interface FilteredPipelineData {
  stages: PipelineStage[];
  highPriorityStatus: 'success' | 'failed' | 'none';
}

export function filterPipelineJobs(
  stages: PipelineStage[],
  repoPath: string,
  jobImportanceMap: Record<string, Record<string, JobImportance>>
): FilteredPipelineData {
  const repoJobs = jobImportanceMap[repoPath] || {};

  const filteredStages: PipelineStage[] = stages
    .map(stage => ({
      ...stage,
      jobs: stage.jobs.filter(job => {
        const importance = repoJobs[job.name] || 'low';
        return importance !== 'ignore';
      })
    }))
    .filter(stage => stage.jobs.length > 0);

  let hasHighPriorityJobs = false;
  let hasFailedHighPriorityJob = false;
  let allHighPriorityJobsSucceeded = true;

  stages.forEach(stage => {
    stage.jobs.forEach(job => {
      const importance = repoJobs[job.name] || 'low';
      if (importance === 'monitored') {
        hasHighPriorityJobs = true;
        if (job.status === 'FAILED') {
          hasFailedHighPriorityJob = true;
          allHighPriorityJobsSucceeded = false;
        } else if (job.status !== 'SUCCESS') {
          allHighPriorityJobsSucceeded = false;
        }
      }
    });
  });

  const highPriorityStatus = !hasHighPriorityJobs
    ? 'none'
    : hasFailedHighPriorityJob
    ? 'failed'
    : allHighPriorityJobsSucceeded
    ? 'success'
    : 'none';

  return {
    stages: filteredStages,
    highPriorityStatus
  };
}
