// Dracula theme color palette
// Single source of truth for all UI colors

export const Colors = {
  // Status colors
  SUCCESS: '#50fa7b',    // green - for approvals, resolved discussions, successful jobs, positive Jira status
  ERROR: '#ff5555',      // red - for failures, unresolved discussions, failed jobs
  WARNING: '#ffb86c',    // orange - for neutral/pending states
  INFO: '#8be9fd',       // cyan - for branches, running states
  NEUTRAL: '#bd93f9',    // purple - for inactive/neutral states
  SUPPORTING: '#8c9ac4', // brighter grey - for dim/supporting elements

  // Text colors
  PRIMARY: '#f8f8f2',    // white - primary text
  SECONDARY: '#f1fa8c',  // yellow - secondary text like timestamps

  // Background colors
  BACKGROUND: '#282a36',
  SELECTED: '#191a21',
  STRIPE: '#343746',
  TRACK: '#44475a',
} as const;