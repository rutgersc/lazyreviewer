import { writeFileSync, readFileSync, existsSync } from 'fs';
import { spawn } from 'child_process';

const SETTINGS_FILE = 'lazygitlab-settings.json';

export interface Settings {
  repositoryPaths: Record<string, string>;
  ignoredMergeRequests: string[];
}

const defaultSettings: Settings = {
  repositoryPaths: {},
  ignoredMergeRequests: []
};

export const loadSettings = (): Settings => {
  try {
    if (!existsSync(SETTINGS_FILE)) {
      saveSettings(defaultSettings);
      return defaultSettings;
    }

    const fileContent = readFileSync(SETTINGS_FILE, 'utf8');
    const settings: Settings = JSON.parse(fileContent);

    return {
      ...defaultSettings,
      ...settings
    };
  } catch (error) {
    console.error('Failed to load settings:', error);
    return defaultSettings;
  }
};

export const saveSettings = (settings: Settings): void => {
  try {
    writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
};

export const openSettingsFile = (): void => {
  if (!existsSync(SETTINGS_FILE)) {
    saveSettings(defaultSettings);
  }

  const isWindows = process.platform === 'win32';
  const isMac = process.platform === 'darwin';

  if (isWindows) {
    spawn('cmd', ['/c', 'start', '""', SETTINGS_FILE], { detached: true, stdio: 'ignore' });
  } else if (isMac) {
    spawn('open', [SETTINGS_FILE], { detached: true, stdio: 'ignore' });
  } else {
    spawn('xdg-open', [SETTINGS_FILE], { detached: true, stdio: 'ignore' });
  }
};