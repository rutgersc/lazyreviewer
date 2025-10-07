import { useState, useMemo } from "react";
import { useKeyboard } from "@opentui/react";
import { TextAttributes, type ParsedKey } from "@opentui/core";
import { type JiraIssue } from "../services/jiraService";
import { type GitlabMergeRequest, type PipelineStage, type PipelineJob } from "../gitlabgraphql";
import { formatCompactTime } from "../formatting";
import { copyToClipboard } from "../utils/clipboard";
import { openUrl } from "../utils/url";
import { getJobStatusDisplay } from "../utils/jobStatus";
import { useAppStore } from "../store/appStore";
import { ActivePane } from "../types/userSelection";
import { useAutoScroll } from "../hooks/useAutoScroll";
import { Colors } from "../constants/colors";
import { useRepositoryBranches } from "../hooks/useRepositoryBranches";
import { loadSettings } from "../utils/settings";

const TimeColumnAuthorTitle = ({
  mr
}: {
  mr: MergeRequest;
}) => (
  <box style={{ flexDirection: "row", alignItems: "center", gap: 1 }}>
    <box style={{ width: 3 }}>
      <text
        style={{ fg: Colors.SECONDARY, attributes: TextAttributes.DIM }}
        wrap={false}
      >
        {formatCompactTime(mr.updatedAt)}
      </text>
    </box>

    <box style={{ width: 15 }}>
      <text style={{ fg: Colors.NEUTRAL }} wrap={false}>
        {mr.author}
      </text>
    </box>

    <box style={{ flexGrow: 1 }}>
      <text
        style={{ fg: Colors.PRIMARY, attributes: TextAttributes.BOLD }}
        wrap={false}
      >
        {mr.title.length > 100 ? mr.title.substring(0, 100) + "..." : mr.title}
      </text>
    </box>
  </box>
);

const PipelineStagesWithJobStatuses = ({ mr }: { mr: MergeRequest }) => {
  const PipelineJobComponent = (props: { job: PipelineJob; key?: string | number }) => {
    const statusDisplay = getJobStatusDisplay(props.job.status);
    return (
      <text
        style={{
          fg: statusDisplay.color,
          attributes: TextAttributes.DIM,
        }}
        wrap={false}
      >
        {statusDisplay.symbol}
      </text>
    );
  };

  const PipelineStageComponent = (props: { stage: PipelineStage; key?: string | number }) => (
    <box
      style={{ flexDirection: "row", alignItems: "center", gap: 0 }}
    >
      {props.stage.jobs.map((job: PipelineJob, jobIndex: number) => (
        <PipelineJobComponent key={jobIndex} job={job} />
      ))}
    </box>
  );

  return (
    <box style={{ flexDirection: "row", alignItems: "center", gap: 0 }}>
      {mr.pipeline && mr.pipeline.stage && mr.pipeline.stage.length > 0 ? (
        mr.pipeline.stage.map((stage: PipelineStage, stageIndex: number) => (
          <PipelineStageComponent key={stageIndex} stage={stage} />
        ))
      ) : (
        <text
          style={{
            fg: Colors.NEUTRAL,
            attributes: TextAttributes.DIM,
          }}
          wrap={false}
        >
          ○
        </text>
      )}
    </box>
  );
};

