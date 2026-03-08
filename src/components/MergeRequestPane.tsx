import { useState, useMemo, useEffect } from "react";
import { TextAttributes } from "@opentui/core";
import { type MergeRequest } from "../mergerequests/mergerequest-schema";
import { type PipelineStage, type PipelineJob } from "../domain/merge-request-schema";
import { formatCompactTime, getAgeColor } from "../utils/formatting";
import { openUrl } from "../system/open-url";
import { getJobStatusDisplay } from "../domain/display/jobStatus";
import { type UserId, isCurrentUser, mrProviderAuthor } from "../userselection/userSelection";
import { ActivePane } from '../userselection/ActivePane';
import { useAutoScroll } from "../hooks/useAutoScroll";
import { useDoubleClick } from "../hooks/useDoubleClick";
import { Colors } from "../colors";
import { mapStatus } from "../jiraboard/board-utils";
import { repositoryBranchesAtom, projectBranchMapAtom, type WorktreeMatch } from "../mergerequests/hooks/useRepositoryBranches";
import { type JobImportance } from "../settings/settings";
import MrStateTabs from "./MrStateTabs";
import UserFilterBar from "./UserFilterBar";
import RepoFilterBar from "./RepoFilterBar";
import SprintFilterBar from "./SprintFilterBar";
import type { MergeRequestState } from "../domain/merge-request-state";
import { filterPipelineJobs } from "../domain/display/pipelineJobFiltering";
import { Atom, useAtom, useAtomSet, useAtomValue } from "@effect-atom/atom-react";
import { Result } from "@effect-atom/atom-react";
import { filterMrStateAtom, selectedMrIndexAtom, branchDifferencesAtom, refetchSelectedMrPipelineAtom, unwrappedLastRefreshTimestampAtom, isMergeRequestsLoadingAtom, unwrappedMergeRequestsAtom, refreshMergeRequestsAtom, allJiraIssuesAtom, allMrsAtom, allMrSourceBranchesByProjectAtom, selectMrByBranchAtom } from "../mergerequests/mergerequests-atom";
import { activePaneAtom, activeModalAtom, nowAtom } from "../ui/navigation-atom";
import { currentUserIdAtom } from "../settings/settings-atom";
import type { JiraIssue } from "../jira/jira-schema";
import { ignoredMergeRequestsAtom, seenMergeRequestsAtom, toggleIgnoreMergeRequestAtom, toggleSeenMergeRequestAtom, monitoredMergeRequestsAtom, pipelineJobImportanceAtom, showBranchNamesAtom } from "../settings/settings-atom";

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



const truncate = (text: string, max: number) =>
  text.length > max ? text.substring(0, max) + "..." : text;

type RelationType =
  | { readonly _tag: 'stack-base' }
  | { readonly _tag: 'stacked-on-this' }
  | { readonly _tag: 'same-ticket' }
  | { readonly _tag: 'sibling-ticket' };

type SelectedMrContext = {
  readonly selectedMr: MergeRequest;
  readonly selectedKeys: ReadonlySet<string>;
  readonly selectedTicketKey: string | undefined;
  readonly selectedParentKey: string | undefined;
};

const buildSelectedMrContext = (selectedMr: MergeRequest, jiraIssuesMap: ReadonlyMap<string, JiraIssue>): SelectedMrContext => {
  const selectedKeys = new Set(selectedMr.jiraIssueKeys);
  const selectedIssues = selectedMr.jiraIssueKeys.flatMap(k => {
    const issue = jiraIssuesMap.get(k);
    return issue ? [issue] : [];
  });
  const selectedTicketKey = selectedIssues[0]?.key;
  const selectedIsSubtask = selectedIssues[0]?.fields.issuetype.name.toLowerCase().includes('sub-task');
  const selectedParentKey = selectedIsSubtask ? selectedIssues[0]?.fields.parent?.key : undefined;
  return { selectedMr, selectedKeys, selectedTicketKey, selectedParentKey };
};

