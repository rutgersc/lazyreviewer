import { useState, useMemo, useEffect } from "react";
import { useKeyboard } from "@opentui/react";
import { TextAttributes, type ParsedKey } from "@opentui/core";
import { type MergeRequest, type JiraIssue, type GitlabMergeRequest, type PipelineStage, type PipelineJob } from "../schemas/mergeRequestSchema";
import { formatCompactTime } from "../utils/formatting";
import { copyToClipboard } from "../system/clipboard-effect";
import { openUrl } from "../system/url-effect";
import { getJobStatusDisplay } from "../gitlab/jobStatus";
import { ActivePane } from "../userselection/userSelection";
import { useAutoScroll } from "../hooks/useAutoScroll";
import { Colors } from "../colors";
import { useRepositoryBranches } from "../hooks/useRepositoryBranches";
import { loadSettings } from "../settings/settings";
import MrStateTabs from "./MrStateTabs";
import type { MergeRequestState } from "../generated/gitlab-sdk";
import { filterPipelineJobs } from "../gitlab/pipelineJobFiltering";
import { useAtom, useAtomSet, useAtomValue } from "@effect-atom/atom-react";
import { Result } from "@effect-atom/atom-react";
import { filterMrStateAtom, selectedMrIndexAtom, mergeRequestsAtom, unwrappedMergeRequestsAtom, refreshMergeRequestsAtom, activePaneAtom, activeModalAtom, currentUserAtom, ignoredMergeRequestsAtom, seenMergeRequestsAtom, toggleIgnoreMergeRequestAtom, toggleSeenMergeRequestAtom, branchDifferencesAtom, refetchSelectedMrPipelineAtom } from "../store/appAtoms";

const getJiraStatusColor = (statusName: string | undefined): string => {
  if (!statusName) return Colors.PRIMARY;

  const status = statusName.toLowerCase();

  if (status.includes('merge requested') || status.includes('ready for merge')) {
    return Colors.SUCCESS;
  }

  if (status.includes('test in progress') || status.includes('testing')) {
    return Colors.WARNING;
  }

  if (status.includes('in code review')) {
    return Colors.INFO;
  }

  return Colors.PRIMARY;
};

const TimeColumnAuthorTitle = ({
  mr,
  isMyMr
}: {
  mr: MergeRequest;
  isMyMr: boolean;
}) => (
  <box style={{ flexDirection: "row", alignItems: "center", gap: 1 }}>
    <box style={{ width: 3 }}>
      <text
        style={{ fg: Colors.SECONDARY, attributes: TextAttributes.DIM }}
        wrapMode='none'
      >
        {formatCompactTime(mr.updatedAt)}
      </text>
    </box>

    <box style={{ width: 15 }}>
      <text style={{ fg: isMyMr ? '#f1fa8c' : Colors.NEUTRAL }} wrapMode='none'>
        {mr.author}
      </text>
    </box>

    <box style={{ flexGrow: 1 }}>
      <text
        style={{ fg: Colors.PRIMARY, attributes: TextAttributes.BOLD }}
        wrapMode='none'
      >
        {mr.title.length > 100 ? mr.title.substring(0, 100) + "..." : mr.title}
      </text>
    </box>
  </box>
);

