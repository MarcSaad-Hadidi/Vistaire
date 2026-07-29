import type {
  Reporter,
  TestCase,
  TestResult
} from "@playwright/test/reporter";

class ForbidSkippedTestsReporter implements Reporter {
  private readonly skippedTests: string[] = [];

  onTestEnd(test: TestCase, result: TestResult) {
    if (result.status !== "skipped" && test.expectedStatus !== "skipped") return;
    this.skippedTests.push(test.titlePath().join(" > "));
  }

  async onEnd() {
    if (this.skippedTests.length === 0) return;
    console.error(
      `Sauge Noire blocking suite must not skip tests:\n${this.skippedTests
        .map((title) => `- ${title}`)
        .join("\n")}`
    );
    return { status: "failed" as const };
  }
}

export default ForbidSkippedTestsReporter;
