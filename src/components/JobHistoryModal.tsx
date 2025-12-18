import React from 'react';
import { TextAttributes, type ParsedKey } from '@opentui/core';
import { useKeyboard } from '@opentui/react';
import { getJobStatusDisplay } from '../gitlab/display/jobStatus';
import { Colors } from '../colors';
import { jobHistoryDataAtom, jobHistoryLoadingAtom, selectedJobForHistoryAtom, jobHistoryHasNextPageAtom, jobHistoryEndCursorAtom, loadMoreJobHistoryAtom } from '../mergerequests/job-atom';
import { useAtomValue, useAtomSet, useAtom } from '@effect-atom/atom-react';
import { useAutoScroll } from '../hooks/useAutoScroll';

interface JobHistoryModalProps {
  isVisible: boolean;
  onClose: () => void;
}

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

  const jobName = useAtomValue(selectedJobForHistoryAtom);
  const jobHistory = useAtomValue(jobHistoryDataAtom);
  const isLoading = useAtomValue(jobHistoryLoadingAtom);
  const hasNextPage = useAtomValue(jobHistoryHasNextPageAtom);
  const setJobHistoryData = useAtomSet(jobHistoryDataAtom);
  const setJobHistoryEndCursor = useAtomSet(jobHistoryEndCursorAtom);
  const setJobHistoryHasNextPage = useAtomSet(jobHistoryHasNextPageAtom);
  const runLoadMore = useAtomSet(loadMoreJobHistoryAtom, { mode: 'promiseExit' });

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
      if (hasNextPage) {
        runLoadMore().then((exit) => {
          if (exit._tag === 'Success') {
            const { history, pageInfo } = exit.value;
            setJobHistoryData(history);
            setJobHistoryEndCursor(pageInfo.endCursor);
            setJobHistoryHasNextPage(pageInfo.hasNextPage);
          }
        });
      }
    } else if (key.name === 'return') {
      const selectedEntry = jobHistory[selectedIndex];
      if (selectedEntry?.webPath) {
        const { spawn } = require('child_process');
        const url = `https://git.elabnext.com${selectedEntry.webPath}`;
        const command = process.platform === 'win32' ? 'start' :
                       process.platform === 'darwin' ? 'open' : 'xdg-open';
        spawn(command, [url], { shell: true, detached: true, stdio: 'ignore' });
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
        backgroundColor: 'transparent',
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000
      }}
    >
      <box
        style={{
          width: '90%',
          height: '85%',
          border: true,
          borderColor: Colors.NEUTRAL,
          backgroundColor: Colors.BACKGROUND,
          flexDirection: 'column',
          overflow: 'hidden'
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
          {isLoading ? (
            <text style={{ fg: Colors.NEUTRAL, attributes: TextAttributes.DIM }} wrapMode='none'>
              Loading job history...
            </text>
          ) : jobHistory.length === 0 ? (
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

                      {/* Runner */}
                      <text style={{ fg: Colors.SUPPORTING, width: 20 }} wrapMode='none'>
                        {entry.runnerDescription || entry.runnerShortSha
                          ? `${entry.runnerShortSha ? `(${entry.runnerShortSha}) ` : ''}${entry.runnerDescription || '-'}`
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
            {`${totalRuns} loaded · ${developRuns} on develop · ${failedRuns} failures${hasNextPage ? ' · more available' : ' · all loaded'}`}
          </text>
          <text style={{ fg: Colors.NEUTRAL, attributes: TextAttributes.DIM }} wrapMode='none'>
            {hasNextPage ? 'j/k: navigate • enter: open • m: load more • esc: close' : 'j/k: navigate • enter: open • esc: close'}
          </text>
        </box>
      </box>
    </box>
  );
}
