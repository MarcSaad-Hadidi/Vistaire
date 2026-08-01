import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const componentUrl = new URL(
  "../components/vistaire-preview/VistairePreviewPdfCompareSlider.tsx",
  import.meta.url
);

function extractFunctionBody(source, functionName) {
  const declarationStart = source.indexOf(`const ${functionName} =`);
  assert.notEqual(declarationStart, -1, `${functionName} declaration is missing`);

  const bodyStart = source.indexOf("{", declarationStart);
  assert.notEqual(bodyStart, -1, `${functionName} body is missing`);

  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(bodyStart + 1, index);
  }

  assert.fail(`${functionName} body is not balanced`);
}

test("serializes Home then Shift+ArrowRight before React commits rendered state", async () => {
  const source = await readFile(componentUrl, "utf8");
  const handlerBody = extractFunctionBody(source, "onKeyDown");
  const runSequence = new Function(
    "split",
    `
      const nextSplitRef = { current: split };
      const committed = [];
      const commitSplit = (value) => {
        const next = Math.max(0, Math.min(100, value));
        nextSplitRef.current = next;
        committed.push(next);
      };
      const hasInteracted = false;
      const setHasInteracted = () => {};
      const onKeyDown = (event) => {${handlerBody}};
      const event = (key, shiftKey = false) => ({
        key,
        shiftKey,
        preventDefault() {}
      });

      onKeyDown(event("Home"));
      onKeyDown(event("ArrowRight", true));
      return committed;
    `
  );

  assert.deepEqual(runSequence(18), [0, 10]);
});
