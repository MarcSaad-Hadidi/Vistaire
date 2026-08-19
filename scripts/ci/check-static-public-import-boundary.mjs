#!/usr/bin/env node

import { lstat, readFile, realpath } from "node:fs/promises";
import {
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep
} from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

export const STATIC_PUBLIC_NAMED_PAGE_ENTRIES = Object.freeze([
  "app/(fr)/page.tsx",
  "app/(fr)/a-propos/page.tsx",
  "app/(fr)/contact/page.tsx",
  "app/(fr)/prendre-rendez-vous/page.tsx",
  "app/(fr)/(seo)/menu-digital-restaurant/page.tsx",
  "app/(fr)/(seo)/menu-pdf-vs-menu-digital/page.tsx",
  "app/(fr)/(seo)/menu-qr-code-restaurant/page.tsx",
  "app/(fr)/(seo)/menu-3d-ar-restaurant/page.tsx",
  "app/(fr)/(seo)/tarifs-menu-digital-restaurant/page.tsx",
  "app/(fr)/guides/anatomie-menu-digital-premium/page.tsx",
  "app/(fr)/guides/menu-qr-mobile-sans-application/page.tsx",
  "app/(fr)/guides/3d-restaurant-utile-vs-gadget/page.tsx",
  "app/(fr)/apercu-restaurateur/page.tsx",
  "app/(en)/en/page.tsx",
  "app/(en)/en/about/page.tsx",
  "app/(en)/en/contact/page.tsx",
  "app/(en)/en/book-a-call/page.tsx",
  "app/(en)/en/digital-restaurant-menu/page.tsx",
  "app/(en)/en/pdf-vs-digital-menu/page.tsx",
  "app/(en)/en/qr-code-restaurant-menu/page.tsx",
  "app/(en)/en/3d-ar-restaurant-menu/page.tsx",
  "app/(en)/en/pricing-digital-restaurant-menu/page.tsx",
  "app/(en)/en/guides/premium-digital-menu-anatomy/page.tsx",
  "app/(en)/en/guides/mobile-qr-menu-without-app/page.tsx",
  "app/(en)/en/guides/restaurant-3d-useful-vs-gimmick/page.tsx",
  "app/(en)/en/restaurant-preview/page.tsx"
]);

export const STATIC_PUBLIC_ENTRY_FILES = Object.freeze([
  "app/(fr)/layout.tsx",
  "app/(fr)/(seo)/layout.tsx",
  "app/(en)/layout.tsx",
  ...STATIC_PUBLIC_NAMED_PAGE_ENTRIES
]);

const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const RESOLUTION_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const FORBIDDEN_PACKAGES = [
  "next/headers",
  "next/cookies",
  "@clerk/nextjs/server"
];
const FORBIDDEN_PATH_PATTERNS = [
  /^utils\/supabase\/(?:admin|server)(?:\.[^/]+|\/|$)/,
  /^lib\/(?:admin|owner)(?:\/|$)/,
  /^app\/\(fr\)\/(?:admin|owner)(?:\/|$)/,
  /^app\/api(?:\/|$)/
];
const LANDING_ENTRIES = new Set([
  "app/(fr)/page.tsx",
  "app/(en)/en/page.tsx"
]);
const REVIEWED_SEO_LOADER_ENTRIES = new Set([
  "app/(fr)/(seo)/menu-digital-restaurant/page.tsx",
  "app/(fr)/(seo)/menu-pdf-vs-menu-digital/page.tsx",
  "app/(en)/en/digital-restaurant-menu/page.tsx",
  "app/(en)/en/pdf-vs-digital-menu/page.tsx"
]);
const LANDING_BRIDGE = "components/vistaire-preview/VistairePreviewLanding.tsx";
const LANDING_RENDERER = "components/landing/VistaireLanding.tsx";
const SEO_COMPARISON = "components/landing/SeoInteractiveComparison.tsx";
const LANDING_LOADER = "lib/landing/menuExperiences.ts";
const PUBLIC_EXTERNAL_DATA_FACADE =
  "lib/landing/publicLandingMenuData.ts";
const PUBLIC_EXTERNAL_DATA_DELEGATE =
  "lib/menu/publicMenuRenderContext.ts";