const ProjectStatusInfo = ({ mr, isActiveInLocalRepo, createdAt, repoColor }: { mr: MergeRequest; isActiveInLocalRepo: boolean; createdAt: Date; repoColor?: string }) => {
  const currentUser = useAppStore((state) => state.currentUser);
  const isApprovedByMe = mr.approvedBy.some(approver => approver.username === currentUser);
  const isMyMr = mr.author === currentUser;
  const projectColor = repoColor || Colors.SUCCESS;

  return (
    <box style={{ flexDirection: "row", alignItems: "center", gap: 1 }}>
      <box style={{ width: 3 }}>
        <text
          style={{ fg: Colors.PRIMARY, attributes: TextAttributes.DIM }}
          wrap={false}
        >
          {formatCompactTime(createdAt)}
        </text>
      </box>

      <box style={{ width: 15, backgroundColor: isActiveInLocalRepo ? projectColor : "transparent" }}>
        <text
          style={{
            fg: isActiveInLocalRepo ? Colors.BACKGROUND : projectColor,
            attributes: TextAttributes.DIM
          }}
          wrap={false}
        >
          {mr.project.name}
        </text>
      </box>

      <box style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
        <box>
          <text
            style={{
              fg: mr.approvedBy.length > 0 ? Colors.SUCCESS : Colors.PRIMARY,
              attributes: (isApprovedByMe || isMyMr) ? TextAttributes.BOLD : TextAttributes.DIM
            }}
            wrap={false}
          >
            {isMyMr
              ? `🟢 ${mr.approvedBy.length}`
              : isApprovedByMe
              ? `✅ ${mr.approvedBy.length}`
              : `👍 ${mr.approvedBy.length}`}
          </text>
        </box>

      <box>
        <text
          style={{
            fg: mr.unresolvedDiscussions > 0
              ? Colors.ERROR
              : mr.resolvableDiscussions > 0
              ? Colors.SUCCESS
              : Colors.PRIMARY,
            attributes: mr.unresolvedDiscussions > 0 ? TextAttributes.BOLD : mr.resolvableDiscussions > 0 ? undefined : TextAttributes.DIM,
          }}
          wrap={false}
        >
          {`💬 ${mr.resolvedDiscussions}/${mr.resolvableDiscussions}`}
        </text>
      </box>

      <box>
        <text
          style={{
            fg:
              mr.jiraIssues.length > 0 &&
              mr.jiraIssues[0]?.fields.status.name === "Merge Requested"
                ? Colors.SUCCESS
                : Colors.WARNING,
            attributes:
              mr.jiraIssues.length > 0 ? undefined : TextAttributes.DIM,
          }}
          wrap={false}
        >
          {mr.jiraIssues.length > 0
            ? mr.jiraIssues[0]?.fields.status.name
            : "<no jira ticket>"}
        </text>
      </box>

      <PipelineStagesWithJobStatuses mr={mr} />
      </box>
    </box>
  );
};

const BranchInformation = ({ mr, branchDifferenceMap }: { mr: MergeRequest; branchDifferenceMap: Map<string, { behind: number; ahead: number }> }) => {
  const difference = branchDifferenceMap.get(mr.id);

  return (
    <box style={{ flexDirection: "row", alignItems: "center", gap: 1 }}>
      <box style={{ width: 19 }}></box>

      <box style={{ flexDirection: "row", alignItems: "center", gap: 1 }}>
        <text
          style={{ fg: Colors.PRIMARY, attributes: TextAttributes.DIM }}
          wrap={false}
        >
          {mr.targetbranch}
        </text>
        <text
          style={{ fg: Colors.PRIMARY, attributes: TextAttributes.DIM }}
          wrap={false}
        >
          ←
        </text>
        <text
          style={{ fg: Colors.PRIMARY, attributes: TextAttributes.DIM }}
          wrap={false}
        >
          {mr.sourcebranch}
        </text>
        {difference && (
          <text
            style={{
              fg: difference.behind > 0 ? Colors.WARNING : Colors.SUCCESS,
              attributes: TextAttributes.DIM
            }}
            wrap={false}
          >
            {difference.behind > 0 ? ` (-${difference.behind})` : ` (up to date)`}
          </text>
        )}
      </box>
    </box>
  );
};

