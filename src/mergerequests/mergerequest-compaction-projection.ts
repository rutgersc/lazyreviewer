import type { MergeRequestFieldsFragment } from "../graphql/mrs.generated"
import type { BitbucketPullRequest } from "../bitbucket/bitbucketapi"
import type { MergeRequestState } from "../graphql/generated/gitlab-base-types"
import type {
  GitlabprojectMergeRequestsFetchedEvent,
  GitlabSingleMrFetchedEvent
} from "../events/gitlab-events"
import { defineProjection, type ProjectionEventType } from "../utils/define-projection"

export interface CompactedMergeRequestEntry {
  mr: MergeRequestFieldsFragment | BitbucketPullRequest
  forUsernames: string[]
  forState: MergeRequestState | 'opened' | 'merged' | 'closed' | 'all' | 'locked' // Update to include Bitbucket states
  forProjectPath: string
  forIid: string | number
}

export type CompactedMergeRequestsState = Map<string, CompactedMergeRequestEntry>

const getMrKey = (projectPath: string, mrId: string | number): string =>
  `${projectPath}::${mrId}`

type ProjectMrNode = NonNullable<
  NonNullable<
    NonNullable<GitlabprojectMergeRequestsFetchedEvent['mrs']['project']>['mergeRequests']
  >['nodes']
>[number]

const mapProjectMrToFragment = (node: ProjectMrNode): MergeRequestFieldsFragment => {
  if (!node) throw new Error("Project MR node is null")
  return {
    ...node,
    name: node.title, // Ensure both name and title are present
  } satisfies MergeRequestFieldsFragment
}

type SingleMrNode = NonNullable<
  NonNullable<GitlabSingleMrFetchedEvent['mr']['project']>['mergeRequest']
>

const mapSingleMrToFragment = (node: SingleMrNode): MergeRequestFieldsFragment => {
  return {
    ...node,
    name: node.title, // Ensure both name and title are present
  } satisfies MergeRequestFieldsFragment
}

const isGitlabMr = (mr: MergeRequestFieldsFragment | BitbucketPullRequest): mr is MergeRequestFieldsFragment =>
  'iid' in mr && 'project' in mr

const projectMrsToState = (mrs: ReadonlyArray<MergeRequestFieldsFragment | BitbucketPullRequest>): CompactedMergeRequestsState => {
  const newState = new Map<string, CompactedMergeRequestEntry>()
  mrs.forEach(mr => {
    if (isGitlabMr(mr)) {
      const key = getMrKey(mr.project.fullPath, mr.iid)
      newState.set(key, {
        mr,
        forUsernames: [mr.author?.name || ''],
        forState: 'all',
        forProjectPath: mr.project.fullPath,
        forIid: mr.iid
      })
    } else {
      const repoFullName = mr.destination.repository.full_name
      const key = getMrKey(repoFullName, mr.id)
      newState.set(key, {
        mr,
        forUsernames: [mr.author.display_name],
        forState: 'all',
        forProjectPath: repoFullName,
        forIid: mr.id
      })
    }
  })
  return newState
}

const initialCompactedMergeRequestsState: CompactedMergeRequestsState = new Map()

export const compactedMergeRequestsProjection = defineProjection({
  initialState: initialCompactedMergeRequestsState,
  handlers: {
    "compacted-event": (state, event) => projectMrsToState(event.mrs),

    "gitlab-user-mrs-fetched-event": (state, event) => {
      const newState = new Map(state)
      const users = event.mrs.users?.nodes || []
      users.forEach(user => {
        if (!user) return
        const mrs = user.authoredMergeRequests?.nodes || []
        mrs.forEach(mr => {
          if (!mr) return
          const rawMr = mr
          const key = getMrKey(rawMr.project.fullPath, rawMr.iid)
          newState.set(key, {
            mr: rawMr,
            forUsernames: [...event.forUsernames],
            forState: event.forState,
            forProjectPath: rawMr.project.fullPath,
            forIid: rawMr.iid
          })
        })
      })
      return newState
    },

    "gitlab-project-mrs-fetched-event": (state, event) => {
      const newState = new Map(state)
      const mrs = event.mrs.project?.mergeRequests?.nodes || []
      mrs.forEach(mr => {
        if (!mr) return
        const fragmentMr = mapProjectMrToFragment(mr)
        const key = getMrKey(fragmentMr.project.fullPath, fragmentMr.iid)
        newState.set(key, {
          mr: fragmentMr,
          forUsernames: [fragmentMr.author?.name || ''],
          forState: event.forState,
          forProjectPath: event.forProjectPath,
          forIid: fragmentMr.iid
        })
      })
      return newState
    },

    "gitlab-single-mr-fetched-event": (state, event) => {
      const newState = new Map(state)
      const mr = event.mr.project?.mergeRequest
      if (!mr) return newState

      const fragmentMr = mapSingleMrToFragment(mr)
      const key = getMrKey(fragmentMr.project.fullPath, fragmentMr.iid)
      newState.set(key, {
        mr: fragmentMr,
        forUsernames: [fragmentMr.author?.name || ''],
        forState: 'all',
        forProjectPath: event.forProjectPath,
        forIid: event.forIid
      })
      return newState
    },

    "bitbucket-prs-fetched-event": (state, event) => {
      const newState = new Map(state)
      const prs = event.prsResponse.values
      prs.forEach(pr => {
        const repoFullName = pr.destination.repository.full_name
        const key = getMrKey(repoFullName, pr.id)
        newState.set(key, {
          mr: pr,
          forUsernames: [pr.author.display_name],
          forState: event.forState,
          forProjectPath: repoFullName,
          forIid: pr.id
        })
      })
      return newState
    },

    "bitbucket-single-pr-fetched-event": (state, event) => {
      const newState = new Map(state)
      const pr = event.pr
      const repoFullName = pr.destination.repository.full_name
      const key = getMrKey(repoFullName, pr.id)
      newState.set(key, {
        mr: pr,
        forUsernames: [pr.author.display_name],
        forState: 'all',
        forProjectPath: repoFullName,
        forIid: pr.id
      })
      return newState
    },
  }
})

// Derived from the projection
export type CompactedMergeRequestsEvent = ProjectionEventType<typeof compactedMergeRequestsProjection>
