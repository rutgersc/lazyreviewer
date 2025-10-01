import type { CiJobStatus } from '../generated/gitlab-sdk';
import { Colors } from '../constants/colors';

export interface JobStatusDisplay {
  symbol: string;
  color: string;
  description: string;
}

export function getJobStatusDisplay(status: CiJobStatus): JobStatusDisplay {
  switch (status) {
    case 'SUCCESS':
      return { symbol: '●', color: Colors.SUCCESS, description: 'Success' };
    case 'RUNNING':
      return { symbol: '◐', color: Colors.INFO, description: 'Running' };
    case 'PENDING':
      return { symbol: '◯', color: Colors.SECONDARY, description: 'Pending' };
    case 'FAILED':
      return { symbol: '●', color: Colors.ERROR, description: 'Failed' };
    case 'CANCELED':
      return { symbol: '○', color: Colors.NEUTRAL, description: 'Canceled' };
    case 'CANCELING':
      return { symbol: '○', color: Colors.WARNING, description: 'Canceling' };
    case 'SKIPPED':
      return { symbol: '○', color: Colors.NEUTRAL, description: 'Skipped' };
    case 'MANUAL':
      return { symbol: '●', color: Colors.WARNING, description: 'Manual' };
    case 'SCHEDULED':
      return { symbol: '○', color: Colors.INFO, description: 'Scheduled' };
    case 'PREPARING':
      return { symbol: '◔', color: Colors.SECONDARY, description: 'Preparing' };
    case 'WAITING_FOR_CALLBACK':
      return { symbol: '◑', color: Colors.SECONDARY, description: 'Waiting for callback' };
    case 'CREATED':
      return { symbol: '◯', color: Colors.PRIMARY, description: 'Created' };
    default:
      return { symbol: '○', color: Colors.NEUTRAL, description: 'Unknown' };
  }
}