const PUBLIC_EXTERNAL_DATA_DELEGATE_SPECIFIER =
  "@/lib/menu/publicMenuRenderContext";
const PUBLIC_EXTERNAL_DATA_FACADE_IMPORTS = new Set([
  "server-only",
  PUBLIC_EXTERNAL_DATA_DELEGATE_SPECIFIER
]);
const REVIEWED_PUBLIC_OWNER_HELPERS = new Set([
  "lib/owner/price.ts",
  "lib/owner/modelAssetSize.ts",
  "lib/owner/menuUrlCore.ts",
  "lib/owner/storageSafeIdentifier.ts"
]);
const SAUGE_RENDERER_BINDINGS =
  "components/menu/unique/sauge-noire/SaugeNoireRendererBindings.ts";

// These values are public deployment/build metadata even though the platform
// does not use the NEXT_PUBLIC_ prefix for them. Secret-bearing names are not
// accepted here.
const PUBLIC_BUILD_ENVIRONMENT_KEYS = new Set([
  "NODE_ENV",
  "NEXT_PHASE",
  "SITE_URL",
  "VERCEL_ENV",
  "VERCEL_PROJECT_PRODUCTION_URL",
  "VERCEL_URL"
]);

function portablePath(value) {
  return value.split(sep).join("/");
}

function isInside(root, target) {
  const pathFromRoot = relative(root, target);
  return pathFromRoot === "" || (!pathFromRoot.startsWith("..") && !isAbsolute(pathFromRoot));
}

function scriptKind(file) {
  switch (extname(file).toLowerCase()) {
    case ".tsx":
      return ts.ScriptKind.TSX;
    case ".jsx":
      return ts.ScriptKind.JSX;
    case ".js":
    case ".mjs":
    case ".cjs":
      return ts.ScriptKind.JS;
    default:
      return ts.ScriptKind.TS;
  }
}

function importClauseIsTypeOnly(clause) {
  if (!clause) return false;
  if (clause.isTypeOnly) return true;
  if (clause.name) return false;
  return Boolean(
    clause.namedBindings &&
      ts.isNamedImports(clause.namedBindings) &&
      clause.namedBindings.elements.length > 0 &&
      clause.namedBindings.elements.every((element) => element.isTypeOnly)
  );
}

