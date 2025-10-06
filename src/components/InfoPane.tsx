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
import type { JiraIssue } from '../services/jiraService';
import { openUrl } from '../utils/url';
import { copyToClipboard } from '../utils/clipboard';
import { loadJobLog } from '../pipelinejob-log';

interface InfoPaneProps {
  // No props needed - everything comes from store!
}

const TAB_LABELS: Record<InfoPaneTab, string> = {
  overview: 'Merge request',
  jira: 'Jira',
  pipeline: 'Pipeline'
};

export default function InfoPane({}: InfoPaneProps) {
  const { activePane, infoPaneScrollOffset, infoPaneTab, selectedJiraIndex, selectedJiraSubIndex, selectedPipelineJobIndex, selectedDiscussionIndex, setSelectedJiraIndex, setSelectedJiraSubIndex, setSelectedPipelineJobIndex, setSelectedDiscussionIndex } = useAppStore();
  const scrollBoxRef = useRef<any>(null);

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

  // Keyboard navigation for jira and pipeline tabs
  useKeyboard((key: ParsedKey) => {
    if (activePane !== ActivePane.InfoPane) return;

    // Escape goes back to MergeRequests pane
    if (key.name === 'escape') {
      useAppStore.getState().setActivePane(ActivePane.MergeRequests);
      return;
    }

    // Overview tab - navigate through unresolved discussions
    if (infoPaneTab === 'overview' && unresolvedDiscussions.length > 0) {
      switch (key.name) {
        case 'j':
        case 'down':
          setSelectedDiscussionIndex(Math.min(selectedDiscussionIndex + 1, unresolvedDiscussions.length - 1));
          break;
        case 'k':
        case 'up':
          setSelectedDiscussionIndex(Math.max(selectedDiscussionIndex - 1, 0));
          break;
        case 'i':
          // Open discussion in browser
          const selectedDiscussion = unresolvedDiscussions[selectedDiscussionIndex];
          if (selectedDiscussion && selectedMergeRequest?.webUrl) {
            const discussionUrl = `${selectedMergeRequest.webUrl}#note_${selectedDiscussion.id}`;
            openUrl(discussionUrl);
          }
          break;
        case 'c':
          // Copy discussion URL
          const discussion = unresolvedDiscussions[selectedDiscussionIndex];
          if (discussion && selectedMergeRequest?.webUrl) {
            const discussionUrl = `${selectedMergeRequest.webUrl}#note_${discussion.id}`;
            copyToClipboard(discussionUrl);
          }
          break;
      }
      return;
    }

    if (infoPaneTab === 'jira' && jiraIssues.length > 0) {
      const selectedIssue = jiraIssues[selectedJiraIndex];
      const hasParent = selectedIssue?.fields.parent !== undefined;
      const maxSubIndex = hasParent ? 1 : 0;

      switch (key.name) {
        case 'j':
        case 'down':
          if (selectedJiraSubIndex < maxSubIndex) {
            setSelectedJiraSubIndex(selectedJiraSubIndex + 1);
          } else if (selectedJiraIndex < jiraIssues.length - 1) {
            setSelectedJiraIndex(selectedJiraIndex + 1);
          }
          break;
        case 'k':
        case 'up':
          if (selectedJiraSubIndex > 0) {
            setSelectedJiraSubIndex(selectedJiraSubIndex - 1);
          } else if (selectedJiraIndex > 0) {
            setSelectedJiraIndex(selectedJiraIndex - 1);
          }
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
        case 'i':
          const selectedJob = pipelineJobs[selectedPipelineJobIndex];
          if (selectedJob && selectedMergeRequest) {
            loadJobLog(selectedMergeRequest, selectedJob.job);
          }
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
        if ((activePane === ActivePane.MergeRequests || activePane === ActivePane.InfoPane) && selectedMergeRequest) {
          return <MergeRequestInfo mergeRequest={selectedMergeRequest} selectedDiscussionIndex={selectedDiscussionIndex} />;
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

        // Build flat list of main issues and their parents
        type JiraListItem = {
          issue: JiraIssue;
          isParent: boolean;
          parentIssueIndex: number;
          subIndex: number;
        };

        const jiraListItems: JiraListItem[] = [];
        jiraIssues.forEach((issue, issueIndex) => {
          jiraListItems.push({
            issue,
            isParent: false,
            parentIssueIndex: issueIndex,
            subIndex: 0
          });

          if (issue.fields.parent) {
            // Create a pseudo JiraIssue from parent data
            const parentAsIssue: JiraIssue = {
              key: issue.fields.parent.key,
              id: '',
              self: '',
              fields: {
                summary: issue.fields.parent.fields.summary,
                parent: undefined,
                status: { name: 'To Do', statusCategory: { name: '' } },
                assignee: null,
                priority: { name: '' },
                issuetype: issue.fields.parent.fields.issuetype,
                created: '',
                updated: '',
                comment: { total: 0, comments: [] }
              }
            };

            jiraListItems.push({
              issue: parentAsIssue,
              isParent: true,
              parentIssueIndex: issueIndex,
              subIndex: 1
            });
          }
        });

        // Find the currently selected item
        const selectedListItem = jiraListItems.find(
          item => item.parentIssueIndex === selectedJiraIndex && item.subIndex === selectedJiraSubIndex
        );

        return (
          <box style={{ flexDirection: "column", gap: 1 }}>
            {/* List of Jira issues */}
            <box style={{ flexDirection: "column", gap: 0 }}>
              {jiraListItems.map((item, flatIndex) => {
                const isSelected = item.parentIssueIndex === selectedJiraIndex && item.subIndex === selectedJiraSubIndex;

                return (
                  <box
                    key={`${item.issue.key}-${item.isParent ? 'parent' : 'main'}`}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 2,
                      backgroundColor: isSelected ? Colors.SELECTED : 'transparent',
                      marginLeft: item.isParent ? 2 : 0
                    }}
                  >
                    {item.isParent && (
                      <text
                        style={{ fg: Colors.NEUTRAL, attributes: TextAttributes.DIM }}
                        wrap={false}
                      >
                        ↳
                      </text>
                    )}
                    <text
                      style={{ fg: Colors.SUCCESS, attributes: TextAttributes.BOLD }}
                      wrap={false}
                    >
                      {item.issue.key}
                    </text>
                    <text
                      style={{ fg: Colors.WARNING, attributes: TextAttributes.DIM }}
                      wrap={false}
                    >
                      {item.issue.fields.status.name}
                    </text>
                    <text
                      style={{ fg: Colors.NEUTRAL, attributes: TextAttributes.DIM }}
                      wrap={false}
                    >
                      {item.issue.fields.issuetype.name}
                    </text>
                    <text
                      style={{ fg: Colors.PRIMARY }}
                      wrap={false}
                    >
                      {item.issue.fields.summary}
                    </text>
                  </box>
                );
              })}
            </box>

            {/* Separator */}
            <text style={{ fg: Colors.NEUTRAL }} wrap={false}>
              ─────────────────────────────────────
            </text>

            {/* Details of selected Jira issue */}
            {selectedListItem && <JiraIssueInfo issue={selectedListItem.issue} />}
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