import type { MergeRequest } from "./components/MergeRequestPane";
import { getJobTrace, type PipelineJob } from "./gitlabgraphql";
import { existsSync, writeFileSync, mkdirSync } from "fs"
 import { join } from "path"
  import { execSync } from "child_process"

export const loadJobLog = async (
  selectedMergeRequest: MergeRequest,
  job: PipelineJob
) => {
  const logsDir = join(process.cwd(), "logs");
  const logFileName = `${selectedMergeRequest.project.name}_job_${job.name}_${job.localId}.ansi`;
  const logFilePath = join(logsDir, logFileName);

  if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
  }

  if (!existsSync(logFilePath)) {
    console.log(`Log does not exist yet: ${logFilePath}`);
    const log = await getJobTrace(
      selectedMergeRequest.project.fullPath,
      job.id
    );

    if (!log) {
      return;
    }

    writeFileSync(logFilePath, log, "utf8");
    console.log(`Log saved to: ${logFilePath}`);
  }

  if (process.platform === 'win32') {
    execSync(`cmd /c start "" "${logFilePath}"`);
  } else if (process.platform === 'darwin') {
    execSync(`open "${logFilePath}"`);
  } else {
    execSync(`xdg-open "${logFilePath}"`);
  }
};