function literalModuleSpecifiers(sourceFile) {
  const specifiers = [];
  function visit(node) {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteralLike(node.moduleSpecifier) &&
      !importClauseIsTypeOnly(node.importClause)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier) &&
      !node.isTypeOnly
    ) {
      specifiers.push(node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node) && node.arguments.length === 1) {
      const argument = node.arguments[0];
      const dynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const commonJsRequire =
        ts.isIdentifier(node.expression) && node.expression.text === "require";
      if (
        (dynamicImport || commonJsRequire) &&
        ts.isStringLiteralLike(argument)
      ) {
        specifiers.push(argument.text);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return [...new Set(specifiers)];
}

function isProcessEnv(node) {
  return (
    ts.isPropertyAccessExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "process" &&
    node.name.text === "env"
  );
}

function environmentReads(sourceFile) {
  const reads = [];
  function visit(node) {
    if (ts.isPropertyAccessExpression(node) && isProcessEnv(node.expression)) {
      reads.push(node.name.text);
      return;
    }
    if (ts.isElementAccessExpression(node) && isProcessEnv(node.expression)) {
      const key = node.argumentExpression;
      reads.push(ts.isStringLiteralLike(key) ? key.text : "<dynamic>");
      return;
    }
    if (isProcessEnv(node)) {
      const parent = node.parent;
      const consumedByProperty =
        (ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) &&
        parent.expression === node;
      if (!consumedByProperty) reads.push("<process.env>");
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return [...new Set(reads)];
}

function callsCreateSignedUrl(sourceFile) {
  let found = false;
  function visit(node) {
    if (found) return;
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (
        (ts.isIdentifier(callee) && callee.text === "createSignedUrl") ||
        (ts.isPropertyAccessExpression(callee) && callee.name.text === "createSignedUrl")
      ) {
        found = true;
        return;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return found;
}

function packageIsForbidden(specifier) {
  return FORBIDDEN_PACKAGES.some(
    (candidate) => specifier === candidate || specifier.startsWith(`${candidate}/`)
  );
}

async function existingFile(candidate) {
  try {
    return (await lstat(candidate)).isFile();
  } catch {
    return false;
  }
}

async function existingDirectory(candidate) {
  try {
    return (await lstat(candidate)).isDirectory();
  } catch {
    return false;
  }
}

async function resolveLocalImport(specifier, importer, root) {
  const base = specifier.startsWith("@/")
    ? resolve(root, specifier.slice(2))
    : resolve(dirname(importer), specifier);
  const candidates = [];
  if (await existingFile(base)) candidates.push(base);
  if (!extname(base)) {
    for (const extension of RESOLUTION_EXTENSIONS) {
      candidates.push(`${base}${extension}`);
    }
  }
  if (await existingDirectory(base)) {
    for (const extension of RESOLUTION_EXTENSIONS) {
      candidates.push(join(base, `index${extension}`));
    }
  } else {
    for (const extension of RESOLUTION_EXTENSIONS) {
      candidates.push(join(base, `index${extension}`));
    }
  }
  for (const candidate of candidates) {
    if (await existingFile(candidate)) return candidate;
  }
  return null;
}

function findingKey(finding) {
  return `${finding.entry}\0${finding.file}\0${finding.rule}\0${finding.detail}`;
}

export async function inspectStaticPublicImportBoundary(
  entries,
  options = {}
) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new TypeError("static public import entries must be a non-empty array");
  }
  const root = resolve(options.root ?? process.cwd());
  const rootReal = await realpath(root);
  const findings = [];
  const findingKeys = new Set();

  function addFinding(finding) {
    const key = findingKey(finding);
    if (findingKeys.has(key)) return;
    findingKeys.add(key);
    findings.push(finding);
  }

  for (const suppliedEntry of entries) {
    const entryCandidate = isAbsolute(suppliedEntry)
      ? resolve(suppliedEntry)
      : resolve(root, suppliedEntry);
    const entry = portablePath(relative(root, entryCandidate));
    if (!isInside(root, entryCandidate)) {
      addFinding({
        entry,
        file: entry,
        rule: "path-escape",
        detail: "entry resolves outside repository root"
      });
      continue;
    }

    let entryReal;
    try {
      entryReal = await realpath(entryCandidate);
    } catch {
      addFinding({
        entry,
        file: entry,
        rule: "missing-entry",
        detail: "entry file does not exist"
      });
      continue;
    }
    if (!isInside(rootReal, entryReal)) {
      addFinding({
        entry,
        file: entry,
        rule: "path-escape",
        detail: "entry symlink resolves outside repository root"
      });
      continue;
    }

    const visited = new Set();
    async function visit(file, chain) {
      let fileReal;
      try {
        fileReal = await realpath(file);
      } catch {
        addFinding({
          entry,
          file: portablePath(relative(root, file)),
          rule: "unresolved-import",
          detail: "resolved file disappeared"
        });
        return;
      }
      const filePath = portablePath(relative(rootReal, fileReal));
      if (!isInside(rootReal, fileReal)) {
        addFinding({
          entry,
          file: filePath,
          rule: "path-escape",
          detail: "import symlink resolves outside repository root"
        });
        return;
      }

      if (filePath === LANDING_LOADER) {
        const importer = chain.at(-1);
        const allowedLandingEntry =
          LANDING_ENTRIES.has(entry) &&
          chain.includes(LANDING_BRIDGE) &&
          importer === LANDING_RENDERER;
        const allowedSeoComparison =
          REVIEWED_SEO_LOADER_ENTRIES.has(entry) &&
          importer === SEO_COMPARISON;
        if (!allowedLandingEntry && !allowedSeoComparison) {
          addFinding({
            entry,
            file: filePath,
            rule: "landing-loader-boundary",
            detail: "menuExperiences is outside the exact reviewed landing and SEO comparison chains"
          });
        }
      }

      if (
        !REVIEWED_PUBLIC_OWNER_HELPERS.has(filePath) &&
        FORBIDDEN_PATH_PATTERNS.some((pattern) => pattern.test(filePath))
      ) {
        addFinding({
          entry,
          file: filePath,
          rule: "forbidden-path",
          detail: filePath.replace(/\.[^/.]+$/, "")
        });
        return;
      }
      if (visited.has(fileReal)) return;
      visited.add(fileReal);
      if (!CODE_EXTENSIONS.has(extname(fileReal).toLowerCase())) return;

      const source = await readFile(fileReal, "utf8");
      const sourceFile = ts.createSourceFile(
        fileReal,
        source,
        ts.ScriptTarget.Latest,
        true,
        scriptKind(fileReal)
      );
      const moduleSpecifiers = literalModuleSpecifiers(sourceFile);
      if (filePath === PUBLIC_EXTERNAL_DATA_FACADE) {
        for (const specifier of moduleSpecifiers) {
          if (!PUBLIC_EXTERNAL_DATA_FACADE_IMPORTS.has(specifier)) {
            addFinding({
              entry,
              file: filePath,
              rule: "public-data-facade-import",
              detail: specifier
            });
          }
        }
        if (!moduleSpecifiers.includes(PUBLIC_EXTERNAL_DATA_DELEGATE_SPECIFIER)) {
          addFinding({
            entry,
            file: filePath,
            rule: "public-data-facade-import",
            detail: `missing ${PUBLIC_EXTERNAL_DATA_DELEGATE_SPECIFIER}`
          });
        }
      }
      if (callsCreateSignedUrl(sourceFile)) {
        addFinding({
          entry,
          file: filePath,
          rule: "signed-url-capability",
          detail: "createSignedUrl"
        });
      }
      for (const environmentKey of environmentReads(sourceFile)) {
        const allowed =
          environmentKey.startsWith("NEXT_PUBLIC_") ||
          PUBLIC_BUILD_ENVIRONMENT_KEYS.has(environmentKey) ||
          (environmentKey === "NODE_TEST_CONTEXT" &&
            filePath === SAUGE_RENDERER_BINDINGS);
        if (!allowed) {
          addFinding({
            entry,
            file: filePath,
            rule: "non-public-environment",
            detail: environmentKey
          });
        }
      }

      for (const specifier of moduleSpecifiers) {
        if (packageIsForbidden(specifier)) {
          addFinding({
            entry,
            file: filePath,
            rule: "forbidden-package",
            detail: specifier
          });
          continue;
        }
        const local = specifier.startsWith("@/") || specifier.startsWith("./") || specifier.startsWith("../");
        if (!local) continue;
        const resolvedImport = await resolveLocalImport(specifier, fileReal, rootReal);
        if (!resolvedImport) {
          addFinding({
            entry,
            file: filePath,
            rule: "unresolved-import",
            detail: specifier
          });
          continue;
        }
        if (
          filePath === PUBLIC_EXTERNAL_DATA_FACADE &&
          specifier === PUBLIC_EXTERNAL_DATA_DELEGATE_SPECIFIER
        ) {
          const delegateReal = await realpath(resolvedImport);
          const delegatePath = portablePath(
            relative(rootReal, delegateReal)
          );
          if (
            isInside(rootReal, delegateReal) &&
            delegatePath === PUBLIC_EXTERNAL_DATA_DELEGATE
          ) {
            continue;
          }
          addFinding({
            entry,
            file: filePath,
            rule: "public-data-facade-import",
            detail: `${specifier} resolves to ${delegatePath}`
          });
        }
        await visit(resolvedImport, [...chain, filePath]);
      }
    }

    await visit(entryReal, []);
  }

  return findings.sort(
    (left, right) =>
      left.entry.localeCompare(right.entry) ||
      left.file.localeCompare(right.file) ||
      left.rule.localeCompare(right.rule) ||
      left.detail.localeCompare(right.detail)
  );
}

async function main() {
  const findings = await inspectStaticPublicImportBoundary(
    STATIC_PUBLIC_ENTRY_FILES
  );
  if (findings.length > 0) {
    for (const finding of findings) {
      process.stderr.write(
        `${finding.entry} -> ${finding.file}: ${finding.rule} (${finding.detail})\n`
      );
    }
    process.exitCode = 1;
    return;
  }
  process.stdout.write(
    `Static public import boundary: PASS (${STATIC_PUBLIC_ENTRY_FILES.length} entries)\n`
  );
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    process.stderr.write(`Static public import boundary: FAIL (${error.message})\n`);
    process.exitCode = 1;
  });
}