const IgnoredMergeRequestRow = ({
  mr,
  isActiveInLocalRepo,
  repoColor
}: {
  mr: MergeRequest;
  isActiveInLocalRepo: boolean;
  repoColor?: string;
}) => {
  const projectColor = repoColor || Colors.SUCCESS;

  return (
    <>
      <box style={{ flexDirection: "row", alignItems: "center", gap: 1 }}>
        <box style={{ width: 3 }}>
          <text
            style={{ fg: Colors.SECONDARY, attributes: TextAttributes.DIM }}
            wrap={false}
          >
            {formatCompactTime(mr.updatedAt)}
          </text>
        </box>

        <box style={{ width: 15 }}>
          <text style={{ fg: Colors.NEUTRAL, attributes: TextAttributes.DIM }} wrap={false}>
            {mr.author}
          </text>
        </box>

        <box style={{ flexGrow: 1 }}>
          <text
            style={{ fg: Colors.PRIMARY, attributes: TextAttributes.DIM }}
            wrap={false}
          >
            {mr.title.length > 100 ? mr.title.substring(0, 100) + "..." : mr.title}
          </text>
        </box>
      </box>

      <box style={{ flexDirection: "row", alignItems: "center", gap: 1 }}>
        <box style={{ width: 3 }}>
          <text
            style={{ fg: Colors.PRIMARY, attributes: TextAttributes.DIM }}
            wrap={false}
          >
            {formatCompactTime(mr.createdAt)}
          </text>
        </box>

        <box style={{ width: 15, backgroundColor: isActiveInLocalRepo ? projectColor : "transparent" }}>
          <text
            style={{
              fg: isActiveInLocalRepo ? Colors.BACKGROUND : projectColor,
              attributes: TextAttributes.DIM
            }}
            wrap={false}
          >
            {mr.project.name}
          </text>
        </box>
    </box>

    <box style={{ flexDirection: "row", alignItems: "center", gap: 1 }}>
      <box style={{ width: 19 }}></box>

      <box style={{ flexDirection: "row", alignItems: "center", gap: 1 }}>
        <text
          style={{ fg: Colors.PRIMARY, attributes: TextAttributes.DIM }}
          wrap={false}
        >
          {mr.targetbranch}
        </text>
        <text
          style={{ fg: Colors.PRIMARY, attributes: TextAttributes.DIM }}
          wrap={false}
        >
          ←
        </text>
        <text
          style={{ fg: Colors.PRIMARY, attributes: TextAttributes.DIM }}
          wrap={false}
        >
          {mr.sourcebranch}
        </text>
      </box>
    </box>
  </>
);
};

const CopyNotificationPopup = ({
  notification,
}: {
  notification: string | null;
}) =>
  notification ? (
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
        {notification}
      </text>
    </box>
  ) : null;

export type MergeRequest = GitlabMergeRequest & {
  jiraIssues: JiraIssue[];
};

