import { TextAttributes } from '@opentui/core';
import { Colors } from '../colors';
import { getJobStatusDisplay } from '../domain/display/jobStatus';
import type { PipelineJob, PipelineStage } from '../domain/merge-request-schema';
import { ActivePane } from '../userselection/userSelection';
import { useAtom, useAtomValue, useAtomSet, Atom } from '@effect-atom/atom-react';
import { selectedMrAtom } from '../mergerequests/mergerequests-atom';

import { useAutoScroll } from '../hooks/useAutoScroll';
import { useDoubleClick } from '../hooks/useDoubleClick';
import { useEffect, useState } from 'react';
import type { MergeRequest } from './MergeRequestPane';
import { selectedPipelineJobIndexAtom } from './JobHistoryModal';
import { loadJobLogAtom, jobLogDownloadSignalAtom } from '../mergerequests/open-pipelinejob-log-atom';
import { pipelineJobImportanceAtom } from '../settings/settings-atom';
import { existsSync, readFileSync } from 'fs';
import { parseJobLogErrors, hasErrors, type JobLogErrors } from '../domain/parse-job-log-errors';
import { getJobLogPath } from '../mergerequests/open-pipelinejob-log';

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
  const runLoadJobLog = useAtomSet(loadJobLogAtom, { mode: 'promiseExit' });
  const setDownloadSignal = useAtomSet(jobLogDownloadSignalAtom);
  const downloadSignal = useAtomValue(jobLogDownloadSignalAtom);
  const { scrollBoxRef, scrollToId } = useAutoScroll({ lookahead: 2 });
  const [scrollToItemRequest, setScrollToItemRequest] = useAtom(requestScrollPipelineJobsListToJob);

  const pipelineJobs = getPipelineJobsFromMr(selectedMergeRequest)
  const jobImportanceMap = useAtomValue(pipelineJobImportanceAtom);
  const projectJobImportance = selectedMergeRequest
    ? jobImportanceMap.get(selectedMergeRequest.project.fullPath) ?? new Map<string, string>()
    : new Map<string, string>();

  const selectedPipelineJob = pipelineJobs[selectedPipelineJobIndex];
  const [logErrors, setLogErrors] = useState<JobLogErrors | null>(null);

  useEffect(() => {
    if (!selectedPipelineJob || !selectedMergeRequest) {
      setLogErrors(null);
      return;
    }
    const logPath = getJobLogPath(
      selectedMergeRequest.project.path,
      selectedPipelineJob.job.name,
      selectedPipelineJob.job.localId
    );
    try {
      if (existsSync(logPath)) {
        const content = readFileSync(logPath, 'utf8');
        const errors = parseJobLogErrors(selectedPipelineJob.job.name, content);
        setLogErrors(hasErrors(errors) ? errors : null);
      } else {
        setLogErrors(null);
      }
    } catch {
      setLogErrors(null);
    }
  }, [selectedMergeRequest?.project.path, selectedPipelineJob?.job.name, selectedPipelineJob?.job.localId, downloadSignal]);

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
        runLoadJobLog({ mergeRequest: selectedMergeRequest, job: selectedJob.job }).then(() => {
          setDownloadSignal(Date.now());
        });
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
          const jobImportance = projectJobImportance.get(job.name) ?? 'low';
          const importanceIndicator = jobImportance === 'monitored' ? '■' : jobImportance === 'ignore' ? '-' : null;
          const importanceColor = jobImportance === 'monitored' ? Colors.WARNING : jobImportance === 'ignore' ? Colors.SUPPORTING : null;

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
                style={{ fg: jobImportance === 'monitored' ? Colors.WARNING : Colors.PRIMARY }}
                wrapMode='none'
              >
                {job.name}
              </text>
              {importanceIndicator && importanceColor && (
                <text style={{ fg: importanceColor }} wrapMode='none'>
                  {importanceIndicator}
                </text>
              )}
            </box>
          );
        })}
      </box>

      <text style={{ fg: Colors.NEUTRAL }} wrapMode='none'>
        ─────────────────────────────────────
      </text>

      {selectedPipelineJob && (() => {
        const selectedJobImportance = projectJobImportance.get(selectedPipelineJob.job.name) ?? 'low';
        const importanceDisplay = selectedJobImportance === 'ignore' ? 'ignored' : selectedJobImportance;
        const importanceColor = selectedJobImportance === 'monitored' ? Colors.WARNING : selectedJobImportance === 'ignore' ? Colors.ERROR : Colors.PRIMARY;

        return (
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
            <box style={{ flexDirection: "row", gap: 2 }}>
              <text style={{ fg: Colors.NEUTRAL }} wrapMode='none'>
                Importance:
              </text>
              <text style={{ fg: importanceColor }} wrapMode='none'>
                {importanceDisplay}
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
            {logErrors && (
              <box style={{ flexDirection: "column", gap: 0 }}>
                <text style={{ fg: Colors.ERROR, attributes: TextAttributes.BOLD }} wrapMode='none'>
                  ─── Log Errors ───
                </text>
                {logErrors.buildErrors.length > 0 && (
                  <box style={{ flexDirection: "column", gap: 0 }}>
                    <text style={{ fg: Colors.ERROR }} wrapMode='none'>
                      {`Build errors (${logErrors.buildErrors.length}):`}
                    </text>
                    {logErrors.buildErrors.slice(0, 5).map((err, i) => (
                      <text key={`be-${i}`} style={{ fg: Colors.ERROR, attributes: TextAttributes.DIM }} wrapMode='none'>
                        {`  ${err}`}
                      </text>
                    ))}
                    {logErrors.buildErrors.length > 5 && (
                      <text style={{ fg: Colors.SUPPORTING }} wrapMode='none'>
                        {`  ...and ${logErrors.buildErrors.length - 5} more`}
                      </text>
                    )}
                  </box>
                )}
                {logErrors.failedTests.length > 0 && (
                  <box style={{ flexDirection: "column", gap: 0 }}>
                    <text style={{ fg: Colors.ERROR }} wrapMode='none'>
                      {`Failed tests (${logErrors.failedTests.length}):`}
                    </text>
                    {logErrors.failedTests.slice(0, 8).map((test, i) => (
                      <box key={`ft-${i}`} style={{ flexDirection: "column" }}>
                        <text style={{ fg: Colors.ERROR }} wrapMode='none'>
                          {`  ${test.name}`}
                        </text>
                        {test.errorMessage && (
                          <text style={{ fg: Colors.SUPPORTING }} wrapMode='none'>
                            {`    ${test.errorMessage.substring(0, 120)}`}
                          </text>
                        )}
                      </box>
                    ))}
                    {logErrors.failedTests.length > 8 && (
                      <text style={{ fg: Colors.SUPPORTING }} wrapMode='none'>
                        {`  ...and ${logErrors.failedTests.length - 8} more`}
                      </text>
                    )}
                  </box>
                )}
                {logErrors.failedSummaries.map((summary, i) => (
                  <text key={`fs-${i}`} style={{ fg: Colors.ERROR, attributes: TextAttributes.DIM }} wrapMode='none'>
                    {summary}
                  </text>
                ))}
              </box>
            )}
          </box>
        );
      })()}
    </box>
    </scrollbox>
  );
}
