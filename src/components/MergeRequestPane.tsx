import { useState, useMemo, useEffect } from "react";
import { TextAttributes } from "@opentui/core";
import { type MergeRequest } from "../mergerequests/mergerequest-schema";
import { type PipelineStage, type PipelineJob } from "../domain/merge-request-schema";
import { formatCompactTime, getAgeColor } from "../utils/formatting";
import { openUrl } from "../system/open-url";
import { getJobStatusDisplay } from "../domain/display/jobStatus";
import { ActivePane } from "../userselection/userSelection";
import { useAutoScroll } from "../hooks/useAutoScroll";
import { useDoubleClick } from "../hooks/useDoubleClick";
import { Colors } from "../colors";
import { mapStatus } from "../jiraboard/board-utils";
import { useRepositoryBranches } from "../mergerequests/hooks/useRepositoryBranches";
import { type JobImportance } from "../settings/settings";
import MrStateTabs from "./MrStateTabs";
import type { MergeRequestState } from "../domain/merge-request-state";
import { filterPipelineJobs } from "../domain/display/pipelineJobFiltering";
import { Atom, useAtom, useAtomSet, useAtomValue } from "@effect-atom/atom-react";
import { Result } from "@effect-atom/atom-react";
import { filterMrStateAtom, selectedMrIndexAtom, branchDifferencesAtom, refetchSelectedMrPipelineAtom, unwrappedLastRefreshTimestampAtom, isMergeRequestsLoadingAtom, unwrappedMergeRequestsAtom, refreshMergeRequestsAtom, allJiraIssuesAtom, allMrsAtom } from "../mergerequests/mergerequests-atom";
import { activePaneAtom, activeModalAtom, nowAtom } from "../ui/navigation-atom";
import { currentUserAtom } from "../settings/settings-atom";
import type { JiraIssue } from "../jira/jira-schema";
import { ignoredMergeRequestsAtom, seenMergeRequestsAtom, toggleIgnoreMergeRequestAtom, toggleSeenMergeRequestAtom, monitoredMergeRequestsAtom, repositoryColorsAtom, pipelineJobImportanceAtom } from "../settings/settings-atom";

export const scrollToItemRequestAtom = Atom.make<number | null>(null);
export const copyNotificationRequestAtom = Atom.make<string | null>(null);

const getJiraStatusColor = (statusName: string | undefined, mrState: string): string => {
  if (!statusName) return Colors.PRIMARY;
  const s = statusName.toLowerCase();
  if (s.includes('merged') && mrState !== 'merged') return Colors.ERROR;
  return mapStatus(statusName).color;
};

const getMergeBlockedLabel = (status: string | null): string | null => {
  switch (status) {
    case 'NEED_REBASE': return 'needs rebase';
    case 'CONFLICT': return 'conflicts';
    case 'BLOCKED_STATUS': return 'blocked';
    case 'DRAFT_STATUS': return 'draft';
    case 'MERGE_TIME': return 'scheduled';
    case 'EXTERNAL_STATUS_CHECKS': return 'ext checks';
    case 'LOCKED_PATHS': return 'locked';
    case 'LOCKED_LFS_FILES': return 'lfs locked';
    case 'JIRA_ASSOCIATION': return 'jira required';
    case 'TITLE_NOT_MATCHING': return 'title mismatch';
    case 'SECURITY_POLICIES_VIOLATIONS': return 'security';
    case 'COMMITS_STATUS': return 'commits';
    default: return null;
  }
};


const extractElabKeys = (title: string): readonly string[] =>
  [...title.matchAll(/ELAB-\d+/g)].map(match => match[0]);