export default function MergeRequestPane({}: {}) {
  const setSelectedMergeRequest = useAppStore(
    (state) => state.setSelectedMergeRequest
  );
  const selectedIndex = useAppStore((state) => state.selectedMergeRequest);
  const mergeRequests = useAppStore((state) => state.mergeRequests);

  const activePane = useAppStore((state) => state.activePane);
  const mrState = useAppStore((state) => state.mrState);
  const showFilterModal = useAppStore((state) => state.showMrFilterModal);
  const setShowFilterModal = useAppStore((state) => state.setShowMrFilterModal);
  const setShowGitSwitchModal = useAppStore((state) => state.setShowGitSwitchModal);
  const showHelpModal = useAppStore((state) => state.showHelpModal);
  const setShowHelpModal = useAppStore((state) => state.setShowHelpModal);
  const showJiraModal = useAppStore((state) => state.showJiraModal);
  const setShowJiraModal = useAppStore((state) => state.setShowJiraModal);
  const toggleIgnoreMergeRequest = useAppStore((state) => state.toggleIgnoreMergeRequest);
  const ignoredMergeRequests = useAppStore((state) => state.ignoredMergeRequests);
  const setActivePane = useAppStore((state) => state.setActivePane);

  const isActive = activePane === ActivePane.MergeRequests;
  const [copyNotification, setCopyNotification] = useState<string | null>(null);
  const { scrollBoxRef, scrollToItem } = useAutoScroll({
    itemHeight: 3,
    lookahead: 2,
  });

  const repositoryBranches = useRepositoryBranches(mergeRequests);
  const branchDifferences = useAppStore((state) => state.branchDifferences);
  const settings = loadSettings();

  // Create a map of project path to current branch
  const projectBranchMap = useMemo(() => {
    const map = new Map<string, string>();
    repositoryBranches.forEach(repo => {
      if (repo.currentBranch) {
        map.set(repo.projectPath, repo.currentBranch);
      }
    });
    return map;
  }, [repositoryBranches]);

  // Get the selected MR's Jira ticket info
  const selectedMrJiraInfo = useMemo(() => {
    const selectedMr = mergeRequests[selectedIndex];
    return {
      ticketKey: selectedMr?.jiraIssues[0]?.key || null,
      ticketSummary: selectedMr?.jiraIssues[0]?.fields.summary || null,
      parentKey: selectedMr?.jiraIssues[0]?.fields.parent?.key || null,
      parentSummary: selectedMr?.jiraIssues[0]?.fields.parent?.fields.summary || null
    };
  }, [mergeRequests, selectedIndex]);

  // Function to determine background color and shared ticket info for an MR item
  const getMrHighlightInfo = (mr: MergeRequest, index: number): { backgroundColor: string; sharedTicket: { key: string; summary: string } | null } => {
    // Current selection gets priority
    if (index === selectedIndex) {
      return { backgroundColor: Colors.TRACK, sharedTicket: null };
    }

    const mrTicketKey = mr.jiraIssues[0]?.key;
    const mrParentKey = mr.jiraIssues[0]?.fields.parent?.key;

    // Highlight if same Jira ticket
    if (selectedMrJiraInfo.ticketKey && mrTicketKey === selectedMrJiraInfo.ticketKey) {
      return {
        backgroundColor: Colors.SELECTED,
        sharedTicket: {
          key: selectedMrJiraInfo.ticketKey,
          summary: selectedMrJiraInfo.ticketSummary || ''
        }
      };
    }

    // Highlight if same parent ticket
    if (selectedMrJiraInfo.parentKey && mrParentKey === selectedMrJiraInfo.parentKey) {
      return {
        backgroundColor: Colors.SELECTED,
        sharedTicket: {
          key: selectedMrJiraInfo.parentKey,
          summary: selectedMrJiraInfo.parentSummary || ''
        }
      };
    }

    return { backgroundColor: "transparent", sharedTicket: null };
  };


  useKeyboard((key: ParsedKey) => {
    // Only handle keys when this pane is active
    if (!isActive) return;

    // Don't handle keys when modals are open (handled globally)
    if (showHelpModal || showJiraModal || showFilterModal) {
      return;
    }

    switch (key.name) {
      case 'return':
        setActivePane(ActivePane.InfoPane);
        break;
      case 'f':
        setShowFilterModal(true);
        break;
      case "j":
      case "down":
        if (mergeRequests.length > 0) {
          const newIndex = selectedIndex < mergeRequests.length - 1 ? selectedIndex + 1 : 0;
          setSelectedMergeRequest(newIndex);
          scrollToItem(newIndex);
        }
        break;
      case "k":
      case "up":
        if (mergeRequests.length > 0) {
          const newIndex = selectedIndex > 0 ? selectedIndex - 1 : mergeRequests.length - 1;
          setSelectedMergeRequest(newIndex);
          scrollToItem(newIndex);
        }
        break;
      case 'c':
        if (mergeRequests[selectedIndex]) {
          const sourceBranch = mergeRequests[selectedIndex].sourcebranch;
          copyToClipboard(sourceBranch).then((success) => {
            if (success) {
              setCopyNotification(`Copied: ${sourceBranch}`);
              setTimeout(() => setCopyNotification(null), 2000);
            } else {
              setCopyNotification('Copy failed!');
              setTimeout(() => setCopyNotification(null), 2000);
            }
          });
        }
        break;
      case 'x':
        if (mergeRequests[selectedIndex]) {
          openUrl(mergeRequests[selectedIndex].webUrl);
        }
        break;
      case 'g':
        setShowGitSwitchModal(true);
        break;
      case 't':
        setShowJiraModal(true);
        break;
      case 'backspace':
        // Toggle ignore when no modals are open
        if (mergeRequests[selectedIndex]) {
          toggleIgnoreMergeRequest(mergeRequests[selectedIndex].id);
        }
        break;
    }
  });

  // Get shared ticket info for the selected MR
  const selectedMrSharedTicket = useMemo(() => {
    const selectedMr = mergeRequests[selectedIndex];
    if (!selectedMr?.jiraIssues?.[0]) return null;

    const selectedTicketKey = selectedMr.jiraIssues[0].key;
    const selectedTicketSummary = selectedMr.jiraIssues[0].fields.summary;
    const selectedParentKey = selectedMr.jiraIssues[0].fields.parent?.key;
    const selectedParentSummary = selectedMr.jiraIssues[0].fields.parent?.fields.summary;

    // Find if any other MR shares the same ticket or parent
    for (let i = 0; i < mergeRequests.length; i++) {
      if (i === selectedIndex) continue;

      const mr = mergeRequests[i];
      if (!mr) continue;

      const mrTicketKey = mr.jiraIssues?.[0]?.key;
      const mrParentKey = mr.jiraIssues?.[0]?.fields.parent?.key;

      // Check if they share the same direct ticket
      if (selectedTicketKey && mrTicketKey === selectedTicketKey) {
        return { key: selectedTicketKey, summary: selectedTicketSummary };
      }

      // Check if they share the same parent ticket
      if (selectedParentKey && mrParentKey === selectedParentKey) {
        return { key: selectedParentKey, summary: selectedParentSummary || '' };
      }
    }

    return null;
  }, [mergeRequests, selectedIndex]);

  return (
    <box style={{ flexDirection: "column", height: "100%" }}>
      <box style={{ flexDirection: "row", alignItems: "center", gap: 2, marginBottom: 1 }}>
        <text
          style={{
            fg: Colors.PRIMARY,
            attributes: TextAttributes.BOLD,
          }}
          wrap={false}
        >
          {`Merge Requests - ${
            mrState.charAt(0).toUpperCase() + mrState.slice(1)
          } (${mergeRequests.length})`}
        </text>

        {selectedMrSharedTicket && (
          <box
            style={{
              backgroundColor: Colors.INFO,
              flexDirection: "row",
              gap: 1,
              alignItems: "center"
            }}
          >
            <text style={{ fg: Colors.BACKGROUND, attributes: TextAttributes.BOLD }} wrap={false}>
              🔗 {selectedMrSharedTicket.key}:
            </text>
            <text style={{ fg: Colors.BACKGROUND }} wrap={false}>
              {selectedMrSharedTicket.summary}
            </text>
          </box>
        )}
      </box>

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
        {mergeRequests.map((mr, index) => {
          const currentBranch = projectBranchMap.get(mr.project.fullPath);
          const isActiveInLocalRepo = currentBranch === mr.sourcebranch;
          const isIgnored = ignoredMergeRequests.has(mr.id);
          const highlightInfo = getMrHighlightInfo(mr, index);
          const repoColor = settings.repositoryColors[mr.project.fullPath];

          return (
            <box
              key={mr.id}
              style={{
                flexDirection: "column",
                backgroundColor: highlightInfo.backgroundColor,
              }}
            >
              {isIgnored ? (
                <IgnoredMergeRequestRow mr={mr} isActiveInLocalRepo={isActiveInLocalRepo} repoColor={repoColor} />
              ) : (
                <>
                  <TimeColumnAuthorTitle mr={mr} />
                  <ProjectStatusInfo mr={mr} isActiveInLocalRepo={isActiveInLocalRepo} createdAt={mr.createdAt} repoColor={repoColor} />
                  <BranchInformation mr={mr} branchDifferenceMap={branchDifferences} />
                </>
              )}
            </box>
          );
        })}
      </scrollbox>

      {repositoryBranches.length > 0 && (
        <box
          style={{
            flexDirection: "column",
            marginTop: 1,
          }}
        >
          {repositoryBranches.map((repo) => (
            <box key={repo.projectPath}>
              <text
                style={{
                  fg: repo.localPath ? (repo.currentBranch ? Colors.INFO : Colors.NEUTRAL) : Colors.WARNING,
                  attributes: TextAttributes.DIM,
                }}
                wrap={false}
              >
                {repo.projectName}:{repo.localPath ? (repo.currentBranch || "?") : "<no path set> (press ctrl+s to configure)"}
              </text>
            </box>
          ))}
        </box>
      )}

      <CopyNotificationPopup
        notification={copyNotification} />
    </box>
  );
}