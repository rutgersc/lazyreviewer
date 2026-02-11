import { TextAttributes, type ParsedKey } from '@opentui/core';
import { useKeyboard } from '@opentui/react';
import { useAtomValue } from '@effect-atom/atom-react';
import { Effect } from 'effect';
import { Colors } from '../colors';
import { notificationSettingsAtom, backgroundSyncSettingsAtom } from '../settings/settings-atom';
import { openFileInEditor } from '../utils/open-file';
import { appLayer } from '../appLayerRuntime';

interface NotificationsPageProps {
  onClose: () => void;
}

const COL1 = 22;
const COL2 = 44;
const COL3 = 42;

const changeTrackingRows: readonly { type: string; title: string; filter: string }[] = [
  { type: 'New MR',             title: '{author} created MR {name}',               filter: 'always' },
  { type: 'Merged MR',          title: '{name} merged',                             filter: 'always' },
  { type: 'Closed MR',          title: '{name} closed',                             filter: 'always' },
  { type: 'Reopened MR',        title: '{name} got reopened',                       filter: 'always' },
  { type: 'Diff comment',       title: '{author} commented on {name}',             filter: 'your MR or your thread' },
  { type: 'Discussion comment', title: '{author} commented on {name}',             filter: 'your MR or your thread' },
  { type: 'Jira comment',       title: '{author} commented on {issueKey}',         filter: 'related ticket, not you' },
  { type: 'Jira status change', title: 'status of {issueKey} changed to {status}', filter: 'always' },
];

const pipelineRows: readonly { event: string; title: string; body: string }[] = [
  { event: 'Job failed',      title: '{job}: FAILED (ok,fail)/total', body: '{project}!{iid}' },
  { event: 'All jobs passed', title: 'Pipeline SUCCESS',              body: '{project}!{iid} - all {N} jobs passed' },
];

const pad = (s: string, width: number) => s + ' '.repeat(Math.max(0, width - s.length));

export default function NotificationsPage({ onClose }: NotificationsPageProps) {
  const notificationSettings = useAtomValue(notificationSettingsAtom);
  const backgroundSyncSettings = useAtomValue(backgroundSyncSettingsAtom);

  useKeyboard((key: ParsedKey) => {
    switch (key.name) {
      case 'escape':
      case 'q':
        onClose();
        break;
      case 'e':
        Effect.runPromise(
          openFileInEditor('lazygitlab-settings.json').pipe(Effect.provide(appLayer))
        );
        break;
    }
  });

  const onOffText = (enabled: boolean) => (
    <text
      style={{ fg: enabled ? Colors.SUCCESS : Colors.ERROR, attributes: TextAttributes.BOLD }}
      wrapMode='none'
    >
      {enabled ? 'ON' : 'OFF'}
    </text>
  );

  return (
    <box
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: Colors.BACKGROUND,
        flexDirection: 'column',
        zIndex: 1000,
      }}
    >
      <box style={{ flexDirection: 'column', padding: 1 }}>
        {/* Header */}
        <box style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <text style={{ fg: '#ff79c6', attributes: TextAttributes.BOLD }} wrapMode='none'>
            Notifications
          </text>
          <text style={{ fg: Colors.SUPPORTING }} wrapMode='none'>
            q: close | e: edit settings
          </text>
        </box>
        <text style={{ fg: Colors.NEUTRAL }} wrapMode='none'>
          {'─'.repeat(100)}
        </text>

        {/* Status */}
        <box style={{ flexDirection: 'column', paddingTop: 1, paddingLeft: 2 }}>
          <box style={{ flexDirection: 'row', gap: 1 }}>
            <text style={{ fg: Colors.PRIMARY }} wrapMode='none'>System Notifications</text>
            {onOffText(notificationSettings.enabled)}
          </box>
          <box style={{ flexDirection: 'row', gap: 1 }}>
            <text style={{ fg: Colors.PRIMARY }} wrapMode='none'>Background Sync</text>
            {onOffText(backgroundSyncSettings.enabled)}
          </box>
          <text style={{ fg: Colors.SUPPORTING, marginTop: 1 }} wrapMode='none'>
            Press 'e' to open settings file to toggle these.
          </text>
        </box>

        {/* Change Tracking table */}
        <box style={{ flexDirection: 'column', paddingTop: 1 }}>
          <text style={{ fg: Colors.NEUTRAL, attributes: TextAttributes.BOLD }} wrapMode='none'>
            ── Change Tracking (requires background sync) ──
          </text>
          <box style={{ flexDirection: 'column', paddingLeft: 2, paddingTop: 1 }}>
            {/* Table header */}
            <text style={{ fg: Colors.INFO, attributes: TextAttributes.BOLD }} wrapMode='none'>
              {pad('Change Type', COL1)}{pad('Notification Title', COL2)}{pad('When', COL3)}
            </text>
            <text style={{ fg: Colors.NEUTRAL }} wrapMode='none'>
              {'─'.repeat(COL1 + COL2 + COL3)}
            </text>
            {changeTrackingRows.map(row => (
              <box key={row.type} style={{ flexDirection: 'row' }}>
                <text style={{ fg: Colors.WARNING, width: COL1 }} wrapMode='none'>{row.type}</text>
                <text style={{ fg: Colors.PRIMARY, width: COL2 }} wrapMode='none'>{row.title}</text>
                <text style={{ fg: Colors.SUPPORTING }} wrapMode='none'>{row.filter}</text>
              </box>
            ))}
          </box>
          <text style={{ fg: Colors.SUPPORTING, paddingLeft: 2, marginTop: 1 }} wrapMode='none'>
            Your own actions are always skipped. Comments notify only on MRs you authored or threads you participated in.
          </text>
        </box>

        {/* Pipeline Monitor table */}
        <box style={{ flexDirection: 'column', paddingTop: 1 }}>
          <text style={{ fg: Colors.NEUTRAL, attributes: TextAttributes.BOLD }} wrapMode='none'>
            ── Pipeline Job Monitor (requires monitored jobs) ──
          </text>
          <box style={{ flexDirection: 'column', paddingLeft: 2, paddingTop: 1 }}>
            {/* Table header */}
            <text style={{ fg: Colors.INFO, attributes: TextAttributes.BOLD }} wrapMode='none'>
              {pad('Event', COL1)}{pad('Title', COL2)}{pad('Body', COL3)}
            </text>
            <text style={{ fg: Colors.NEUTRAL }} wrapMode='none'>
              {'─'.repeat(COL1 + COL2 + COL3)}
            </text>
            {pipelineRows.map(row => (
              <box key={row.event} style={{ flexDirection: 'row' }}>
                <text style={{ fg: Colors.WARNING, width: COL1 }} wrapMode='none'>{row.event}</text>
                <text style={{ fg: Colors.PRIMARY, width: COL2 }} wrapMode='none'>{row.title}</text>
                <text style={{ fg: Colors.SUPPORTING }} wrapMode='none'>{row.body}</text>
              </box>
            ))}
          </box>
        </box>
      </box>
    </box>
  );
}
