import React from 'react';
import { TextAttributes, type ParsedKey } from '@opentui/core';
import { useKeyboard } from '@opentui/react';
import { getJobStatusDisplay } from '../domain/display/jobStatus';
import { Colors } from '../colors';
import { useAtomValue, useAtomSet, Atom, Registry, RegistryContext } from '@effect-atom/atom-react';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { appAtomRuntime } from '../appLayerRuntime';
import { Console, Effect, Exit } from 'effect';
import { fetchJobHistory, getJobTraceRaw } from '../gitlab/gitlab-graphql';
import type { JobHistoryEntry } from '../domain/merge-request-schema';
import { spawn } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { repositoryPathsAtom } from '../settings/settings-atom';
import { loadJobLogInternal } from '../mergerequests/open-pipelinejob-log';

export interface JobHistoryQuery {
  readonly projectPath: string;
  readonly jobName: string;
}

export const jobHistoryQueryAtom = Atom.make<JobHistoryQuery | null>(null);

interface JobHistoryModalProps {
  isVisible: boolean;
  onClose: () => void;
}

export const selectedPipelineJobIndexAtom = Atom.make<number>(0);

export const jobHistoryDataAtom = Atom.make<JobHistoryEntry[]>([]);
export const selectedJobForHistoryAtom = Atom.make<string | null>(null);
export const jobHistoryLimitAtom = Atom.make<number>(50);

export const jobHistoryEndCursorAtom = Atom.make<string | null>(null);
export const jobHistoryHasNextPageAtom = Atom.make<boolean>(false);
export const jobHistoryPipelinesScannedAtom = Atom.make<number>(0);
export const jobHistoryIsLoadingMoreAtom = Atom.make<boolean>(false);

export const fetchJobHistoryAtom = appAtomRuntime.fn((_: number, get) =>
  Effect.gen(function* () {
    const query = get(jobHistoryQueryAtom);
    const limit = get(jobHistoryLimitAtom);

    if (!query) {
      yield* Console.log('[JobHistory] No query set');
      return { history: [] as JobHistoryEntry[], pipelinesScanned: 0, pageInfo: { hasNextPage: false, endCursor: null as string | null } };
    }

    yield* Console.log(`[JobHistory] Fetching history for ${query.jobName} (limit: ${limit})`);

    const result = yield* fetchJobHistory(
      query.projectPath,
      query.jobName,
      limit,
      null
    );

    yield* Console.log(`[JobHistory] Fetched ${result.history.length} entries (scanned ${result.pipelinesScanned} pipelines)`);

    return { history: result.history, pipelinesScanned: result.pipelinesScanned, pageInfo: result.pageInfo };
  })
);

interface LoadMoreArgs {
  readonly query: JobHistoryQuery;
  readonly endCursor: string | null;
  readonly currentHistory: JobHistoryEntry[];
}

const loadMoreJobHistoryAtom = appAtomRuntime.fn((args: LoadMoreArgs, get) =>
  Effect.gen(function* () {
    const limit = get(jobHistoryLimitAtom);

    yield* Console.log(`[JobHistory] Loading more for ${args.query.jobName} (cursor: ${args.endCursor})`);

    const result = yield* fetchJobHistory(
      args.query.projectPath,
      args.query.jobName,
      limit,
      args.endCursor
    );

    yield* Console.log(`[JobHistory] Fetched ${result.history.length} more entries (scanned ${result.pipelinesScanned} pipelines)`);

    const newHistory: JobHistoryEntry[] = [...args.currentHistory, ...result.history];

    return { history: newHistory, pipelinesScanned: result.pipelinesScanned, pageInfo: result.pageInfo };
  })
);