const TimeColumnAuthorTitle = ({
  mr,
  isMyMr,
  relationType,
  now
}: {
  mr: MergeRequest;
  isMyMr: boolean;
  relationType: 'ticket' | 'sibling' | null;
  now: Date;
}) => (
  <box style={{ flexDirection: "row", alignItems: "center", gap: 1 }}>
    <box style={{ width: 3 }}>
      <text
        style={{ fg: Colors.SECONDARY, attributes: TextAttributes.DIM }}
        wrapMode='none'
      >
        {formatCompactTime(mr.updatedAt, now)}
      </text>
    </box>

    <box style={{ width: 15 }}>
      <text style={{ fg: isMyMr ? '#f1fa8c' : Colors.NEUTRAL }} wrapMode='none'>
        {mr.author}
      </text>
    </box>

    <box style={{ flexGrow: 1, flexDirection: "row", gap: 1 }}>
      {relationType && (
        <text
          style={{
            fg: Colors.BACKGROUND,
            attributes: TextAttributes.BOLD,
            bg: relationType === 'sibling' ? Colors.INFO : Colors.WARNING
          }}
          wrapMode='none'
        >
          {relationType === 'sibling' ? ' sibling ' : ' related '}
        </text>
      )}
      <text
        style={{ fg: Colors.PRIMARY, attributes: TextAttributes.BOLD }}
        wrapMode='none'
      >
        {mr.title.length > 100 ? mr.title.substring(0, 100) + "..." : mr.title}
      </text>
    </box>
  </box>
);

