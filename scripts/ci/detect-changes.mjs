#!/usr/bin/env node

/**
 * Deterministic, fail-closed change classifier used by CI.
 *
 * The module deliberately has no npm dependencies.  Consumers can call
 * classifyChanges({ eventName, changedFiles, ref, dispatchInput }) in tests,
 * while the executable form reads the GitHub event payload and writes stable
 * key=value records to GITHUB_OUTPUT.
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const CATEGORIES = Object.freeze([
  "docs_only",
  "ci_infrastructure",
  "dependencies",
  "assets",
  "core",
  "public_navigation",
  "database",
  "translations",
  "landing",
  "seo",
  "menu_shared",
  "sauge_renderer",
  "pageflip_gestures",
  "admin",
  "qr",
  "full_ci"
]);

const PUBLIC_NAVIGATION_CALLSITES = new Set([
  "app/apercu-restaurateur/page.tsx",
  "app/demo/page.tsx",
  "app/en/restaurant-preview/page.tsx",
  "app/en/pricing-digital-restaurant-menu/page.tsx",
  "app/en/vistaire-menu/page.tsx",
  "components/landing/vistairelanding.tsx",
  "components/seo/seogeoaeopage.tsx"
]);

// These are the only job-policy outputs consumed by App CI.  Keeping the
// decision here means workflow `if:` expressions and CI Gate cannot drift
// apart when a category is added or reclassified.
export const RUN_OUTPUTS = Object.freeze([
  "run_static",
  "run_database",
  "run_build",
  "run_core",
  "run_landing",
  "run_menu",
  "run_sauge",
  "run_admin_qr",
  "run_seo",
  "run_webkit"
]);

const OPERATIONAL_CATEGORIES = CATEGORIES.filter((name) => name !== "docs_only" && name !== "full_ci");
const ZERO_SHA = /^0+$/;
// Keep documentation media on the same path as the large-file/LFS guards.
// This includes ordinary runtime formats and the dangerous/source/archive
// extensions rejected by scripts/check-large-files.mjs.
const ASSET_EXTENSION = /\.(?:7z|ai|avi|avif|blend|exr|fbx|fig|gif|glb|gltf|gz|hdr|ico|jpeg|jpg|m4v|mov|mp4|obj|png|psd|rar|sketch|stl|svg|tar|usd|usda|usdc|usdz|webm|webp|zip)$/;

export function normalizePath(value) {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .replaceAll("\\", "/")
    .replace(/^\.\//, "")
    .replace(/\/+/g, "/");
}

function add(set, ...values) {
  values.forEach((value) => set.add(value));
}

/** Return path categories and whether the path is covered by an explicit rule. */
export function classifyPath(input) {
  const file = normalizePath(input);
  const categories = new Set();
  if (!file) return { path: file, categories, known: false };

  const lower = file.toLowerCase();
  const base = path.posix.basename(lower);
  const mediaPath = ASSET_EXTENSION.test(lower);

  // Documentation is intentionally an allowlist.  Runtime content with a
  // documentation-like extension must never evade its owning test family.
  const docsOnlyPath = lower === "readme.md" ||
    lower === "contributing.md" ||
    lower === "security.md" ||
    /^(?:docs|documentation)\//.test(lower) && !mediaPath;
  if (docsOnlyPath) {
    return { path: file, categories: new Set(["docs_only"]), known: true };
  }

  if (/^\.github\/(?:workflows|actions)\//.test(lower) || lower === ".github/dependabot.yml" ||
      /^scripts\/ci\//.test(lower) || lower === "scripts/run-playwright-e2e.mjs" ||
      /^playwright\.config\.(?:[cm]?js|ts|mts|cts)$/.test(lower) ||
      /(?:ci|contract).*\.test\.(?:mjs|js|ts)$/.test(base)) {
    add(categories, "ci_infrastructure");
  }

  if (/^(?:package\.json|package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock)$/.test(lower) ||
      /(?:^|\/)package-lock\.json$/.test(lower)) {
    add(categories, "dependencies");
  }

  if (/^(?:public|assets)\//.test(lower) || mediaPath) {
    add(categories, "assets");
  }

  if (/^public\/(?:images\/landing|videos\/|frames\/menualive)/.test(lower)) {
    add(categories, "landing");
  }

  if (/^supabase\//.test(lower) || /^tests\/postgres\//.test(lower) ||
      /^scripts\/.*(?:postgres|migration|backfill)/.test(lower) ||
      /^(?:lib\/translation|lib\/menu|lib\/owner)\//.test(lower) ||
      /(?:migration|rpc|postgres|transaction|atomic|cas|permission)/.test(base)) {
    add(categories, "database");
  }

  if (/(?:translation|translations|i18n|locale|locales|messages|bilingual)/.test(lower) ||
      /^tests\/backfill-menu-translations\.test\./.test(lower)) {
    add(categories, "translations");
  }

  if (/^(?:app\/(?:\(?(?:landing|marketing)\)?|page(?:\.|\/))|components\/landing\/|lib\/landing\/|styles\/landing(?:\/|\.|$)|e2e\/landing[-/])/.test(lower) ||
      /(?:landing|marketing|showcase)/.test(base)) {
    add(categories, "landing");
  }

  if (/^(?:lib\/seo|app\/(?:robots|sitemap)(?:\.|\/|$)|app\/(?:seo|geo)(?:\/|$)|e2e\/seo[-/])/.test(lower) ||
      /(?:^|[-_.])seo(?:[-_.]|$)|metadata|json-ld/.test(base)) {
    add(categories, "seo");
  }

  if (/^(?:components\/menu\/|lib\/menu\/|app\/(?:menu|api\/(?:public\/)?menu(?:[-/]))|e2e\/menu[-/])/.test(lower) ||
      /(?:trouvable|menu-(?:navigation|photo|translation)|public-menu)/.test(lower)) {
    add(categories, "menu_shared");
  }

  if (/sauge-noire|sauge_noire|sauge\/|unique\/sauge|renderer\/sauge|sauge-renderer/.test(lower) ||
      /^e2e\/sauge[-/]/.test(lower) || /sauge/.test(base)) {
    add(categories, "sauge_renderer");
  }

  if (/pageflip|page-flip|gesture|swipe|transition-coordinator|handoff/.test(lower) ||
      /react-pageflip/.test(lower)) {
    add(categories, "pageflip_gestures");
  }

  if (/^(?:app\/admin|components\/admin|lib\/admin|e2e\/admin[-/])/.test(lower) ||
      /(?:admin|owner-dashboard|owner-cockpit)/.test(base)) {
    add(categories, "admin");
  }

  if (/qr|qr-codes|qrcode/.test(lower)) add(categories, "qr");

  // Public preview chrome owns the navigation contract.  Keep this signal
  // alongside specialised categories (for example the QR preview) so a
  // mixed diff still runs the public browser family without weakening the
  // admin QR classification.
  if (
    /^components\/vistaire-preview\//.test(lower) ||
    /^lib\/restaurateurpreview\//.test(lower) ||
    /^e2e\/restaurateur-preview(?:-[^/]+)?\.spec\.ts$/.test(lower) ||
    PUBLIC_NAVIGATION_CALLSITES.has(lower) ||
    lower === "e2e/public-navigation.spec.ts"
  ) {
    add(categories, "public_navigation");
  }

  // Explicitly recognised application/source trees are core even when a
  // specialised rule above did not match.  Database migrations and SQL test
  // fixtures are deliberately database-only so a SQL-only PR does not build
  // or launch browser suites as a side effect of the generic source rule.
  const databaseOnlyPath = /^(?:supabase\/|tests\/postgres\/|scripts\/.*(?:postgres|migration|backfill))/.test(lower);
  if (!databaseOnlyPath && /^(?:app|components|content|fixtures|lib|scripts|tests|e2e|styles|config|types)\//.test(lower) ||
      /^(?:next|tsconfig|tailwind|postcss|eslint)\.config\./.test(base) ||
      (!databaseOnlyPath && /\.(?:css|scss|sass|less|tsx?|jsx?|mjs|cjs|mts|cts|mdx|txt)$/.test(lower))) {
    add(categories, "core");
  }

  // A path with no explicit rule is intentionally unknown.  The caller will
  // force full CI, rather than silently allowing an incomplete validation.
  return { path: file, categories, known: categories.size > 0 };
}

