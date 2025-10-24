import { ScrollBoxRenderable, TextAttributes, type ParsedKey } from '@opentui/core';
import { useRef, useEffect } from 'react';
import { useKeyboard } from '@opentui/react';
import Overview from './Overview';
import ActivityLog from './ActivityLog';
import JiraIssuesList from './JiraIssuesList';
import PipelineJobsList from './PipelineJobsList';
import { useAppStore, type InfoPaneTab } from '../store/appStore';
import { ActivePane } from '../userselection/userSelection';
import { Colors } from '../colors';
import type { PipelineJob, PipelineStage } from '../gitlab/gitlabgraphql';

interface InfoPaneProps {
  // No props needed - everything comes from store!
}

const TAB_LABELS: Record<InfoPaneTab, string> = {
  overview: 'Merge request',
  jira: 'Jira',
  pipeline: 'Pipeline',
  activity: 'Activity'
};

export default function InfoPane({}: InfoPaneProps) {
  const activePane = useAppStore(state => state.activePane);
  const infoPaneScrollOffset = useAppStore(state => state.infoPaneScrollOffset);
  const infoPaneTab = useAppStore(state => state.infoPaneTab);
  const selectedJiraIndex = useAppStore(state => state.selectedJiraIndex);
  const selectedJiraSubIndex = useAppStore(state => state.selectedJiraSubIndex);
  const selectedPipelineJobIndex = useAppStore(state => state.selectedPipelineJobIndex);
  const selectedDiscussionIndex = useAppStore(state => state.selectedDiscussionIndex);
  const selectedActivityIndex = useAppStore(state => state.selectedActivityIndex);
  const activeModal = useAppStore(state => state.activeModal);
  const scrollBoxRef = useRef<ScrollBoxRenderable>(null);

  const selectedMergeRequest = useAppStore(state => state.mergeRequests[state.selectedMergeRequest]);
  const selectedUserSelectionEntry = useAppStore(state => state.userSelections[state.selectedUserSelectionEntry]);

  // Sync scroll position when offset changes
  useEffect(() => {
    if (scrollBoxRef.current && typeof scrollBoxRef.current.scrollTo === 'function') {
      scrollBoxRef.current.scrollTo(infoPaneScrollOffset);
    }
  }, [infoPaneScrollOffset]);

  const pipelineJobs = !selectedMergeRequest?.pipeline?.stage
    ? []
    : selectedMergeRequest.pipeline.stage.flatMap((stage: PipelineStage) =>
        stage.jobs.map((job: PipelineJob) => ({ stage, job }))
      );

  const jiraIssues = selectedMergeRequest?.jiraIssues || [];

  useKeyboard((key: ParsedKey) => {
    if (activePane !== ActivePane.InfoPane) return;
    if (activeModal !== 'none') return;

    if (key.name === 'escape') {
      useAppStore.getState().setActivePane(ActivePane.MergeRequests);
      return;
    }
  });

  const renderTabBar = () => {
    const tabs: InfoPaneTab[] = ['overview', 'jira', 'pipeline', 'activity'];

    return (
      <box style={{ flexDirection: "column", gap: 0, marginBottom: 1 }}>
        {/* Tabs */}
        <box style={{ flexDirection: "row", gap: 1 }}>
          {tabs.map((tab, index) => (
            <text
              key={tab}
              style={{
                fg: tab === infoPaneTab ? Colors.PRIMARY : Colors.NEUTRAL,
                attributes: tab === infoPaneTab ? TextAttributes.BOLD : undefined
              }}
              wrapMode='none'
            >
              {index > 0 ? '| ' : ''}{TAB_LABELS[tab]}
            </text>
          ))}
        </box>
      </box>
    );
  };

  const renderTabContent = () => {
    switch (infoPaneTab) {
      case 'overview':
        return <Overview
          activePane={activePane}
          selectedMergeRequest={selectedMergeRequest}
          selectedUserSelectionEntry={selectedUserSelectionEntry}
          selectedDiscussionIndex={selectedDiscussionIndex}
        />;

      case 'jira':
        return <JiraIssuesList
          jiraIssues={jiraIssues}
          selectedJiraIndex={selectedJiraIndex}
          selectedJiraSubIndex={selectedJiraSubIndex}
        />;

      case 'pipeline':
        return <PipelineJobsList
          pipelineJobs={pipelineJobs}
          selectedPipelineJobIndex={selectedPipelineJobIndex}
        />;

      case 'activity':
        if (!selectedMergeRequest) {
          return (
            <box style={{ flexDirection: "column", gap: 1, justifyContent: "flex-start", alignItems: "flex-start", flexGrow: 1 }}>
              <text style={{ fg: Colors.SECONDARY, attributes: TextAttributes.DIM }} wrapMode='none'>
                No selection
              </text>
            </box>
          );
        }

        return <ActivityLog
          mergeRequest={selectedMergeRequest}
          columns={['time', 'eventType', 'eventDetails']}
          selectedActivityIndex={selectedActivityIndex} />;

    }
  };

  return (
    <box style={{ flexDirection: "column", padding: 1, flexGrow: 1, alignItems: "flex-start", height: "100%" }}>
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