const getRelationType = (ctx: SelectedMrContext, mr: MergeRequest, jiraIssuesMap: ReadonlyMap<string, JiraIssue>): RelationType | null => {
  const sameProject = ctx.selectedMr.project.fullPath === mr.project.fullPath;
  if (sameProject && ctx.selectedMr.targetbranch === mr.sourcebranch) return { _tag: 'stack-base' };
  if (sameProject && mr.targetbranch === ctx.selectedMr.sourcebranch) return { _tag: 'stacked-on-this' };

  const mrIssues = mr.jiraIssueKeys.flatMap(k => {
    const issue = jiraIssuesMap.get(k);
    return issue ? [issue] : [];
  });
  const mrTicketKey = mrIssues[0]?.key;

  if (ctx.selectedTicketKey && mrTicketKey === ctx.selectedTicketKey) return { _tag: 'same-ticket' };

  if (ctx.selectedParentKey) {
    const mrParentKey = mrIssues[0]?.fields.parent?.key;
    if (mrParentKey === ctx.selectedParentKey) return { _tag: 'sibling-ticket' };
  }

  if (mr.jiraIssueKeys.some(key => ctx.selectedKeys.has(key))) return { _tag: 'same-ticket' };

  return null;
};

const getRelationBadge = (tag: RelationType['_tag']): { readonly label: string; readonly badgeBg: string; readonly titleBg: string } => {
  switch (tag) {
    case 'stack-base':      return { label: ' base ',         badgeBg: Colors.SUCCESS, titleBg: Colors.BADGE_SUCCESS_BG };
    case 'stacked-on-this': return { label: ' stacked ',      badgeBg: Colors.ACCENT,  titleBg: Colors.BADGE_ACCENT_BG };
    case 'same-ticket':     return { label: ' same ticket ',  badgeBg: Colors.WARNING, titleBg: Colors.BADGE_WARNING_BG };
    case 'sibling-ticket':  return { label: ' same parent ',  badgeBg: Colors.INFO,    titleBg: Colors.BADGE_INFO_BG };
  }
};

const TimeColumnAuthorTitle = ({
  mr,
  isMyMr,
  relationType,
  now,
  showBranchNames
}: {
  mr: MergeRequest;
  isMyMr: boolean;
  relationType: RelationType | null;
  now: Date;
  showBranchNames: boolean;
}) => {
  const badge = relationType ? getRelationBadge(relationType._tag) : null;
  return (
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
        <text style={{ fg: isMyMr ? Colors.SECONDARY : Colors.NEUTRAL }} wrapMode='none'>
          {mr.author}
        </text>
      </box>

      <box style={{ flexGrow: 1, flexDirection: "row", gap: 1 }}>
        {badge && (
          <text
            style={{
              fg: Colors.BACKGROUND,
              attributes: TextAttributes.BOLD,
              bg: badge.badgeBg
            }}
            wrapMode='none'
          >
            {badge.label}
          </text>
        )}
        <text
          style={{
            fg: showBranchNames ? Colors.INFO : Colors.PRIMARY,
            attributes: TextAttributes.BOLD,
            ...(badge && { bg: badge.titleBg })
          }}
          wrapMode='none'
        >
          {truncate(showBranchNames ? mr.sourcebranch : mr.title, 100)}
        </text>
      </box>
    </box>
  );
};

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

