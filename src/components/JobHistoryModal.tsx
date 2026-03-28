import React from 'react';
import { TextAttributes, type ParsedKey } from '@opentui/core';
import { useKeyboard } from '@opentui/react';
import { getJobStatusDisplay } from '../domain/display/jobStatus';
import { Colors } from '../colors';
import { useAtomValue, Atom, Registry, RegistryContext, useAtomSet } from '@effect-atom/atom-react';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { appAtomRuntime } from '../appLayerRuntime';
import { Console, Effect, Exit } from 'effect';
import { fetchJobHistory, getGitlabBaseUrl } from '../gitlab/gitlab-graphql';
import type { JobHistoryEntry } from '../domain/merge-request-schema';
import { spawn } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { repositoryPathsAtom } from '../settings/settings-atom';
import { loadJobLogInternal, downloadJobTrace, getJobLogPath } from '../mergerequests/open-pipelinejob-log';
import { selectedMrAtom } from '../mergerequests/mergerequests-atom';
import { getPipelineJobsFromMr } from './PipelineJobsList';

export interface JobHistoryQuery {
  readonly projectPath: string;
  readonly jobName: string;
}

export const jobHistoryQueryAtom = Atom.make<JobHistoryQuery | null>(null);

export const selectedPipelineJobIndexAtom = Atom.make<number>(0);

export const jobHistoryDataAtom = Atom.make<JobHistoryEntry[]>([]);

interface JobHistoryPageState {
  readonly endCursor: string | null;
  readonly hasNextPage: boolean;
  readonly pipelinesScanned: number;
  readonly isLoadingMore: boolean;
}

const initialPageState: JobHistoryPageState = {
  endCursor: null,
  hasNextPage: false,
  pipelinesScanned: 0,
  isLoadingMore: false,
};

export const jobHistoryPageStateAtom = Atom.make<JobHistoryPageState>(initialPageState);

const jobHistoryStatusAtom = Atom.make<string | null>(null);

const jobHistoryLimitAtom = Atom.make<number>(50);

