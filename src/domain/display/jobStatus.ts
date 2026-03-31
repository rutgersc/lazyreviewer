import type { CiJobStatus } from '../ci-status';
import { Colors, getColorScheme } from '../../colors';
import { TextAttributes } from '@opentui/core';

export interface JobStatusDisplay {
  symbol: string;
  color: string;
  description: string;
  attributes?: number
}

// DIM works well in dark mode (tones down bright colors) but crushes
// already-dark colors in light mode, making them nearly invisible.
const dimIfDark = (): Pick<JobStatusDisplay, 'attributes'> =>
  getColorScheme() === 'dark' ? { attributes: TextAttributes.DIM } : {};

export function getJobStatusDisplay(status: CiJobStatus): JobStatusDisplay {
  switch (status) {
    case 'SUCCESS':
      return { symbol: '■', color: Colors.SUCCESS, description: 'Success', ...dimIfDark() };
    case 'RUNNING':
      return { symbol: '◧', color: Colors.INFO, description: 'Running' };
    case 'PENDING':
      return { symbol: '□', color: Colors.PRIMARY, description: 'Pending', ...dimIfDark() };
    case 'FAILED':
      return { symbol: '■', color: Colors.ERROR, description: 'Failed' };
    case 'CANCELED':
      return { symbol: '□', color: Colors.NEUTRAL, description: 'Canceled', ...dimIfDark() };
    case 'CANCELING':
      return { symbol: '◨', color: Colors.WARNING, description: 'Canceling', ...dimIfDark() };
    case 'SKIPPED':
      return { symbol: '□', color: Colors.PRIMARY, description: 'Skipped', ...dimIfDark() };
    case 'MANUAL':
      return { symbol: '■', color: Colors.WARNING, description: 'Manual', ...dimIfDark() };
    case 'SCHEDULED':
      return { symbol: '□', color: Colors.INFO, description: 'Scheduled', ...dimIfDark() };
    case 'PREPARING':
      return { symbol: '▣', color: Colors.SECONDARY, description: 'Preparing', ...dimIfDark() };
    case 'WAITING_FOR_CALLBACK':
      return { symbol: '◫', color: Colors.SECONDARY, description: 'Waiting for callback', ...dimIfDark() };
    case 'CREATED':
      return { symbol: '□', color: Colors.PRIMARY, description: 'Created', ...dimIfDark() };
    default:
      return { symbol: '□', color: Colors.NEUTRAL, description: 'Unknown', ...dimIfDark() };
  }
}
