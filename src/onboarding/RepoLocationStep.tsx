import { spawn } from 'child_process'
import { TextAttributes, type ParsedKey } from '@opentui/core'
import { useKeyboard } from '@opentui/react'
import { useState } from 'react'
import { Colors } from '../colors'
import type { DiscoveredRepo } from './onboarding-types'

interface RepoLocationStepProps {
  readonly repos: readonly DiscoveredRepo[]
  readonly onNext: (localPaths: ReadonlyMap<string, string>) => void
  readonly onBack: () => void
}

const openFolderPicker = (): Promise<string | undefined> =>
  new Promise((resolve) => {
    const ps = spawn('powershell.exe', ['-Command', `
      Add-Type -AssemblyName System.Windows.Forms
      $d = New-Object System.Windows.Forms.FolderBrowserDialog
      if ($d.ShowDialog() -eq 'OK') { $d.SelectedPath } else { '' }
    `], { stdio: ['ignore', 'pipe', 'ignore'] })
    let output = ''
    ps.stdout.on('data', (data: Buffer) => { output += data.toString() })
    ps.on('close', () => {
      const path = output.trim()
      resolve(path || undefined)
    })
  })

export default function RepoLocationStep({ repos, onNext, onBack }: RepoLocationStepProps) {
  const [localPaths, setLocalPaths] = useState<ReadonlyMap<string, string>>(new Map())
  const [highlightIndex, setHighlightIndex] = useState(0)
  const [picking, setPicking] = useState(false)

  // repos + 1 for "Continue" button
  const totalItems = repos.length + 1
  const isContinueHighlighted = highlightIndex === repos.length

  const handleBrowse = async (repo: DiscoveredRepo) => {
    if (picking) return
    const existing = localPaths.get(repo.fullPath)
    if (existing) {
      setLocalPaths(prev => {
        const next = new Map(prev)
        next.delete(repo.fullPath)
        return next
      })
      return
    }
    setPicking(true)
    const selected = await openFolderPicker()
    setPicking(false)
    if (selected) {
      setLocalPaths(prev => new Map(prev).set(repo.fullPath, selected))
    }
  }

  useKeyboard((key: ParsedKey) => {
    if (picking) return

    if (key.name === 'escape') {
      onBack()
      return
    }

    switch (key.name) {
      case 'j':
      case 'down':
        setHighlightIndex(i => Math.min(totalItems - 1, i + 1))
        break
      case 'k':
      case 'up':
        setHighlightIndex(i => Math.max(0, i - 1))
        break
      case 'return':
        if (isContinueHighlighted) {
          onNext(localPaths)
        } else {
          const repo = repos[highlightIndex]
          if (repo) handleBrowse(repo)
        }
        break
    }
  })

  return (
    <box style={{ flexDirection: 'column', flexGrow: 1 }}>
      <box style={{ flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 1, paddingRight: 1 }}>
        <text style={{ fg: Colors.PRIMARY, attributes: TextAttributes.BOLD }} wrapMode='none'>
          Step 2/4: Locate repositories locally (optional)
        </text>
        <text style={{ fg: Colors.SUPPORTING }} wrapMode='none'>
          j/k: nav | Enter: browse/clear | Esc: back
        </text>
      </box>
      <text style={{ fg: Colors.NEUTRAL, paddingLeft: 1 }} wrapMode='none'>
        {'─'.repeat(100)}
      </text>

      {picking && (
        <text style={{ fg: Colors.INFO, paddingLeft: 2, paddingTop: 1 }} wrapMode='none'>
          Waiting for folder picker...
        </text>
      )}

      <scrollbox
        style={{
          flexGrow: 1,
          contentOptions: { backgroundColor: Colors.BACKGROUND },
          scrollbarOptions: {
            trackOptions: { foregroundColor: Colors.NEUTRAL, backgroundColor: Colors.TRACK },
          },
        }}
      >
        <box style={{ flexDirection: 'column', paddingTop: 1 }}>
          {repos.map((repo, idx) => {
            const isHighlighted = idx === highlightIndex
            const localPath = localPaths.get(repo.fullPath)
            return (
              <box
                key={repo.fullPath}
                onMouseDown={() => {
                  setHighlightIndex(idx)
                  handleBrowse(repo)
                }}
                style={{
                  flexDirection: 'row',
                  backgroundColor: isHighlighted ? Colors.SELECTED : 'transparent',
                  paddingLeft: 2,
                  gap: 1,
                }}
              >
                <text style={{ fg: isHighlighted ? Colors.SUCCESS : Colors.PRIMARY }} wrapMode='none'>
                  {isHighlighted ? '> ' : '  '}{repo.fullPath}
                </text>
                <text style={{ fg: localPath ? Colors.INFO : Colors.SUPPORTING }} wrapMode='none'>
                  {localPath ?? '(not set)'}
                </text>
              </box>
            )
          })}

          <box
            onMouseDown={() => {
              setHighlightIndex(repos.length)
              onNext(localPaths)
            }}
            style={{
              paddingLeft: 2,
              paddingTop: 1,
              backgroundColor: isContinueHighlighted ? Colors.SELECTED : 'transparent',
            }}
          >
            <text style={{ fg: isContinueHighlighted ? Colors.SUCCESS : Colors.NEUTRAL, attributes: TextAttributes.BOLD }} wrapMode='none'>
              {isContinueHighlighted ? '> ' : '  '}[Continue →]
            </text>
          </box>
        </box>
      </scrollbox>
    </box>
  )
}
