import { parseKeyString } from '../actions/key-matcher';
import { Atom, Registry, useAtomSet } from '@effect-atom/atom-react';
import { activeModalAtom } from '../ui/navigation-atom';
import { selectedMrAtom } from '../mergerequests/mergerequests-atom';

import { getPipelineJobsFromMr, requestScrollPipelineJobsListToJob as requestScrollPipelineJobsListToJobAtom } from './PipelineJobsList';
import { Effect } from 'effect';
import { fetchJobHistoryAtom, jobHistoryDataAtom, jobHistoryEndCursorAtom, jobHistoryHasNextPageAtom, selectedJobForHistoryAtom, selectedPipelineJobIndexAtom } from './JobHistoryModal';
import { loadJobLogAtom } from '../mergerequests/open-pipelinejob-log-atom';
import { toggleJobImportanceAtom } from '../settings/settings-atom';

export const pipelineJobsListActionsAtom = Atom.make((get) => {
  const registry = get.registry;

  return [
    {
      id: 'pipeline:nav-down',
      keys: [parseKeyString('j'), parseKeyString('down')],
      displayKey: 'j/k, ↑/↓',
      description: 'Navigate pipeline jobs',
      handler: () => {
        const currentMr = registry.get(selectedMrAtom);
        const jobs = getPipelineJobsFromMr(currentMr);
        const currentIndex = registry.get(selectedPipelineJobIndexAtom);
        const next = Math.min(currentIndex + 1, jobs.length - 1);
        registry.set(selectedPipelineJobIndexAtom, next);
        registry.set(requestScrollPipelineJobsListToJobAtom, `pipeline-job-${next}`);
      },
    },
    {
      id: 'pipeline:nav-up',
      keys: [parseKeyString('k'), parseKeyString('up')],
      displayKey: '',
      description: '',
      handler: () => {
        const currentIndex = registry.get(selectedPipelineJobIndexAtom);
        const prev = Math.max(currentIndex - 1, 0);
        registry.set(selectedPipelineJobIndexAtom, prev);
        registry.set(requestScrollPipelineJobsListToJobAtom, `pipeline-job-${prev}`);
      },
    },
    {
      id: 'pipeline:download-log',
      keys: [parseKeyString('i')],
      displayKey: 'i',
      description: 'Download and open job log',
      handler: () => {
        const currentMr = registry.get(selectedMrAtom);
        const jobs = getPipelineJobsFromMr(currentMr);
        const currentIndex = registry.get(selectedPipelineJobIndexAtom);
        const selectedJob = jobs[currentIndex];
        if (selectedJob && currentMr) {
          registry.set(loadJobLogAtom, { mergeRequest: currentMr, job: selectedJob.job });
        }
      },
    },
    {
      id: 'pipeline:job-history',
      keys: [parseKeyString('y')],
      displayKey: 'y',
      description: 'View job history',
      handler: () => {
        console.log("step 0")
        const currentMr = registry.get(selectedMrAtom);
        const jobs = getPipelineJobsFromMr(currentMr);
        const currentIndex = registry.get(selectedPipelineJobIndexAtom);

        console.log("step 1")

        if (jobs[currentIndex]) {
        console.log("step 2")

        registry.set(fetchJobHistoryAtom, 0);

        const promise = Effect.runPromiseExit(
          Registry.getResult(registry, fetchJobHistoryAtom, { suspendOnWaiting: true })
        ).then((exit) => {
            console.log("result", exit)
            if (exit._tag === 'Success') {
              const { job, history, pageInfo } = exit.value;
              registry.set(jobHistoryDataAtom, history);
              registry.set(selectedJobForHistoryAtom, job?.name || null);
              registry.set(jobHistoryEndCursorAtom, pageInfo.endCursor);
              registry.set(jobHistoryHasNextPageAtom, pageInfo.hasNextPage);
            }

            registry.set(activeModalAtom, 'jobHistory');
          });
        }
      },
    },
    {
      id: 'pipeline:toggle-job-importance',
      keys: [parseKeyString('m')],
      displayKey: 'm',
      description: 'Toggle job importance (low → monitored → ignore)',
      handler: () => {
        const currentMr = registry.get(selectedMrAtom);
        const jobs = getPipelineJobsFromMr(currentMr);
        const currentIndex = registry.get(selectedPipelineJobIndexAtom);
        const selectedJob = jobs[currentIndex];
        if (selectedJob && currentMr) {
          registry.set(toggleJobImportanceAtom, {
            projectFullPath: currentMr.project.fullPath,
            jobName: selectedJob.job.name,
          });
        }
      },
    },
  ];
});
