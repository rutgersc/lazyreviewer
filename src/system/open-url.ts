import { spawn } from 'child_process';

/**
 * Opens a URL in the default browser using platform-specific commands
 * @param url The URL to open
 */
export const openUrl = (url: string): void => {
  const isWindows = process.platform === 'win32';
  const isMac = process.platform === 'darwin';

  if (isWindows) {
    // On Windows, use start command via shell
    spawn(`start "" "${url}"`, { detached: true, stdio: 'ignore', shell: true });
  } else if (isMac) {
    spawn('open', [url], { detached: true, stdio: 'ignore' });
  } else {
    // Linux/Unix
    spawn('xdg-open', [url], { detached: true, stdio: 'ignore' });
  }
};