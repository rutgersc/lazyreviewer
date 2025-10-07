import { useState, useEffect } from 'react';
import { TextAttributes } from '@opentui/core';

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
}

export default function ConsolePane({ isActive }: { isActive: boolean }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    // Capture console.log, console.warn, console.error
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    const addLog = (level: LogEntry['level'], args: any[]) => {
      const message = args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');

      const logEntry: LogEntry = {
        timestamp: new Date().toLocaleTimeString(),
        level,
        message
      };

      setLogs(prevLogs => {
        const newLogs = [...prevLogs, logEntry];
        // Keep only last 100 log entries
        return newLogs.slice(-100);
      });
    };

    console.log = (...args) => {
      originalLog(...args);
      addLog('info', args);
    };

    console.warn = (...args) => {
      originalWarn(...args);
      addLog('warn', args);
    };

    console.error = (...args) => {
      originalError(...args);
      addLog('error', args);
    };

    // Cleanup on unmount
    return () => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    };
  }, []);

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
      <text style={{ fg: '#f8f8f2', marginBottom: 1, attributes: TextAttributes.BOLD }} wrap={false}>
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
          <text style={{ fg: '#bd93f9', padding: 1 }} wrap={false}>
            No console output yet...
          </text>
        ) : (
          logs.map((log, index) => (
            <box key={index} style={{ flexDirection: "row", gap: 1, paddingLeft: 1, paddingRight: 1 }}>
              <text style={{ fg: '#bd93f9' }} wrap={false}>
                {`[${log.timestamp}]`}
              </text>
              <text style={{ fg: getLogColor(log.level), attributes: TextAttributes.BOLD }} wrap={false}>
                {`[${log.level.toUpperCase()}]`}
              </text>
              <text style={{ fg: '#f8f8f2' }} wrap={false}>
                {log.message}
              </text>
            </box>
          ))
        )}
      </scrollbox>
    </box>
  );
}