import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("the shared dashboard walkthrough uses the approved baked-3x media at native speed and size", () => {
  const source = readFileSync("components/vistaire-preview/DashboardWalkthrough.tsx", "utf8");
  const player = readFileSync("components/vistaire-preview/DemoWalkthroughVideo.tsx", "utf8");
  const styles = readFileSync("components/vistaire-preview/VistaireRestaurateurDashboardPreview.module.css", "utf8");
  assert.match(source, /https:\/\/cdn\.vistaire\.ca\/demo\/dashboard-studio-3x-67468b94997f\.mp4/);
  assert.match(source, /dashboard-studio-3x\.webp/);
  assert.equal((source.match(/2 min 18/g) ?? []).length, 2);
  assert.match(source, /controls\s+autoPlay/);
  assert.doesNotMatch(source + player, /(?:defaultPlaybackRate|playbackRate)\s*[:=]\s*(?!1\b)\d/);
  assert.match(styles, /aspect-ratio:\s*1166\s*\/\s*756/);
});
