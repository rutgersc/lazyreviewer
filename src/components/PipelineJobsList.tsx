import { TextAttributes, type ParsedKey } from '@opentui/core';
import { useKeyboard } from '@opentui/react';
import { Colors } from '../colors';
import { getJobStatusDisplay } from '../gitlab/jobStatus';
import type { PipelineJob, PipelineStage } from '../gitlab/gitlabgraphql';
import { ActivePane } from '../userselection/userSelection';
import { useAtom, useAtomValue, useAtomSet } from '@effect-atom/atom-react';
import { infoPaneTabAtom, selectedPipelineJobIndexAtom, selectedMrAtom, activeModalAtom, jobHistoryDataAtom, jobHistoryLoadingAtom, selectedJobForHistoryAtom, loadJobLogAtom, fetchJobHistoryAtom, jobHistoryLimitAtom } from '../store/appAtoms';

interface PipelineJobsListProps {
  activePane: ActivePane;
  pipelineJobs: Array<{ stage: PipelineStage; job: PipelineJob }>;
  selectedPipelineJobIndex: number;
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

  useKeyboard((key: ParsedKey) => {
    if (activePane !== ActivePane.InfoPane || infoPaneTab !== 'pipeline') return;
    if (activeModal !== 'none') return;
    if (pipelineJobs.length === 0) return;

    switch (key.name) {
      case 'j':
      case 'down':
        setSelectedPipelineJobIndex(Math.min(selectedPipelineJobIndex + 1, pipelineJobs.length - 1));
        break;
      case 'k':
      case 'up':
        setSelectedPipelineJobIndex(Math.max(selectedPipelineJobIndex - 1, 0));
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
    <box style={{ flexDirection: "column", gap: 1 }}>
      <box style={{ flexDirection: "column", gap: 0 }}>
        {pipelineJobs.map(({ stage, job }, index) => (
          <box
            key={job.id}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 2,
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
  );
}
