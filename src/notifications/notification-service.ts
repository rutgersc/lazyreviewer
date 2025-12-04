import { Effect, Console } from 'effect';
import notifier from 'node-notifier';
import { platform } from 'os';

export interface NotificationPayload {
  title: string;
  body: string;
  subtitle?: string;
}

/**
 * Cross-platform system notification service.
 * Uses node-notifier for reliable cross-platform notifications:
 * - Windows: Native Windows notifications
 * - macOS: Native macOS notification center
 * - Linux: notify-send
 */
export const sendSystemNotification = Effect.fn("sendSystemNotification")(function* (
  payload: NotificationPayload
) {
  yield* Console.log(`[Notification] Sending: "${payload.title}" - ${payload.body}`);

  yield* Effect.tryPromise({
    try: () => sendNotificationForPlatform(payload),
    catch: (error) => {
      console.error('[Notification] Error details:', error);
      return new NotificationError({ cause: error });
    }
  });
});

class NotificationError extends Error {
  readonly _tag = 'NotificationError';
  constructor(options: { cause: unknown }) {
    super(`Failed to send notification: ${options.cause}`);
    this.cause = options.cause;
  }
}

function sendNotificationForPlatform(payload: NotificationPayload): Promise<void> {
  return new Promise((resolve, reject) => {
    const os = platform();

    notifier.notify(
      {
        title: payload.title,
        message: payload.body,
        sound: false,
        wait: false,
        appID: 'LazyGitLab',
        ...(os === 'darwin' && payload.subtitle ? { subtitle: payload.subtitle } : {})
      },
      (error, response) => {
        if (error) {
          console.error('[Notification] node-notifier error:', error);
          console.error('[Notification] response:', response);
          resolve();
        } else {
          resolve();
        }
      }
    );
  });
}

export const sendBatchNotification = Effect.fn("sendBatchNotification")(function* (
  newMrsCount: number,
  newCommentsCount: number
) {
  if (newMrsCount === 0 && newCommentsCount === 0) {
    return;
  }

  const parts: string[] = [];
  if (newMrsCount > 0) {
    parts.push(`${newMrsCount} new MR${newMrsCount > 1 ? 's' : ''}`);
  }
  if (newCommentsCount > 0) {
    parts.push(`${newCommentsCount} new comment${newCommentsCount > 1 ? 's' : ''}`);
  }

  yield* sendSystemNotification({
    title: '🔔 LazyGitLab Update',
    body: parts.join(', ')
  });
});
