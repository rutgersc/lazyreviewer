import {
  projectGitlabUserMrsFetchedEvent,
  projectGitlabProjectMrsFetchedEvent,
  projectGitlabSingleMrFetchedEvent,
  projectGitlabMrsFetchedEvent
} from '../gitlab/gitlab-projections'
import { mapBitbucketToMergeRequest } from '../bitbucket/bitbucket-projections'
import type { DiscussionNote, MergeRequest } from '../domain/merge-request-schema'
import { defineProjection } from '../utils/define-projection'
import type { Change } from './change-tracking-projection'
import { type Provider, type AuthorIdentity, mrProviderAuthor } from '../userselection/userSelection'

// Cumulative state per MR (for calculating future deltas)
export interface MrStateForDelta {
  mrNoteIds: Set<string>
  mrStatus: string
}

// Per-event delta for a single MR (for display)
interface MrDelta {
  mrId: string
  commentsDelta: Set<string>
  stateDelta?: string
}

// Info about an MR for display purposes
export interface MrInfo {
  mrId: string;
  mrName: string;
  mrAuthor: AuthorIdentity;
  provider: Provider;
  jiraIssueKeys: string[];
}

// Individual MR change types - flat list of what happened
export interface NewMrChange {
  type: 'new-mr';
  mr: MrInfo;
  changedAt: Date;
}

export interface MergedMrChange {
  type: 'merged-mr';
  mr: MrInfo;
  changedAt: Date;
}

export interface ClosedMrChange {
  type: 'closed-mr';
  mr: MrInfo;
  changedAt: Date;
}

export interface ReopenedMrChange {
  type: 'reopened-mr';
  mr: MrInfo;
  changedAt: Date;
}

export type SystemNoteType =
  | 'commits-added'
  | 'approved'
  | 'mentioned-in-mr'
  | 'branch-deleted'
  | 'left-review-comments'
  | 'changed-description'
  | 'changed-target-branch'
  | 'changed-line'
  | 'changed-title'
  | 'resolved-all-threads'
  | 'assigned'
  | 'unassigned'
  | 'unknown';

export const FILTERED_SYSTEM_NOTE_TYPES: ReadonlySet<SystemNoteType> = new Set([
  'left-review-comments',
  'changed-description',
  'changed-target-branch',
  'changed-line',
  'changed-title',
  'resolved-all-threads',
  'assigned',
  'unassigned',
]);

export interface SystemNoteChange {
  type: 'system-note';
  systemNoteType: SystemNoteType;
  mr: MrInfo;
  noteId: string;
  body: string;
  author: AuthorIdentity;
  authorDisplayName: string;
  changedAt: Date;
}

export interface DiffCommentChange {
  type: 'diff-comment';
  mr: MrInfo;
  discussionId: string;
  noteId: string;
  author: AuthorIdentity;
  authorDisplayName: string;
  filePath: string;
  line: number | null;
  changedAt: Date;
}

export interface DiscussionCommentChange {
  type: 'discussion-comment';
  mr: MrInfo;
  discussionId: string;
  noteId: string;
  author: AuthorIdentity;
  authorDisplayName: string;
  changedAt: Date;
}

export interface SystemNotesCompactedChange {
  type: 'system-notes-compacted';
  systemNoteType: SystemNoteType;
  mr: MrInfo;
  count: number;
  noteIds: string[];
  authors: AuthorIdentity[];
  authorDisplayNames: string[];
  changedAt: Date;
  earliestChangedAt: Date;
}

export type MrChange =
  | NewMrChange
  | MergedMrChange
  | ClosedMrChange
  | ReopenedMrChange
  | SystemNoteChange
  | SystemNotesCompactedChange
  | DiffCommentChange
  | DiscussionCommentChange;

// Result of projection: new cumulative state + deltas for this event
export interface MrProjectionResult {
  mrStatesForDelta: Map<string, MrStateForDelta>
  mrDeltas: MrChange[]
}

export const isMrChange = (change: Change): change is MrChange => {
  switch (change.type) {
    case 'new-mr':
    case 'merged-mr':
    case 'closed-mr':
    case 'reopened-mr':
    case 'system-note':
    case 'system-notes-compacted':
    case 'diff-comment':
    case 'discussion-comment':
      return true;
    case 'new-jira-issue':
    case 'jira-status-changed':
    case 'jira-comment':
      return false;
    default:
      return false;
  }
};


