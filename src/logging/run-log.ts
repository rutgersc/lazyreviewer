import fs from "node:fs"
import path from "node:path"
import util from "node:util"
import { appDataPath } from "../system/app-data-dir"

const LOG_DIR = appDataPath("logs")
const MAX_RUNS = 10

let currentRunLogPath: string | null = null
export const getRunLogPath = (): string | null => currentRunLogPath

type LogLevel = "LOG" | "INFO" | "WARN" | "ERROR" | "DEBUG"
type ConsoleEntry = [Date, LogLevel, unknown[], unknown]

interface TerminalConsoleCache {
  readonly cachedLogs: ConsoleEntry[]
  on(event: "entry", listener: (entry: ConsoleEntry) => void): void
}

const getConsoleCache = (): TerminalConsoleCache | null => {
  const bag = (globalThis as Record<symbol, Record<string, unknown>>)[Symbol.for("@opentui/core/singleton")]
  return (bag?.["TerminalConsoleCache"] as TerminalConsoleCache | undefined) ?? null
}

const formatEntry = ([date, level, args]: ConsoleEntry): string => {
  const message = args
    .map(arg => typeof arg === "string" ? arg : util.inspect(arg, { depth: 6, breakLength: Infinity }))
    .join(" ")
  return `${date.toISOString()} ${level.padEnd(5)} ${message}\n`
}

// Keep only the newest (MAX_RUNS - 1) previous runs so this run makes MAX_RUNS total.
const pruneOldRuns = (): void => {
  const runs = fs.readdirSync(LOG_DIR)
    .filter(f => f.startsWith("run-") && f.endsWith(".log"))
    .sort() // ISO-timestamped names sort chronologically
  runs.slice(0, Math.max(0, runs.length - (MAX_RUNS - 1)))
    .forEach(f => fs.rmSync(path.join(LOG_DIR, f), { force: true }))
}

// Streams every captured console entry to a per-run file under appData/logs.
// Opt out with LAZYREVIEWER_RUN_LOG=0. Returns the file path, or null if disabled/unavailable.
export const startRunLog = (): string | null => {
  const flag = process.env.LAZYREVIEWER_RUN_LOG
  if (flag === "0" || flag === "false") return null

  const cache = getConsoleCache()
  if (!cache) return null

  fs.mkdirSync(LOG_DIR, { recursive: true })
  pruneOldRuns()

  const startedAt = new Date().toISOString().replace(/[:.]/g, "-")
  const file = path.join(LOG_DIR, `run-${startedAt}.log`)

  const append = (entry: ConsoleEntry) => fs.appendFileSync(file, formatEntry(entry))
  // A tail of this file is the only way to watch a running instance: the overlay keeps its entries
  // in memory and only writes them out on ctrl+s.
  cache.cachedLogs.forEach(append) // entries captured before we attached
  cache.on("entry", append)

  currentRunLogPath = file
  return file
}
