import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);

function loadUploader(hooks) {
  const sourcePromise = readFile(
    new URL("../components/owner/OwnerDishPhotoUploader.tsx", import.meta.url),
    "utf8"
  );

  return sourcePromise.then((source) => {
    const compiled = ts.transpileModule(source, {
      compilerOptions: {
        esModuleInterop: true,
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022
      }
    }).outputText;
    const componentModule = { exports: {} };
    const componentRequire = (specifier) => {
      if (specifier === "react") return hooks;
      if (specifier === "next/navigation") return { useRouter: () => ({ refresh() {} }) };
      if (specifier.endsWith("OwnerCockpit.module.css")) {
        return {
          tableActions: "tableActions",
          btn: "btn",
          btnSmall: "btnSmall",
          cellSub: "cellSub",
          errorText: "errorText"
        };
      }
      return require(specifier);
    };

    new Function("exports", "require", "module", compiled)(
      componentModule.exports,
      componentRequire,
      componentModule
    );
    return componentModule.exports.OwnerDishPhotoUploader;
  });
}

function createHookHarness() {
  const values = [];
  let cursor = 0;

  return {
    hooks: {
      useRef(initialValue) {
        const index = cursor++;
        values[index] ??= { current: initialValue };
        return values[index];
      },
      useState(initialValue) {
        const index = cursor++;
        values[index] ??= initialValue;
        return [values[index], (nextValue) => {
          values[index] =
            typeof nextValue === "function" ? nextValue(values[index]) : nextValue;
        }];
      }
    },
    render(Component, props) {
      cursor = 0;
      return Component(props);
    }
  };
}

function findElement(node, type) {
  if (!node || typeof node !== "object") return undefined;
  if (node.type === type) return node;
  const children = Array.isArray(node.props?.children)
    ? node.props.children
    : [node.props?.children];
  for (const child of children) {
    const match = findElement(child, type);
    if (match) return match;
  }
  return undefined;
}

test("successful owner photo upload preserves the API's versioned preview URL", async (t) => {
  const versionedImageUrl =
    `/api/public/menu-dishes/dish-1/photo?v=${"a".repeat(64)}`;
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ ok: true, imageUrl: versionedImageUrl })
  );
  const harness = createHookHarness();
  const Uploader = await loadUploader(harness.hooks);
  const props = {
    restaurantId: "restaurant-1",
    dishId: "dish-1",
    dishName: "Betterave"
  };

  const initialTree = harness.render(Uploader, props);
  const input = findElement(initialTree, "input");
  input.props.onChange({
    currentTarget: {
      files: [new File(["photo"], "photo.jpg", { type: "image/jpeg" })]
    }
  });
  await new Promise((resolve) => setImmediate(resolve));

  const updatedTree = harness.render(Uploader, props);
  const image = findElement(updatedTree, "img");
  assert.equal(image.props.src, versionedImageUrl);
});
