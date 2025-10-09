import { TextAttributes, type ParsedKey } from '@opentui/core';
import { useRef, useEffect, useMemo, useState } from 'react';
import { useKeyboard } from '@opentui/react';
import Overview from './Overview';
import ActivityLog, { extractActivityEvents } from './ActivityLog';
import JiraIssuesList from './JiraIssuesList';
import PipelineJobsList from './PipelineJobsList';
import { useAppStore, type InfoPaneTab } from '../store/appStore';
import { ActivePane } from '../types/userSelection';
import { Colors } from '../constants/colors';
import type { PipelineJob, PipelineStage } from '../gitlabgraphql';
import { handleOverviewKeys } from './OverviewKeyHandler';
import { handleJiraKeys } from './JiraIssuesListKeyHandler';
import { handlePipelineKeys } from './PipelineJobsListKeyHandler';
import { handleActivityKeys } from './ActivityLogKeyHandler';

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
  const { activePane, infoPaneScrollOffset, infoPaneTab, selectedJiraIndex, selectedJiraSubIndex, selectedPipelineJobIndex, selectedDiscussionIndex, selectedActivityIndex, setSelectedJiraIndex, setSelectedJiraSubIndex, setSelectedPipelineJobIndex, setSelectedDiscussionIndex, setSelectedActivityIndex } = useAppStore();
  const scrollBoxRef = useRef<any>(null);
  const [copyNotification, setCopyNotification] = useState<string | null>(null);

  const selectedMergeRequest = useAppStore(state => state.mergeRequests[state.selectedMergeRequest]);
  const selectedUserSelectionEntry = useAppStore(state => state.userSelections[state.selectedUserSelectionEntry]);

  // Sync scroll position when offset changes
  useEffect(() => {
    if (scrollBoxRef.current && typeof scrollBoxRef.current.scrollTo === 'function') {
      scrollBoxRef.current.scrollTo(infoPaneScrollOffset);
    }
  }, [infoPaneScrollOffset]);

  const pipelineJobs = useMemo(() => {
    if (!selectedMergeRequest?.pipeline?.stage) return [];
    return selectedMergeRequest.pipeline.stage.flatMap((stage: PipelineStage) =>
      stage.jobs.map((job: PipelineJob) => ({ stage, job }))
    );
  }, [selectedMergeRequest]);

  const jiraIssues = useMemo(() => {
    if (!selectedMergeRequest) return [];
    return selectedMergeRequest.jiraIssues || [];
  }, [selectedMergeRequest]);

  const unresolvedDiscussions = useMemo(() => {
    if (!selectedMergeRequest?.discussions) return [];
    return selectedMergeRequest.discussions.filter(d => d.resolvable && !d.resolved);
  }, [selectedMergeRequest]);

  const activityEvents = useMemo(() => {
    if (!selectedMergeRequest) return [];
    return extractActivityEvents(selectedMergeRequest);
  }, [selectedMergeRequest]);

  useKeyboard((key: ParsedKey) => {
    if (activePane !== ActivePane.InfoPane) return;

    if (key.name === 'escape') {
      useAppStore.getState().setActivePane(ActivePane.MergeRequests);
      return;
    }

    if (infoPaneTab === 'overview') {
      handleOverviewKeys({
        key,
        unresolvedDiscussions,
        selectedDiscussionIndex,
        setSelectedDiscussionIndex,
        selectedMergeRequest,
        setCopyNotification
      });
    } else if (infoPaneTab === 'jira') {
      handleJiraKeys({
        key,
        jiraIssues,
        selectedJiraIndex,
        selectedJiraSubIndex,
        setSelectedJiraIndex,
        setSelectedJiraSubIndex
      });
    } else if (infoPaneTab === 'pipeline') {
      handlePipelineKeys({
        key,
        pipelineJobs,
        selectedPipelineJobIndex,
        setSelectedPipelineJobIndex,
        selectedMergeRequest
      });
    } else if (infoPaneTab === 'activity') {
      handleActivityKeys({
        key,
        activityEvents,
        selectedActivityIndex,
        setSelectedActivityIndex,
        selectedMergeRequest
      });
    }
  });

  const renderTabBar = () => {
    const tabs: InfoPaneTab[] = ['overview', 'jira', 'pipeline', 'activity'];

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
              <text style={{ fg: Colors.SECONDARY, attributes: TextAttributes.DIM }} wrap={false}>
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

      {copyNotification && (
        <box
          style={{
            position: "absolute",
            top: 3,
            right: 3,
            padding: 1,
            border: true,
            borderColor: Colors.SUCCESS,
            backgroundColor: Colors.BACKGROUND,
            zIndex: 1000,
          }}
        >
          <text
            style={{ fg: Colors.SUCCESS, attributes: TextAttributes.BOLD }}
            wrap={false}
          >
            {copyNotification}
          </text>
        </box>
      )}
    </box>
  );
}