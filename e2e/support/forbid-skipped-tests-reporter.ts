import type {
  Reporter,
  TestCase,
  TestResult
} from "@playwright/test/reporter";
import { writeFile } from "node:fs/promises";

class ForbidSkippedTestsReporter implements Reporter {
  private readonly skippedTests = new Set<string>();
  private readonly results = new Map<
    string,
    { result: TestResult; hadRetry: boolean }
  >();

  onTestEnd(test: TestCase, result: TestResult) {
    const key = test.id;
    const previous = this.results.get(key);
    this.results.set(key, {
      result,
      hadRetry: Boolean(previous?.hadRetry || result.retry > 0)
    });
    if (result.status !== "skipped" && test.expectedStatus !== "skipped") return;
    this.skippedTests.add(test.titlePath().join(" > "));
  }

  async onEnd() {
    const counts = { total: this.results.size, passed: 0, failed: 0, skipped: 0, flaky: 0, interrupted: 0 };
    for (const { result, hadRetry } of this.results.values()) {
      if (result.status === "skipped") counts.skipped++;
      else if (result.status === "interrupted") counts.interrupted++;
      else if (result.status === "failed") counts.failed++;
      else if (hadRetry) counts.flaky++;
      else if (result.status === "passed") counts.passed++;
    }
    const outputPath = process.env.CI_TEST_REPORT_PATH;
    if (outputPath) await writeFile(outputPath, `${JSON.stringify(counts)}\n`, "utf8");
    if (this.skippedTests.size === 0) return;
    console.error(
      `Sauge Noire / Preview Gate must not skip tests:\n${[...this.skippedTests]
        .map((title) => `- ${title}`)
        .join("\n")}`
    );
    return { status: "failed" as const };
  }
}

export default ForbidSkippedTestsReporter;
