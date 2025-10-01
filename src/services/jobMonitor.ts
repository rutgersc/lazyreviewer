import { promises as fs } from 'fs';
import path from 'path';
import { getJobTrace } from '../gitlabgraphql';
import { openUrl } from '../utils/url';
import type { CiJobStatus } from '../generated/gitlab-sdk';

export interface MonitoredJob {
  jobId: string;
  projectFullPath: string;
  jobName: string;
  webPath: string;
  lastStatus: CiJobStatus;
  addedAt: Date;
  mrTitle: string; // For context in logs
}

export interface JobMonitorTodoList {
  jobs: MonitoredJob[];
  lastUpdated: Date;
}

const TODO_FILE_PATH = path.join(process.cwd(), 'data', 'job-monitor-todo.json');

// Ensure data directory exists
async function ensureDataDir() {
  const dataDir = path.dirname(TODO_FILE_PATH);
  try {
    await fs.mkdir(dataDir, { recursive: true });
  } catch (error) {
    // Directory might already exist, ignore
  }
}

// Load todo list from disk
export async function loadJobTodoList(): Promise<JobMonitorTodoList> {
  try {
    await ensureDataDir();
    const data = await fs.readFile(TODO_FILE_PATH, 'utf-8');
    const parsed = JSON.parse(data);
    return {
      jobs: parsed.jobs.map((job: Omit<MonitoredJob, 'addedAt'> & { addedAt: string }) => ({
        ...job,
        addedAt: new Date(job.addedAt),
      })),
      lastUpdated: new Date(parsed.lastUpdated),
    };
  } catch (error) {
    // File doesn't exist or is invalid, return empty list
    return {
      jobs: [],
      lastUpdated: new Date(),
    };
  }
}

// Save todo list to disk
export async function saveJobTodoList(todoList: JobMonitorTodoList): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(TODO_FILE_PATH, JSON.stringify({
    ...todoList,
    lastUpdated: new Date(),
  }, null, 2));
}

// Add a job to monitor
export async function addJobToMonitor(job: Omit<MonitoredJob, 'addedAt'>): Promise<void> {
  const todoList = await loadJobTodoList();

  // Check if job is already being monitored
  const existingJob = todoList.jobs.find(j => j.jobId === job.jobId);
  if (existingJob) {
    console.log(`Job ${job.jobName} is already being monitored`);
    return;
  }

  const monitoredJob: MonitoredJob = {
    ...job,
    addedAt: new Date(),
  };

  todoList.jobs.push(monitoredJob);
  await saveJobTodoList(todoList);
  console.log(`Added job ${job.jobName} to monitoring queue`);
}

// Remove a job from monitoring
export async function removeJobFromMonitor(jobId: string): Promise<void> {
  const todoList = await loadJobTodoList();
  todoList.jobs = todoList.jobs.filter(job => job.jobId !== jobId);
  await saveJobTodoList(todoList);
}

// Get current GitLab job status using REST API
async function getCurrentJobStatus(projectFullPath: string, jobId: string): Promise<CiJobStatus | null> {
  try {
    const token = process.env.GITLAB_TOKEN;
    if (!token) {
      console.error('GITLAB_TOKEN not set');
      return null;
    }

    // Extract job ID from the GraphQL ID format
    const realJobId = jobId.split('/').pop();
    if (!realJobId) {
      console.error('Invalid job ID format:', jobId);
      return null;
    }

    const encodedProjectPath = encodeURIComponent(projectFullPath);
    const url = `https://git.elabnext.com/api/v4/projects/${encodedProjectPath}/jobs/${realJobId}`;

    const response = await fetch(url, {
      headers: {
        'PRIVATE-TOKEN': token
      }
    });

    if (!response.ok) {
      console.error(`Failed to fetch job status: ${response.status} ${response.statusText}`);
      return null;
    }

    const jobData = await response.json();
    console.error('job status:', jobData, jobId);
    return jobData.status as CiJobStatus;
  } catch (error) {
    console.error('Error fetching job status:', error);
    return null;
  }
}

// Handle job completion
async function handleJobCompletion(job: MonitoredJob, newStatus: CiJobStatus): Promise<void> {
  console.log(`Job ${job.jobName} completed with status: ${newStatus}`);

  if (newStatus === 'FAILED') {
    console.log(`Job ${job.jobName} failed, fetching and opening job log...`);
    try {
      // Fetch job trace
      const trace = await getJobTrace(job.projectFullPath, job.jobId);

      if (trace) {
        // Write trace to temp file
        const tempDir = path.join(process.cwd(), 'temp');
        await fs.mkdir(tempDir, { recursive: true });

        const tempFilePath = path.join(tempDir, `job-${job.jobId.split('/').pop()}-trace.txt`);
        await fs.writeFile(tempFilePath, trace);

        console.log(`Job trace saved to: ${tempFilePath}`);

        // Open the trace file (this mimics the "i" action)
        // Note: This might need platform-specific handling
        if (process.platform === 'win32') {
          const { exec } = require('child_process');
          exec(`start notepad "${tempFilePath}"`);
        } else {
          const { exec } = require('child_process');
          exec(`open "${tempFilePath}"`);
        }
      } else {
        console.log(`Could not fetch trace for job ${job.jobName}, opening web URL instead`);
        if (job.webPath) {
          openUrl(`https://git.elabnext.com${job.webPath}`);
        }
      }
    } catch (error) {
      console.error(`Error handling failed job ${job.jobName}:`, error);
    }
  }

  // Remove job from monitoring list
  await removeJobFromMonitor(job.jobId);
}

// Main monitoring loop
export async function runJobMonitoringCycle(): Promise<void> {
  return; // disabled for now
}

// Start background monitoring
export function startJobMonitoring(): NodeJS.Timeout {
  console.log('Starting job monitoring (30 second intervals)...');
  return setInterval(runJobMonitoringCycle, 30000);
}

// Stop background monitoring
export function stopJobMonitoring(intervalId: NodeJS.Timeout): void {
  clearInterval(intervalId);
  console.log('Job monitoring stopped');
}