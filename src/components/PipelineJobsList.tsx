import { TextAttributes } from '@opentui/core';
import { Colors } from '../colors';
import { getJobStatusDisplay } from '../gitlab/display/jobStatus';
import type { PipelineJob, PipelineStage } from '../gitlab/gitlab-graphql';
import { ActivePane } from '../userselection/userSelection';
import { useAtom, useAtomValue, useAtomSet, Atom } from '@effect-atom/atom-react';
import { selectedMrAtom } from '../mergerequests/mergerequests-atom';

import { useAutoScroll } from '../hooks/useAutoScroll';
import { useDoubleClick } from '../hooks/useDoubleClick';
import { useEffect } from 'react';
import type { MergeRequest } from './MergeRequestPane';
import { selectedPipelineJobIndexAtom } from './JobHistoryModal';
import { loadJobLogAtom } from '../mergerequests/open-pipelinejob-log-atom';
import { pipelineJobImportanceAtom, projectMonitoredJobsAtom } from '../settings/settings-atom';

interface PipelineJobsListProps {
  selectedPipelineJobIndex: number;
}

export const requestScrollPipelineJobsListToJob = Atom.make<string | null>(null);

export const getPipelineJobsFromMr = (selectedMergeRequest: MergeRequest | undefined) => {
  return !selectedMergeRequest?.pipeline?.stage
    ? []
    : selectedMergeRequest.pipeline.stage.flatMap((stage: PipelineStage) =>
        stage.jobs.map((job: PipelineJob) => ({ stage, job }))
      );
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === 0) return '-';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

export default function PipelineJobsList({ selectedPipelineJobIndex }: PipelineJobsListProps) {
  const [, setSelectedPipelineJobIndex] = useAtom(selectedPipelineJobIndexAtom);
  const selectedMergeRequest = useAtomValue(selectedMrAtom);
  const runLoadJobLog = useAtomSet(loadJobLogAtom);
  const { scrollBoxRef, scrollToId } = useAutoScroll({ lookahead: 2 });
  const [scrollToItemRequest, setScrollToItemRequest] = useAtom(requestScrollPipelineJobsListToJob);

  const pipelineJobs = getPipelineJobsFromMr(selectedMergeRequest)
  const projectMonitoredJobs = useAtomValue(projectMonitoredJobsAtom);
  const trackedJobNames = selectedMergeRequest
    ? projectMonitoredJobs.get(selectedMergeRequest.project.fullPath) ?? new Set<string>()
    : new Set<string>();
  const jobImportanceMap = useAtomValue(pipelineJobImportanceAtom);
  const projectJobImportance = selectedMergeRequest
    ? jobImportanceMap.get(selectedMergeRequest.project.fullPath) ?? new Map<string, string>()
    : new Map<string, string>();

  useEffect(() => {
    if (scrollToItemRequest !== null) {
      scrollToId(scrollToItemRequest);
      setScrollToItemRequest(null);
    }
  }, [scrollToItemRequest, scrollToId, setScrollToItemRequest]);

  const handleJobClick = useDoubleClick<number>({
    onSingleClick: (index) => {
      setSelectedPipelineJobIndex(index);
      scrollToId(`pipeline-job-${index}`);
    },
    onDoubleClick: (index) => {
      const selectedJob = pipelineJobs[index];
      if (selectedJob && selectedMergeRequest) {
        runLoadJobLog({ mergeRequest: selectedMergeRequest, job: selectedJob.job });
      }
    }
  });

  if (pipelineJobs.length === 0) {
    return (
      <box style={{ flexDirection: "column", gap: 1 }}>
        <text style={{ fg: Colors.NEUTRAL, attributes: TextAttributes.DIM }} wrapMode='none'>
          No pipeline data
        </text>
      </box>
    );
  }

  const selectedPipelineJob = pipelineJobs[selectedPipelineJobIndex];

  return (
    <scrollbox
      ref={scrollBoxRef}
      style={{
        flexGrow: 1,
        width: "100%",
        contentOptions: { backgroundColor: '#282a36' },
        scrollbarOptions: {
          trackOptions: { foregroundColor: '#bd93f9', backgroundColor: '#44475a' },
        },
      }}
    >
    <box style={{ flexDirection: "column", gap: 1 }}>
      <box style={{ flexDirection: "column", gap: 0 }}>
        {pipelineJobs.map(({ stage, job }, index) => {
          const isHighImportance = projectJobImportance.get(job.name) === 'high';
          const isMonitoredJob = trackedJobNames.has(job.name);

          return (
            <box
              key={job.id}
              id={`pipeline-job-${index}`}
              onMouseDown={() => handleJobClick(index)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 1,
                backgroundColor: index === selectedPipelineJobIndex ? Colors.SELECTED : 'transparent',
              }}
            >
              <text
                style={{ fg: getJobStatusDisplay(job.status).color, attributes: TextAttributes.DIM }}
                wrapMode='none'
              >
                {getJobStatusDisplay(job.status).symbol}
              </text>
              <text
                style={{ fg: Colors.SUPPORTING, width: 8 }}
                wrapMode='none'
              >
                {formatDuration(job.duration)}
              </text>
              <text
                style={{ fg: Colors.NEUTRAL }}
                wrapMode='none'
              >
                {`${stage.name}: `}
              </text>
              <text
                style={{ fg: isMonitoredJob ? Colors.WARNING : Colors.PRIMARY }}
                wrapMode='none'
              >
                {job.name}
              </text>
              {isMonitoredJob && (
                <text style={{ fg: Colors.WARNING }} wrapMode='none'>
                  {' (job monitored)'}
                </text>
              )}
              {isHighImportance && (
                <text style={{ fg: Colors.SECONDARY }} wrapMode='none'>
                  {'■ '}
                </text>
              )}
            </box>
          );
        })}
      </box>

      <text style={{ fg: Colors.NEUTRAL }} wrapMode='none'>
        ─────────────────────────────────────
      </text>

      {selectedPipelineJob && (
        <box style={{ flexDirection: "column", gap: 1 }}>
          <text style={{ fg: Colors.PRIMARY, attributes: TextAttributes.BOLD }} wrapMode='none'>
            {selectedPipelineJob.job.name}
          </text>
          <box style={{ flexDirection: "row", gap: 2 }}>
            <text style={{ fg: Colors.NEUTRAL }} wrapMode='none'>
              Status:
            </text>
            <text style={{ fg: getJobStatusDisplay(selectedPipelineJob.job.status).color }} wrapMode='none'>
              {selectedPipelineJob.job.status}
            </text>
          </box>
          <box style={{ flexDirection: "row", gap: 2 }}>
            <text style={{ fg: Colors.NEUTRAL }} wrapMode='none'>
              Stage:
            </text>
            <text style={{ fg: Colors.PRIMARY }} wrapMode='none'>
              {selectedPipelineJob.stage.name}
            </text>
          </box>
          {selectedPipelineJob.job.webPath && (
            <box style={{ flexDirection: "row", gap: 2 }}>
              <text style={{ fg: Colors.NEUTRAL }} wrapMode='none'>
                Path:
              </text>
              <text style={{ fg: Colors.INFO }} wrapMode='none'>
                {selectedPipelineJob.job.webPath}
              </text>
            </box>
          )}
        </box>
      )}
    </box>
    </scrollbox>
  );
}
