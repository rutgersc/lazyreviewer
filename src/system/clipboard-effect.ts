import { spawn } from 'child_process';

/**
 * Copies text to the system clipboard using platform-specific commands
 * @param text The text to copy to clipboard
 * @returns Promise that resolves to true if successful, false otherwise
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  return new Promise((resolve) => {
    // Use platform-specific clipboard command
    const isWindows = process.platform === 'win32';
    const command = isWindows ? 'clip' : 'pbcopy';
    const proc = spawn(command, [], { stdio: 'pipe' });
    
    proc.stdin.write(text);
    proc.stdin.end();
    
    proc.on('close', (code) => {
      resolve(code === 0);
    });
    
    proc.on('error', () => {
      resolve(false);
    });
  });
};