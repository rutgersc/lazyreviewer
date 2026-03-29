import { TextAttributes, type ParsedKey } from '@opentui/core'
import { useKeyboard } from '@opentui/react'
import { useState, useEffect } from 'react'
import { Effect } from 'effect'
import { Colors } from '../colors'
import type { DiscoveredRepo } from './onboarding-types'
import { DEFAULT_GITLAB_REPOS, DEFAULT_BITBUCKET_REPOS, BITBUCKET_WORKSPACE } from './onboarding-defaults'
import { fetchGitlabProjects, fetchBitbucketRepos, type RepoFetchResult } from './onboarding-effects'

interface RepoSelectionStepProps {
  onNext: (repos: DiscoveredRepo[]) => void
  onBack: () => void
}

const isDefaultRepo = (repo: DiscoveredRepo): boolean =>
  repo.provider === 'gitlab'
    ? DEFAULT_GITLAB_REPOS.includes(repo.fullPath)
    : DEFAULT_BITBUCKET_REPOS.includes(repo.fullPath)

export default function RepoSelectionStep({ onNext, onBack }: RepoSelectionStepProps) {
  const [repos, setRepos] = useState<DiscoveredRepo[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [highlightIndex, setHighlightIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [warnings, setWarnings] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const [gitlab, bitbucket] = await Promise.all([
        Effect.runPromise(fetchGitlabProjects),
        Effect.runPromise(fetchBitbucketRepos(BITBUCKET_WORKSPACE)),
      ])

      if (cancelled) return

      const allRepos = [...gitlab.repos, ...bitbucket.repos]
      const allWarnings = [...gitlab.warnings, ...bitbucket.warnings]
      setRepos(allRepos)
      setWarnings(allWarnings)

      const defaults = new Set(
        allRepos.filter(isDefaultRepo).map(r => r.fullPath)
      )
      setSelected(defaults)
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [])

  const toggle = (idx: number) => {
    const repo = repos[idx]
    if (!repo) return
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(repo.fullPath)) next.delete(repo.fullPath)
      else next.add(repo.fullPath)
      return next
    })
  }

  const handleProceed = () => {
    const selectedRepos = repos.filter(r => selected.has(r.fullPath))
    if (selectedRepos.length > 0) onNext(selectedRepos)
  }

  useKeyboard((key: ParsedKey) => {
    switch (key.name) {
      case 'j':
      case 'down':
        setHighlightIndex(i => Math.min(repos.length - 1, i + 1))
        break
      case 'k':
      case 'up':
        setHighlightIndex(i => Math.max(0, i - 1))
        break
      case 'space':
        toggle(highlightIndex)
        break
      case 'return':
        handleProceed()
        break
      case 'escape':
        onBack()
        break
    }
  })

  const gitlabRepos = repos.filter(r => r.provider === 'gitlab')
  const bitbucketRepos = repos.filter(r => r.provider === 'bitbucket')

  const gitlabOffset = 0
  const bitbucketOffset = gitlabRepos.length

  return (
    <box style={{ flexDirection: 'column', flexGrow: 1 }}>
      <box style={{ flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 1, paddingRight: 1 }}>
        <text style={{ fg: Colors.PRIMARY, attributes: TextAttributes.BOLD }} wrapMode='none'>
          Step 1/4: Select Repositories
        </text>
        <text style={{ fg: Colors.SUPPORTING }} wrapMode='none'>
          j/k: nav | space: toggle | Enter: next | Esc: close
        </text>
      </box>
      <text style={{ fg: Colors.NEUTRAL, paddingLeft: 1 }} wrapMode='none'>
        {'─'.repeat(100)}
      </text>

      {loading && (
        <box style={{ padding: 2 }}>
          <text style={{ fg: Colors.INFO }} wrapMode='none'>
            Loading repositories...
          </text>
        </box>
      )}

      {!loading && warnings.length > 0 && (
        <box style={{ flexDirection: 'column', paddingLeft: 2, paddingRight: 1 }}>
          {warnings.map((w, i) => (
            <text key={i} style={{ fg: Colors.WARNING }} wrapMode='none'>
              {w}
            </text>
          ))}
        </box>
      )}

      {!loading && (
        <scrollbox
          style={{
            flexGrow: 1,
            contentOptions: { backgroundColor: Colors.BACKGROUND },
            scrollbarOptions: {
              trackOptions: { foregroundColor: Colors.NEUTRAL, backgroundColor: Colors.TRACK },
            },
          }}
        >
          <box style={{ flexDirection: 'column' }}>
            {gitlabRepos.length > 0 && (
              <>
                <text style={{ fg: Colors.WARNING, attributes: TextAttributes.BOLD, paddingLeft: 1 }} wrapMode='none'>
                  GitLab
                </text>
                {gitlabRepos.map((repo, idx) => {
                  const flatIdx = gitlabOffset + idx
                  const isHighlighted = flatIdx === highlightIndex
                  const isSelected = selected.has(repo.fullPath)
                  return (
                    <box
                      key={repo.fullPath}
                      onMouseDown={() => { setHighlightIndex(flatIdx); toggle(flatIdx) }}
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
              </>
            )}

            {bitbucketRepos.length > 0 && (
              <>
                <text style={{ fg: Colors.WARNING, attributes: TextAttributes.BOLD, paddingLeft: 1 }} wrapMode='none'>
                  Bitbucket
                </text>
                {bitbucketRepos.map((repo, idx) => {
                  const flatIdx = bitbucketOffset + idx
                  const isHighlighted = flatIdx === highlightIndex
                  const isSelected = selected.has(repo.fullPath)
                  return (
                    <box
                      key={repo.fullPath}
                      onMouseDown={() => { setHighlightIndex(flatIdx); toggle(flatIdx) }}
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
              </>
            )}
          </box>
        </scrollbox>
      )}

      <box style={{ paddingLeft: 1, paddingRight: 1 }}>
        <text style={{ fg: Colors.SUPPORTING }} wrapMode='none'>
          {selected.size} repos selected
        </text>
      </box>
    </box>
  )
}
