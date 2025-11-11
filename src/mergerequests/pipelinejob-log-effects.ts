import type { MergeRequest } from "./mergeRequestSchema";
import type { PipelineJob } from "../gitlab/gitlab-schema";
import { getJobTraceAsEvent } from "../gitlab/gitlab-graphql";
import { existsSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { Effect, Console } from "effect";
import { projectGitlabJobTraceFetchedEvent } from "../gitlab/gitlab-projections";

export const loadJobLog = Effect.fn(function* (
  selectedMergeRequest: MergeRequest,
  job: PipelineJob
) {
  const logsDir = join(process.cwd(), "logs");
  const logFileName = `${selectedMergeRequest.project.name}_job_${job.name}_${job.localId}.ansi`;
  const logFilePath = join(logsDir, logFileName);

  if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
  }

  if (!existsSync(logFilePath)) {
    yield* Console.log(`Log does not exist yet: ${logFilePath}`);

    const event = yield* getJobTraceAsEvent(
      selectedMergeRequest.project.fullPath,
      job.id
    );
    const log = projectGitlabJobTraceFetchedEvent(event);

    if (!log) {
      return;
    }

    writeFileSync(logFilePath, log, "utf8");
    yield* Console.log(`Log saved to: ${logFilePath}`);
  }

  if (process.platform === 'win32') {
    execSync(`cmd /c start "" "${logFilePath}"`);
  } else if (process.platform === 'darwin') {
    execSync(`open "${logFilePath}"`);
  } else {
    execSync(`xdg-open "${logFilePath}"`);
  }
});
