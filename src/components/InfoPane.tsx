import { TextAttributes, type ParsedKey } from '@opentui/core';
import { useKeyboard } from '@opentui/react';
import Overview from './Overview';
import ActivityLog from './ActivityLog';
import JiraIssuesList from './JiraIssuesList';
import PipelineJobsList from './PipelineJobsList';
import { ActivePane } from '../userselection/userSelection';
import { Colors } from '../colors';
import type { PipelineJob, PipelineStage } from '../gitlab/gitlab-graphql';
import type { Action } from '../actions/action-types';
import { useAtom, useAtomSet, useAtomValue } from '@effect-atom/atom-react';
import { activePaneAtom, activeModalAtom, infoPaneTabAtom, type InfoPaneTab } from '../ui/navigation-atom';
import { selectedPipelineJobIndexAtom } from '../mergerequests/job-atom';
import { selectedMrAtom, allJiraIssuesAtom } from '../mergerequests/mergerequests-atom';

interface InfoPaneProps {
  activePane: ActivePane;
  isActive: boolean;
  onActionsChange: (actions: Action[]) => void;
}

const TAB_LABELS: Record<InfoPaneTab, string> = {
  overview: 'Merge request',
  jira: 'Jira',
  pipeline: 'Pipeline',
  activity: 'Activity'
};

export default function InfoPane({ activePane, isActive, onActionsChange }: InfoPaneProps) {
  const setActivePane = useAtomSet(activePaneAtom);
  const activeModal = useAtomValue(activeModalAtom);
  const [infoPaneTab, setInfoPaneTab] = useAtom(infoPaneTabAtom);
  const [selectedPipelineJobIndex] = useAtom(selectedPipelineJobIndexAtom);

  const selectedMergeRequest = useAtomValue(selectedMrAtom);

  const pipelineJobs = !selectedMergeRequest?.pipeline?.stage
    ? []
    : selectedMergeRequest.pipeline.stage.flatMap((stage: PipelineStage) =>
        stage.jobs.map((job: PipelineJob) => ({ stage, job }))
      );

  const jiraIssuesMap = useAtomValue(allJiraIssuesAtom);

  const jiraIssues = selectedMergeRequest?.jiraIssueKeys.flatMap(key => {
    const issue = jiraIssuesMap.get(key);
    return issue ? [issue] : [];
  }) || [];

  useKeyboard((key: ParsedKey) => {
    if (activePane !== ActivePane.InfoPane) return;
    if (activeModal !== 'none') return;

    if (key.name === 'escape') {
      setActivePane(ActivePane.MergeRequests);
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
              onMouseDown={() => {
                setInfoPaneTab(tab);
                setActivePane(ActivePane.InfoPane);
              }}
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
          isActive={isActive && infoPaneTab === 'overview'}
          onActionsChange={onActionsChange}
        />;

      case 'jira':
        return <JiraIssuesList
          activePane={activePane}
          jiraIssues={jiraIssues}
          isActive={isActive && infoPaneTab === 'jira'}
          onActionsChange={onActionsChange}
        />;

      case 'pipeline':
        return <PipelineJobsList
          activePane={activePane}
          pipelineJobs={pipelineJobs}
          selectedPipelineJobIndex={selectedPipelineJobIndex}
          isActive={isActive && infoPaneTab === 'pipeline'}
          onActionsChange={onActionsChange}
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
          activePane={activePane}
          mergeRequest={selectedMergeRequest}
          columns={['time', 'eventType', 'eventDetails']} />;

    }
  };

  return (
    <box
      onMouseDown={() => setActivePane(ActivePane.InfoPane)}
      style={{ flexDirection: "column", padding: 1, flexGrow: 1, alignItems: "flex-start", height: "100%" }}
    >
      {renderTabBar()}
      <box style={{ flexGrow: 1, width: "100%" }}>
        {renderTabContent()}
      </box>
    </box>
  );
}