const ProjectStatusInfo = ({ mr, isActiveInLocalRepo, worktreeMatch, createdAt, branchDifferenceMap, jiraIssuesMap, now, currentUser, seenMergeRequests, pipelineJobImportance }: { mr: MergeRequest; isActiveInLocalRepo: boolean; worktreeMatch: WorktreeMatch | null; createdAt: Date; branchDifferenceMap: Map<string, { behind: number; ahead: number }>; jiraIssuesMap: ReadonlyMap<string, JiraIssue>; now: Date; currentUser: UserId; seenMergeRequests: Set<string>; pipelineJobImportance: Record<string, Record<string, JobImportance>> }) => {
  const isSeen = seenMergeRequests.has(mr.id);
  const isApprovedByMe = mr.approvedBy.some(approver => isCurrentUser(currentUser, mrProviderAuthor(mr.provider, approver.username)));
  const isMyMr = isCurrentUser(currentUser, mrProviderAuthor(mr.provider, mr.author));
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

      <box style={{ width: 15, backgroundColor: isActiveInLocalRepo ? Colors.SUCCESS : "transparent", flexDirection: "row" }}>
        <text
          style={{
            fg: isActiveInLocalRepo ? Colors.BACKGROUND : Colors.SUCCESS,
            ...(!isActiveInLocalRepo && { attributes: TextAttributes.DIM })
          }}
          wrapMode='none'
        >
         {mr.project.name}
        </text>
        {worktreeMatch && (
          <text
            style={{
              fg: isActiveInLocalRepo ? Colors.BACKGROUND : Colors.INFO,
              attributes: TextAttributes.BOLD
            }}
            wrapMode='none'
          >
            {` [${worktreeMatch.index}]`}
          </text>
        )}
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
              : (isApprovedByMe || isMyMr)
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

const BranchInformation = ({ mr, branchDifferenceMap, worktreeMatch }: { mr: MergeRequest; branchDifferenceMap: Map<string, { behind: number; ahead: number }>; worktreeMatch: WorktreeMatch | null }) => {
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
        {worktreeMatch && (
          <text
            style={{ fg: Colors.INFO, attributes: TextAttributes.BOLD }}
            wrapMode='none'
          >
            {` [${worktreeMatch.index}] ${worktreeMatch.folderName}`}
          </text>
        )}
      </box>
    </box>
  );
};

const IgnoredMergeRequestRow = ({
  mr,
  isActiveInLocalRepo,
  worktreeMatch,
  isMyMr,
  now
}: {
  mr: MergeRequest;
  isActiveInLocalRepo: boolean;
  worktreeMatch: WorktreeMatch | null;
  isMyMr: boolean;
  now: Date;
}) => {

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
          <text style={{ fg: isMyMr ? Colors.SECONDARY : Colors.NEUTRAL, attributes: TextAttributes.DIM }} wrapMode='none'>
            {mr.author}
          </text>
        </box>

        <box style={{ flexGrow: 1 }}>
          <text
            style={{ fg: Colors.DIM }}
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

        <box style={{ width: 15, backgroundColor: isActiveInLocalRepo ? Colors.SUCCESS : "transparent", flexDirection: "row" }}>
          <text
            style={{
              fg: isActiveInLocalRepo ? Colors.BACKGROUND : Colors.SUCCESS,
              attributes: TextAttributes.DIM
            }}
            wrapMode='none'
          >
            {mr.project.name}
          </text>
          {worktreeMatch && (
            <text
              style={{
                fg: isActiveInLocalRepo ? Colors.BACKGROUND : Colors.INFO,
                attributes: TextAttributes.BOLD
              }}
              wrapMode='none'
            >
              {` [${worktreeMatch.index}]`}
            </text>
          )}
        </box>
    </box>
  </>
);
};

const relationTagOrder: readonly RelationType['_tag'][] = ['stack-base', 'stacked-on-this', 'same-ticket', 'sibling-ticket'];

