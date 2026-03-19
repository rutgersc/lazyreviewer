#!/usr/bin/env bun
/**
 * Fetches recent GitLab CI jobs and analyzes queue/pause/run time breakdown.
 * Usage: bun scripts/job-queue-analysis.ts [project-id-or-path] [--pages N]
 */

import { config } from "dotenv";
config({ path: ".env" });

const GITLAB_URL = "https://git.elabnext.com";
const TOKEN = process.env.GITLAB_TOKEN!;

const headers = { "PRIVATE-TOKEN": TOKEN };

type GitlabJob = {
  id: number;
  name: string;
  stage: string;
  status: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  queued_duration: number | null;
  duration: number | null;
  runner: { description: string; id: number; tags: string[] } | null;
  tag_list: string[];
  pipeline: { id: number; ref: string };
  web_url: string;
};

type Project = {
  id: number;
  path_with_namespace: string;
  name: string;
};

const fetchJson = async <T>(url: string): Promise<T> => {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`);
  return res.json() as Promise<T>;
};

const fetchProjects = () =>
  fetchJson<Project[]>(
    `${GITLAB_URL}/api/v4/projects?membership=true&per_page=100&simple=true&order_by=last_activity_at`
  );

const fetchJobs = async (projectId: number, pages: number): Promise<GitlabJob[]> => {
  const allJobs: GitlabJob[] = [];
  for (let page = 1; page <= pages; page++) {
    const jobs = await fetchJson<GitlabJob[]>(
      `${GITLAB_URL}/api/v4/projects/${projectId}/jobs?per_page=100&page=${page}&scope[]=success&scope[]=failed`
    );
    allJobs.push(...jobs);
    if (jobs.length < 100) break;
  }
  return allJobs;
};

const fmt = (seconds: number) => {
  if (seconds < 60) return `${seconds.toFixed(0)}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
};

const pct = (n: number, total: number) =>
  total > 0 ? `${((n / total) * 100).toFixed(0)}%` : "-";

const pad = (s: string, len: number) => s.padEnd(len);
const rpad = (s: string, len: number) => s.padStart(len);