function pathsFromEntries(entries) {
  const paths = [];
  for (const entry of entries ?? []) {
    if (typeof entry === "string") {
      const normalized = normalizePath(entry);
      if (normalized) paths.push(normalized);
      continue;
    }
    if (!entry || typeof entry !== "object") continue;
    const candidates = [entry.path, entry.file, entry.to, entry.newPath, entry.filename, entry.name,
      entry.from, entry.oldPath, entry.previousPath, entry.source];
    // Git's rename/copy records have two paths.  Classify both sides so a
    // rename out of (or into) a sensitive area cannot evade a gate.
    if (entry.status && /^[RC]/i.test(String(entry.status))) {
      candidates.push(entry.from, entry.oldPath, entry.previousPath, entry.source);
    } else if (/delete|rename/i.test(String(entry.status ?? ""))) {
      candidates.push(entry.from, entry.oldPath, entry.previousPath, entry.source);
    }
    for (const candidate of candidates) {
      const normalized = normalizePath(candidate);
      if (normalized) paths.push(normalized);
    }
  }
  return [...new Set(paths)].sort();
}

function allOperationalFlags() {
  return Object.fromEntries(OPERATIONAL_CATEGORIES.map((name) => [name, true]));
}

function isMainRef(input) {
  const ref = input.ref ?? input.refName ?? input.branch ?? input.baseRef;
  return ref === "main" || ref === "refs/heads/main";
}