const getMrCumulativeState = (mr: MergeRequest): MrStateForDelta => ({
  mrStatus: mr.state,
  mrNoteIds: new Set(
    mr.discussions
      .flatMap((d) => d.notes)
      .map((n) => n.id)
  )
});

const calcDelta = (
  mrId: string,
  previousMr: MrStateForDelta | undefined,
  latestMr: MrStateForDelta
): MrDelta => {
  if (!previousMr) {
    return {
      mrId,
      commentsDelta: new Set(),
      stateDelta: latestMr.mrStatus
    };
  }

  const stateChanged = latestMr.mrStatus !== previousMr.mrStatus
  return {
    mrId,
    commentsDelta: latestMr.mrNoteIds.difference(previousMr.mrNoteIds),
    ...(stateChanged && { stateDelta: latestMr.mrStatus }),
  };
};

const detectMergerequestChanges = (
  mrStatesForDelta: Map<string, MrStateForDelta>,
  latestGitlabMrs: MergeRequest[]
): MrProjectionResult => {

  const determineMrStatusChange = (stateDelta: string | undefined, mrInfo: MrInfo, updatedAt: Date): MrChange | undefined => {
    if (stateDelta === 'opened') {
      return { type: 'new-mr', mr: mrInfo, changedAt: updatedAt };
    } else if (stateDelta === 'merged') {
      return { type: 'merged-mr', mr: mrInfo, changedAt: updatedAt };
    } else if (stateDelta === 'closed') {
      return { type: 'closed-mr', mr: mrInfo, changedAt: updatedAt };
    } else if (stateDelta === 'reopened') {
      return { type: 'reopened-mr', mr: mrInfo, changedAt: updatedAt };
    }
  }

  const determineNoteChange = (
    noteId: string,
    discussionId: string,
    note: DiscussionNote | undefined,
    mrInfo: MrInfo
  ): MrChange => {

    const parseSystemNoteType = (body: string): SystemNoteType => {
      // added 1 commit\n\n<ul><li>
      // added 3 commits
      if (body.startsWith('added ') && body.includes('commit')) {
        return 'commits-added';
      }
      // approved this merge request
      if (body.startsWith('approved this merge request')) {
        return 'approved';
      }
      // mentioned in merge request !768
      // mentioned in merge request BlackLotus!775
      if (body.startsWith('mentioned in merge request')) {
        return 'mentioned-in-mr';
      }
      if (body.startsWith('deleted the ') && body.includes('branch')) {
        return 'branch-deleted';
      }
      // left review comments
      if (body.startsWith('left review comments')) {
        return 'left-review-comments';
      }
      // changed the description
      if (body.startsWith('changed the description')) {
        return 'changed-description';
      }
      // changed target branch from
      if (body.startsWith('changed target branch')) {
        return 'changed-target-branch';
      }
      // changed this line in
      if (body.startsWith('changed this line')) {
        return 'changed-line';
      }
      // <p>changed title from <code
      if (body.includes('changed title from')) {
        return 'changed-title';
      }
      // resolved all threads
      if (body.startsWith('resolved all threads')) {
        return 'resolved-all-threads';
      }
      // assigned to @ArjenPost
      if (body.startsWith('assigned to')) {
        return 'assigned';
      }
      // unassigned @m.bures
      if (body.startsWith('unassigned')) {
        return 'unassigned';
      }
      return 'unknown';
    };

    const noteAuthorIdentity = (note: DiscussionNote): AuthorIdentity =>
      mrProviderAuthor(mrInfo.provider, note.authorUsername);

    const determineSystemNoteChange = (note: DiscussionNote): SystemNoteChange => ({
      type: "system-note",
      systemNoteType: parseSystemNoteType(note.body),
      mr: mrInfo,
      noteId: note.id,
      body: note.body,
      author: noteAuthorIdentity(note),
      authorDisplayName: note.author,
      changedAt: note.createdAt,
    });

    if (!note) {
      const unknownAuthor = mrProviderAuthor(mrInfo.provider, 'unknown');
      return {
        type: "system-note",
        systemNoteType: 'unknown',
        mr: mrInfo,
        noteId: noteId,
        body: "unknown (is this a bug?)",
        author: unknownAuthor,
        authorDisplayName: 'unknown',
        changedAt: new Date()
      };
    }
    if (note.system) {
      return determineSystemNoteChange(note);
    } else if (note.position) {
      return {
        type: "diff-comment",
        mr: mrInfo,
        discussionId,
        noteId: note.id,
        author: noteAuthorIdentity(note),
        authorDisplayName: note.author,
        filePath: note.position.filePath ?? "",
        line: note.position.newLine ?? note.position.oldLine,
        changedAt: note.createdAt
      };
    } else {
      return {
        type: "discussion-comment",
        mr: mrInfo,
        discussionId,
        noteId: note.id,
        author: noteAuthorIdentity(note),
        authorDisplayName: note.author,
        changedAt: note.createdAt
      };
    }
  };

  function findNoteById(mr: MergeRequest, noteId: string): { note: DiscussionNote; discussionId: string } | undefined {
    for (const discussion of mr.discussions) {
      for (const note of discussion.notes) {
        if (note.id === noteId) {
          return { note, discussionId: discussion.id };
        }
      }
    }
    return undefined;
  }

  // Create a copy of the input map to avoid mutating it
  mrStatesForDelta = new Map(mrStatesForDelta);
  const mrDeltas: MrChange[] = [];

  for (const mr of latestGitlabMrs) {
    const previousState = mrStatesForDelta.get(mr.id);
    const latestState = getMrCumulativeState(mr);
    const delta = calcDelta(mr.id, previousState, latestState);

    if (delta.stateDelta !== undefined || delta.commentsDelta.size > 0) {
      const mrAuthorIdentity = mrProviderAuthor(mr.provider, mr.author);
      const mrInfo: MrInfo = { mrId: delta.mrId, mrName: mr?.title ?? "unknown", mrAuthor: mrAuthorIdentity, provider: mr.provider, jiraIssueKeys: mr.jiraIssueKeys };
      const mrStatusChange = determineMrStatusChange(delta.stateDelta, mrInfo, mr.updatedAt);
      const noteChanges = [...delta.commentsDelta].map((noteId) => {
        const found = mr ? findNoteById(mr, noteId) : undefined;
        return determineNoteChange(noteId, found?.discussionId ?? '', found?.note, mrInfo);
      });

      if (mrStatusChange) { mrDeltas.push(mrStatusChange); }
      noteChanges.forEach(delta => mrDeltas.push(delta));
    }

    mrStatesForDelta.set(mr.id, latestState);
  }

  return { mrStatesForDelta, mrDeltas };
};

