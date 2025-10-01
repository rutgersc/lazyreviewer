import { useState, useEffect } from 'react';
import { useKeyboard } from '@opentui/react';
import { TextAttributes, type ParsedKey } from '@opentui/core';
import type { MergeRequest } from './MergeRequestPane';
import { getJobStatusDisplay } from '../utils/jobStatus';
import type { JiraIssue } from '../services/jiraService';
import type { PipelineJob, PipelineStage } from '../gitlabgraphql';
import { getJobTrace } from '../gitlabgraphql';
import { useAppStore } from '../store/appStore';
import { loadJobLog } from '../pipelinejob-log';
import { addJobToMonitor } from '../services/jobMonitor';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { Colors } from '../constants/colors';

interface MergeRequestDetailsPaneProps {
  isActive: boolean;
}

interface JiraMrDetailRow {
  type: 'jira',
  key: string,
  issue: JiraIssue,
  displayText: string
}

interface MrDetailRow {
  type: 'mr',
  key: string,
  mr: MergeRequest,
  displayText: string
}

interface PipelineJobRow {
  type: 'job',
  key: string,
  stage: PipelineStage,
  job: PipelineJob,
  displayText: string
}

export type DetailRow = JiraMrDetailRow | MrDetailRow | PipelineJobRow;

 const getExpandableItemsFromMergeRequest = (mr: MergeRequest): DetailRow[] => {
    const mrRow = {
      type: 'mr',
      key: mr.id,
      mr: mr,
      displayText: `${mr.title}`
    } satisfies DetailRow;

    const jiraIssues = mr.jiraIssues.map(issue => {
      return {
        type: 'jira',
        key: issue.key,
        issue: issue,
        displayText: `${issue.key} - ${issue.fields.summary}`
      } satisfies JiraMrDetailRow
    });

    const jobs = mr.pipeline.stage.flatMap(stage => {
      return stage.jobs.map(job => {
        return {
          type: 'job',
          key: job.id,
          stage: stage,
          job: job,
          displayText: `${stage.name}: ${job.name}`
        } satisfies PipelineJobRow;
      });
    });

    return [mrRow, ...jiraIssues, ...jobs];
  };

function renderMrDetailRow(item: MrDetailRow) {
  return (
    <box style={{ flexDirection: "row", gap: 2, alignItems: "center" }}>
      <box style={{ width: 5 }}>
        <text
          style={{ fg: '#bd93f9', attributes: TextAttributes.BOLD }}
          wrap={false}
        >
          MR
        </text>
      </box>
      <box style={{ width: 12 }}>
        <text
          style={{ fg: '#ffb86c', attributes: TextAttributes.DIM }}
          wrap={false}
        >
          {item.mr.state}
        </text>
      </box>
      <text
        style={{ fg: '#8be9fd', attributes: TextAttributes.DIM }}
        wrap={false}
      >
        {`💬 ${item.mr.totalDiscussions}`}
      </text>
      <text
        style={{ fg: '#50fa7b', attributes: TextAttributes.BOLD }}
        wrap={false}
      >
        {`!${item.mr.iid}`}
      </text>
      <text
        style={{ fg: '#f8f8f2' }}
        wrap={false}
      >
        {item.mr.title.length > 35 ? item.mr.title.substring(0, 100) + '...' : item.mr.title}
      </text>
    </box>
  );
}

function renderJiraDetailRow(item: JiraMrDetailRow) {
  return (
    <box style={{ flexDirection: "row", gap: 2, alignItems: "center" }}>
      <box style={{ width: 5 }}>
        <text
          style={{ fg: '#bd93f9', attributes: TextAttributes.BOLD }}
          wrap={false}
        >
          ISSUE
        </text>
      </box>
      <box style={{ width: 12 }}>
        <text
          style={{ fg: '#ffb86c', attributes: TextAttributes.DIM }}
          wrap={false}
        >
          {item.issue.fields.status.name}
        </text>
      </box>
      <text
        style={{ fg: '#8be9fd', attributes: TextAttributes.DIM }}
        wrap={false}
      >
        {`💬 ${item.issue.fields.comment.total}`}
      </text>
      <text
        style={{ fg: '#50fa7b', attributes: TextAttributes.BOLD }}
        wrap={false}
      >
        {item.issue.key}
      </text>
      <text
        style={{ fg: '#f8f8f2' }}
        wrap={false}
      >
        {item.issue.fields.summary.length > 35 ? item.issue.fields.summary.substring(0, 35) + '...' : item.issue.fields.summary}
      </text>
    </box>
  );
}

function renderPipelineJobDetailRow(item: PipelineJobRow) {
  return (
    <box style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
      <box style={{ width: 5 }}>
        <text
          style={{ fg: '#bd93f9', attributes: TextAttributes.BOLD }}
          wrap={false}
        >
          JOB
        </text>
      </box>
      <text
        style={{ fg: getJobStatusDisplay(item.job.status).color, attributes: TextAttributes.DIM }}
        wrap={false}
      >
        {getJobStatusDisplay(item.job.status).symbol}
      </text>
      <text
        style={{ fg: '#bd93f9' }}
        wrap={false}
      >
        {`${item.stage.name}: `}
      </text>
      <text
        style={{ fg: '#f8f8f2' }}
        wrap={false}
      >
        {item.job.name}
      </text>
    </box>
  );
}

