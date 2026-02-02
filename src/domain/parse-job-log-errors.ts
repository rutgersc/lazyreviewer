export interface JobLogErrors {
  readonly failedTests: ReadonlyArray<{
    readonly name: string;
    readonly errorMessage: string | null;
  }>;
  readonly buildErrors: ReadonlyArray<string>;
  readonly failedSummaries: ReadonlyArray<string>;
}

const EMPTY_ERRORS: JobLogErrors = { failedTests: [], buildErrors: [], failedSummaries: [] };

export const hasErrors = (errors: JobLogErrors): boolean =>
  errors.failedTests.length > 0 || errors.buildErrors.length > 0 || errors.failedSummaries.length > 0;

// --- Shared utilities ---

const ANSI_RE = /\x1b\[[\d;]*[A-Za-z]/g;
const LOG_PREFIX_RE = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z\s+\d{2}[OE]\+?\s?/;

const cleanLine = (line: string): string =>
  line.replace(LOG_PREFIX_RE, '').replace(ANSI_RE, '');

const cleanLines = (content: string): string[] =>
  content.split('\n').map(cleanLine);

// --- Dotnet build/test parser (02_build_test) ---

const FAILED_TEST_RE = /^\s{2}Failed\s+(.+?)\s+\[.+\]$/;
const ERROR_MESSAGE_RE = /^\s{2}Error Message:\s*$/;
const BUILD_ERROR_RE = /: error \w+\d+:/;
const FAILED_SUMMARY_RE = /^Failed!\s+-\s+Failed:/;

const shortenTestName = (fullName: string): string => {
  const parts = fullName.split('.');
  return parts.length > 2 ? parts.slice(-2).join('.') : fullName;
};

const extractBuildErrorText = (line: string): string =>
  line
    .replace(/\s+\[.*\]\s*$/, '')
    .replace(/^.*[/\\](?=[^/\\]*\(\d)/, '');

const parseDotnetBuildTest = (content: string): JobLogErrors => {
  const lines = cleanLines(content);
  const failedTests: Array<{ name: string; errorMessage: string | null }> = [];
  const buildErrorSet = new Set<string>();
  const failedSummaries: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    const failedMatch = FAILED_TEST_RE.exec(line);
    if (failedMatch) {
      const name = shortenTestName(failedMatch[1]!);
      const errorMessage =
        i + 2 < lines.length && ERROR_MESSAGE_RE.test(lines[i + 1]!)
          ? lines[i + 2]!.trim()
          : null;
      failedTests.push({ name, errorMessage });
      continue;
    }

    if (BUILD_ERROR_RE.test(line)) {
      buildErrorSet.add(extractBuildErrorText(line.trim()));
      continue;
    }

    if (FAILED_SUMMARY_RE.test(line)) {
      failedSummaries.push(line.trim().replace(/\s{2,}/g, ' '));
    }
  }

  return { failedTests, buildErrors: [...buildErrorSet], failedSummaries };
};

// --- Job name → parser registry ---

type JobLogParser = (content: string) => JobLogErrors;

const JOB_PARSERS: ReadonlyArray<{ readonly pattern: RegExp; readonly parser: JobLogParser }> = [
  { pattern: /^02_build_test$/, parser: parseDotnetBuildTest },
];

export const parseJobLogErrors = (jobName: string, content: string): JobLogErrors => {
  const entry = JOB_PARSERS.find(e => e.pattern.test(jobName));
  return entry ? entry.parser(content) : EMPTY_ERRORS;
};
