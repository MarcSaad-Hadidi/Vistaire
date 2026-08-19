import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { scanPublicPrerenderArtifacts } from "../scripts/ci/check-public-prerender-artifacts.mjs";

const SENTINELS = [
  "synthetic-service-role-secret",
  "synthetic-owner-email@example.test",
  "synthetic-session-cookie"
];

async function makeNextRoot() {
  const parent = await mkdtemp(join(tmpdir(), "vistaire-public-artifacts-"));
  const nextRoot = join(parent, ".next");
  await mkdir(join(nextRoot, "server", "app", "safe"), { recursive: true });
  await writeFile(
    join(nextRoot, "prerender-manifest.json"),
    JSON.stringify({ version: 4, routes: {}, dynamicRoutes: {}, preview: {} })
  );
  return { parent, nextRoot };
}

test("stable public routes and UUIDs pass while server bundles remain out of scope", async (t) => {
  const { parent, nextRoot } = await makeNextRoot();
  t.after(() => rm(parent, { recursive: true, force: true }));
  await writeFile(
    join(nextRoot, "server", "app", "safe", "page.html"),
    '<img src="/api/public/menu-dishes/11111111-1111-4111-8111-111111111112/photo?v=public-7">'
  );
  await writeFile(
    join(nextRoot, "server", "app", "safe", "page.rsc"),
    '{"restaurantId":"22222222-2222-4222-8222-222222222222"}'
  );
  await writeFile(
    join(nextRoot, "server", "app", "safe", "page.js"),
    SENTINELS.join(" ")
  );
  await writeFile(
    join(nextRoot, "server", "app", "safe", "debug.txt"),
    "token=synthetic-capability"
  );

  assert.deepEqual(
    await scanPublicPrerenderArtifacts(nextRoot, SENTINELS),
    []
  );
});

test("capability markers and synthetic sentinels report redacted file evidence", async (t) => {
  const { parent, nextRoot } = await makeNextRoot();
  t.after(() => rm(parent, { recursive: true, force: true }));
  const appRoot = join(nextRoot, "server", "app");
  const fixtures = [
    ["signed-storage.html", "/storage/v1/object/sign/dishes/private.webp", "signed-storage-path"],
    ["token.rsc", "?token=synthetic-capability", "credential-query:token"],
    ["signature.body", "&signature=synthetic-signature", "credential-query:signature"],
    ["expires.meta", "?expires=9999999999", "credential-query:expires"],
    ["aws.html", "?X-Amz-Signature=", "credential-query:x-amz-signature"],
    ["secret.rsc", SENTINELS[0], "sentinel[0]"],
    ["owner.body", SENTINELS[1], "sentinel[1]"],
    ["bypass.meta", "x-vistaire-owner-e2e-authorized", "trusted-owner-bypass-header"]
  ];
  for (const [name, body] of fixtures) {
    await writeFile(join(appRoot, name), body);
  }
  const manifest = JSON.parse(
    await readFile(join(nextRoot, "prerender-manifest.json"), "utf8")
  );
  manifest.synthetic = SENTINELS[2];
  await writeFile(
    join(nextRoot, "prerender-manifest.json"),
    JSON.stringify(manifest)
  );

  const findings = await scanPublicPrerenderArtifacts(nextRoot, SENTINELS);
  for (const [name, , marker] of fixtures) {
    assert.ok(
      findings.some(
        (finding) => finding.file.endsWith(name) && finding.marker === marker
      ),
      `${name} must report ${marker}`
    );
  }
  assert.ok(
    findings.some(
      (finding) =>
        finding.file === "prerender-manifest.json" &&
        finding.marker === "sentinel[2]"
    )
  );
  for (const finding of findings) {
    assert.doesNotMatch(finding.marker, /synthetic-(?:service|owner|session)/i);
    assert.equal(Object.hasOwn(finding, "value"), false);
  }
});

test("the CLI fails closed with JSON sentinels and passes a safe tree", async (t) => {
  const { parent, nextRoot } = await makeNextRoot();
  t.after(() => rm(parent, { recursive: true, force: true }));
  await writeFile(
    join(nextRoot, "server", "app", "safe", "page.html"),
    '<img src="/images/menu-safe.webp">'
  );
  const script = resolve("scripts/ci/check-public-prerender-artifacts.mjs");
  const environment = {
    ...process.env,
    VISTAIRE_PUBLIC_ARTIFACT_SENTINELS: JSON.stringify(SENTINELS)
  };
  const safe = spawnSync(process.execPath, [script], {
    cwd: parent,
    env: environment,
    encoding: "utf8"
  });
  assert.equal(safe.status, 0, safe.stderr || safe.stdout);

  await writeFile(
    join(nextRoot, "server", "app", "safe", "page.html"),
    `private=${SENTINELS[0]}`
  );
  const unsafe = spawnSync(process.execPath, [script], {
    cwd: parent,
    env: environment,
    encoding: "utf8"
  });
  assert.equal(unsafe.status, 1, unsafe.stderr || unsafe.stdout);
  assert.match(unsafe.stderr, /sentinel\[0\]/);
  assert.doesNotMatch(unsafe.stderr, new RegExp(SENTINELS[0]));
});