const buildDebugPrompt = (
  query: JobHistoryQuery,
  totalLoaded: number,
  localRepoPath: string | null,
  traces: readonly { job: JobHistoryEntry; trace: string | null }[]
): string => {
  const stripAnsi = (s: string) =>
    s.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
     .replace(/\x1B\[0K/g, '')
     .replace(/^section_(?:start|end):[^\n]*$/gm, '')
     .replace(/\r/g, '')
     .replace(/\n{3,}/g, '\n\n');

  const tailLines = (s: string, n: number) => {
    const lines = s.split('\n');
    return lines.length > n
      ? `... (${lines.length - n} lines truncated)\n${lines.slice(-n).join('\n')}`
      : s;
  };

  const sections = traces.map(({ job, trace }) => {
    const traceContent = trace
      ? tailLines(stripAnsi(trace), 200)
      : '(trace unavailable)';

    return [
      `## Pipeline #${job.pipelineIid} — ${job.pipelineRef}`,
      '',
      `- **Commit**: \`${job.shortShaCommit || 'unknown'}\``,
      `- **Created**: ${job.pipelineCreatedAt}`,
      `- **Duration**: ${job.duration ? `${job.duration}s` : 'unknown'}`,
      job.failureMessage ? `- **Failure**: ${job.failureMessage}` : null,
      job.mergeRequestTitle ? `- **MR**: !${job.mergeRequestIid} ${job.mergeRequestTitle}` : null,
      job.runner ? `- **Runner**: ${job.runner.description || job.runner.shortSha}` : null,
      '',
      '### Job Log (last 200 lines)',
      '',
      '```',
      traceContent,
      '```',
      ''
    ].filter(line => line !== null).join('\n');
  });

  return [
    `# Debug: Failed "${query.jobName}" runs`,
    '',
    `> ${traces.length} failed run(s) out of ${totalLoaded} total loaded runs in \`${query.projectPath}\``,
    localRepoPath ? `> Local repository: \`${localRepoPath}\`` : null,
    '',
    'Analyze these failed CI job logs. The commits referenced below can be inspected in the local repository.',
    '',
    'Identify:',
    '1. **Root cause(s)** — What is causing each failure?',
    '2. **Patterns** — Are multiple failures related? Same root cause or different?',
    '3. **Fix suggestions** — What changes would resolve these failures?',
    '4. **Flaky vs real** — Are any of these flaky test failures vs genuine bugs?',
    '',
    '---',
    '',
    ...sections
  ].filter(line => line !== null).join('\n');
};

const openJobLogFromHistoryAtom = appAtomRuntime.fn((entry: JobHistoryEntry, get) => {
  const query = get(jobHistoryQueryAtom);
  if (!query) return Effect.void;
  return loadJobLogInternal(
    { project: { path: '', fullPath: query.projectPath }, sourcebranch: entry.pipelineRef },
    { id: entry.jobId, name: entry.jobName, localId: entry.pipelineIid }
  );
});

const generateDebugPromptAtom = appAtomRuntime.fn((_: void, get) =>
  Effect.gen(function* () {
    const query = get(jobHistoryQueryAtom);
    const history = get(jobHistoryDataAtom);
    const repoPaths = get(repositoryPathsAtom);

    if (!query) return;

    const localRepoPath = repoPaths[query.projectPath]?.localPath || null;

    const failedJobs = history.filter(e => e.jobStatus === 'FAILED');
    if (failedJobs.length === 0) {
      yield* Console.log('[JobHistory] No failed jobs to debug');
      return;
    }

    yield* Console.log(`[JobHistory] Fetching traces for ${failedJobs.length} failed jobs...`);

    const traces = yield* Effect.all(
      failedJobs.map(job =>
        getJobTraceRaw(query.projectPath, job.jobId).pipe(
          Effect.map(trace => ({ job, trace })),
          Effect.catchAll(() => Effect.succeed({ job, trace: null as string | null }))
        )
      ),
      { concurrency: 5 }
    );

    const prompt = buildDebugPrompt(query, history.length, localRepoPath, traces);

    const sanitize = (s: string) => s.replace(/[<>:"/\\|?*]/g, '_');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dir = join(process.cwd(), 'logs', 'debug-prompts');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const filePath = join(dir, `${sanitize(query.jobName)}_${timestamp}.md`);

    writeFileSync(filePath, prompt, 'utf8');
    yield* Console.log(`[JobHistory] Debug prompt saved to: ${filePath}`);

    if (process.platform === 'win32') {
      spawn('start', ['', filePath], { shell: true, detached: true, stdio: 'ignore' });
    } else if (process.platform === 'darwin') {
      spawn('open', [filePath], { detached: true, stdio: 'ignore' });
    } else {
      spawn('xdg-open', [filePath], { detached: true, stdio: 'ignore' });
    }
  })
);

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMinutes > 0) return `${diffMinutes}m ago`;
  return 'just now';
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === 0) return '-';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

export default function JobHistoryModal({
  isVisible,
  onClose
}: JobHistoryModalProps) {
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  const registry = React.useContext(RegistryContext);
  const query = useAtomValue(jobHistoryQueryAtom);
  const jobName = useAtomValue(selectedJobForHistoryAtom);
  const jobHistory = useAtomValue(jobHistoryDataAtom);
  const hasNextPage = useAtomValue(jobHistoryHasNextPageAtom);
  const endCursor = useAtomValue(jobHistoryEndCursorAtom);
  const pipelinesScanned = useAtomValue(jobHistoryPipelinesScannedAtom);
  const isLoadingMore = useAtomValue(jobHistoryIsLoadingMoreAtom);
  const setJobHistoryData = useAtomSet(jobHistoryDataAtom);
  const setJobHistoryEndCursor = useAtomSet(jobHistoryEndCursorAtom);
  const setJobHistoryHasNextPage = useAtomSet(jobHistoryHasNextPageAtom);

  const { scrollBoxRef, scrollToItem } = useAutoScroll({
    lookahead: 2,
  });

  useKeyboard((key: ParsedKey) => {
    if (!isVisible) return;

    if (key.name === 'escape') {
      onClose();
    } else if (key.name === 'j' || key.name === 'down') {
      setSelectedIndex(prev => {
        const newIndex = Math.min(prev + 1, jobHistory.length - 1);
        scrollToItem(newIndex);
        return newIndex;
      });
    } else if (key.name === 'k' || key.name === 'up') {
      setSelectedIndex(prev => {
        const newIndex = Math.max(prev - 1, 0);
        scrollToItem(newIndex);
        return newIndex;
      });
    } else if (key.name === 'm') {
      if (hasNextPage && query && !isLoadingMore) {
        registry.set(jobHistoryIsLoadingMoreAtom, true);
        registry.set(loadMoreJobHistoryAtom, { query, endCursor, currentHistory: jobHistory });
        Effect.runPromiseExit(
          Registry.getResult(registry, loadMoreJobHistoryAtom, { suspendOnWaiting: true })
        ).then((exit) => {
          registry.set(jobHistoryIsLoadingMoreAtom, false);
          if (Exit.isSuccess(exit)) {
            const { history, pageInfo, pipelinesScanned: batchScanned } = exit.value;
            registry.set(jobHistoryDataAtom, history);
            registry.set(jobHistoryEndCursorAtom, pageInfo.endCursor);
            registry.set(jobHistoryHasNextPageAtom, pageInfo.hasNextPage);
            registry.set(jobHistoryPipelinesScannedAtom, pipelinesScanned + batchScanned);
          }
        });
      }
    } else if (key.name === 'd') {
      registry.set(generateDebugPromptAtom, undefined);
    } else if (key.name === 'return') {
      const selectedEntry = jobHistory[selectedIndex];
      if (selectedEntry) {
        registry.set(openJobLogFromHistoryAtom, selectedEntry);
      }
    }
  });

  if (!isVisible) return null;

  const totalRuns = jobHistory.length;
  const developRuns = jobHistory.filter(entry => entry.isDevelopBranch).length;
  const failedRuns = jobHistory.filter(entry => entry.jobStatus === 'FAILED').length;

  return (
    <box
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
        backgroundColor: Colors.BACKGROUND,
        zIndex: 9999
      }}
    >

        {/* Header */}
        <box style={{ padding: 1, border: true, borderColor: Colors.NEUTRAL, backgroundColor: Colors.TRACK, flexShrink: 0 }}>
          <text style={{ fg: Colors.PRIMARY, attributes: TextAttributes.BOLD }} wrapMode='none'>
            {`📋 Job History: ${jobName} (${totalRuns} runs across all branches)`}
          </text>
        </box>

        {/* Content */}
        <scrollbox
          ref={scrollBoxRef}
          style={{
            flexDirection: 'column',
            overflow: 'scroll',
            contentOptions: {
              backgroundColor: Colors.BACKGROUND,
            },
            viewportOptions: {
              backgroundColor: Colors.BACKGROUND,
            },
          }}
        >
          {jobHistory.length === 0 ? (
            <text style={{ fg: Colors.NEUTRAL, attributes: TextAttributes.DIM }} wrapMode='none'>
              No history found for this job.
            </text>
          ) : (
            <box style={{ flexDirection: 'column', gap: 0 }}>
              {jobHistory.map((entry, index) => {
                const statusDisplay = getJobStatusDisplay(entry.jobStatus);
                const isSelected = index === selectedIndex;
                const developIndicator = entry.isDevelopBranch ? '★ ' : '  ';

                return (
                  <box
                    key={`${entry.pipelineId}-${entry.jobId}`}
                    style={{
                      flexDirection: 'column',
                      backgroundColor: isSelected ? Colors.SELECTED : 'transparent',
                      paddingLeft: 1,
                      paddingRight: 1
                    }}
                  >
                    {/* Main row */}
                    <box style={{ flexDirection: 'row', gap: 1, alignItems: 'center' }}>
                      {/* Time */}
                      <text style={{ fg: Colors.SUPPORTING, width: 8 }} wrapMode='none'>
                        {formatRelativeTime(entry.pipelineCreatedAt)}
                      </text>

                      {/* Pipeline IID */}
                      <text style={{ fg: Colors.SUPPORTING, width: 8 }} wrapMode='none'>
                        {`#${entry.pipelineIid}`}
                      </text>

                      {/* Status */}
                      <text style={{ fg: statusDisplay.color, attributes: TextAttributes.BOLD }} wrapMode='none'>
                        {statusDisplay.symbol}
                      </text>
                      <text style={{ fg: statusDisplay.color, width: 10 }} wrapMode='none'>
                        {statusDisplay.description.toUpperCase()}
                      </text>

                      {/* Duration */}
                      <text style={{ fg: Colors.SUPPORTING, width: 8 }} wrapMode='none'>
                        {formatDuration(entry.duration)}
                      </text>

                      {/* commit */}
                      <text style={{ fg: Colors.SUPPORTING, width: 8 }} wrapMode='none'>
                        {entry.shortShaCommit}
                      </text>

                      {/* Runner */}
                      <text style={{ fg: Colors.SUPPORTING, width: 20 }} wrapMode='none'>
                        {entry.runner?.description || entry.runner?.shortSha
                          ? `${entry.runner?.shortSha
                              ? `(${entry.runner.shortSha}) `
                              : ''}${entry.runner.description || '-'}`
                          : '-'}
                      </text>

                      {/* Develop indicator */}
                      <text
                        style={{
                          fg: entry.isDevelopBranch ? Colors.SECONDARY : Colors.SUPPORTING,
                          attributes: entry.isDevelopBranch ? TextAttributes.BOLD : TextAttributes.NONE
                        }}
                        wrapMode='none'
                      >
                        {developIndicator}
                      </text>

                      {/* Branch/Ref */}
                      <text
                        style={{
                          fg: entry.isDevelopBranch ? Colors.SECONDARY : Colors.INFO,
                          attributes: TextAttributes.BOLD
                        }}
                        wrapMode='none'
                      >
                        {entry.pipelineRef}
                      </text>

                      {/* MR Title and Author (if available) */}
                      {entry.mergeRequestTitle && (
                        <>
                          <text style={{ fg: Colors.SUPPORTING }} wrapMode='none'>
                            {'·'}
                          </text>
                          <text style={{ fg: Colors.PRIMARY }} wrapMode='none'>
                            {`!${entry.mergeRequestIid} ${entry.mergeRequestTitle}`}
                          </text>
                          {entry.mergeRequestAuthor && (
                            <text style={{ fg: Colors.SUPPORTING }} wrapMode='none'>
                              {` (@${entry.mergeRequestAuthor})`}
                            </text>
                          )}
                        </>
                      )}
                    </box>

                    {/* Failure message (if any) */}
                    {entry.failureMessage && (
                      <box style={{ marginLeft: 4 }}>
                        <text style={{ fg: Colors.ERROR, attributes: TextAttributes.DIM }} wrapMode='none'>
                          {entry.failureMessage.substring(0, 100)}
                        </text>
                      </box>
                    )}
                  </box>
                );
              })}
            </box>
          )}
        </scrollbox>

        {/* Footer */}
        <box style={{
          padding: 1,
          border: true,
          borderColor: Colors.NEUTRAL,
          backgroundColor: Colors.TRACK,
          flexDirection: 'column',
          gap: 0,
          flexShrink: 0
        }}>
          <text style={{ fg: Colors.PRIMARY }} wrapMode='none'>
            {`${totalRuns} matching jobs · ${pipelinesScanned} pipelines scanned · ${developRuns} on develop · ${failedRuns} failures${isLoadingMore ? ' · loading...' : hasNextPage ? ' · more available' : ' · all loaded'}`}
          </text>
          <text style={{ fg: Colors.NEUTRAL, attributes: TextAttributes.DIM }} wrapMode='none'>
            {hasNextPage ? 'j/k: navigate • enter: open • m: load more • d: debug prompt • esc: close' : 'j/k: navigate • enter: open • d: debug prompt • esc: close'}
          </text>
        </box>
      </box>
  );
}
