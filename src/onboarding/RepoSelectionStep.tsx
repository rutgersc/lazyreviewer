import { TextAttributes, type ParsedKey } from '@opentui/core'
import { useKeyboard } from '@opentui/react'
import { useState, useEffect } from 'react'
import { Effect } from 'effect'
import { useAtomValue } from '@effect/atom-react'
import { Colors } from '../colors'
import type { DiscoveredRepo } from './onboarding-types'
import { DEFAULT_GITLAB_REPOS, DEFAULT_BITBUCKET_REPOS } from './onboarding-defaults'
import { fetchGitlabProjects, fetchBitbucketRepos, type RepoFetchResult } from './onboarding-effects'
import { useAutoScroll } from '../hooks/useAutoScroll'
import { CREDENTIALS } from '../config/credentials-config'
import { missingCredentialsAtom } from '../config/config-atom'

interface RepoSelectionStepProps {
  onNext: (repos: DiscoveredRepo[]) => void
  onBack: () => void
}

type ProviderStatus = 'loading' | 'done' | 'error'
type ActiveColumn = 'gitlab' | 'bitbucket'

const isDefaultRepo = (repo: DiscoveredRepo): boolean =>
  repo.provider === 'gitlab'
    ? DEFAULT_GITLAB_REPOS.includes(repo.fullPath)
    : DEFAULT_BITBUCKET_REPOS.includes(repo.fullPath)

const statusIcon = (status: ProviderStatus): string =>
  status === 'loading' ? '⟳' : status === 'done' ? '✓' : '✗'

const statusColor = (status: ProviderStatus): string =>
  status === 'loading' ? Colors.WARNING : status === 'done' ? Colors.SUCCESS : Colors.ERROR

const GITLAB_CREDENTIALS = CREDENTIALS.filter(c => c.key.startsWith('GITLAB_'))
const BITBUCKET_CREDENTIALS = CREDENTIALS.filter(c => c.key.startsWith('BITBUCKET_'))