function dispatchTarget(input) {
  const value = input.dispatchInput ?? input.workflowDispatch ?? input.inputs ?? input.input;
  if (typeof value === "string") return value.toLowerCase();
  if (value && typeof value === "object") return String(value.target ?? value.mode ?? value.validation ?? "targeted").toLowerCase();
  return "targeted";
}

function applyDispatchTarget(target, flags) {
  const targetCategories = {
    database: ["database"],
    admin_qr: ["admin", "qr"],
    landing: ["landing"],
    seo: ["seo"],
    sauge: ["sauge_renderer", "pageflip_gestures", "menu_shared"]
  };
  for (const category of targetCategories[target] ?? []) flags[category] = true;
  return Boolean(targetCategories[target]);
}

/**
 * Derive the exact App CI job matrix from category flags.  This function is
 * deliberately exported so policy tests can assert the complete matrix
 * without parsing shell expressions or duplicating conditions in a gate.
 */
export function deriveRunOutputs(flags) {
  const full = flags.full_ci === true;
  const docsOnly = flags.docs_only === true;
  return {
    run_static: full || !docsOnly,
    run_database: full || flags.database === true || flags.translations === true || flags.qr === true,
    run_build: full || flags.core === true || flags.assets === true || flags.landing === true ||
      flags.menu_shared === true || flags.translations === true || flags.sauge_renderer === true ||
      flags.pageflip_gestures === true || flags.admin === true || flags.qr === true ||
      flags.seo === true || flags.dependencies === true,
    // Specialised families own their browser coverage.  A generic core smoke
    // is retained for landing/assets and the explicit public-navigation
    // family, while SQL, translations, menu, admin, QR and SEO changes stay
    // in their precise families.
    run_core: full || flags.assets === true || flags.landing === true ||
      flags.public_navigation === true ||
      (flags.core === true && flags.database !== true && flags.translations !== true &&
        flags.menu_shared !== true && flags.admin !== true && flags.qr !== true &&
        flags.seo !== true && flags.sauge_renderer !== true && flags.pageflip_gestures !== true),
    run_landing: full || flags.landing === true,
    run_menu: full || flags.menu_shared === true || flags.translations === true,
    run_sauge: full || flags.sauge_renderer === true || flags.pageflip_gestures === true,
    run_admin_qr: full || flags.admin === true || flags.qr === true,
    run_seo: full || flags.seo === true,
    run_webkit: full || flags.public_navigation === true || flags.menu_shared === true || flags.translations === true ||
      flags.sauge_renderer === true || flags.pageflip_gestures === true
  };
}

