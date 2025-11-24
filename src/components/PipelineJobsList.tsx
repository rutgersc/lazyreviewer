import { TextAttributes, type ParsedKey } from '@opentui/core';
import { useKeyboard } from '@opentui/react';
import { Colors } from '../colors';
import { getJobStatusDisplay } from '../gitlab/display/jobStatus';
import type { PipelineJob, PipelineStage } from '../gitlab/gitlab-graphql';
import { ActivePane } from '../userselection/userSelection';
import { useAtom, useAtomValue, useAtomSet } from '@effect-atom/atom-react';
import { infoPaneTabAtom, activeModalAtom } from '../ui/navigation-atom';
import { selectedPipelineJobIndexAtom, jobHistoryDataAtom, jobHistoryLoadingAtom, selectedJobForHistoryAtom, loadJobLogAtom, fetchJobHistoryAtom, jobHistoryLimitAtom } from '../mergerequests/job-atom';
import { selectedMrAtom } from '../mergerequests/mergerequests-atom';

import { useAutoScroll } from '../hooks/useAutoScroll';
import { useDoubleClick } from '../hooks/useDoubleClick';
import { useEffect } from 'react';

interface PipelineJobsListProps {
  activePane: ActivePane;
  pipelineJobs: Array<{ stage: PipelineStage; job: PipelineJob }>;
  selectedPipelineJobIndex: number;
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

export default function PipelineJobsList({ activePane, pipelineJobs, selectedPipelineJobIndex }: PipelineJobsListProps) {
  const activeModal = useAtomValue(activeModalAtom);
  const setActiveModal = useAtomSet(activeModalAtom);
  const infoPaneTab = useAtomValue(infoPaneTabAtom);
  const [, setSelectedPipelineJobIndex] = useAtom(selectedPipelineJobIndexAtom);
  const selectedMergeRequest = useAtomValue(selectedMrAtom);
  const setJobHistoryData = useAtomSet(jobHistoryDataAtom);
  const setJobHistoryLoading = useAtomSet(jobHistoryLoadingAtom);
  const setSelectedJobForHistory = useAtomSet(selectedJobForHistoryAtom);
  const setJobHistoryLimit = useAtomSet(jobHistoryLimitAtom);
  const runLoadJobLog = useAtomSet(loadJobLogAtom);
  const runFetchJobHistory = useAtomSet(fetchJobHistoryAtom, { mode: 'promiseExit' });
  const { scrollBoxRef, scrollToId } = useAutoScroll({ lookahead: 2 });

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

  useKeyboard((key: ParsedKey) => {
    if (activePane !== ActivePane.InfoPane || infoPaneTab !== 'pipeline') return;
    if (activeModal !== 'none') return;
    if (pipelineJobs.length === 0) return;

    switch (key.name) {
      case 'j':
      case 'down':
        const next = Math.min(selectedPipelineJobIndex + 1, pipelineJobs.length - 1);
        setSelectedPipelineJobIndex(next);
        scrollToId(`pipeline-job-${next}`);
        break;
      case 'k':
      case 'up':
        const prev = Math.max(selectedPipelineJobIndex - 1, 0);
        setSelectedPipelineJobIndex(prev);
        scrollToId(`pipeline-job-${prev}`);
        break;
      case 'i':
        const selectedJob = pipelineJobs[selectedPipelineJobIndex];
        if (selectedJob && selectedMergeRequest) {
          runLoadJobLog({ mergeRequest: selectedMergeRequest, job: selectedJob.job });
        }
        break;
      case 'y':
        if (pipelineJobs[selectedPipelineJobIndex]) {
          setJobHistoryLimit(15); // Reset to default limit
          runFetchJobHistory().then((exit) => {
            if (exit._tag === 'Success') {
              const { job, history } = exit.value;
              setJobHistoryData(history);
              setSelectedJobForHistory(job?.name || null);
            }
            setActiveModal('jobHistory');
          });
        }
        break;
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
        {pipelineJobs.map(({ stage, job }, index) => (
          <box
            key={job.id}
            id={`pipeline-job-${index}`}
            onMouseDown={() => handleJobClick(index)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 1,
              backgroundColor: index === selectedPipelineJobIndex ? Colors.SELECTED : 'transparent'
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
              style={{ fg: Colors.PRIMARY }}
              wrapMode='none'
            >
              {job.name}
            </text>
          </box>
        ))}
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