const analyze = (jobs: GitlabJob[]) => {
  // Only jobs that actually ran (have started_at)
  const completed = jobs.filter((j) => j.started_at && j.created_at);

  if (completed.length === 0) {
    console.log("No completed jobs found.");
    return;
  }

  // Compute timings per job
  const timed = completed.map((j) => {
    const created = new Date(j.created_at).getTime();
    const started = new Date(j.started_at!).getTime();
    const finished = j.finished_at ? new Date(j.finished_at).getTime() : started;
    const totalWait = (started - created) / 1000; // seconds from created to started
    const queued = j.queued_duration ?? 0;
    const paused = Math.max(0, totalWait - queued); // time not accounted for by queue
    const runTime = j.duration ?? (finished - started) / 1000;

    return {
      ...j,
      totalWait,
      queued,
      paused,
      runTime,
    };
  });

  // === OVERALL SUMMARY ===
  const totalQueue = timed.reduce((s, j) => s + j.queued, 0);
  const totalPause = timed.reduce((s, j) => s + j.paused, 0);
  const totalRun = timed.reduce((s, j) => s + j.runTime, 0);
  const totalAll = totalQueue + totalPause + totalRun;

  console.log(`\n${"=".repeat(70)}`);
  console.log(`OVERALL (${timed.length} jobs)`);
  console.log(`${"=".repeat(70)}`);
  console.log(
    `  Queue time:  ${fmt(totalQueue)} (${pct(totalQueue, totalAll)} of total wall time)`
  );
  console.log(
    `  Pause time:  ${fmt(totalPause)} (${pct(totalPause, totalAll)}) [created→queue, manual, delayed, deps]`
  );
  console.log(
    `  Run time:    ${fmt(totalRun)} (${pct(totalRun, totalAll)})`
  );
  console.log(`  Total:       ${fmt(totalAll)}`);

  // === PER JOB NAME ===
  const byName = new Map<string, typeof timed>();
  timed.forEach((j) => {
    const list = byName.get(j.name) ?? [];
    list.push(j);
    byName.set(j.name, list);
  });

  const stats = [...byName.entries()]
    .map(([name, jobs]) => {
      const avgQueue = jobs.reduce((s, j) => s + j.queued, 0) / jobs.length;
      const maxQueue = Math.max(...jobs.map((j) => j.queued));
      const avgPause = jobs.reduce((s, j) => s + j.paused, 0) / jobs.length;
      const maxPause = Math.max(...jobs.map((j) => j.paused));
      const avgRun = jobs.reduce((s, j) => s + j.runTime, 0) / jobs.length;
      const count = jobs.length;
      const totalWasted = jobs.reduce((s, j) => s + j.queued + j.paused, 0);
      return { name, avgQueue, maxQueue, avgPause, maxPause, avgRun, count, totalWasted };
    })
    .sort((a, b) => b.totalWasted - a.totalWasted);

  console.log(`\n${"=".repeat(100)}`);
  console.log("PER JOB NAME (sorted by total wait time)");
  console.log(`${"=".repeat(100)}`);

  const hdr = [
    pad("Job Name", 35),
    rpad("Count", 6),
    rpad("AvgQueue", 9),
    rpad("MaxQueue", 9),
    rpad("AvgPause", 9),
    rpad("MaxPause", 9),
    rpad("AvgRun", 9),
    rpad("TotalWait", 10),
  ].join(" ");
  console.log(hdr);
  console.log("-".repeat(100));

  stats.forEach((s) => {
    const row = [
      pad(s.name.slice(0, 34), 35),
      rpad(String(s.count), 6),
      rpad(fmt(s.avgQueue), 9),
      rpad(fmt(s.maxQueue), 9),
      rpad(fmt(s.avgPause), 9),
      rpad(fmt(s.maxPause), 9),
      rpad(fmt(s.avgRun), 9),
      rpad(fmt(s.totalWasted), 10),
    ].join(" ");
    console.log(row);
  });

  // === WORST INDIVIDUAL JOBS ===
  const worst = [...timed].sort((a, b) => b.totalWait - a.totalWait).slice(0, 15);

  console.log(`\n${"=".repeat(100)}`);
  console.log("TOP 15 WORST INDIVIDUAL WAITS");
  console.log(`${"=".repeat(100)}`);

  const hdr2 = [
    pad("Job Name", 30),
    rpad("Queue", 8),
    rpad("Pause", 8),
    rpad("Run", 8),
    rpad("Status", 8),
    pad("Pipeline", 12),
    pad("Created", 20),
  ].join(" ");
  console.log(hdr2);
  console.log("-".repeat(100));

  worst.forEach((j) => {
    const row = [
      pad(j.name.slice(0, 29), 30),
      rpad(fmt(j.queued), 8),
      rpad(fmt(j.paused), 8),
      rpad(fmt(j.runTime), 8),
      rpad(j.status, 8),
      pad(`#${j.pipeline.id}`, 12),
      pad(j.created_at.slice(0, 19), 20),
    ].join(" ");
    console.log(row);
  });

  // === QUEUE TIME BY HOUR OF DAY ===
  const byHour = new Map<number, { totalQueue: number; count: number }>();
  timed.forEach((j) => {
    const hour = new Date(j.created_at).getHours();
    const existing = byHour.get(hour) ?? { totalQueue: 0, count: 0 };
    existing.totalQueue += j.queued;
    existing.count++;
    byHour.set(hour, existing);
  });

  console.log(`\n${"=".repeat(50)}`);
  console.log("AVERAGE QUEUE TIME BY HOUR (UTC)");
  console.log(`${"=".repeat(50)}`);

  for (let h = 0; h < 24; h++) {
    const data = byHour.get(h);
    if (!data) continue;
    const avg = data.totalQueue / data.count;
    const bar = "█".repeat(Math.min(50, Math.round(avg / 10)));
    console.log(`  ${String(h).padStart(2, "0")}:00  ${rpad(fmt(avg), 7)} ${rpad(String(data.count), 4)} jobs  ${bar}`);
  }

  // === RUNNER DISTRIBUTION ===
  const byRunner = new Map<string, { totalQueue: number; count: number }>();
  timed
    .filter((j) => j.runner)
    .forEach((j) => {
      const desc = j.runner!.description;
      const existing = byRunner.get(desc) ?? { totalQueue: 0, count: 0 };
      existing.totalQueue += j.queued;
      existing.count++;
      byRunner.set(desc, existing);
    });

  if (byRunner.size > 0) {
    console.log(`\n${"=".repeat(60)}`);
    console.log("QUEUE TIME BY RUNNER");
    console.log(`${"=".repeat(60)}`);

    [...byRunner.entries()]
      .sort((a, b) => b[1].totalQueue - a[1].totalQueue)
      .forEach(([runner, data]) => {
        console.log(
          `  ${pad(runner.slice(0, 35), 36)} ${rpad(String(data.count), 5)} jobs  avg queue: ${fmt(data.totalQueue / data.count)}`
        );
      });
  }
};

// === MAIN ===
const args = process.argv.slice(2);
const pagesFlag = args.indexOf("--pages");
const pages = pagesFlag >= 0 ? parseInt(args[pagesFlag + 1]) : 5;
const projectArg = args.find((a) => !a.startsWith("--") && a !== String(pages));

const run = async () => {
  if (!projectArg) {
    // List projects and let user pick
    console.log("Fetching your GitLab projects...\n");
    const projects = await fetchProjects();
    projects.slice(0, 20).forEach((p, i) => {
      console.log(`  [${i + 1}] ${p.path_with_namespace} (id: ${p.id})`);
    });
    console.log(`\nUsage: bun scripts/job-queue-analysis.ts <project-id> [--pages N]`);
    console.log(`  --pages N  Number of pages of 100 jobs to fetch (default: 5 = 500 jobs)`);
    return;
  }

  const projectId = parseInt(projectArg);
  if (isNaN(projectId)) {
    // Try to resolve by path
    const encoded = encodeURIComponent(projectArg);
    const project = await fetchJson<Project>(
      `${GITLAB_URL}/api/v4/projects/${encoded}`
    );
    console.log(`Resolved: ${project.path_with_namespace} (id: ${project.id})`);
    console.log(`Fetching jobs (${pages} pages of 100)...`);
    const jobs = await fetchJobs(project.id, pages);
    console.log(`Fetched ${jobs.length} completed jobs.`);
    analyze(jobs);
    return;
  }

  console.log(`Fetching jobs for project ${projectId} (${pages} pages of 100)...`);
  const jobs = await fetchJobs(projectId, pages);
  console.log(`Fetched ${jobs.length} completed jobs.`);
  analyze(jobs);
};

run().catch((err) => {
  console.error("Error:", err.message ?? err);
  process.exit(1);
});
