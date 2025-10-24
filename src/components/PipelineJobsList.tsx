import { TextAttributes, type ParsedKey } from '@opentui/core';
import { useKeyboard } from '@opentui/react';
import { Colors } from '../colors';
import { getJobStatusDisplay } from '../gitlab/jobStatus';
import type { PipelineJob, PipelineStage } from '../gitlab/gitlabgraphql';
import { useAppStore } from '../store/appStore';
import { ActivePane } from '../userselection/userSelection';
import { loadJobLog } from '../gitlab/pipelinejob-log';

interface PipelineJobsListProps {
  pipelineJobs: Array<{ stage: PipelineStage; job: PipelineJob }>;
  selectedPipelineJobIndex: number;
}

export default function PipelineJobsList({ pipelineJobs, selectedPipelineJobIndex }: PipelineJobsListProps) {
  const activePane = useAppStore(state => state.activePane);
  const infoPaneTab = useAppStore(state => state.infoPaneTab);
  const setSelectedPipelineJobIndex = useAppStore(state => state.setSelectedPipelineJobIndex);
  const selectedMergeRequest = useAppStore(state => state.mergeRequests[state.selectedMergeRequest]);
  const fetchJobHistoryForSelectedJob = useAppStore(state => state.fetchJobHistoryForSelectedJob);
  const setShowJobHistoryModal = useAppStore(state => state.setShowJobHistoryModal);
  const showJobHistoryModal = useAppStore(state => state.showJobHistoryModal);

  useKeyboard((key: ParsedKey) => {
    if (activePane !== ActivePane.InfoPane || infoPaneTab !== 'pipeline') return;
    if (showJobHistoryModal) return;
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
          loadJobLog(selectedMergeRequest, selectedJob.job);
        }
        break;
      case 'y':
        if (pipelineJobs[selectedPipelineJobIndex]) {
          fetchJobHistoryForSelectedJob().then(() => {
            setShowJobHistoryModal(true);
          });
        }
        break;
    }
  });
  if (pipelineJobs.length === 0) {
    return (
      <box style={{ flexDirection: "column", gap: 1 }}>
        <text style={{ fg: Colors.NEUTRAL, attributes: TextAttributes.DIM }} wrap={false}>
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
              wrap={false}
            >
              {getJobStatusDisplay(job.status).symbol}
            </text>
            <text
              style={{ fg: Colors.NEUTRAL }}
              wrap={false}
            >
              {`${stage.name}: `}
            </text>
            <text
              style={{ fg: Colors.PRIMARY }}
              wrap={false}
            >
              {job.name}
            </text>
          </box>
        ))}
      </box>

      <text style={{ fg: Colors.NEUTRAL }} wrap={false}>
        ─────────────────────────────────────
      </text>

      {selectedPipelineJob && (
        <box style={{ flexDirection: "column", gap: 1 }}>
          <text style={{ fg: Colors.PRIMARY, attributes: TextAttributes.BOLD }} wrap={false}>
            {selectedPipelineJob.job.name}
          </text>
          <box style={{ flexDirection: "row", gap: 2 }}>
            <text style={{ fg: Colors.NEUTRAL }} wrap={false}>
              Status:
            </text>
            <text style={{ fg: getJobStatusDisplay(selectedPipelineJob.job.status).color }} wrap={false}>
              {selectedPipelineJob.job.status}
            </text>
          </box>
          <box style={{ flexDirection: "row", gap: 2 }}>
            <text style={{ fg: Colors.NEUTRAL }} wrap={false}>
              Stage:
            </text>
            <text style={{ fg: Colors.PRIMARY }} wrap={false}>
              {selectedPipelineJob.stage.name}
            </text>
          </box>
          {selectedPipelineJob.job.webPath && (
            <box style={{ flexDirection: "row", gap: 2 }}>
              <text style={{ fg: Colors.NEUTRAL }} wrap={false}>
                Path:
              </text>
              <text style={{ fg: Colors.INFO }} wrap={false}>
                {selectedPipelineJob.job.webPath}
              </text>
            </box>
          )}
        </box>
      )}
    </box>
  );
}