/**
 * Classify a change set.  Missing diffs and unrecognised paths are fail-closed
 * and set full_ci.  The result contains both snake_case output names and
 * camelCase aliases for JavaScript callers.
 */
export function classifyChanges(input = {}) {
  const event = String(input.eventName ?? input.event ?? input.GITHUB_EVENT_NAME ?? "").toLowerCase();
  const changedFiles = pathsFromEntries(input.changedFiles ?? input.files ?? input.paths);
  const exhaustiveEvent = event === "merge_group" ||
    (event === "push" && isMainRef(input)) ||
    (event === "workflow_dispatch" && dispatchTarget(input) === "full");
  const missingDiff = !Array.isArray(input.changedFiles ?? input.files ?? input.paths);
  const forceForEvent = exhaustiveEvent || (event === "workflow_dispatch" && missingDiff);

  const flags = Object.fromEntries(CATEGORIES.map((name) => [name, false]));
  const unknownFiles = [];
  const reasons = [];
  for (const file of changedFiles) {
    const result = classifyPath(file);
    if (!result.known) unknownFiles.push(file);
    for (const category of result.categories) flags[category] = true;
  }

  const manualTarget = event === "workflow_dispatch" ? dispatchTarget(input) : "";
  const explicitManualSelection = event === "workflow_dispatch" && !missingDiff && applyDispatchTarget(manualTarget, flags);
  const targetedManualWithoutDiff = event === "workflow_dispatch" && missingDiff && applyDispatchTarget(manualTarget, flags);
  const validManualTarget = event !== "workflow_dispatch" ||
    manualTarget === "full" ||
    manualTarget === "targeted" ||
    explicitManualSelection ||
    targetedManualWithoutDiff;

  if (changedFiles.length === 0 && missingDiff) {
    reasons.push("changed file list unavailable");
  }
  if (unknownFiles.length > 0) reasons.push("unclassified path(s): " + unknownFiles.join(", "));
  if (exhaustiveEvent) reasons.push(`${event} requires exhaustive validation`);
  if (event === "pull_request" && missingDiff) reasons.push("pull_request diff unavailable");
  if (event === "push" && !isMainRef(input) && missingDiff) reasons.push("push diff unavailable");
  if (event === "workflow_dispatch") reasons.push(`manual target: ${manualTarget}`);

  const docsOnly = changedFiles.length > 0 && changedFiles.every((file) => {
    const result = classifyPath(file);
    return result.known && result.categories.size === 1 && result.categories.has("docs_only");
  }) && !unknownFiles.length &&
    !(event === "workflow_dispatch" && manualTarget !== "targeted");

  // CI definitions and the package graph can invalidate every downstream
  // assumption, so they always request the exhaustive matrix.
  const infrastructureChange = flags.ci_infrastructure || flags.dependencies;
  if (infrastructureChange) reasons.push("CI infrastructure or dependency graph changed");
  // Explicit manual family targets are intentional, while an unqualified
  // targeted dispatch remains fail-closed because no diff is available.
  const manualFamilyTarget = targetedManualWithoutDiff || explicitManualSelection;
  const fullCi = !validManualTarget ||
    (forceForEvent && !manualFamilyTarget) ||
    infrastructureChange ||
    unknownFiles.length > 0 ||
    (missingDiff && !docsOnly && !manualFamilyTarget);
  if (fullCi) Object.assign(flags, allOperationalFlags());
  flags.docs_only = docsOnly && !fullCi;
  flags.full_ci = fullCi;

  const runOutputs = deriveRunOutputs(flags);
  const categories = CATEGORIES.filter((name) => flags[name]);
  const result = {
    event,
    dispatch_target: manualTarget || "targeted",
    changed_files: changedFiles,
    unknown_files: [...new Set(unknownFiles)].sort(),
    categories,
    flags,
    reason: reasons.length ? reasons.join("; ") : "classified by deterministic path rules",
    ...flags,
    ...runOutputs,
    classification_valid: RUN_OUTPUTS.every((name) => typeof runOutputs[name] === "boolean")
  };
  // JS-friendly aliases are useful to workflow adapters and preserve a small,
  // stable interface if output names are consumed outside Actions.
  for (const name of CATEGORIES) {
    result[name.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())] = flags[name];
  }
  result.docsOnly = flags.docs_only;
  result.fullCi = flags.full_ci;
  result.changedFiles = result.changed_files;
  result.unknownFiles = result.unknown_files;
  for (const name of RUN_OUTPUTS) {
    result[name.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())] = runOutputs[name];
  }
  return result;
}