export default function RepoSelectionStep({ onNext, onBack }: RepoSelectionStepProps) {
  const [repos, setRepos] = useState<DiscoveredRepo[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [activeColumn, setActiveColumn] = useState<ActiveColumn>('gitlab')
  const [gitlabHighlight, setGitlabHighlight] = useState(0)
  const [bitbucketHighlight, setBitbucketHighlight] = useState(0)
  const [gitlabStatus, setGitlabStatus] = useState<ProviderStatus>('loading')
  const [bitbucketStatus, setBitbucketStatus] = useState<ProviderStatus>('loading')
  const [gitlabWarnings, setGitlabWarnings] = useState<string[]>([])
  const [bitbucketWarnings, setBitbucketWarnings] = useState<string[]>([])

  const { scrollBoxRef: gitlabScrollRef, scrollToId: gitlabScrollToId } = useAutoScroll({ lookahead: 1 })
  const { scrollBoxRef: bbScrollRef, scrollToId: bbScrollToId } = useAutoScroll({ lookahead: 1 })

  const missingCredentialsResult = useAtomValue(missingCredentialsAtom)
  const missingKeys = missingCredentialsResult._tag === 'Success'
    ? new Set(missingCredentialsResult.value.map((c: { key: string }) => c.key))
    : new Set<string>()

  useEffect(() => {
    let cancelled = false

    const loadGitlab = Effect.runPromise(fetchGitlabProjects)
      .then(result => {
        if (cancelled) return result
        setRepos(prev => [...prev, ...result.repos])
        setGitlabWarnings(result.warnings)
        setGitlabStatus(result.warnings.length > 0 && result.repos.length === 0 ? 'error' : 'done')
        return result
      })
      .catch(() => {
        if (!cancelled) setGitlabStatus('error')
        return { repos: [], warnings: [] } as RepoFetchResult
      })

    const loadBitbucket = Effect.runPromise(fetchBitbucketRepos)
      .then(result => {
        if (cancelled) return result
        setRepos(prev => [...prev, ...result.repos])
        setBitbucketWarnings(result.warnings)
        setBitbucketStatus(result.warnings.length > 0 && result.repos.length === 0 ? 'error' : 'done')
        return result
      })
      .catch(() => {
        if (!cancelled) setBitbucketStatus('error')
        return { repos: [], warnings: [] } as RepoFetchResult
      })

    Promise.all([loadGitlab, loadBitbucket]).then(([gitlab, bitbucket]) => {
      if (cancelled) return
      const allRepos = [...gitlab.repos, ...bitbucket.repos]
      setSelected(new Set(allRepos.filter(isDefaultRepo).map(r => r.fullPath)))
    })

    return () => { cancelled = true }
  }, [])

  const gitlabRepos = repos.filter(r => r.provider === 'gitlab')
  const bitbucketRepos = repos.filter(r => r.provider === 'bitbucket')

  const toggleRepo = (repo: DiscoveredRepo) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(repo.fullPath)) next.delete(repo.fullPath)
      else next.add(repo.fullPath)
      return next
    })
  }

  useEffect(() => {
    const repo = gitlabRepos[gitlabHighlight]
    if (repo) gitlabScrollToId(`gl-${repo.fullPath}`)
  }, [gitlabHighlight, gitlabRepos.length])

  useEffect(() => {
    const repo = bitbucketRepos[bitbucketHighlight]
    if (repo) bbScrollToId(`bb-${repo.fullPath}`)
  }, [bitbucketHighlight, bitbucketRepos.length])

  const handleProceed = () => {
    const selectedRepos = repos.filter(r => selected.has(r.fullPath))
    if (selectedRepos.length > 0) onNext(selectedRepos)
  }

  useKeyboard((key: ParsedKey) => {
    const currentRepos = activeColumn === 'gitlab' ? gitlabRepos : bitbucketRepos
    const currentHighlight = activeColumn === 'gitlab' ? gitlabHighlight : bitbucketHighlight

    switch (key.name) {
      case 'j':
      case 'down':
        if (activeColumn === 'gitlab') setGitlabHighlight(i => Math.min(gitlabRepos.length - 1, i + 1))
        else setBitbucketHighlight(i => Math.min(bitbucketRepos.length - 1, i + 1))
        break
      case 'k':
      case 'up':
        if (activeColumn === 'gitlab') setGitlabHighlight(i => Math.max(0, i - 1))
        else setBitbucketHighlight(i => Math.max(0, i - 1))
        break
      case 'h':
      case 'left':
        setActiveColumn('gitlab')
        break
      case 'l':
      case 'right':
        setActiveColumn('bitbucket')
        break
      case 'space': {
        const repo = currentRepos[currentHighlight]
        if (repo) toggleRepo(repo)
        break
      }
      case 'return':
        handleProceed()
        break
      case 'escape':
        onBack()
        break
    }
  })

  const gitlabHeaderText = `GitLab ${statusIcon(gitlabStatus)}${gitlabStatus === 'done' ? ` ${gitlabRepos.length} repos` : gitlabStatus === 'loading' ? ' loading...' : ''}`
  const bitbucketHeaderText = `Bitbucket ${statusIcon(bitbucketStatus)}${bitbucketStatus === 'done' ? ` ${bitbucketRepos.length} repos` : bitbucketStatus === 'loading' ? ' loading...' : ''}`

  return (
    <box style={{ flexDirection: 'column', flexGrow: 1 }}>
      {/* Header - absolute so it doesn't get swallowed by flex */}
      <box style={{ position: 'absolute', top: 0, left: 0, width: '100%', zIndex: 10 }}>
        <box style={{ flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 1, paddingRight: 1, backgroundColor: Colors.BACKGROUND }}>
          <text style={{ fg: Colors.PRIMARY, attributes: TextAttributes.BOLD }} wrapMode='none'>
            Step 1/4: Select Repositories
          </text>
          <text style={{ fg: Colors.SUPPORTING }} wrapMode='none'>
            j/k h/l space Enter Esc
          </text>
        </box>
      </box>

      {/* Two-column layout - full height with top/bottom padding for header/footer */}
      <box style={{ flexDirection: 'row', flexGrow: 1, paddingTop: 1, paddingBottom: 1 }}>
        {/* GitLab column */}
        <box style={{ flexDirection: 'column', width: '50%', border: true, borderColor: activeColumn === 'gitlab' ? Colors.SUCCESS : Colors.TRACK }}>
          <scrollbox
            ref={gitlabScrollRef}
            style={{
              flexGrow: 1,
              contentOptions: { backgroundColor: Colors.BACKGROUND },
              scrollbarOptions: {
                trackOptions: { foregroundColor: Colors.NEUTRAL, backgroundColor: Colors.TRACK },
              },
            }}
          >
            <box style={{ flexDirection: 'column' }}>
              <box style={{ paddingLeft: 1 }}>
                <text style={{ fg: Colors.WARNING, attributes: TextAttributes.BOLD }} wrapMode='none'>
                  {gitlabHeaderText}
                </text>
              </box>
              {GITLAB_CREDENTIALS.map(cred => (
                <box key={cred.key} style={{ paddingLeft: 1 }}>
                  <text style={{ fg: missingKeys.has(cred.key) ? Colors.ERROR : Colors.SUCCESS }} wrapMode='none'>
                    {`${missingKeys.has(cred.key) ? '✗' : '✓'} ${cred.key}`}
                  </text>
                </box>
              ))}
              {gitlabWarnings.map((w, i) => (
                <box key={`w${i}`} style={{ paddingLeft: 1 }}>
                  <text style={{ fg: Colors.WARNING }} wrapMode='none'>
                    {w}
                  </text>
                </box>
              ))}
              {gitlabRepos.length === 0 && gitlabStatus !== 'loading' && (
                <box style={{ paddingLeft: 2 }}>
                  <text style={{ fg: Colors.SUPPORTING }} wrapMode='none'>
                    No repositories found
                  </text>
                </box>
              )}
              {gitlabRepos.map((repo, idx) => {
                const isHighlighted = activeColumn === 'gitlab' && idx === gitlabHighlight
                const isSelected = selected.has(repo.fullPath)
                return (
                  <box
                    id={`gl-${repo.fullPath}`}
                    key={repo.fullPath}
                    onMouseDown={() => { setActiveColumn('gitlab'); setGitlabHighlight(idx); toggleRepo(repo) }}
                    style={{
                      flexDirection: 'row',
                      backgroundColor: isHighlighted ? Colors.SELECTED : 'transparent',
                      paddingLeft: 2,
                    }}
                  >
                    <text style={{ fg: isSelected ? Colors.SUCCESS : Colors.SUPPORTING }} wrapMode='none'>
                      {isSelected ? '[x] ' : '[ ] '}
                    </text>
                    <text style={{ fg: Colors.PRIMARY }} wrapMode='none'>
                      {repo.fullPath}
                    </text>
                  </box>
                )
              })}
            </box>
          </scrollbox>
        </box>

        {/* Bitbucket column */}
        <box style={{ flexDirection: 'column', width: '50%', border: true, borderColor: activeColumn === 'bitbucket' ? Colors.SUCCESS : Colors.TRACK }}>
          <scrollbox
            ref={bbScrollRef}
            style={{
              flexGrow: 1,
              contentOptions: { backgroundColor: Colors.BACKGROUND },
              scrollbarOptions: {
                trackOptions: { foregroundColor: Colors.NEUTRAL, backgroundColor: Colors.TRACK },
              },
            }}
          >
            <box style={{ flexDirection: 'column' }}>
              <box style={{ paddingLeft: 1 }}>
                <text style={{ fg: Colors.WARNING, attributes: TextAttributes.BOLD }} wrapMode='none'>
                  {bitbucketHeaderText}
                </text>
              </box>
              {BITBUCKET_CREDENTIALS.map(cred => (
                <box key={cred.key} style={{ paddingLeft: 1 }}>
                  <text style={{ fg: missingKeys.has(cred.key) ? Colors.ERROR : Colors.SUCCESS }} wrapMode='none'>
                    {`${missingKeys.has(cred.key) ? '✗' : '✓'} ${cred.key}`}
                  </text>
                </box>
              ))}
              {bitbucketWarnings.map((w, i) => (
                <box key={`w${i}`} style={{ paddingLeft: 1 }}>
                  <text style={{ fg: Colors.WARNING }} wrapMode='none'>
                    {w}
                  </text>
                </box>
              ))}
              {bitbucketRepos.length === 0 && bitbucketStatus !== 'loading' && (
                <box style={{ paddingLeft: 2 }}>
                  <text style={{ fg: Colors.SUPPORTING }} wrapMode='none'>
                    No repositories found
                  </text>
                </box>
              )}
              {bitbucketRepos.map((repo, idx) => {
                const isHighlighted = activeColumn === 'bitbucket' && idx === bitbucketHighlight
                const isSelected = selected.has(repo.fullPath)
                return (
                  <box
                    id={`bb-${repo.fullPath}`}
                    key={repo.fullPath}
                    onMouseDown={() => { setActiveColumn('bitbucket'); setBitbucketHighlight(idx); toggleRepo(repo) }}
                    style={{
                      flexDirection: 'row',
                      backgroundColor: isHighlighted ? Colors.SELECTED : 'transparent',
                      paddingLeft: 2,
                    }}
                  >
                    <text style={{ fg: isSelected ? Colors.SUCCESS : Colors.SUPPORTING }} wrapMode='none'>
                      {isSelected ? '[x] ' : '[ ] '}
                    </text>
                    <text style={{ fg: Colors.PRIMARY }} wrapMode='none'>
                      {repo.fullPath}
                    </text>
                  </box>
                )
              })}
            </box>
          </scrollbox>
        </box>
      </box>

      {/* Footer - absolute so it's always visible */}
      <box
        onMouseDown={handleProceed}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          zIndex: 10,
          backgroundColor: Colors.BACKGROUND,
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingLeft: 1,
          paddingRight: 1,
        }}
      >
        <text style={{ fg: Colors.SUPPORTING }} wrapMode='none'>
          {selected.size} repos selected
        </text>
        <text style={{ fg: selected.size > 0 ? Colors.SUCCESS : Colors.SUPPORTING, attributes: TextAttributes.BOLD }} wrapMode='none'>
          {selected.size > 0 ? '[ Continue → ]' : ''}
        </text>
      </box>
    </box>
  )
}
