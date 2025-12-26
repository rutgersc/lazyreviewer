import { TextAttributes } from '@opentui/core';
import { Colors } from '../colors';
import type { Action } from '../actions/action-types';
import { parseKeyString } from '../actions/key-matcher';
import { paneActionsAtom } from '../actions/actions-atom';
import { getJobStatusDisplay } from '../gitlab/display/jobStatus';
import type { PipelineJob, PipelineStage } from '../gitlab/gitlab-graphql';
import { ActivePane } from '../userselection/userSelection';
import { useAtom, useAtomValue, useAtomSet } from '@effect-atom/atom-react';
import { infoPaneTabAtom, activeModalAtom } from '../ui/navigation-atom';
import { selectedPipelineJobIndexAtom, jobHistoryDataAtom, selectedJobForHistoryAtom, loadJobLogAtom, fetchJobHistoryAtom, jobHistoryEndCursorAtom, jobHistoryHasNextPageAtom } from '../mergerequests/job-atom';
import { selectedMrAtom } from '../mergerequests/mergerequests-atom';

import { useAutoScroll } from '../hooks/useAutoScroll';
import { useDoubleClick } from '../hooks/useDoubleClick';
import { useEffect, useMemo } from 'react';

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
  const setSelectedJobForHistory = useAtomSet(selectedJobForHistoryAtom);
  const setJobHistoryEndCursor = useAtomSet(jobHistoryEndCursorAtom);
  const setJobHistoryHasNextPage = useAtomSet(jobHistoryHasNextPageAtom);
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

  const setPaneActions = useAtomSet(paneActionsAtom);
  const isActive = activePane === ActivePane.InfoPane && infoPaneTab === 'pipeline';

  const actions: Action[] = useMemo(() => {
    if (pipelineJobs.length === 0) return [];

    return [
      {
        id: 'pipeline:nav-down',
        keys: [parseKeyString('j'), parseKeyString('down')],
        displayKey: 'j/k, ↑/↓',
        description: 'Navigate pipeline jobs',
        handler: () => {
          const next = Math.min(selectedPipelineJobIndex + 1, pipelineJobs.length - 1);
          setSelectedPipelineJobIndex(next);
          scrollToId(`pipeline-job-${next}`);
        },
      },
      {
        id: 'pipeline:nav-up',
        keys: [parseKeyString('k'), parseKeyString('up')],
        displayKey: '',
        description: '',
        handler: () => {
          const prev = Math.max(selectedPipelineJobIndex - 1, 0);
          setSelectedPipelineJobIndex(prev);
          scrollToId(`pipeline-job-${prev}`);
        },
      },
      {
        id: 'pipeline:download-log',
        keys: [parseKeyString('i')],
        displayKey: 'i',
        description: 'Download and open job log',
        handler: () => {
          const selectedJob = pipelineJobs[selectedPipelineJobIndex];
          if (selectedJob && selectedMergeRequest) {
            runLoadJobLog({ mergeRequest: selectedMergeRequest, job: selectedJob.job });
          }
        },
      },
      {
        id: 'pipeline:job-history',
        keys: [parseKeyString('y')],
        displayKey: 'y',
        description: 'View job history',
        handler: () => {
          if (pipelineJobs[selectedPipelineJobIndex]) {
            runFetchJobHistory().then((exit) => {
              if (exit._tag === 'Success') {
                const { job, history, pageInfo } = exit.value;
                setJobHistoryData(history);
                setSelectedJobForHistory(job?.name || null);
                setJobHistoryEndCursor(pageInfo.endCursor);
                setJobHistoryHasNextPage(pageInfo.hasNextPage);
              }
              setActiveModal('jobHistory');
            });
          }
        },
      },
    ];
  }, [pipelineJobs, selectedPipelineJobIndex, selectedMergeRequest, scrollToId]);

  useEffect(() => {
    if (isActive && activeModal === 'none') {
      setPaneActions(actions);
    }
  }, [isActive, activeModal, actions, setPaneActions]);
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
