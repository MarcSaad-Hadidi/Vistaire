import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("the shared dashboard walkthrough uses the approved baked-3x media at native speed and size", () => {
  const source = readFileSync("components/vistaire-preview/DashboardWalkthrough.tsx", "utf8");
  const player = readFileSync("components/vistaire-preview/DemoWalkthroughVideo.tsx", "utf8");
  const styles = readFileSync("components/vistaire-preview/VistaireRestaurateurDashboardPreview.module.css", "utf8");
  assert.match(source, /https:\/\/cdn\.vistaire\.ca\/demo\/dashboard-studio-3x-67468b94997f\.mp4/);
  assert.match(source, /dashboard-studio-3x\.webp/);
  assert.doesNotMatch(source, /figcaption|<details|<summary|transcript|playLabel/);
  assert.doesNotMatch(source, /\scontrols(?:\s|=)/);
  assert.match(source, /className=\{styles\.dashboardScreen\} inert/);
  assert.match(source, /\sautoPlay\s/);
  assert.match(player, /controls = false/);
  assert.match(player, /\sloop\s/);
  assert.match(player, /\smuted\s/);
  assert.match(player, /\splaysInline\s/);
  assert.match(source, /\sdisablePictureInPicture\s/);
  assert.match(styles, /\.dashboardScreen\s*\{[^}]*pointer-events:\s*none/s);
  // The Studio walkthrough plays at twice its recorded speed (user request).
  assert.match(source, /playbackRate=\{2\}/);
  assert.match(player, /playbackRate = 1\r?\n/);
  assert.match(styles, /aspect-ratio:\s*1166\s*\/\s*756/);
});
