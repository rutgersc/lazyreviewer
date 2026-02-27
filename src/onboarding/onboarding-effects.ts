import { Effect, Console } from 'effect'
import type { DiscoveredRepo, DiscoveredUser } from './onboarding-types'
import type { UserId } from '../userselection/userSelection'
import { EventStorage } from '../events/events'
import { getGitlabMrsByProjectAsEvent } from '../gitlab/gitlab-graphql'
import { getBitbucketPrsAsEvent } from '../bitbucket/bitbucketapi'
import { projectGitlabProjectMrsFetchedEvent } from '../gitlab/gitlab-projections'
import { projectBitbucketPrsFetchedEvent } from '../bitbucket/bitbucket-projections'

type GitlabProject = {
  id: number
  path_with_namespace: string
  name: string
}

type BitbucketRepo = {
  full_name: string
  name: string
  slug: string
  workspace: { slug: string }
}

type BitbucketResponse = {
  values: BitbucketRepo[]
}

export type RepoFetchResult = {
  readonly repos: DiscoveredRepo[]
  readonly warnings: string[]
}

export const fetchGitlabProjects: Effect.Effect<RepoFetchResult> = Effect.gen(function* () {
  const token = process.env.GITLAB_TOKEN
  if (!token) {
    return { repos: [], warnings: ['GitLab: GITLAB_TOKEN not configured in .env'] }
  }

  const response = yield* Effect.tryPromise({
    try: () => fetch('https://git.elabnext.com/api/v4/projects?membership=true&per_page=100&simple=true', {
      headers: { 'PRIVATE-TOKEN': token }
    }),
    catch: (cause) => `GitLab: network error - ${cause}`
  })

  if (!response.ok) {
    return { repos: [], warnings: [`GitLab: API returned ${response.status} ${response.statusText}`] }
  }

  const data = yield* Effect.tryPromise({
    try: () => response.json() as Promise<GitlabProject[]>,
    catch: (cause) => `GitLab: JSON parse error - ${cause}`
  })

  const repos = data.map((p): DiscoveredRepo => ({
    provider: 'gitlab',
    fullPath: p.path_with_namespace,
    name: p.name,
  }))
  return { repos, warnings: [] }
}).pipe(Effect.catchAll((warning) =>
  Effect.succeed({ repos: [] as DiscoveredRepo[], warnings: [String(warning)] })
))

export const fetchBitbucketRepos = (workspace: string): Effect.Effect<RepoFetchResult> => Effect.gen(function* () {
  const email = process.env.BITBUCKET_EMAIL
  const token = process.env.BITBUCKET_API_TOKEN
  if (!(email && token)) {
    return { repos: [], warnings: ['Bitbucket: BITBUCKET_EMAIL and/or BITBUCKET_API_TOKEN not configured in .env'] }
  }

  const authToken = Buffer.from(`${email}:${token}`).toString('base64')

  const response = yield* Effect.tryPromise({
    try: () => fetch(`https://api.bitbucket.org/2.0/repositories/${workspace}?pagelen=100`, {
      headers: {
        'Authorization': `Basic ${authToken}`,
        'Accept': 'application/json',
      }
    }),
    catch: (cause) => `Bitbucket: network error - ${cause}`
  })

  if (!response.ok) {
    return { repos: [], warnings: [`Bitbucket: API returned ${response.status} ${response.statusText}`] }
  }

  const data = yield* Effect.tryPromise({
    try: () => response.json() as Promise<BitbucketResponse>,
    catch: (cause) => `Bitbucket: JSON parse error - ${cause}`
  })

  const repos = data.values.map((r): DiscoveredRepo => ({
    provider: 'bitbucket',
    fullPath: r.full_name,
    name: r.name,
    workspace: r.workspace.slug,
    repoSlug: r.slug,
  }))
  return { repos, warnings: [] }
}).pipe(Effect.catchAll((warning) =>
  Effect.succeed({ repos: [] as DiscoveredRepo[], warnings: [String(warning)] })
))

export const fetchMrsForRepos = (repos: readonly DiscoveredRepo[]) => Effect.gen(function* () {
  const results = yield* Effect.forEach(
    repos,
    (repo) => fetchMrsForRepo(repo).pipe(
      Effect.catchAll((err) =>
        Console.error(`[Onboarding] Error fetching MRs for ${repo.fullPath}: ${err}`).pipe(
          Effect.as([] as DiscoveredUser[])
        )
      )
    ),
    { concurrency: 3 }
  )

  const allUsers = results.flat()
  const seen = new Set<string>()
  return allUsers.filter(u => {
    const key = `${u.provider}:${u.username}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
})

const fetchMrsForRepo = (repo: DiscoveredRepo) => Effect.gen(function* () {
  if (repo.provider === 'gitlab') {
    const mrEvent = yield* getGitlabMrsByProjectAsEvent(repo.fullPath, 'opened')
    yield* EventStorage.appendEvent(mrEvent)
    const mrs = projectGitlabProjectMrsFetchedEvent(mrEvent)
    return mrs.map((mr): DiscoveredUser => ({
      provider: 'gitlab',
      username: mr.author,
      displayName: mr.author,
    }))
  }

  const workspace = repo.workspace ?? repo.fullPath.split('/')[0] ?? ''
  const repoSlug = repo.repoSlug ?? repo.fullPath.split('/')[1] ?? ''
  const bbEvent = yield* getBitbucketPrsAsEvent(workspace, repoSlug, 'opened')
  yield* EventStorage.appendEvent(bbEvent)
  const prs = projectBitbucketPrsFetchedEvent(bbEvent, new Map())
  return prs.map((pr): DiscoveredUser => ({
    provider: 'bitbucket',
    username: pr.author,
    displayName: pr.author,
  }))
})

export const mergeWithPredefinedUsers = (
  discovered: readonly DiscoveredUser[],
  predefinedUsers: readonly UserId[]
): readonly UserId[] => {
  const byUserId = new Map<string, UserId>()

  discovered.forEach(d => {
    const predefined = predefinedUsers.find(p =>
      (d.provider === 'gitlab' && p.gitlab === d.username) ||
      (d.provider === 'bitbucket' && p.bitbucket === d.username)
    )

    const userId = predefined ?? {
      type: 'userId' as const,
      userId: d.username,
      ...(d.provider === 'gitlab' ? { gitlab: d.username } : { bitbucket: d.username }),
    }

    if (!byUserId.has(userId.userId)) {
      byUserId.set(userId.userId, userId)
    }
  })

  return [...byUserId.values()]
}
