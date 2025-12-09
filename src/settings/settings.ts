import { writeFileSync, readFileSync, existsSync } from 'fs';
import { openFileInEditor } from '../utils/open-file';
import { Effect } from 'effect';
import { appLayer } from '../appLayerRuntime';

const SETTINGS_FILE = 'lazygitlab-settings.json';

export type JobImportance = 'ignore' | 'low' | 'high';

export interface NotificationSettings {
  enabled: boolean;
  syncIntervalSeconds: number;
  syncUserSelectionEntryId?: string;
  lastProcessedEventId?: string;
}

export interface Settings {
  repositoryPaths: Record<string, string>;
  repositoryColors: Record<string, string>;
  ignoredMergeRequests: string[];
  seenMergeRequests: string[];
  pipelineJobImportance: Record<string, Record<string, JobImportance>>;
  selectedUserSelectionEntryId?: string;
  currentUser: string;
  notifications: NotificationSettings;
}

export const defaultNotificationSettings: NotificationSettings = {
  enabled: false,
  syncIntervalSeconds: 60 * 15
};

export const defaultSettings: Settings = {
  repositoryPaths: {},
  repositoryColors: {},
  ignoredMergeRequests: [],
  seenMergeRequests: [],
  pipelineJobImportance: {},
  currentUser: 'r.schoorstra',
  notifications: defaultNotificationSettings
};

// Color palette for repository colors - Dracula-compatible colors
const REPOSITORY_COLOR_PALETTE = [
  '#ff5555', // Dracula Red
  '#50fa7b', // Dracula Green
  '#8be9fd', // Dracula Cyan
  '#bd93f9', // Dracula Purple
  '#f1fa8c', // Dracula Yellow
  '#ffb86c', // Dracula Orange
  '#ff79c6', // Dracula Pink
  '#8c9ac4', // Dracula Supporting (brighter grey)
  '#6272a4', // Dracula Comment (darker grey-blue)
  '#44475a', // Dracula Current Line (medium grey)
  '#f8f8f2', // Dracula Foreground (white)
  '#282a36', // Dracula Background (dark)
  '#ff6e6e', // Lighter red variant
  '#5af78e', // Lighter green variant
  '#9aedfe', // Lighter cyan variant
  '#caa9fa', // Lighter purple variant
];

// Generate a color for a repository based on its name
const generateRepositoryColor = (repositoryPath: string): string => {
  // Simple hash function to consistently assign colors based on repository path
  let hash = 0;
  for (let i = 0; i < repositoryPath.length; i++) {
    const char = repositoryPath.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  const colorIndex = Math.abs(hash) % REPOSITORY_COLOR_PALETTE.length;
  return REPOSITORY_COLOR_PALETTE[colorIndex] || '#ff5555';
};

export const loadSettings = (): Settings => {
  try {
    if (!existsSync(SETTINGS_FILE)) {
      saveSettings(defaultSettings);
      return defaultSettings;
    }

    const fileContent = readFileSync(SETTINGS_FILE, 'utf8');
    const settings: Partial<Settings> = JSON.parse(fileContent);

    return {
      ...defaultSettings,
      ...settings,
      // Deep merge for nested objects
      notifications: {
        ...defaultNotificationSettings,
        ...(settings.notifications || {})
      }
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

// Ensure repository colors exist for all repositories, generating them if needed
export const ensureRepositoryColors = (repositoryPaths: string[]): Settings => {
  const settings = loadSettings();
  let settingsUpdated = false;

  repositoryPaths.forEach(repoPath => {
    if (!settings.repositoryColors[repoPath]) {
      settings.repositoryColors[repoPath] = generateRepositoryColor(repoPath);
      settingsUpdated = true;
    }
  });

  if (settingsUpdated) {
    saveSettings(settings);
  }

  return settings;
};

export const ensurePipelineJobsInSettings = (mergeRequests: Array<{
  project: { fullPath: string };
  pipeline: { stage: Array<{ jobs: Array<{ name: string }> }> }
}>): Settings => {
  const settings = loadSettings();
  let settingsUpdated = false;

  mergeRequests.forEach(mr => {
    const repoPath = mr.project.fullPath;

    if (!settings.pipelineJobImportance[repoPath]) {
      settings.pipelineJobImportance[repoPath] = {};
      settingsUpdated = true;
    }

    const repoJobs = settings.pipelineJobImportance[repoPath];

    mr.pipeline.stage.forEach(stage => {
      stage.jobs.forEach(job => {
        if (!repoJobs[job.name]) {
          repoJobs[job.name] = 'low';
          settingsUpdated = true;
        }
      });
    });
  });

  if (settingsUpdated) {
    saveSettings(settings);
  }

  return settings;
};

export const openSettingsFile = async (): Promise<void> => {
  if (!existsSync(SETTINGS_FILE)) {
    saveSettings(defaultSettings);
  }

  await openFileInEditor(SETTINGS_FILE).pipe(
    Effect.provide(appLayer),
    Effect.runPromise
  );
};