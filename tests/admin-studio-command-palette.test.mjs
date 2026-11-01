import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("approved command composition uses supplied menu data and accessible library primitives", async () => {
  const source = await readFile("components/admin/studio/StudioCommandPalette.tsx", "utf8");
  assert.match(source, /import \{ Command \} from "cmdk"/);
  assert.match(source, /import \{ Dialog \} from "radix-ui"/);
  assert.match(source, /import type \{ AdminMenuDish \}/);
  for (const primitive of ["Dialog.Title", "Dialog.Description", "Command.Input", "Command.List", "Command.Empty", "Command.Item", "onCloseAutoFocus"])
    assert.ok(source.includes(primitive), primitive);
  assert.match(source, /dishes\.map/);
  assert.match(source, /navigate\.map/);
  assert.match(source, /normalize\("NFD"\)/);
  assert.match(source, /alive\.current = true/);
  assert.match(source, /alive\.current = false;\s*pending\.current = null/);
  assert.match(source, /onCloseAutoFocus=\{\(\) => \{\s*if \(!alive\.current\) return/);
  assert.doesNotMatch(source, /fetch\(|localStorage|Math\.random|Sauge Noire|@\/lib\/admin\/(?!menuReadiness)/);
});

test("shortcut respects editing, composing, repeats and existing dialogs", async () => {
  const source = await readFile("components/admin/studio/StudioCommandPalette.tsx", "utf8");
  for (const guard of ["event.metaKey", "event.ctrlKey", "event.altKey", "event.isComposing", "event.repeat", "contenteditable", "dialog[open]"])
    assert.ok(source.includes(guard), guard);
  const css = await readFile("components/admin/studio/StudioCommandPalette.module.css", "utf8");
  assert.match(css, /max-width: 650px/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /data-selected="true"/);
});