const OutOfViewRelations = ({ relations }: { relations: ReadonlyMap<RelationType['_tag'], readonly MergeRequest[]> }) => {
  if (relations.size === 0) return null;

  const badges = relationTagOrder
    .filter(tag => relations.has(tag))
    .map(tag => ({ tag, count: relations.get(tag)!.length, badge: getRelationBadge(tag) }));

  return (
    <box style={{ flexDirection: "row", alignItems: "center" }}>
      <box style={{ width: 19 }} />
      <box style={{ flexDirection: "row", gap: 1, alignItems: "center" }}>
        <text style={{ fg: Colors.SUPPORTING }} wrapMode='none'>+</text>
        {badges.map(({ tag, count, badge }) => (
          <text
            key={tag}
            style={{
              fg: Colors.BACKGROUND,
              bg: badge.badgeBg,
              attributes: TextAttributes.BOLD,
            }}
            wrapMode='none'
          >
            {` ${count}${badge.label}(not in view) `}
          </text>
        ))}
      </box>
    </box>
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
  const currentUser = useAtomValue(currentUserIdAtom);

  const jiraIssuesMap = useAtomValue(allJiraIssuesAtom);
  const showBranchNames = useAtomValue(showBranchNamesAtom);

  const ignoredMergeRequests = useAtomValue(ignoredMergeRequestsAtom);
  const monitoredMergeRequests = useAtomValue(monitoredMergeRequestsAtom);
  const refreshMergeRequests = useAtomSet(refreshMergeRequestsAtom, { mode: 'promiseExit' });
  const selectMrByBranch = useAtomSet(selectMrByBranchAtom);
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

  const repositoryBranches = useAtomValue(repositoryBranchesAtom);
  const branchDifferences = useAtomValue(branchDifferencesAtom);

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

  const projectBranchMap = useAtomValue(projectBranchMapAtom);
  const allMrBranchesByProject = useAtomValue(allMrSourceBranchesByProjectAtom);

  const selectedMrContext = useMemo((): SelectedMrContext | null => {
    const selectedMr = mergeRequests[selectedIndex];
    return selectedMr ? buildSelectedMrContext(selectedMr, jiraIssuesMap) : null;
  }, [mergeRequests, selectedIndex, jiraIssuesMap]);

  const relatedMrIndices = useMemo((): Map<number, RelationType> => {
    if (!selectedMrContext) return new Map();

    return new Map(
      mergeRequests
        .map((mr, index): readonly [number, RelationType] | null => {
          if (index === selectedIndex) return null;
          const rel = getRelationType(selectedMrContext, mr, jiraIssuesMap);
          return rel ? [index, rel] : null;
        })
        .filter((entry): entry is [number, RelationType] => entry !== null)
    );
  }, [mergeRequests, selectedIndex, selectedMrContext, jiraIssuesMap]);

  const allMrsResult = useAtomValue(allMrsAtom);
  const outOfViewRelations = useMemo((): ReadonlyMap<RelationType['_tag'], readonly MergeRequest[]> => {
    if (!selectedMrContext) return new Map();

    const visibleGids = new Set(mergeRequests.map(mr => mr.id));
    const allMrsByGid = Result.match(allMrsResult, {
      onInitial: () => new Map() as ReadonlyMap<string, MergeRequest>,
      onSuccess: (state) => state.value.mrsByGid,
      onFailure: () => new Map() as ReadonlyMap<string, MergeRequest>,
    });

    const grouped = new Map<RelationType['_tag'], MergeRequest[]>();
    for (const mr of allMrsByGid.values()) {
      if (visibleGids.has(mr.id)) continue;
      if (mr.id === selectedMrContext.selectedMr.id) continue;
      if (mr.state !== 'opened') continue;

      const rel = getRelationType(selectedMrContext, mr, jiraIssuesMap);
      if (!rel) continue;

      const list = grouped.get(rel._tag);
      if (list) list.push(mr);
      else grouped.set(rel._tag, [mr]);
    }
    return grouped;
  }, [selectedMrContext, mergeRequests, allMrsResult, jiraIssuesMap]);

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

      <RepoFilterBar />
      <UserFilterBar />
      <SprintFilterBar />

      <box style={{ marginBottom: 1, height: 1 }}>
        {isLoading ? (
          <box style={{ flexDirection: "row", alignItems: "center", gap: 1 }}>
            <Spinner />
            <text style={{ fg: Colors.INFO }}>
              Loading merge requests...
            </text>
          </box>
        ) : (
          <box style={{ flexDirection: "row", alignItems: "center", gap: 1 }}>
            {lastRefreshTimestamp && (
              <text style={{ fg: Colors.SUPPORTING }} wrapMode="none">
                Last refreshed: {formatCompactTime(lastRefreshTimestamp, now)} ago
              </text>
            )}
            <text
               onMouseDown={() => refreshMergeRequests(undefined)}
               style={{
                fg: Colors.INFO
               }}
               wrapMode='none'
             >
                {" >> refresh <<"}
            </text>
          </box>
        )}
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
          const branchInfo = projectBranchMap.get(mr.project.fullPath);
          const isActiveInLocalRepo = branchInfo?.currentBranch === mr.sourcebranch;
          const worktreeMatch = branchInfo?.worktreeBranches.get(mr.sourcebranch) ?? null;
          const isIgnored = ignoredMergeRequests.has(mr.id);
          const isMonitored = monitoredMergeRequests.has(mr.id);
          const highlightInfo = getMrHighlightInfo(mr, index);

          const isMyMr = isCurrentUser(currentUser, mrProviderAuthor(mr.provider, mr.author));

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
                backgroundColor: isMonitored ? Colors.ACCENT : 'transparent',
              }} />
              <box style={{ flexDirection: "column", flexGrow: 1 }}>
                {isIgnored ? (
                  <IgnoredMergeRequestRow mr={mr} isActiveInLocalRepo={isActiveInLocalRepo || worktreeMatch !== null} worktreeMatch={worktreeMatch} isMyMr={isMyMr} now={now} />
                ) : (
                  <>
                    <TimeColumnAuthorTitle mr={mr} isMyMr={isMyMr} relationType={relatedMrIndices.get(index) ?? null} now={now} showBranchNames={showBranchNames} />
                    <ProjectStatusInfo mr={mr} isActiveInLocalRepo={isActiveInLocalRepo || worktreeMatch !== null} worktreeMatch={worktreeMatch} createdAt={mr.createdAt} branchDifferenceMap={branchDifferences} jiraIssuesMap={jiraIssuesMap} now={now} currentUser={currentUser} seenMergeRequests={seenMergeRequests} pipelineJobImportance={pipelineJobImportance} />
                    {index === selectedIndex && <OutOfViewRelations relations={outOfViewRelations} />}
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
            height: repositoryBranches.reduce((sum, repo, index) => {
              const wtCount = projectBranchMap.get(repo.projectPath)?.allWorktrees.length ?? 0;
              const noPathWarning = repo.localPath ? 0 : 1;
              return sum + noPathWarning + wtCount;
            }, 0),
          }}
        >
          {repositoryBranches.map((repo, index) => {
            const allWorktrees = projectBranchMap.get(repo.projectPath)?.allWorktrees;
            const checkedOutBranches = allMrBranchesByProject.get(repo.projectPath);
            return (
              <box key={repo.projectPath} style={{ flexDirection: "column" }}>
                {!repo.localPath && (
                  <text style={{ fg: Colors.WARNING }} wrapMode='none'>
                    {repo.projectName}: {"<no path set> (press , to configure)"}
                  </text>
                )}
                {allWorktrees?.map((wt) => {
                  const isCheckedOut = wt.branch != null && checkedOutBranches?.has(wt.branch) === true;
                  return (
                    <box
                      key={wt.folderName}
                      height={1}
                      onMouseDown={isCheckedOut && wt.branch
                        ? () => selectMrByBranch({ projectPath: repo.projectPath, branch: wt.branch! })
                        : undefined}
                    >
                      <text
                        style={{
                          fg: isCheckedOut ? Colors.INFO : Colors.PRIMARY,
                          attributes: isCheckedOut ? TextAttributes.BOLD : 0,
                        }}
                        wrapMode='none'
                      >
                        {`[${wt.index}] ${wt.folderName} : ${wt.branch ?? '(detached)'}`}
                      </text>
                    </box>
                  );
                })}
              </box>
            );
          })}
        </box>
      )}

      <CopyNotificationPopup
        notification={copyNotification} />
    </box>
  );
}
