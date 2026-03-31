import { Stream, Effect, Console } from "effect"
import { MrStateService } from "../mergerequests/mr-state-service"
import { UserSettingsService, type UserSettings } from "./user-filter-presets"
import type { AllMrsState } from "../mergerequests/all-mergerequests-projection"
import type { Provider } from "../userselection/userSelection"

type AuthorEntry = { readonly author: string; readonly provider: Provider }

const extractAuthors = (state: AllMrsState): readonly AuthorEntry[] => {
  const seen = new Map<string, AuthorEntry>()
  for (const mr of state.mrsByGid.values()) {
    const key = `${mr.provider}:${mr.author}`
    if (!seen.has(key)) {
      seen.set(key, { author: mr.author, provider: mr.provider })
    }
  }
  return [...seen.values()]
}

const findNewUsers = (
  authors: readonly AuthorEntry[],
  existingUsers: UserSettings['users'],
): readonly { userId: string; gitlab?: string; bitbucket?: string }[] => {
  const gitlabUsernames = new Set(existingUsers.filter(u => u.gitlab).map(u => u.gitlab!))
  const bitbucketUsernames = new Set(existingUsers.filter(u => u.bitbucket).map(u => u.bitbucket!))
  const added = new Set<string>()

  return authors.filter(({ author, provider }) => {
    const key = `${provider}:${author}`
    if (added.has(key)) return false
    const isKnown = provider === 'gitlab'
      ? gitlabUsernames.has(author)
      : bitbucketUsernames.has(author)
    if (isKnown) return false
    added.add(key)
    return true
  }).map(({ author, provider }) => ({
    userId: author,
    ...(provider === 'gitlab' ? { gitlab: author } : { bitbucket: author }),
  }))
}

export const ensureDiscoveredUsersInSettings = Effect.gen(function* () {
  const mrStateService = yield* MrStateService
  const userSettingsService = yield* UserSettingsService
  return yield* mrStateService.changes.pipe(
    Stream.debounce("4 seconds"),
    Stream.mapEffect(state =>
      Effect.gen(function* () {
        const authors = extractAuthors(state)
        yield* userSettingsService.modify(settings => {
          const newUsers = findNewUsers(authors, settings.users)
          if (newUsers.length === 0) return settings
          return { ...settings, users: [...settings.users, ...newUsers] }
        })
      })
    ),
    Stream.runDrain,
  )
})
