#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const NAMED_STATIC_PUBLIC_ROUTES = Object.freeze([
  "/",
  "/a-propos",
  "/contact",
  "/prendre-rendez-vous",
  "/menu-digital-restaurant",
  "/menu-pdf-vs-menu-digital",
  "/menu-qr-code-restaurant",
  "/menu-3d-ar-restaurant",
  "/tarifs-menu-digital-restaurant",
  "/guides/anatomie-menu-digital-premium",
  "/guides/menu-qr-mobile-sans-application",
  "/guides/3d-restaurant-utile-vs-gadget",
  "/apercu-restaurateur",
  "/en",
  "/en/about",
  "/en/contact",
  "/en/book-a-call",
  "/en/digital-restaurant-menu",
  "/en/pdf-vs-digital-menu",
  "/en/qr-code-restaurant-menu",
  "/en/3d-ar-restaurant-menu",
  "/en/pricing-digital-restaurant-menu",
  "/en/guides/premium-digital-menu-anatomy",
  "/en/guides/mobile-qr-menu-without-app",
  "/en/guides/restaurant-3d-useful-vs-gimmick",
  "/en/restaurant-preview"
]);

const DYNAMIC_EXACT_ROUTES = new Set([
  "/demo",
  "/en/vistaire-menu",
  "/[slug]",
  "/en/[slug]"
]);
const DYNAMIC_ROUTE_PREFIXES = [
  "/admin",
  "/owner",
  "/api",
  "/q",
  "/menu",
  "/sign-in",
  "/todos",
  "/legacy"
];

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isApprovedDynamicSurface(route) {
  if (DYNAMIC_EXACT_ROUTES.has(route)) return true;
  return DYNAMIC_ROUTE_PREFIXES.some(
    (prefix) => route === prefix || route.startsWith(`${prefix}/`)
  );
}

function validRevalidate(value) {
  return value === false || (typeof value === "number" && value > 0);
}

export function validateStaticPublicRoutes(manifest) {
  if (!isRecord(manifest)) throw new TypeError("prerender manifest must be an object");
  if (!isRecord(manifest.routes)) {
    throw new TypeError("prerender manifest routes must be an object");
  }
  if (!isRecord(manifest.dynamicRoutes)) {
    throw new TypeError("prerender manifest dynamicRoutes must be an object");
  }

  const dynamic = Object.keys(manifest.dynamicRoutes);
  for (const route of NAMED_STATIC_PUBLIC_ROUTES) {
    if (Object.hasOwn(manifest.dynamicRoutes, route)) {
      throw new Error(`named static public route is dynamic: ${route}`);
    }
    if (!Object.hasOwn(manifest.routes, route)) {
      throw new Error(`missing named static public route: ${route}`);
    }
    const revalidate = manifest.routes[route]?.initialRevalidateSeconds;
    if (!validRevalidate(revalidate)) {
      throw new Error(`invalid initialRevalidateSeconds for ${route}`);
    }
  }

  for (const route of Object.keys(manifest.routes)) {
    if (isApprovedDynamicSurface(route)) {
      throw new Error(`dynamic route is prerendered: ${route}`);
    }
  }

  return {
    named: [...NAMED_STATIC_PUBLIC_ROUTES],
    dynamic
  };
}

async function main() {
  const manifestPath = resolve(".next", "prerender-manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const result = validateStaticPublicRoutes(manifest);
  process.stdout.write(
    `Static public route manifest: PASS (${result.named.length} named, ${result.dynamic.length} dynamic templates)\n`
  );
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    process.stderr.write(`Static public route manifest: FAIL (${error.message})\n`);
    process.exitCode = 1;
  });
}
