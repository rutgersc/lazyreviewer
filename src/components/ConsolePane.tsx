import { TextAttributes } from '@opentui/core';
import { useConsoleLogs, type LogEntry } from '../logging/logging-atom';
import { Colors } from '../colors';

const getLogColor = (level: LogEntry['level']) => {
  switch (level) {
    case 'error': return Colors.ERROR;
    case 'warn': return Colors.WARNING;
    case 'info': return Colors.INFO;
    case 'debug': return Colors.NEUTRAL;
    default: return Colors.PRIMARY;
  }
};

export default function ConsolePane({ isActive }: { isActive: boolean }) {
  const logs = useConsoleLogs();

  return (
    <box style={{ flexDirection: "column", height: "100%", paddingLeft: 1 }}>
      <text style={{ fg: Colors.PRIMARY, marginBottom: 1, attributes: TextAttributes.BOLD }} wrapMode='none'>
        Console Output (~)
      </text>

      <scrollbox
        style={{
          contentOptions: {
            backgroundColor: Colors.BACKGROUND,
          },
          viewportOptions: {
            backgroundColor: Colors.BACKGROUND,
          },
          scrollbarOptions: {
            trackOptions: {
              foregroundColor: Colors.NEUTRAL,
              backgroundColor: Colors.TRACK,
            },
          },
        }}
        stickyScroll={true}
        stickyStart="bottom"
        focused={isActive}
      >
        {logs.length === 0 ? (
          <text style={{ fg: Colors.NEUTRAL, padding: 1 }} wrapMode='none'>
            No console output yet...
          </text>
        ) : (
          logs.map((log, index) => (
            <box key={index} style={{ flexDirection: "row", gap: 1, paddingLeft: 1, paddingRight: 1 }}>
              <text style={{ fg: Colors.NEUTRAL }} wrapMode='none'>
                {`[${log.timestamp}]`}
              </text>
              <text style={{ fg: getLogColor(log.level), attributes: TextAttributes.BOLD }} wrapMode='none'>
                {`[${log.level.toUpperCase()}]`}
              </text>
              <text style={{ fg: Colors.PRIMARY }} wrapMode='none'>
                {log.message}
              </text>
            </box>
          ))
        )}
      </scrollbox>
    </box>
  );
}