export default function MergeRequestDetailsPane({ isActive }: MergeRequestDetailsPaneProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { setSelectedDetailItem } = useAppStore();
   const selectedMergeRequest = useAppStore(state => state.mergeRequests[state.selectedMergeRequest]);
  const { scrollBoxRef, scrollToItem } = useAutoScroll({
    itemHeight: 1,
    lookahead: 2,
  });

  const notifySelectionChange = (newIndex: number) => {
    if (selectedMergeRequest) {
      const expandableItems = getExpandableItemsFromMergeRequest(selectedMergeRequest);
      const selectedItem = expandableItems[newIndex];
      setSelectedDetailItem(selectedItem);
    } else {
      setSelectedDetailItem(undefined);
    }
  };

  useKeyboard((key: ParsedKey) => {
    if (!isActive || !selectedMergeRequest) return;

    // if (showingJobLog) {
    //   switch (key.name) {
    //     case 'escape':
    //     case 'q':
    //       setShowingJobLog(false);
    //       setJobLog(null);
    //       break;
    //   }
    //   return;
    // }

    const expandableItems = getExpandableItemsFromMergeRequest(selectedMergeRequest);

    switch (key.name) {
      case 'j':
      case 'down':
        if (selectedIndex < expandableItems.length - 1) {
          const newIndex = selectedIndex + 1;
          setSelectedIndex(newIndex);
          notifySelectionChange(newIndex);
          scrollToItem(newIndex);
        }
        break;
      case 'k':
      case 'up':
        if (selectedIndex > 0) {
          const newIndex = selectedIndex - 1;
          setSelectedIndex(newIndex);
          notifySelectionChange(newIndex);
          scrollToItem(newIndex);
        }
        break;
      case 'i':
        const selectedItem = expandableItems[selectedIndex];
        if (selectedItem && selectedItem.type === 'job') {
          loadJobLog(selectedMergeRequest, selectedItem.job);
        }
        break;
      case 'm':
        const selectedJobItem = expandableItems[selectedIndex];
        if (selectedJobItem && selectedJobItem.type === 'job') {
          const job = selectedJobItem.job;

          // Only monitor jobs that are currently running or pending
          if (job.status === 'RUNNING' || job.status === 'PENDING' || job.status === 'PREPARING') {
            addJobToMonitor({
              jobId: job.id,
              projectFullPath: selectedMergeRequest.project.fullPath,
              jobName: job.name,
              webPath: job.webPath || '',
              lastStatus: job.status,
              mrTitle: selectedMergeRequest.title,
            });
            console.log(`Started monitoring job: ${job.name}`);
          } else {
            console.log(`Job ${job.name} is not in a monitorable state (status: ${job.status})`);
          }
        }
        break;
    }
  });

  if (!selectedMergeRequest) {
    return (
      <box style={{ flexDirection: "column", padding: 1, height: "100%" }}>
        <text
          style={{ fg: '#f8f8f2', marginBottom: 1, attributes: TextAttributes.BOLD }}
          wrap={false}
        >
          MR Details
        </text>
        <box style={{ flexDirection: "column", gap: 1 }}>
          <text
            style={{ fg: '#bd93f9', attributes: TextAttributes.DIM }}
            wrap={false}
          >
            No merge request selected
          </text>
        </box>
      </box>
    );
  }

  const expandableItems = getExpandableItemsFromMergeRequest(selectedMergeRequest);

  return (
    <box style={{ flexDirection: "column", padding: 1, height: "100%" }}>
      <text
        style={{ fg: '#f8f8f2', marginBottom: 1, attributes: TextAttributes.BOLD }}
        wrap={false}
      >
        {`MR Details (${expandableItems.length})`}
      </text>

      <scrollbox
        ref={scrollBoxRef}
        style={{
          flexGrow: 1,
          contentOptions: {
            backgroundColor: Colors.BACKGROUND,
          },
          viewportOptions: {
            backgroundColor: Colors.BACKGROUND,
          },
          scrollbarOptions: {
            width: 1,
            trackOptions: {
              foregroundColor: Colors.NEUTRAL,
              backgroundColor: Colors.TRACK,
            },
          },
        }}
        focused={false}
      >
        {expandableItems.map((item, index) => (
          <box
            key={item.key}
            style={{
              flexDirection: "column",
              backgroundColor: index === selectedIndex ? Colors.SELECTED : 'transparent'
            }}
          >
            {item.type === 'mr' ? renderMrDetailRow(item) :
             item.type === 'jira' ? renderJiraDetailRow(item) :
             renderPipelineJobDetailRow(item)}
          </box>
        ))}

        {expandableItems.length === 0 && (
          <box style={{ flexDirection: "column", gap: 1 }}>
            <text
              style={{ fg: '#bd93f9', attributes: TextAttributes.DIM }}
              wrap={false}
            >
              No Jira issues or pipeline jobs
            </text>
          </box>
        )}
      </scrollbox>
    </box>
  );
}
