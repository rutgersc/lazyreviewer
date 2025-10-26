import { TextAttributes, type ParsedKey } from '@opentui/core';
import { useKeyboard } from '@opentui/react';
import Overview from './Overview';
import ActivityLog from './ActivityLog';
import JiraIssuesList from './JiraIssuesList';
import PipelineJobsList from './PipelineJobsList';
import { ActivePane } from '../userselection/userSelection';
import { Colors } from '../colors';
import type { PipelineJob, PipelineStage } from '../gitlab/gitlabgraphql';
import { useScrollBox } from '../hooks/useScrollBox';
import { useAtom, useAtomSet, useAtomValue } from '@effect-atom/atom-react';
import { activePaneAtom, activeModalAtom, infoPaneTabAtom, selectedJiraIndexAtom, selectedJiraSubIndexAtom, selectedDiscussionIndexAtom, selectedActivityIndexAtom, selectedPipelineJobIndexAtom, selectedMrAtom, selectedUserSelectionEntryAtom, userSelectionsAtom, type InfoPaneTab } from '../store/appAtoms';

interface InfoPaneProps {
  activePane: ActivePane;
}

const TAB_LABELS: Record<InfoPaneTab, string> = {
  overview: 'Merge request',
  jira: 'Jira',
  pipeline: 'Pipeline',
  activity: 'Activity'
};

export default function InfoPane({ activePane }: InfoPaneProps) {
  const setActivePane = useAtomSet(activePaneAtom);
  const activeModal = useAtomValue(activeModalAtom);
  const [infoPaneTab, setInfoPaneTab] = useAtom(infoPaneTabAtom);
  const [selectedDiscussionIndex] = useAtom(selectedDiscussionIndexAtom);
  const [selectedActivityIndex] = useAtom(selectedActivityIndexAtom);
  const [selectedPipelineJobIndex] = useAtom(selectedPipelineJobIndexAtom);

  const selectedMergeRequest = useAtomValue(selectedMrAtom);
  const [selectedUserSelectionEntryIndex] = useAtom(selectedUserSelectionEntryAtom);
  const userSelections = useAtomValue(userSelectionsAtom);
  const selectedUserSelectionEntry = userSelections[selectedUserSelectionEntryIndex];

  const scrollBoxRef = useScrollBox('infoPane', { scrollAmount: 3 });

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
        />;

      case 'jira':
        return <JiraIssuesList
          activePane={activePane}
          jiraIssues={jiraIssues}
        />;

      case 'pipeline':
        return <PipelineJobsList
          activePane={activePane}
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
          activePane={activePane}
          mergeRequest={selectedMergeRequest}
          columns={['time', 'eventType', 'eventDetails']} />;

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