// Backwards-compatible, descriptive aliases for workflow/test consumers.
export const detectChanges = classifyChanges;
export const classifyChangedFiles = classifyChanges;

function readEventPayload() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !existsSync(eventPath)) return {};
  try { return JSON.parse(readFileSync(eventPath, "utf8")); } catch { return {}; }
}

export function gitDiffPaths(base, head, options = {}) {
  if (!base || !head || ZERO_SHA.test(base) || ZERO_SHA.test(head)) return null;
  // Event payload SHAs are full hexadecimal object ids.  Reject anything
  // else before passing values to Git so malformed payloads fail closed rather
  // than becoming options or ambiguous revisions.
  if (!/^[0-9a-f]{40}$/i.test(String(base)) || !/^[0-9a-f]{40}$/i.test(String(head))) return null;
  try {
    const gitOptions = {
      encoding: "utf8",
      cwd: options.cwd,
      stdio: ["ignore", "pipe", "ignore"]
    };
    const mergeBase = execFileSync("git", ["merge-base", base, head], gitOptions).trim();
    if (!/^[0-9a-f]{40}$/i.test(mergeBase)) return null;
    // NUL-delimited records are required for safe rename/deletion handling;
    // tabs and newlines are valid Git path bytes.
    const text = execFileSync(
      "git",
      ["diff", "--name-status", "-M", "-z", mergeBase, head],
      gitOptions
    );
    const fields = text.split("\0");
    const entries = [];
    for (let index = 0; index < fields.length;) {
      const status = fields[index++];
      if (!status) break;
      const pathCount = /^[RC]/i.test(status) ? 2 : 1;
      const firstPath = fields[index++];
      const secondPath = pathCount === 2 ? fields[index++] : undefined;
      if (!firstPath || (pathCount === 2 && !secondPath)) return null;
      entries.push({
        status,
        path: secondPath ?? firstPath,
        ...(secondPath ? { oldPath: firstPath } : {})
      });
    }
    return pathsFromEntries(entries);
  } catch {
    return null;
  }
}