const fetchJobHistoryAtom = appAtomRuntime.fn((_: number, get) =>
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

const resolveQueryFromContext = (registry: Registry.Registry): JobHistoryQuery | null => {
  const currentMr = registry.get(selectedMrAtom);
  const jobs = getPipelineJobsFromMr(currentMr);
  const currentIndex = registry.get(selectedPipelineJobIndexAtom);
  const selectedJob = jobs[currentIndex];
  if (!selectedJob || !currentMr) return null;
  return { projectPath: currentMr.project.fullPath, jobName: selectedJob.job.name };
};

const applyFetchResult = (
  registry: Registry.Registry,
  result: { history: JobHistoryEntry[]; pipelinesScanned: number; pageInfo: { hasNextPage: boolean; endCursor: string | null } }
) => {
  registry.set(jobHistoryDataAtom, result.history);
  registry.set(jobHistoryPageStateAtom, {
    endCursor: result.pageInfo.endCursor,
    hasNextPage: result.pageInfo.hasNextPage,
    pipelinesScanned: result.pipelinesScanned,
    isLoadingMore: false,
  });
};

const triggerInitialFetch = (registry: Registry.Registry) => {
  registry.set(fetchJobHistoryAtom, 0);
  Effect.runPromiseExit(
    Registry.getResult(registry, fetchJobHistoryAtom, { suspendOnWaiting: true })
  ).then((exit) => {
    if (Exit.isSuccess(exit)) {
      applyFetchResult(registry, exit.value);
    }
  });
};

const sanitizeForFilename = (s: string) => s.replace(/[<>:"/\\|?*]/g, '_');

const buildDebugPrompt = (
  query: JobHistoryQuery,
  totalLoaded: number,
  localRepoPath: string | null,
  debugDir: string,
  jobs: readonly { job: JobHistoryEntry; logPath: string }[]
): string => {
  const sections = jobs.map(({ job, logPath }) => [
    `## Pipeline #${job.pipelineIid} — ${job.pipelineRef}`,
    '',
    `- **Commit**: \`${job.shortShaCommit || 'unknown'}\``,
    `- **Created**: ${job.pipelineCreatedAt}`,
    `- **Duration**: ${job.duration ? `${job.duration}s` : 'unknown'}`,
    job.failureMessage ? `- **Failure**: ${job.failureMessage}` : null,
    job.mergeRequestTitle ? `- **MR**: !${job.mergeRequestIid} ${job.mergeRequestTitle}` : null,
    job.runner ? `- **Runner**: ${job.runner.description || job.runner.shortSha}` : null,
    `- **Log**: \`${logPath}\``,
    ''
  ].filter(line => line !== null).join('\n'));

  return [
    `# Debug: Failed "${query.jobName}" runs`,
    '',
    `> ${jobs.length} failed run(s) out of ${totalLoaded} total loaded runs in \`${query.projectPath}\``,
    localRepoPath ? `> Local repository: \`${localRepoPath}\`` : null,
    `> Job logs directory: \`${debugDir}\``,
    '',
    'Analyze these failed CI job logs to find consistent error patterns and spot flaky tests.',
    'The log files are in the directory above. The commits referenced below can be inspected in the local repository.',
    '',
    '## Instructions',
    '1. **Extract the error message / failed test name** from each log file.',
    '2. **Group by error** — find which errors repeat across multiple jobs/branches.',
    '3. **Classify each error**:',
    '   - **Flaky test** — appears intermittently across unrelated branches or sometimes passes on the same branch.',
    '   - **Consistent failure** — appears reliably across multiple runs. Errors that also appear on `develop` are slightly more concerning as it is the main branch.',
    '   - **Branch-specific** — only appears on one feature branch. Likely a legitimate WIP issue — ignore these.',
    '4. **Output a summary table** (markdown) with columns: Error | Classification | Branches | Count',
    '5. **Verdict**: What are the real problems? Which errors are systemic vs one-off? Any flaky tests that need attention?',
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
    const setStatus = (msg: string | null) => get.registry.set(jobHistoryStatusAtom, msg);
    const query = get(jobHistoryQueryAtom);
    const history = get(jobHistoryDataAtom);
    const repoPaths = get(repositoryPathsAtom);

    if (!query) return;

    const localRepoPath = repoPaths[query.projectPath]?.localPath || null;

    const failedJobs = history.filter(e => e.jobStatus === 'FAILED');
    if (failedJobs.length === 0) {
      setStatus('No failed jobs to debug');
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const debugDir = join(process.cwd(), 'logs', 'debug', `${sanitizeForFilename(query.jobName)}_${timestamp}`);
    if (!existsSync(debugDir)) mkdirSync(debugDir, { recursive: true });

    const downloaded: { job: JobHistoryEntry; logPath: string }[] = [];
    const errors: { job: JobHistoryEntry; error: string }[] = [];

    for (let i = 0; i < failedJobs.length; i++) {
      const job = failedJobs[i]!;
      setStatus(`Downloading log ${i + 1}/${failedJobs.length} (pipeline #${job.pipelineIid})...`);
      const mr = { project: { path: '', fullPath: query.projectPath }, sourcebranch: job.pipelineRef };
      const jobRef = { id: job.jobId, name: job.jobName, localId: job.pipelineIid };
      try {
        yield* downloadJobTrace(mr, jobRef, debugDir);
        downloaded.push({ job, logPath: getJobLogPath(mr, jobRef, debugDir) });
        yield* Console.log(`[Debug] Downloaded ${i + 1}/${failedJobs.length}`);
      } catch (err) {
        errors.push({ job, error: String(err) });
        yield* Console.log(`[Debug] Failed ${i + 1}/${failedJobs.length}: ${String(err)}`);
      }
    }

    yield* Console.log(`[Debug] Done: ${downloaded.length} downloaded, ${errors.length} failed`);

    if (errors.length > 0) {
      setStatus(`${errors.length} log(s) failed. Building prompt with ${downloaded.length}...`);
    }

    setStatus('Building debug prompt...');

    const prompt = buildDebugPrompt(query, history.length, localRepoPath, debugDir, downloaded);
    const promptPath = join(debugDir, 'prompt.md');
    writeFileSync(promptPath, prompt, 'utf8');

    yield* Console.log(`[Debug] Prompt saved to ${promptPath}`);
    setStatus(`Saved to ${debugDir}`);

    if (process.platform === 'win32') {
      spawn('start', ['', promptPath], { shell: true, detached: true, stdio: 'ignore' });
    } else if (process.platform === 'darwin') {
      spawn('open', [promptPath], { detached: true, stdio: 'ignore' });
    } else {
      spawn('xdg-open', [promptPath], { detached: true, stdio: 'ignore' });
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

interface JobHistoryModalProps {
  onClose: () => void;
}

export default function JobHistoryModal({
  onClose
}: JobHistoryModalProps) {
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  const registry = React.useContext(RegistryContext);
  const query = useAtomValue(jobHistoryQueryAtom);
  const jobHistory = useAtomValue(jobHistoryDataAtom);
  const pageState = useAtomValue(jobHistoryPageStateAtom);
  const statusMessage = useAtomValue(jobHistoryStatusAtom);
  const setGenerateDebugPromptAtom = useAtomSet(generateDebugPromptAtom);

  const initialFetchDone = React.useRef(false);
  React.useEffect(() => {
    if (initialFetchDone.current) return;
    initialFetchDone.current = true;
    const existingQuery = registry.get(jobHistoryQueryAtom);
    if (!existingQuery) {
      const derived = resolveQueryFromContext(registry);
      if (derived) {
        registry.set(jobHistoryQueryAtom, derived);
      }
    }
    triggerInitialFetch(registry);
  }, []);

  const { scrollBoxRef, scrollToItem } = useAutoScroll({
    lookahead: 2,
  });

  useKeyboard((key: ParsedKey) => {
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
      console.log("things", { pageState, query })

      if (pageState.hasNextPage && query && !pageState.isLoadingMore) {
        registry.set(jobHistoryPageStateAtom, { ...pageState, isLoadingMore: true });
        registry.set(loadMoreJobHistoryAtom, { query, endCursor: pageState.endCursor, currentHistory: jobHistory });
        Effect.runPromiseExit(
          Registry.getResult(registry, loadMoreJobHistoryAtom, { suspendOnWaiting: true })
        ).then((exit) => {
          if (Exit.isSuccess(exit)) {
            const currentPageState = registry.get(jobHistoryPageStateAtom);
            registry.set(jobHistoryDataAtom, exit.value.history);
            registry.set(jobHistoryPageStateAtom, {
              endCursor: exit.value.pageInfo.endCursor,
              hasNextPage: exit.value.pageInfo.hasNextPage,
              pipelinesScanned: currentPageState.pipelinesScanned + exit.value.pipelinesScanned,
              isLoadingMore: false,
            });
          } else {
            registry.set(jobHistoryPageStateAtom, { ...registry.get(jobHistoryPageStateAtom), isLoadingMore: false });
          }
        });
      }
    } else if (key.name === 'd') {
      setGenerateDebugPromptAtom();
    } else if (key.name === 'return') {
      const selectedEntry = jobHistory[selectedIndex];
      if (selectedEntry) {
        registry.set(openJobLogFromHistoryAtom, selectedEntry);
      }
    } else if (key.name === 'x') {
      const selectedEntry = jobHistory[selectedIndex];
      if (selectedEntry?.webPath) {
        const { spawn } = require('child_process');
        const url = `${getGitlabBaseUrl()}${selectedEntry.webPath}`;
        const command = process.platform === 'win32' ? 'start' :
                       process.platform === 'darwin' ? 'open' : 'xdg-open';
        spawn(command, [url], { shell: true, detached: true, stdio: 'ignore' });
      }
    }

  });

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
        <box style={{ paddingLeft: 1, paddingTop: 1, flexShrink: 0, flexDirection: 'column' }}>
          <text style={{ fg: Colors.PRIMARY, attributes: TextAttributes.BOLD }} wrapMode='none'>
            {`Job History: ${query?.jobName ?? '?'} (${totalRuns} runs)`}
          </text>
          <text style={{ fg: Colors.SUPPORTING }} wrapMode='none'>
            {`${pageState.pipelinesScanned} scanned · ${developRuns} develop · ${failedRuns} failed${pageState.isLoadingMore ? ' · loading...' : pageState.hasNextPage ? ' · more available' : ''}`}
          </text>
          {statusMessage && (
            <text style={{ fg: Colors.INFO }} wrapMode='none'>
              {statusMessage}
            </text>
          )}
          <text>{''}</text>
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
            jobHistory.map((entry, index) => {
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
              })
          )}
        </scrollbox>

        {/* Footer */}
        <box style={{ paddingLeft: 1, paddingBottom: 1, flexShrink: 0 }}>
          <text style={{ fg: Colors.PRIMARY }} wrapMode='none'>
            {[
              'j/k',
              'enter: open',
              pageState.hasNextPage ? 'm: more' : null,
              'd: debug',
              'esc: close',
            ].filter(Boolean).join(' · ')}
          </text>
        </box>
      </box>
  );
}
