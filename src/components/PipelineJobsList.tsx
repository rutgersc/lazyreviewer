import { TextAttributes } from '@opentui/core';
import { Colors } from '../constants/colors';
import { getJobStatusDisplay } from '../utils/jobStatus';
import type { PipelineJob, PipelineStage } from '../gitlabgraphql';

interface PipelineJobsListProps {
  pipelineJobs: Array<{ stage: PipelineStage; job: PipelineJob }>;
  selectedPipelineJobIndex: number;
}

export default function PipelineJobsList({ pipelineJobs, selectedPipelineJobIndex }: PipelineJobsListProps) {
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
