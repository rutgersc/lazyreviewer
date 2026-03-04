import { existsSync } from 'fs'
import { join } from 'path'
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

const GIT_REPOS_BASE = 'C:\\git_repos'

const discoverLocalPath = (repo: DiscoveredRepo): string | undefined => {
  const candidate = join(GIT_REPOS_BASE, repo.name)
  return existsSync(candidate) ? candidate : undefined
}

const discoverAllPaths = (repos: readonly DiscoveredRepo[]): ReadonlyMap<string, string> =>
  new Map(
    repos
      .map(repo => [repo.fullPath, discoverLocalPath(repo)] as const)
      .filter((pair): pair is [string, string] => pair[1] !== undefined)
  )

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
  const [localPaths, setLocalPaths] = useState<ReadonlyMap<string, string>>(() => discoverAllPaths(repos))
  const [highlightIndex, setHighlightIndex] = useState(0)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  const [picking, setPicking] = useState(false)

  const totalItems = repos.length + 1
  const isContinueHighlighted = highlightIndex === repos.length

  const setPath = (fullPath: string, path: string) =>
    setLocalPaths(prev => new Map(prev).set(fullPath, path))

  const clearPath = (fullPath: string) =>
    setLocalPaths(prev => {
      const next = new Map(prev)
      next.delete(fullPath)
      return next
    })

  const startEditing = (idx: number) => {
    const repo = repos[idx]
    if (!repo) return
    setEditingIndex(idx)
    setEditValue(localPaths.get(repo.fullPath) ?? '')
  }

  const commitEdit = () => {
    if (editingIndex === null) return
    const repo = repos[editingIndex]
    if (!repo) return
    const trimmed = editValue.trim()
    if (trimmed) {
      setPath(repo.fullPath, trimmed)
    } else {
      clearPath(repo.fullPath)
    }
    setEditingIndex(null)
  }

  const cancelEdit = () => {
    setEditingIndex(null)
  }

  const handleBrowse = async (idx: number) => {
    if (picking) return
    const repo = repos[idx]
    if (!repo) return
    setPicking(true)
    const selected = await openFolderPicker()
    setPicking(false)
    if (selected) {
      setPath(repo.fullPath, selected)
      setEditingIndex(null)
    }
  }

  useKeyboard((key: ParsedKey) => {
    if (picking) return

    if (editingIndex !== null) {
      if (key.name === 'escape') {
        cancelEdit()
        return
      }
      if (key.name === 'tab') {
        handleBrowse(editingIndex)
        return
      }
      return
    }

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
          startEditing(highlightIndex)
        }
        break
      case 'tab':
        if (!isContinueHighlighted) {
          handleBrowse(highlightIndex)
        }
        break
      case 'x':
      case 'delete':
        if (!isContinueHighlighted) {
          const repo = repos[highlightIndex]
          if (repo) clearPath(repo.fullPath)
        }
        break
    }
  })

  const isEditing = editingIndex !== null

  return (
    <box style={{ flexDirection: 'column', flexGrow: 1 }}>
      <box style={{ flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 1, paddingRight: 1 }}>
        <text style={{ fg: Colors.PRIMARY, attributes: TextAttributes.BOLD }} wrapMode='none'>
          Step 2/4: Locate repositories locally (optional)
        </text>
        <text style={{ fg: Colors.SUPPORTING }} wrapMode='none'>
          {isEditing
            ? 'Enter: confirm | Tab: browse | Esc: cancel'
            : 'j/k: nav | Enter: edit | Tab: browse | x: clear | Esc: back'}
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
            const isEditingThis = editingIndex === idx
            const localPath = localPaths.get(repo.fullPath)
            return (
              <box
                key={repo.fullPath}
                onMouseDown={() => {
                  setHighlightIndex(idx)
                  startEditing(idx)
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
                {isEditingThis ? (
                  <input
                    focused={true}
                    value={editValue}
                    placeholder="C:\path\to\repo"
                    style={{
                      width: 50,
                      textColor: Colors.PRIMARY,
                      backgroundColor: Colors.TRACK,
                      cursorColor: Colors.INFO,
                      placeholderColor: Colors.SUPPORTING,
                    }}
                    onInput={setEditValue}
                    onSubmit={() => commitEdit()}
                  />
                ) : (
                  <text style={{ fg: localPath ? Colors.INFO : Colors.SUPPORTING }} wrapMode='none'>
                    {localPath ?? '(not set)'}
                  </text>
                )}
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