const PipelineStagesWithJobStatuses = ({ mr, pipelineJobImportance }: { mr: MergeRequest; pipelineJobImportance: Record<string, Record<string, JobImportance>> }) => {
  const filteredData = filterPipelineJobs(
    mr.pipeline?.stage || [],
    mr.project.fullPath,
    pipelineJobImportance
  );

  const PipelineJobComponent = (props: { job: PipelineJob; key?: string | number }) => {
    const statusDisplay = getJobStatusDisplay(props.job.status);
    return (
      <text
        style={{
          fg: statusDisplay.color,
          attributes: statusDisplay.attributes,
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

  return (
    <box style={{ flexDirection: "row", alignItems: "center", gap: 1 }}>
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

const ProjectStatusInfo = ({ mr, isActiveInLocalRepo, createdAt, repoColor, branchDifferenceMap, jiraIssuesMap, now, currentUser, seenMergeRequests, pipelineJobImportance }: { mr: MergeRequest; isActiveInLocalRepo: boolean; createdAt: Date; repoColor?: string; branchDifferenceMap: Map<string, { behind: number; ahead: number }>; jiraIssuesMap: ReadonlyMap<string, JiraIssue>; now: Date; currentUser: string; seenMergeRequests: Set<string>; pipelineJobImportance: Record<string, Record<string, JobImportance>> }) => {
  const isSeen = seenMergeRequests.has(mr.id);
  const isApprovedByMe = mr.approvedBy.some(approver => approver.username === currentUser);
  const isMyMr = mr.author === currentUser;
  const projectColor = repoColor || Colors.SUCCESS;
  const branchDifference = branchDifferenceMap.get(mr.id);

  const jiraIssues = mr.jiraIssueKeys.flatMap(key => {
    const issue = jiraIssuesMap.get(key);
    return issue ? [issue] : [];
  });

  return (
    <box style={{ flexDirection: "row", alignItems: "center", gap: 1 }}>
      <box style={{ width: 3 }}>
        <text
          style={{ fg: getAgeColor(createdAt), attributes: TextAttributes.DIM }}
          wrapMode='none'
        >
          {formatCompactTime(createdAt, now)}
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
              ? `? ${mr.approvedBy.length}`
              : isApprovedByMe
              ? `☒ ${mr.approvedBy.length}`
              : `☐ ${mr.approvedBy.length}`}
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
            fg: jiraIssues.length > 0
              ? getJiraStatusColor(jiraIssues[0]?.fields.status.name, mr.state)
              : Colors.ERROR,
            attributes:
              jiraIssues.length > 0
                ? (getJiraStatusColor(jiraIssues[0]?.fields.status.name, mr.state) === Colors.PRIMARY ? TextAttributes.DIM : undefined)
                : undefined,
          }}
          wrapMode='none'
        >
          {jiraIssues.length > 0
            ? jiraIssues[0]?.fields.status.name
            : "<no jira ticket>"}
        </text>
        {(() => {
          if (jiraIssues.length === 0) return null;

          const statusName = jiraIssues[0]?.fields.status.name;
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

      <PipelineStagesWithJobStatuses mr={mr} pipelineJobImportance={pipelineJobImportance} />

      {(() => {
        const blockedLabel = getMergeBlockedLabel(mr.detailedMergeStatus);
        if (!blockedLabel) return null;
        return (
          <text
            style={{
              fg: Colors.ERROR,
              attributes: TextAttributes.BOLD,
            }}
            wrapMode='none'
          >
            [{blockedLabel}]
          </text>
        );
      })()}
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
  isMyMr,
  now
}: {
  mr: MergeRequest;
  isActiveInLocalRepo: boolean;
  repoColor?: string;
  isMyMr: boolean;
  now: Date;
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
            {formatCompactTime(mr.updatedAt, now)}
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
            style={{ fg: getAgeColor(mr.createdAt), attributes: TextAttributes.DIM }}
            wrapMode='none'
          >
            {formatCompactTime(mr.createdAt, now)}
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

export type { MergeRequest } from "../mergerequests/mergerequest-schema"

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

export default function MergeRequestPane() {
  const [selectedIndex, setSelectedMRIndex] = useAtom(selectedMrIndexAtom);

  const mergeRequests = useAtomValue(unwrappedMergeRequestsAtom);
  const isLoading = useAtomValue(isMergeRequestsLoadingAtom);
  const lastRefreshTimestamp = useAtomValue(unwrappedLastRefreshTimestampAtom);

  const [activePane, setActivePane] = useAtom(activePaneAtom);
  const isActive = activePane === ActivePane.MergeRequests;
  const [filterMrState, setfilterMrState] = useAtom(filterMrStateAtom);
  const currentUser = useAtomValue(currentUserAtom);

  const jiraIssuesMap = useAtomValue(allJiraIssuesAtom);

  const ignoredMergeRequests = useAtomValue(ignoredMergeRequestsAtom);
  const monitoredMergeRequests = useAtomValue(monitoredMergeRequestsAtom);
  const refreshMergeRequests = useAtomSet(refreshMergeRequestsAtom, { mode: 'promiseExit' });
  const now = useAtomValue(nowAtom);

  const [copyNotification, setCopyNotification] = useState<string | null>(null);

  const { scrollBoxRef, scrollToItem } = useAutoScroll({
    lookahead: 2,
  });

  const handleMrClick = useDoubleClick<number>({
      onSingleClick: (index) => {
          setSelectedMRIndex(index);
      },
      onDoubleClick: (index) => {
          if (mergeRequests[index]) {
              openUrl(mergeRequests[index].webUrl);
          }
      }
  });

  const repositoryBranches = useRepositoryBranches(mergeRequests);
  const branchDifferences = useAtomValue(branchDifferencesAtom);
  const repositoryColors = useAtomValue(repositoryColorsAtom);
  const seenMergeRequests = useAtomValue(seenMergeRequestsAtom);
  const pipelineJobImportanceMap = useAtomValue(pipelineJobImportanceAtom);
  const pipelineJobImportance = useMemo(() =>
    Object.fromEntries(
      [...pipelineJobImportanceMap].map(([project, jobs]) =>
        [project, Object.fromEntries([...jobs])]
      )
    ) as Record<string, Record<string, JobImportance>>,
    [pipelineJobImportanceMap]
  );

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

  // Compute related MR indices based on ELAB keys in title or shared Jira ticket/parent
  type RelationType = 'ticket' | 'sibling';
  const relatedMrIndices = useMemo((): Map<number, RelationType> => {
    const selectedMr = mergeRequests[selectedIndex];
    if (!selectedMr) return new Map();

    const selectedKeys = new Set(extractElabKeys(selectedMr.title));
    const selectedIssues = selectedMr.jiraIssueKeys.flatMap(k => {
      const issue = jiraIssuesMap.get(k);
      return issue ? [issue] : [];
    });
    const selectedTicketKey = selectedIssues[0]?.key;
    const selectedIsSubtask = selectedIssues[0]?.fields.issuetype.name.toLowerCase().includes('sub-task');
    const selectedParentKey = selectedIsSubtask ? selectedIssues[0]?.fields.parent?.key : undefined;

    if (selectedKeys.size === 0 && !selectedTicketKey && !selectedParentKey) return new Map();

    return new Map(
      mergeRequests
        .map((mr, index) => {
          if (index === selectedIndex) return null;

          // Check Jira relationships first (more specific)
          const mrIssues = mr.jiraIssueKeys.flatMap(k => {
            const issue = jiraIssuesMap.get(k);
            return issue ? [issue] : [];
          });
          const mrTicketKey = mrIssues[0]?.key;

          // Same direct ticket
          if (selectedTicketKey && mrTicketKey === selectedTicketKey) {
            return [index, 'ticket'] as const;
          }

          // Same parent (only if selected is a subtask)
          if (selectedParentKey) {
            const mrParentKey = mrIssues[0]?.fields.parent?.key;
            if (mrParentKey === selectedParentKey) {
              return [index, 'sibling'] as const;
            }
          }

          // Check ELAB keys in title
          if (extractElabKeys(mr.title).some(key => selectedKeys.has(key))) {
            return [index, 'ticket'] as const;
          }

          return null;
        })
        .filter((entry): entry is [number, RelationType] => entry !== null)
    );
  }, [mergeRequests, selectedIndex, jiraIssuesMap]);

  // Get the selected MR's Jira ticket info
  const selectedMrJiraInfo = useMemo(() => {
    const selectedMr = mergeRequests[selectedIndex];
    const issues = selectedMr?.jiraIssueKeys.flatMap(k => {
        const i = jiraIssuesMap.get(k);
        return i ? [i] : [];
    }) || [];
    const issue = issues[0];

    return {
      ticketKey: issue?.key || null,
      ticketSummary: issue?.fields.summary || null,
      parentKey: issue?.fields.parent?.key || null,
      parentSummary: issue?.fields.parent?.fields.summary || null
    };
  }, [mergeRequests, selectedIndex, jiraIssuesMap]);

  // Function to determine background color and shared ticket info for an MR item
  const getMrHighlightInfo = (mr: MergeRequest, index: number): { backgroundColor: string; sharedTicket: { key: string; summary: string } | null } => {
    // Current selection gets priority
    if (index === selectedIndex) {
      return { backgroundColor: Colors.TRACK, sharedTicket: null };
    }

    // No more related highlighting (see git history)
    return { backgroundColor: "transparent", sharedTicket: null };
  };


  const scrollRequest = useAtomValue(scrollToItemRequestAtom);
  const setScrollRequest = useAtomSet(scrollToItemRequestAtom);
  useEffect(() => {
    if (scrollRequest !== null) {
      scrollToItem(scrollRequest);
      setScrollRequest(null);
    }
  }, [scrollRequest, scrollToItem, setScrollRequest]);

  const [ notificationRequest ] = useAtom(copyNotificationRequestAtom);
  useEffect(() => {
    setCopyNotification(notificationRequest);
  }, [notificationRequest]);

  // Get shared ticket info for the selected MR
  const selectedMrSharedTicket = useMemo(() => {
    const selectedMr = mergeRequests[selectedIndex];
    const selectedIssues = selectedMr?.jiraIssueKeys.flatMap(k => {
        const i = jiraIssuesMap.get(k);
        return i ? [i] : [];
    }) || [];

    if (!selectedIssues[0]) return null;

    const selectedTicketKey = selectedIssues[0].key;
    const selectedTicketSummary = selectedIssues[0].fields.summary;
    const selectedParentKey = selectedIssues[0].fields.parent?.key;
    const selectedParentSummary = selectedIssues[0].fields.parent?.fields.summary;

    // Find if any other MR shares the same ticket or parent
    for (let i = 0; i < mergeRequests.length; i++) {
      if (i === selectedIndex) continue;

      const mr = mergeRequests[i];
      if (!mr) continue;

      const mrIssues = mr.jiraIssueKeys.flatMap(k => {
        const issue = jiraIssuesMap.get(k);
        return issue ? [issue] : [];
      });

      const mrTicketKey = mrIssues[0]?.key;
      const mrParentKey = mrIssues[0]?.fields.parent?.key;

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
  }, [mergeRequests, selectedIndex, jiraIssuesMap]);

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
    <box
      style={{ flexDirection: "column", padding: 1, height: "100%" }}
      onMouseDown={() => setActivePane(ActivePane.MergeRequests)}
    >
      <MrStateTabs
        currentState={filterMrState}
        onStateChange={(newState: MergeRequestState) => {
          setfilterMrState(newState);
        }}
        isActive={isActive}
      />

      <box style={{ marginTop: 1, marginBottom: 1, height: 1 }}>
        {isLoading ? (
          <box style={{ flexDirection: "row", alignItems: "center", gap: 1 }}>
            <Spinner />
            <text style={{ fg: Colors.INFO }}>
              Loading merge requests...
            </text>
          </box>
        ) : lastRefreshTimestamp ? (
          <box style={{ flexDirection: "row", alignItems: "center", gap: 1 }}>
            <text style={{ fg: Colors.SUPPORTING }} wrapMode="none">
              Last refreshed: {formatCompactTime(lastRefreshTimestamp, now)} ago
            </text>
            <text
               onMouseDown={() => refreshMergeRequests()}
               style={{
                fg: Colors.INFO
               }}
               wrapMode='none'
             >
                {" >> refresh <<"}
            </text>
          </box>
        ) : null}
      </box>

      {!isLoading && mergeRequests.length === 0 && (
        <box style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", flexGrow: 1, gap: 1 }}>
          <text style={{ fg: Colors.SUPPORTING }}>
            No merge requests found
          </text>
          <text style={{ fg: Colors.NEUTRAL }}>
            Try changing the filter or refresh to fetch new data
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
          const isMonitored = monitoredMergeRequests.has(mr.id);
          const highlightInfo = getMrHighlightInfo(mr, index);
          const repoColor = repositoryColors[mr.project.fullPath];
          const isMyMr = mr.author === currentUser;

          return (
            <box
              key={mr.id}
              onMouseDown={(e) => handleMrClick(index)}
              style={{
                flexDirection: "row",
                backgroundColor: highlightInfo.backgroundColor,
              }}
            >
              <box style={{
                width: 1,
                backgroundColor: isMonitored ? '#ff79c6' : 'transparent',
              }} />
              <box style={{ flexDirection: "column", flexGrow: 1 }}>
                {isIgnored ? (
                  <IgnoredMergeRequestRow mr={mr} isActiveInLocalRepo={isActiveInLocalRepo} repoColor={repoColor} isMyMr={isMyMr} now={now} />
                ) : (
                  <>
                    <TimeColumnAuthorTitle mr={mr} isMyMr={isMyMr} relationType={relatedMrIndices.get(index) ?? null} now={now} />
                    <ProjectStatusInfo mr={mr} isActiveInLocalRepo={isActiveInLocalRepo} createdAt={mr.createdAt} repoColor={repoColor} branchDifferenceMap={branchDifferences} jiraIssuesMap={jiraIssuesMap} now={now} currentUser={currentUser} seenMergeRequests={seenMergeRequests} pipelineJobImportance={pipelineJobImportance} />
                  </>
                )}
              </box>
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