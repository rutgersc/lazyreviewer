import { getJobTraceAsEvent } from "../gitlab/gitlab-graphql";
import { existsSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { Effect, Console } from "effect";
import { projectGitlabJobTraceFetchedEvent } from "../gitlab/gitlab-projections";

type JobLogMr = { project: { path: string, fullPath: string }, sourcebranch: string };
type JobLogJob = { id: string; name: string; localId: number };

const sanitizeForFilename = (s: string) => s.replace(/[<>:"/\\|?*]/g, '_');

const jobLogFilename = (mr: JobLogMr, job: JobLogJob): string =>
  `${sanitizeForFilename(mr.sourcebranch)}_${sanitizeForFilename(job.name)}_${job.localId}.ansi`;

const defaultJobLogDir = join(process.cwd(), "logs", "jobs");

export const getJobLogPath = (mr: JobLogMr, job: JobLogJob, dir?: string): string =>
  join(dir ?? defaultJobLogDir, jobLogFilename(mr, job));

export const downloadJobTrace = Effect.fn(function* (mr: JobLogMr, job: JobLogJob, targetDir?: string) {
  const logsDir = targetDir ?? defaultJobLogDir;
  const logFilePath = join(logsDir, jobLogFilename(mr, job));

  if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
  }

  if (!existsSync(logFilePath)) {
    yield* Console.log(`Log does not exist yet: ${logFilePath}`);

    const event = yield* getJobTraceAsEvent(
      mr.project.fullPath,
      job.id
    );
    const log = projectGitlabJobTraceFetchedEvent(event);

    if (!log) {
      return;
    }

    writeFileSync(logFilePath, log, "utf8");
    yield* Console.log(`Log saved to: ${logFilePath}`);
  }
});

export const loadJobLogInternal = Effect.fn(function* (mr: JobLogMr, job: JobLogJob) {
  yield* downloadJobTrace(mr, job);

  const logFilePath = getJobLogPath(mr, job);
  if (existsSync(logFilePath)) {
    const tabTitle = `${mr.sourcebranch} #${job.localId} ${job.name}`;
    openFile(logFilePath, tabTitle);
  }
});

const openFile = (filePath: string, tabTitle: string) => {
  if (process.platform === "win32") {
    execSync(`wt -w 0 nt --title "${tabTitle}" pwsh -NoExit -Command "nvim '${filePath}'"`);
  } else if (process.platform === "darwin") {
    execSync(`open "${filePath}"`);
  } else {
    execSync(`xdg-open "${filePath}"`);
  }
};
