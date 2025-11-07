import type { MergeRequest } from "./mergeRequestSchema";
import type { PipelineJob } from "../gitlab/gitlab-schema";
import { getJobTrace } from "../gitlab/gitlabgraphql";
import { existsSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { Effect, Console } from "effect";

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
    const log = yield* getJobTrace(
      selectedMergeRequest.project.fullPath,
      job.id
    );

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
