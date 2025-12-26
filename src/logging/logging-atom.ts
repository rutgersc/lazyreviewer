import { useEffect, useState } from "react";

export interface LogEntry {
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
}

// OpenTUI internal types (not exported, accessed via singleton)
type OpenTuiLogLevel = 'LOG' | 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'
type OpenTuiLogEntry = [Date, OpenTuiLogLevel, any[], unknown]

interface TerminalConsoleCache {
  cachedLogs: OpenTuiLogEntry[]
  on(event: 'entry', listener: (entry: OpenTuiLogEntry) => void): void
  off(event: 'entry', listener: (entry: OpenTuiLogEntry) => void): void
}

function getTerminalConsoleCache(): TerminalConsoleCache | null {
  const singletonBag = (globalThis as any)[Symbol.for("@opentui/core/singleton")]
  return singletonBag?.["TerminalConsoleCache"] ?? null
}

function mapLogLevel(level: OpenTuiLogLevel): LogEntry['level'] {
  switch (level) {
    case 'ERROR': return 'error'
    case 'WARN': return 'warn'
    case 'DEBUG': return 'debug'
    case 'INFO':
    case 'LOG':
    default: return 'info'
  }
}

function formatArgs(args: any[]): string {
  return args.map(arg =>
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ')
}

function convertEntry(entry: OpenTuiLogEntry): LogEntry {
  const [date, level, args] = entry
  return {
    timestamp: date.toLocaleTimeString(),
    level: mapLogLevel(level),
    message: formatArgs(args)
  }
}

export function useConsoleLogs(): LogEntry[] {
  const [logs, setLogs] = useState<LogEntry[]>([])

  useEffect(() => {
    const cache = getTerminalConsoleCache()
    if (!cache) return

    // Load existing logs
    setLogs(cache.cachedLogs.map(convertEntry))

    // Subscribe to new entries
    const handleEntry = (entry: OpenTuiLogEntry) => {
      setLogs(prev => [...prev.slice(-99), convertEntry(entry)])
    }

    cache.on('entry', handleEntry)
    return () => cache.off('entry', handleEntry)
  }, [])

  return logs
}
