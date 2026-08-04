import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflow = await readFile(
  new URL("../.github/workflows/workflow-security.yml", import.meta.url),
  "utf8"
);

test("workflow security gates are immutable, read-only, and explicit", () => {
  assert.match(workflow, /name: Workflow Security/);
  assert.match(workflow, /permissions:\s+contents: read/);
  assert.match(workflow, /devops-actions\/actionlint@[0-9a-f]{40}/);
  assert.match(workflow, /zizmorcore\/zizmor-action@[0-9a-f]{40}/);
  assert.match(workflow, /version: 1\.21\.0/);
  assert.match(workflow, /online-audits: false/);
  assert.match(workflow, /advanced-security: false/);
  assert.match(workflow, /npm audit --json/);
  assert.match(workflow, /check-npm-audit-baseline\.mjs/);
  assert.doesNotMatch(workflow, /npm audit fix/);
  for (const match of workflow.matchAll(/uses:\s*([^\s]+)@([^\s#]+)/g)) {
    assert.match(match[2], /^[0-9a-f]{40}$/, `${match[1]} must use a full commit SHA`);
  }
});

