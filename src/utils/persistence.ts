import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { UserSelectionState } from '../types/userSelection';

const STATE_FILE = 'lazygitlab-state.json';

export interface PersistedState {
  userSelection: UserSelectionState;
}

/**
 * Save the current user selection state to disk
 * @param state The user selection state to save
 */
export const saveState = (state: UserSelectionState): void => {
  try {
    const persistedState: PersistedState = {
      userSelection: state
    };
    
    writeFileSync(STATE_FILE, JSON.stringify(persistedState, null, 2), 'utf8');
  } catch (error) {
    console.error('Failed to save state:', error);
  }
};

/**
 * Load the user selection state from disk
 * @param fallbackState Default state to use if file doesn't exist or is invalid
 * @returns The loaded state or the fallback state
 */
export const loadState = (fallbackState: UserSelectionState): UserSelectionState => {
  try {
    if (!existsSync(STATE_FILE)) {
      return fallbackState;
    }
    
    const fileContent = readFileSync(STATE_FILE, 'utf8');
    const persistedState: PersistedState = JSON.parse(fileContent);
    
    // Validate that the loaded state has the expected structure
    if (persistedState.userSelection && 
        typeof persistedState.userSelection.selectedIndex !== 'undefined') {
      return persistedState.userSelection;
    }
    
    return fallbackState;
  } catch (error) {
    console.error('Failed to load state:', error);
    return fallbackState;
  }
};