const PipelineStagesWithJobStatuses = ({ mr }: { mr: MergeRequest }) => {
  const settings = loadSettings();
  const filteredData = filterPipelineJobs(
    mr.pipeline?.stage || [],
    mr.project.fullPath,
    settings.pipelineJobImportance
  );

  const PipelineJobComponent = (props: { job: PipelineJob; key?: string | number }) => {
    const statusDisplay = getJobStatusDisplay(props.job.status);
    return (
      <text
        style={{
          fg: statusDisplay.color,
          attributes: TextAttributes.DIM,
        }}
        wrapMode='none'
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

  const pipelineTextColor = filteredData.highPriorityStatus === 'failed'
    ? Colors.ERROR
    : Colors.NEUTRAL;

  return (
    <box style={{ flexDirection: "row", alignItems: "center", gap: 1 }}>
      <text style={{ fg: pipelineTextColor }} wrapMode='none'>
        pipeline:
      </text>
      <box style={{ flexDirection: "row", alignItems: "center", gap: 0 }}>
        {filteredData.stages.length > 0 ? (
          filteredData.stages.map((stage: PipelineStage, stageIndex: number) => (
            <PipelineStageComponent key={stageIndex} stage={stage} />
          ))
        ) : (
          <text
            style={{
              fg: Colors.NEUTRAL,
              attributes: TextAttributes.DIM,
            }}
            wrapMode='none'
          >
            ○
          </text>
        )}
      </box>
    </box>
  );
};

const ProjectStatusInfo = ({ mr, isActiveInLocalRepo, createdAt, repoColor, branchDifferenceMap }: { mr: MergeRequest; isActiveInLocalRepo: boolean; createdAt: Date; repoColor?: string; branchDifferenceMap: Map<string, { behind: number; ahead: number }> }) => {
  const currentUser = useAtomValue(currentUserAtom);
  const seenMergeRequestsResult = useAtomValue(seenMergeRequestsAtom);
  const seenMergeRequests: Set<string> = Result.match(seenMergeRequestsResult, {
    onInitial: () => new Set<string>(),
    onSuccess: (success) => success.value as Set<string>,
    onFailure: () => new Set<string>()
  });
  const isApprovedByMe = mr.approvedBy.some(approver => approver.username === currentUser);
  const isMyMr = mr.author === currentUser;
  const isSeen = seenMergeRequests.has(mr.id);
  const projectColor = repoColor || Colors.SUCCESS;
  const branchDifference = branchDifferenceMap.get(mr.id);

  return (
    <box style={{ flexDirection: "row", alignItems: "center", gap: 1 }}>
      <box style={{ width: 3 }}>
        <text
          style={{ fg: Colors.PRIMARY, attributes: TextAttributes.DIM }}
          wrapMode='none'
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
          wrapMode='none'
        >
         {mr.project.name}
        </text>
      </box>

      <box style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
        <box>
          <text
            style={{
              fg: isSeen
                ? Colors.ERROR
                : mr.approvedBy.length > 0 ? Colors.SUCCESS : Colors.PRIMARY,
              attributes: (isApprovedByMe || isMyMr || isSeen)
                ? TextAttributes.BOLD
                : mr.approvedBy.length > 0
                ? undefined
                : TextAttributes.DIM
            }}
            wrapMode='none'
          >
            {isSeen
              ? `❓ ${mr.approvedBy.length}`
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
          wrapMode='none'
        >
          {`💬 ${mr.resolvedDiscussions}/${mr.resolvableDiscussions}`}
        </text>
      </box>

      <box style={{ flexDirection: "row", alignItems: "center", gap: 1 }}>
        <text
          style={{
            fg: mr.jiraIssues.length > 0
              ? getJiraStatusColor(mr.jiraIssues[0]?.fields.status.name)
              : Colors.PRIMARY,
            attributes:
              mr.jiraIssues.length > 0
                ? (getJiraStatusColor(mr.jiraIssues[0]?.fields.status.name) === Colors.PRIMARY ? TextAttributes.DIM : undefined)
                : TextAttributes.DIM,
          }}
          wrapMode='none'
        >
          {mr.jiraIssues.length > 0
            ? mr.jiraIssues[0]?.fields.status.name
            : "<no jira ticket>"}
        </text>
        {(() => {
          if (mr.jiraIssues.length === 0) return null;

          const statusName = mr.jiraIssues[0]?.fields.status.name;
          const statusLower = statusName?.toLowerCase() || '';
          const isMergeRequested = statusLower.includes('merge requested') || statusLower.includes('ready for merge');
          const isBehind = branchDifference && branchDifference.behind > 0;

          if (isMergeRequested && isBehind) {
            return (
              <text
                style={{
                  fg: Colors.ERROR,
                  attributes: TextAttributes.BOLD,
                }}
                wrapMode='none'
              >
                (BEHIND)
              </text>
            );
          }

          return null;
        })()}
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
          wrapMode='none'
        >
          {mr.targetbranch}
        </text>
        <text
          style={{ fg: Colors.PRIMARY, attributes: TextAttributes.DIM }}
          wrapMode='none'
        >
          ←
        </text>
        <text
          style={{ fg: Colors.PRIMARY, attributes: TextAttributes.DIM }}
          wrapMode='none'
        >
          {mr.sourcebranch}
        </text>
        {difference && (
          <text
            style={{
              fg: difference.behind > 0 ? Colors.WARNING : Colors.SUCCESS,
              attributes: TextAttributes.DIM
            }}
            wrapMode='none'
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
  repoColor,
  isMyMr
}: {
  mr: MergeRequest;
  isActiveInLocalRepo: boolean;
  repoColor?: string;
  isMyMr: boolean;
}) => {
  const projectColor = repoColor || Colors.SUCCESS;

  return (
    <>
      <box style={{ flexDirection: "row", alignItems: "center", gap: 1 }}>
        <box style={{ width: 3 }}>
          <text
            style={{ fg: Colors.SECONDARY, attributes: TextAttributes.DIM }}
            wrapMode='none'
          >
            {formatCompactTime(mr.updatedAt)}
          </text>
        </box>

        <box style={{ width: 15 }}>
          <text style={{ fg: isMyMr ? '#f1fa8c' : Colors.NEUTRAL, attributes: TextAttributes.DIM }} wrapMode='none'>
            {mr.author}
          </text>
        </box>

        <box style={{ flexGrow: 1 }}>
          <text
            style={{ fg: Colors.PRIMARY, attributes: TextAttributes.DIM }}
            wrapMode='none'
          >
            {mr.title.length > 100 ? mr.title.substring(0, 100) + "..." : mr.title}
          </text>
        </box>
      </box>

      <box style={{ flexDirection: "row", alignItems: "center", gap: 1 }}>
        <box style={{ width: 3 }}>
          <text
            style={{ fg: Colors.PRIMARY, attributes: TextAttributes.DIM }}
            wrapMode='none'
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
            wrapMode='none'
          >
            {mr.project.name}
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
        wrapMode='none'
      >
        {notification}
      </text>
    </box>
  ) : null;

export type { MergeRequest } from "../schemas/mergeRequestSchema"

const Spinner = () => {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % frames.length);
    }, 80);
    return () => clearInterval(interval);
  }, []);

  return (
    <text style={{ fg: Colors.INFO, attributes: TextAttributes.BOLD }}>
      {frames[frameIndex]}
    </text>
  );
};

export default function MergeRequestPane({}: {}) {
  const [getSelectedMRIndex, setSelectedMRIndex] = useAtom(selectedMrIndexAtom);
  const setSelectedMergeRequest = setSelectedMRIndex;
  const selectedIndex = getSelectedMRIndex;

  const mergeRequests = useAtomValue(unwrappedMergeRequestsAtom);
  const refreshResult = useAtomValue(refreshMergeRequestsAtom);
  const isRefreshing = Result.isWaiting(refreshResult);

  const [activePane, setActivePane] = useAtom(activePaneAtom);
  const [activeModal, setActiveModal] = useAtom(activeModalAtom);
  const [filterMrState, setfilterMrState] = useAtom(filterMrStateAtom);
  const currentUser = useAtomValue(currentUserAtom);

  const toggleIgnoreMergeRequest = useAtomSet(toggleIgnoreMergeRequestAtom);
  const toggleSeenMergeRequest = useAtomSet(toggleSeenMergeRequestAtom);
  const ignoredMergeRequestsResult = useAtomValue(ignoredMergeRequestsAtom);
  const ignoredMergeRequests: Set<string> = Result.match(ignoredMergeRequestsResult, {
    onInitial: () => new Set<string>(),
    onSuccess: (success) => success.value as Set<string>,
    onFailure: () => new Set<string>()
  });
  const refetchSelectedMrPipeline = useAtomSet(refetchSelectedMrPipelineAtom);

  const isActive = activePane === ActivePane.MergeRequests;
  const [copyNotification, setCopyNotification] = useState<string | null>(null);
  const { scrollBoxRef, scrollToItem } = useAutoScroll({
    itemHeight: 2,
    lookahead: 2,
  });

  const repositoryBranches = useRepositoryBranches(mergeRequests);
  const branchDifferences = useAtomValue(branchDifferencesAtom);
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
    if (activeModal !== 'none') {
      return;
    }

    switch (key.name) {
      case 'return':
        setActivePane(ActivePane.InfoPane);
        break;
      case 'f':
        setActiveModal('mrFilter');
        break;
      case 'h':
      case 'left': {
        break;
      }
      case 'l':
      case 'right': {
        break;
      }
      case '1':
        setfilterMrState('opened');
        break;
      case '2':
        setfilterMrState('merged');
        break;
      case '3':
        setfilterMrState('closed');
        break;
      case '4':
        setfilterMrState('locked');
        break;
      case '5':
        setfilterMrState('all');
        break;
      case "j":
      case "down":
        if (mergeRequests.length > 0) {
          const newIndex = selectedIndex < mergeRequests.length - 1 ? selectedIndex + 1 : 0;
          setSelectedMergeRequest(newIndex);
          setSelectedMRIndex(newIndex);
          scrollToItem(newIndex);
        }
        break;
      case "k":
      case "up":
        if (mergeRequests.length > 0) {
          const newIndex = selectedIndex > 0 ? selectedIndex - 1 : mergeRequests.length - 1;
          setSelectedMergeRequest(newIndex);
          setSelectedMRIndex(newIndex);
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
        setActiveModal('gitSwitch');
        break;
      case 't':
        setActiveModal('jira');
        break;
      case 'r':
        setActiveModal('retarget');
        break;
      case 'backspace':
        if (mergeRequests[selectedIndex]) {
          toggleIgnoreMergeRequest(mergeRequests[selectedIndex].id);
        }
        break;
      case 'p':
        if (mergeRequests[selectedIndex]) {
          refetchSelectedMrPipeline();
          setCopyNotification('Pipeline refreshed!');
          setTimeout(() => setCopyNotification(null), 2000);
        }
        break;
      case 'a':
        if (mergeRequests[selectedIndex]) {
          toggleSeenMergeRequest(mergeRequests[selectedIndex].id);
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

  const sharedTicketDisplay = selectedMrSharedTicket ? (
    <box
      style={{
        backgroundColor: Colors.INFO,
        flexDirection: "row",
        gap: 1,
        alignItems: "center"
      }}
    >
      <text style={{ fg: Colors.BACKGROUND, attributes: TextAttributes.BOLD }} wrapMode='none'>
        🔗 {selectedMrSharedTicket.key}:
      </text>
      <text style={{ fg: Colors.BACKGROUND }} wrapMode='none'>
        {selectedMrSharedTicket.summary}
      </text>
    </box>
  ) : (
    <text wrapMode='none'>{""}</text>
  );

  return (
    <box style={{ flexDirection: "column", padding: 1, height: "100%" }}>
      <MrStateTabs
        currentState={filterMrState}
        onStateChange={(newState: MergeRequestState) => {
          setfilterMrState(newState);
        }}
        isActive={isActive}
      />

      {isRefreshing && (
        <box style={{ flexDirection: "row", alignItems: "center", gap: 1 }}>
          <Spinner />
          <text style={{ fg: Colors.INFO }}>
            Refreshing merge requests...
          </text>
        </box>
      )}

      {/* <box style={{ flexDirection: "row", alignItems: "center", gap: 0, marginBottom: 0 }}>
        {sharedTicketDisplay}
      </box> */}

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
          const isMyMr = mr.author === currentUser;

          return (
            <box
              key={mr.id}
              style={{
                flexDirection: "column",
                backgroundColor: highlightInfo.backgroundColor,
              }}
            >
              {isIgnored ? (
                <IgnoredMergeRequestRow mr={mr} isActiveInLocalRepo={isActiveInLocalRepo} repoColor={repoColor} isMyMr={isMyMr} />
              ) : (
                <>
                  <TimeColumnAuthorTitle mr={mr} isMyMr={isMyMr} />
                  <ProjectStatusInfo mr={mr} isActiveInLocalRepo={isActiveInLocalRepo} createdAt={mr.createdAt} repoColor={repoColor} branchDifferenceMap={branchDifferences} />
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
                wrapMode='none'
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