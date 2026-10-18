import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("approved metric island uses actual pinned NumberFlow with motion and unknown-value guards", async () => {
  const pkg = JSON.parse(await readFile("package.json", "utf8"));
  assert.equal(pkg.dependencies["@number-flow/react"], "0.6.2");
  const source = await readFile(
    "components/admin/studio/StudioNumber.tsx",
    "utf8",
  );
  assert.match(
    source,
    /import NumberFlow, \{ useCanAnimate \} from "@number-flow\/react"/,
  );
  assert.match(source, /respectMotionPreference: true/);
  assert.match(source, /Number\.isFinite\(value\)/);
  assert.match(source, /aria-hidden="true"/);
  assert.match(source, /className=\{styles\.srOnly\}/);
});
