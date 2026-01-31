import type { CiJobStatus } from '../ci-status';
import { Colors } from '../../colors';
import { TextAttributes } from '@opentui/core';

export interface JobStatusDisplay {
  symbol: string;
  color: string;
  description: string;
  attributes?: number
}

export function getJobStatusDisplay(status: CiJobStatus): JobStatusDisplay {
  switch (status) {
    case 'SUCCESS':
      return { symbol: '■', color: Colors.SUCCESS, description: 'Success', attributes: TextAttributes.DIM };
    case 'RUNNING':
      return { symbol: '◧', color: Colors.INFO, description: 'Running', attributes: undefined };
    case 'PENDING':
      return { symbol: '□', color: Colors.PRIMARY, description: 'Pending', attributes: TextAttributes.DIM };
    case 'FAILED':
      return { symbol: '■', color: Colors.ERROR, description: 'Failed', attributes: undefined };
    case 'CANCELED':
      return { symbol: '□', color: Colors.NEUTRAL, description: 'Canceled', attributes: TextAttributes.DIM };
    case 'CANCELING':
      return { symbol: '◨', color: Colors.WARNING, description: 'Canceling', attributes: TextAttributes.DIM };
    case 'SKIPPED':
      return { symbol: '□', color: Colors.PRIMARY, description: 'Skipped', attributes: TextAttributes.DIM };
    case 'MANUAL':
      return { symbol: '■', color: Colors.WARNING, description: 'Manual', attributes: TextAttributes.DIM };
    case 'SCHEDULED':
      return { symbol: '□', color: Colors.INFO, description: 'Scheduled', attributes: TextAttributes.DIM };
    case 'PREPARING':
      return { symbol: '▣', color: Colors.SECONDARY, description: 'Preparing', attributes: TextAttributes.DIM };
    case 'WAITING_FOR_CALLBACK':
      return { symbol: '◫', color: Colors.SECONDARY, description: 'Waiting for callback', attributes: TextAttributes.DIM };
    case 'CREATED':
      return { symbol: '□', color: Colors.PRIMARY, description: 'Created', attributes: TextAttributes.DIM };
    default:
      return { symbol: '□', color: Colors.NEUTRAL, description: 'Unknown', attributes: TextAttributes.DIM };
  }
}