// =============================================================================
// MR Change Tracking Projection - Single Source of Truth
// =============================================================================

const initialMrChangeTrackingState: MrProjectionResult = {
  mrStatesForDelta: new Map(),
  mrDeltas: []
};

export const mrChangeTrackingProjection = defineProjection({
  initialState: initialMrChangeTrackingState,
  handlers: {
    "gitlab-user-mrs-fetched-event": (state, event) =>
      detectMergerequestChanges(state.mrStatesForDelta, projectGitlabUserMrsFetchedEvent(event)),

    "gitlab-project-mrs-fetched-event": (state, event) =>
      detectMergerequestChanges(state.mrStatesForDelta, projectGitlabProjectMrsFetchedEvent(event)),

    "gitlab-single-mr-fetched-event": (state, event) => {
      const mr = projectGitlabSingleMrFetchedEvent(event);
      return detectMergerequestChanges(state.mrStatesForDelta, mr ? [mr] : []);
    },

    "gitlab-mrs-fetched-event": (state, event) => {
      return detectMergerequestChanges(state.mrStatesForDelta, projectGitlabMrsFetchedEvent(event));
    },

    "bitbucket-prs-fetched-event": (state, event) =>
      detectMergerequestChanges(
        state.mrStatesForDelta,
        event.prsResponse.values.map(pr =>
          mapBitbucketToMergeRequest(pr, event.forWorkspace, event.forRepoSlug))
      ),

    "bitbucket-single-pr-fetched-event": (state, event) =>
      detectMergerequestChanges(
        state.mrStatesForDelta,
        [mapBitbucketToMergeRequest(event.pr, event.forWorkspace, event.forRepoSlug)]
      ),
  }
});

