import { getJobTraceAsEvent } from "../gitlab/gitlab-graphql";
import { existsSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { Effect, Console } from "effect";
import { projectGitlabJobTraceFetchedEvent } from "../gitlab/gitlab-projections";

export const loadJobLogInternal = Effect.fn(function* (
  mr: { project: { path: string, fullPath: string } },
  job: { id: string; name: string; localId: number }) {

  const logsDir = join(process.cwd(), "logs", "jobs");
  const logFileName = `${mr.project.path}_${job.name}_${job.localId}.ansi`;
  const logFilePath = join(logsDir, logFileName);

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

  openFile(logFilePath);
});

const openFile = (filePath: string) => {
  if (process.platform === "win32") {
    execSync(`cmd /c start "" "${filePath}"`);
  } else if (process.platform === "darwin") {
    execSync(`open "${filePath}"`);
  } else {
    execSync(`xdg-open "${filePath}"`);
  }
};
