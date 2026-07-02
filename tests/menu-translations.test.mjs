import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import {
  estimateChangedCharacters,
  fieldHashesFor,
  resolveEntityTranslationStatus,
  sourceHashFor,
  summarizeLocaleTranslationStatus
} from "../lib/translation/menuTranslationModel.ts";
import {
  getServerTranslator,
  resolveTranslationProviderStatus
} from "../lib/translation/serverTranslatorCore.ts";

const repoRootUrl = new URL("..", import.meta.url);
const repoRootPath = fileURLToPath(repoRootUrl);

async function readRepoFile(path) {
  return readFile(new URL(path, repoRootUrl), "utf8");
}

async function collectSourceFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (
      entry.isDirectory() &&
      ![".git", ".next", "node_modules", "public"].includes(entry.name)
    ) {
      files.push(...await collectSourceFiles(fullPath));
    }
    if (
      entry.isFile() &&
      /\.(?:ts|tsx|js|jsx|mjs|sql|example)$/.test(entry.name)
    ) {
      files.push(fullPath);
    }
  }
  return files;
}

test("translation migration keeps RLS server-only for public rendering", async () => {
  const migration = await readRepoFile("supabase/migrations/20260702090000_menu_translations.sql");
  const tables = [
    "menu_translations",
    "menu_category_translations",
    "menu_dish_translations",
    "menu_translation_jobs"
  ];

  for (const table of tables) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security;`));
    assert.match(migration, new RegExp(`revoke all on table public\\.${table} from anon, authenticated;`));
    assert.match(
      migration,
      new RegExp(`grant select, insert, update, delete on table public\\.${table} to service_role;`)
    );
  }

  assert.doesNotMatch(migration, /create\s+policy[\s\S]+to\s+anon/i);
  assert.doesNotMatch(migration, /create\s+policy[\s\S]+to\s+authenticated/i);
  assert.doesNotMatch(migration, /grant\s+select[\s\S]+to\s+anon/i);
  assert.doesNotMatch(migration, /grant\s+select[\s\S]+to\s+authenticated/i);
});

test("translation server code stays server-only and client components avoid admin Supabase imports", async () => {
  const publicOverlay = await readRepoFile("lib/menu/publicMenuTranslations.ts");
  const serverTranslator = await readRepoFile("lib/translation/serverTranslator.ts");
  const sourceFiles = await collectSourceFiles(repoRootPath);

  assert.match(publicOverlay, /import "server-only"/);
  assert.match(publicOverlay, /getSupabaseAdminClient/);
  assert.match(publicOverlay, /\.eq\("locale", activeLocale\)/);
  assert.doesNotMatch(publicOverlay, /\.select\("\*"\)/);
  assert.match(serverTranslator, /import "server-only"/);

  for (const file of sourceFiles) {
    const source = await readFile(file, "utf8");
    const relativePath = relative(repoRootPath, file);
    assert.doesNotMatch(
      source,
      /NEXT_PUBLIC_(?:AZURE|TRANSLATION|TRANSLATOR)/,
      `${relativePath} must not expose translation secrets through NEXT_PUBLIC`
    );

    const firstStatement = source.trimStart().split(/\r?\n/, 1)[0]?.trim();
    if (firstStatement === "\"use client\";" || firstStatement === "'use client';") {
      assert.doesNotMatch(
        source,
        /utils\/supabase\/admin|@\/utils\/supabase\/admin/,
        `${relativePath} is a client component and must not import Supabase admin`
      );
    }
  }
});

test("translation hashes detect missing, stale, manual override, and up-to-date entities", () => {
  const entity = {
    type: "dish",
    id: "dish-1",
    fields: {
      name: "Tomato soup",
      description: "Warm tomato and basil.",
      ingredients: ["tomato", "basil"]
    }
  };
  const stored = {
    locale: "es-ES",
    translation_status: "up_to_date",
    source_hash: sourceHashFor(entity.fields),
    field_hashes: fieldHashesFor(entity.fields),
    content: {
      name: "Sopa de tomate",
      description: "Tomate y albahaca.",
      ingredients: ["tomate", "albahaca"]
    }
  };

  assert.deepEqual(resolveEntityTranslationStatus(entity), {
    status: "missing",
    estimatedCharacters: 44
  });
  assert.deepEqual(resolveEntityTranslationStatus(entity, stored), {
    status: "up_to_date",
    estimatedCharacters: 0
  });

  const changedEntity = {
    ...entity,
    fields: { ...entity.fields, name: "Tomato soup of the day" }
  };
  assert.deepEqual(resolveEntityTranslationStatus(changedEntity, stored), {
    status: "stale",
    estimatedCharacters: 22
  });

  assert.equal(
    estimateChangedCharacters(changedEntity, {
      ...stored,
      manual_overrides: { name: true }
    }),
    0
  );
});

test("locale summaries avoid retraduction when only unchanged fields have stored content", () => {
  const menuEntity = {
    type: "menu",
    id: "menu-1",
    fields: { restaurantName: "Cafe Vistaire" }
  };
  const dishEntity = {
    type: "dish",
    id: "dish-1",
    fields: { name: "Salad", options: ["extra lemon"] }
  };
  const rowsByKey = new Map([
    [
      "menu:menu-1",
      {
        locale: "es-ES",
        translation_status: "up_to_date",
        source_hash: sourceHashFor(menuEntity.fields),
        field_hashes: fieldHashesFor(menuEntity.fields),
        content: { restaurantName: "Cafe Vistaire ES" }
      }
    ]
  ]);

  assert.deepEqual(
    summarizeLocaleTranslationStatus({
      locale: "es-ES",
      defaultLocale: "fr-CA",
      entities: [menuEntity, dishEntity],
      rowsByKey
    }),
    {
      locale: "es-ES",
      status: "missing",
      estimatedCharacters: 16,
      missingEntities: 1,
      staleEntities: 0,
      errorEntities: 0
    }
  );
});

test("server translator reports missing provider, supports mock, and calls Azure REST server-side", async () => {
  assert.deepEqual(resolveTranslationProviderStatus({}), {
    configured: false,
    provider: "none",
    reason: "TRANSLATION_PROVIDER n'est pas configure."
  });
  assert.equal(getServerTranslator({}), null);

  const mock = getServerTranslator({ TRANSLATION_PROVIDER: "mock" });
  assert.equal(mock?.provider, "mock");
  assert.deepEqual(
    await mock?.translateTexts({
      texts: ["Tomato soup", "Basil"],
      fromLocale: "fr-CA",
      toLocale: "es-ES"
    }),
    ["[es-ES] Tomato soup", "[es-ES] Basil"]
  );

  const originalFetch = globalThis.fetch;
  let seenUrl = "";
  let seenInit = null;
  globalThis.fetch = async (url, init) => {
    seenUrl = String(url);
    seenInit = init;
    return {
      ok: true,
      async json() {
        return [
          { translations: [{ text: "Sopa de tomate" }] },
          { translations: [{ text: "Albahaca" }] }
        ];
      }
    };
  };

  try {
    const azure = getServerTranslator({
      TRANSLATION_PROVIDER: "azure",
      AZURE_TRANSLATOR_KEY: "test-key",
      AZURE_TRANSLATOR_ENDPOINT: "https://translator.example.test/",
      AZURE_TRANSLATOR_REGION: "canadacentral"
    });

    assert.equal(azure?.provider, "azure");
    assert.deepEqual(
      await azure?.translateTexts({
        texts: ["Tomato soup", "Basil"],
        fromLocale: "fr-CA",
        toLocale: "es-ES"
      }),
      ["Sopa de tomate", "Albahaca"]
    );

    const parsed = new URL(seenUrl);
    assert.equal(`${parsed.origin}${parsed.pathname}`, "https://translator.example.test/translate");
    assert.equal(parsed.searchParams.get("api-version"), "3.0");
    assert.equal(parsed.searchParams.get("from"), "fr");
    assert.equal(parsed.searchParams.get("to"), "es");
    assert.equal(parsed.searchParams.get("textType"), "plain");
    assert.equal(seenInit.method, "POST");
    assert.equal(seenInit.headers["Ocp-Apim-Subscription-Key"], "test-key");
    assert.equal(seenInit.headers["Ocp-Apim-Subscription-Region"], "canadacentral");
    assert.deepEqual(JSON.parse(seenInit.body), [
      { text: "Tomato soup" },
      { text: "Basil" }
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
