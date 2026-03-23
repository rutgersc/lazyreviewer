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
const dimIfDark = (): number | undefined =>
  getColorScheme() === 'dark' ? TextAttributes.DIM : undefined;

export function getJobStatusDisplay(status: CiJobStatus): JobStatusDisplay {
  switch (status) {
    case 'SUCCESS':
      return { symbol: '■', color: Colors.SUCCESS, description: 'Success', attributes: dimIfDark() };
    case 'RUNNING':
      return { symbol: '◧', color: Colors.INFO, description: 'Running', attributes: undefined };
    case 'PENDING':
      return { symbol: '□', color: Colors.PRIMARY, description: 'Pending', attributes: dimIfDark() };
    case 'FAILED':
      return { symbol: '■', color: Colors.ERROR, description: 'Failed', attributes: undefined };
    case 'CANCELED':
      return { symbol: '□', color: Colors.NEUTRAL, description: 'Canceled', attributes: dimIfDark() };
    case 'CANCELING':
      return { symbol: '◨', color: Colors.WARNING, description: 'Canceling', attributes: dimIfDark() };
    case 'SKIPPED':
      return { symbol: '□', color: Colors.PRIMARY, description: 'Skipped', attributes: dimIfDark() };
    case 'MANUAL':
      return { symbol: '■', color: Colors.WARNING, description: 'Manual', attributes: dimIfDark() };
    case 'SCHEDULED':
      return { symbol: '□', color: Colors.INFO, description: 'Scheduled', attributes: dimIfDark() };
    case 'PREPARING':
      return { symbol: '▣', color: Colors.SECONDARY, description: 'Preparing', attributes: dimIfDark() };
    case 'WAITING_FOR_CALLBACK':
      return { symbol: '◫', color: Colors.SECONDARY, description: 'Waiting for callback', attributes: dimIfDark() };
    case 'CREATED':
      return { symbol: '□', color: Colors.PRIMARY, description: 'Created', attributes: dimIfDark() };
    default:
      return { symbol: '□', color: Colors.NEUTRAL, description: 'Unknown', attributes: dimIfDark() };
  }
}
