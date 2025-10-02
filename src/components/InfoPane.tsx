import { TextAttributes, type ParsedKey } from '@opentui/core';
import { useRef, useEffect, useMemo } from 'react';
import { useKeyboard } from '@opentui/react';
import JiraIssueInfo from './JiraIssueInfo';
import MergeRequestInfo from './MergeRequestInfo';
import UserSelectionInfo from './UserSelectionInfo';
import { useAppStore, type InfoPaneTab } from '../store/appStore';
import { ActivePane } from '../types/userSelection';
import { Colors } from '../constants/colors';
import { getJobStatusDisplay } from '../utils/jobStatus';
import type { PipelineJob, PipelineStage } from '../gitlabgraphql';

interface InfoPaneProps {
  // No props needed - everything comes from store!
}

const TAB_LABELS: Record<InfoPaneTab, string> = {
  overview: 'Merge request',
  jira: 'Jira',
  pipeline: 'Pipeline'
};

export default function InfoPane({}: InfoPaneProps) {
  const { activePane, infoPaneScrollOffset, infoPaneTab, selectedJiraIndex, selectedPipelineJobIndex, setSelectedJiraIndex, setSelectedPipelineJobIndex } = useAppStore();
  const scrollBoxRef = useRef<any>(null);

  const selectedMergeRequest = useAppStore(state => state.mergeRequests[state.selectedMergeRequest]);
  const selectedUserSelectionEntry = useAppStore(state => state.userSelections[state.selectedUserSelectionEntry]);

  // Sync scroll position when offset changes
  useEffect(() => {
    if (scrollBoxRef.current && typeof scrollBoxRef.current.scrollTo === 'function') {
      scrollBoxRef.current.scrollTo(infoPaneScrollOffset);
    }
  }, [infoPaneScrollOffset]);

  // Flatten pipeline jobs for easy indexing
  const pipelineJobs = useMemo(() => {
    if (!selectedMergeRequest?.pipeline?.stage) return [];
    return selectedMergeRequest.pipeline.stage.flatMap((stage: PipelineStage) =>
      stage.jobs.map((job: PipelineJob) => ({ stage, job }))
    );
  }, [selectedMergeRequest]);

  const jiraIssues = useMemo(() => {
    return selectedMergeRequest?.jiraIssues || [];
  }, [selectedMergeRequest]);

  // Keyboard navigation for jira and pipeline tabs
  useKeyboard((key: ParsedKey) => {
    if (activePane !== ActivePane.InfoPane) return;

    if (infoPaneTab === 'jira' && jiraIssues.length > 0) {
      switch (key.name) {
        case 'j':
        case 'down':
          setSelectedJiraIndex(Math.min(selectedJiraIndex + 1, jiraIssues.length - 1));
          break;
        case 'k':
        case 'up':
          setSelectedJiraIndex(Math.max(selectedJiraIndex - 1, 0));
          break;
      }
    } else if (infoPaneTab === 'pipeline' && pipelineJobs.length > 0) {
      switch (key.name) {
        case 'j':
        case 'down':
          setSelectedPipelineJobIndex(Math.min(selectedPipelineJobIndex + 1, pipelineJobs.length - 1));
          break;
        case 'k':
        case 'up':
          setSelectedPipelineJobIndex(Math.max(selectedPipelineJobIndex - 1, 0));
          break;
      }
    }
  });

  const renderTabBar = () => {
    const tabs: InfoPaneTab[] = ['overview', 'jira', 'pipeline'];

    return (
      <box style={{ flexDirection: "column", gap: 0, marginBottom: 1 }}>
        {/* MR Title */}
        {selectedMergeRequest && (
          <text style={{ fg: Colors.PRIMARY, attributes: TextAttributes.BOLD }} wrap={false}>
            {selectedMergeRequest.title}
          </text>
        )}

        {/* Tabs */}
        <box style={{ flexDirection: "row", gap: 1 }}>
          {tabs.map((tab, index) => (
            <text
              key={tab}
              style={{
                fg: tab === infoPaneTab ? Colors.PRIMARY : Colors.NEUTRAL,
                attributes: tab === infoPaneTab ? TextAttributes.BOLD : TextAttributes.DIM
              }}
              wrap={false}
            >
              {index > 0 ? '| ' : ''}{TAB_LABELS[tab]}
            </text>
          ))}
        </box>
      </box>
    );
  };

  const renderEmptyState = () => {
    return (
      <box style={{ flexDirection: "column", gap: 1, justifyContent: "flex-start", alignItems: "flex-start", flexGrow: 1 }}>
        <text style={{ fg: '#bd93f9', attributes: TextAttributes.DIM }} wrap={false}>
          No selection
        </text>
      </box>
    );
  };

  const renderTabContent = () => {
    switch (infoPaneTab) {
      case 'overview':
        if (activePane === ActivePane.MergeRequests && selectedMergeRequest) {
          return <MergeRequestInfo mergeRequest={selectedMergeRequest} />;
        } else if (activePane === ActivePane.UserSelection && selectedUserSelectionEntry) {
          return <UserSelectionInfo userSelection={selectedUserSelectionEntry} />;
        }
        return renderEmptyState();

      case 'jira':
        if (jiraIssues.length === 0) {
          return (
            <box style={{ flexDirection: "column", gap: 1 }}>
              <text style={{ fg: Colors.NEUTRAL, attributes: TextAttributes.DIM }} wrap={false}>
                No Jira tickets
              </text>
            </box>
          );
        }

        const selectedJira = jiraIssues[selectedJiraIndex];

        return (
          <box style={{ flexDirection: "column", gap: 1 }}>
            {/* List of Jira issues */}
            <box style={{ flexDirection: "column", gap: 0 }}>
              {jiraIssues.map((issue, index) => (
                <box
                  key={issue.key}
                  style={{
                    flexDirection: "column",
                    gap: 0,
                    backgroundColor: index === selectedJiraIndex ? Colors.SELECTED : 'transparent'
                  }}
                >
                  <box style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                    <text
                      style={{ fg: Colors.SUCCESS, attributes: TextAttributes.BOLD }}
                      wrap={false}
                    >
                      {issue.key}
                    </text>
                    <text
                      style={{ fg: Colors.WARNING, attributes: TextAttributes.DIM }}
                      wrap={false}
                    >
                      {issue.fields.status.name}
                    </text>
                    <text
                      style={{ fg: Colors.NEUTRAL, attributes: TextAttributes.DIM }}
                      wrap={false}
                    >
                      {issue.fields.issuetype.name}
                    </text>
                    <text
                      style={{ fg: Colors.PRIMARY }}
                      wrap={false}
                    >
                      {issue.fields.summary}
                    </text>
                  </box>
                  {issue.fields.parent && (
                    <box style={{ flexDirection: "row", alignItems: "center", gap: 2, marginLeft: 2 }}>
                      <text
                        style={{ fg: Colors.NEUTRAL, attributes: TextAttributes.DIM }}
                        wrap={false}
                      >
                        ↳ Parent:
                      </text>
                      <text
                        style={{ fg: Colors.INFO, attributes: TextAttributes.DIM }}
                        wrap={false}
                      >
                        {issue.fields.parent.key}
                      </text>
                      <text
                        style={{ fg: Colors.NEUTRAL, attributes: TextAttributes.DIM }}
                        wrap={false}
                      >
                        {issue.fields.parent.fields.summary}
                      </text>
                    </box>
                  )}
                </box>
              ))}
            </box>

            {/* Separator */}
            <text style={{ fg: Colors.NEUTRAL }} wrap={false}>
              ─────────────────────────────────────
            </text>

            {/* Details of selected Jira issue */}
            {selectedJira && <JiraIssueInfo issue={selectedJira} />}
          </box>
        );

      case 'pipeline':
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
            {/* List of pipeline jobs */}
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

            {/* Separator */}
            <text style={{ fg: Colors.NEUTRAL }} wrap={false}>
              ─────────────────────────────────────
            </text>

            {/* Details of selected pipeline job */}
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
  };

  return (
    <box style={{ flexDirection: "column", padding: 2, flexGrow: 1, alignItems: "flex-start", height: "100%" }}>
      {renderTabBar()}

      <scrollbox
        ref={scrollBoxRef}
        style={{
          flexGrow: 1,
          width: "100%",
          contentOptions: {
            backgroundColor: '#282a36',
          },
          scrollbarOptions: {
            trackOptions: {
              foregroundColor: '#bd93f9',
              backgroundColor: '#44475a',
            },
          },
        }}
        focused={false}
      >
        {renderTabContent()}
      </scrollbox>
    </box>
  );
}