import { TextAttributes } from '@opentui/core';
import { useAtomValue } from '@effect-atom/atom-react';
import { Result } from '@effect-atom/atom-react';
import { consoleLogsAtom, type LogEntry } from '../logging/logging-atom';

export default function ConsolePane({ isActive }: { isActive: boolean }) {
  const logsResult = useAtomValue(consoleLogsAtom);

  const logs = Result.match(logsResult, {
    onInitial: () => [],
    onSuccess: (success) => success.value,
    onFailure: () => []
  });

  const getLogColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'error': return '#ff5555';
      case 'warn': return '#ffb86c';
      case 'info': return '#8be9fd';
      case 'debug': return '#bd93f9';
      default: return '#f8f8f2';
    }
  };

  return (
    <box style={{ flexDirection: "column", height: "100%", paddingLeft: 1 }}>
      <text style={{ fg: '#f8f8f2', marginBottom: 1, attributes: TextAttributes.BOLD }} wrapMode='none'>
        Console Output (~)
      </text>

      <scrollbox
        style={{
          contentOptions: {
            backgroundColor: '#282a36',
          },
          viewportOptions: {
            backgroundColor: '#282a36',
          },
          scrollbarOptions: {
            trackOptions: {
              foregroundColor: '#bd93f9',
              backgroundColor: '#44475a',
            },
          },
        }}
        stickyScroll={true}
        stickyStart="bottom"
        focused={isActive}
      >
        {logs.length === 0 ? (
          <text style={{ fg: '#bd93f9', padding: 1 }} wrapMode='none'>
            No console output yet...
          </text>
        ) : (
          logs.map((log, index) => (
            <box key={index} style={{ flexDirection: "row", gap: 1, paddingLeft: 1, paddingRight: 1 }}>
              <text style={{ fg: '#bd93f9' }} wrapMode='none'>
                {`[${log.timestamp}]`}
              </text>
              <text style={{ fg: getLogColor(log.level), attributes: TextAttributes.BOLD }} wrapMode='none'>
                {`[${log.level.toUpperCase()}]`}
              </text>
              <text style={{ fg: '#f8f8f2' }} wrapMode='none'>
                {log.message}
              </text>
            </box>
          ))
        )}
      </scrollbox>
    </box>
  );
}