function eventInput(payload) {
  const event = String(process.env.GITHUB_EVENT_NAME ?? process.env.VISTAIRE_CI_EVENT ?? "").toLowerCase();
  if (event === "pull_request") {
    return { eventName: event, baseSha: payload.pull_request?.base?.sha, headSha: payload.pull_request?.head?.sha, changedFiles: gitDiffPaths(payload.pull_request?.base?.sha, payload.pull_request?.head?.sha), ref: payload.pull_request?.base?.ref };
  }
  if (event === "push") {
    return { eventName: event, baseSha: payload.before, headSha: payload.after, changedFiles: gitDiffPaths(payload.before, payload.after), ref: process.env.GITHUB_REF ?? process.env.VISTAIRE_CI_REF ?? payload.ref };
  }
  if (event === "merge_group") return { eventName: event, ref: process.env.GITHUB_REF ?? process.env.VISTAIRE_CI_REF, changedFiles: [] };
  if (event === "workflow_dispatch") return { eventName: event, ref: process.env.GITHUB_REF ?? process.env.VISTAIRE_CI_REF, dispatchInput: payload.inputs ?? process.env.VISTAIRE_CI_TARGET ?? {} };
  return { eventName: event, changedFiles: gitDiffPaths(process.env.GITHUB_BASE_SHA ?? process.env.VISTAIRE_CI_BASE_SHA, process.env.GITHUB_SHA ?? process.env.VISTAIRE_CI_HEAD_SHA) };
}

function cliInput(payload) {
  const args = process.argv.slice(2);
  const value = (name) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const event = value("--event") ?? process.env.GITHUB_EVENT_NAME ?? process.env.VISTAIRE_CI_EVENT;
  const filesArg = value("--files");
  if (!args.some((arg) => arg.startsWith("--"))) return eventInput(payload);
  const files = filesArg === undefined ? undefined : filesArg.split(",").flatMap((item) => item.split(/\r?\n/)).filter(Boolean);
  const input = {
    eventName: event,
    ref: value("--ref") ?? process.env.GITHUB_REF ?? process.env.VISTAIRE_CI_REF,
    dispatchInput: value("--dispatch-target") ?? payload.inputs ?? {},
    changedFiles: files,
    baseSha: value("--base"),
    headSha: value("--head")
  };
  if (files === undefined && input.baseSha && input.headSha) input.changedFiles = gitDiffPaths(input.baseSha, input.headSha);
  return input;
}

export function toGitHubOutputs(result) {
  const escapeOutputText = (value) => String(value)
    .replaceAll("\r", "\\r")
    .replaceAll("\n", "\\n");
  const outputs = [];
  for (const name of CATEGORIES) outputs.push(`${name}=${result.flags[name] ? "true" : "false"}`);
  for (const name of RUN_OUTPUTS) outputs.push(`${name}=${result[name] ? "true" : "false"}`);
  outputs.push(`classification_valid=${result.classification_valid ? "true" : "false"}`);
  // Keep attacker-controlled path bytes on one output line. Escaping control
  // characters prevents a PR filename containing a newline or output
  // delimiter from corrupting GITHUB_OUTPUT; `$()` and backticks are then
  // passed through env and printf in the workflow summary, never shell source.
  outputs.push(`changed_files=${escapeOutputText(result.changed_files.join(" "))}`);
  outputs.push(`unknown_files=${escapeOutputText(result.unknown_files.join(" "))}`);
  outputs.push(`categories=${escapeOutputText(result.categories.join(","))}`);
  outputs.push(`event=${escapeOutputText(result.event)}`);
  outputs.push(`dispatch_target=${escapeOutputText(result.dispatch_target ?? "targeted")}`);
  outputs.push("reason<<CI_CLASSIFIER_REASON");
  outputs.push(escapeOutputText(result.reason));
  outputs.push("CI_CLASSIFIER_REASON");
  return outputs.join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const result = classifyChanges(cliInput(readEventPayload()));
  const output = toGitHubOutputs(result);
  const outputFlag = process.argv.indexOf("--github-output");
  const outputPath = outputFlag >= 0 && process.argv[outputFlag + 1] && !process.argv[outputFlag + 1].startsWith("--")
    ? process.argv[outputFlag + 1]
    : process.env.GITHUB_OUTPUT;
  if (outputPath) appendFileSync(outputPath, `${output}\n`);
  else process.stdout.write(`${output}\n`);
}
