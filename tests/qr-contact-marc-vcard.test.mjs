import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const routeUrl = new URL("../app/contact/marc/route.ts", import.meta.url);
const routePath = fileURLToPath(routeUrl);

test("publishes Marc's permanent public vCard route", () => {
  assert.equal(
    existsSync(routePath),
    true,
    "app/contact/marc/route.ts must exist so the printed QR URL stays permanent"
  );
});

test("returns an iPhone-friendly Marc Saad-Hadidi vCard", async (t) => {
  if (!existsSync(routePath)) {
    t.skip("route not implemented yet");
    return;
  }

  const { GET } = await import(routeUrl.href);
  const response = GET();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/vcard; charset=utf-8");
  assert.equal(
    response.headers.get("content-disposition"),
    'attachment; filename="marc-saad-hadidi.vcf"'
  );
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);

  const body = await response.text();

  assert.equal(body.startsWith("BEGIN:VCARD\r\nVERSION:3.0\r\n"), true);
  assert.equal(body.endsWith("END:VCARD\r\n"), true);
  assert.match(body, /\r\nN:Saad-Hadidi;Marc;;;\r\n/);
  assert.match(body, /\r\nFN:Marc Saad-Hadidi\r\n/);
  assert.match(body, /\r\nORG:Vistaire\r\n/);
  assert.match(body, /\r\nTITLE:Founder & CEO\r\n/);
  assert.match(body, /\r\nTEL;TYPE=CELL,VOICE:\+15147152421\r\n/);
  assert.match(body, /\r\nEMAIL;TYPE=INTERNET:contact@vistaire\.ca\r\n/);
  assert.match(body, /\r\nURL:https:\/\/www\.vistaire\.ca\/en\r\n/);
  assert.match(
    body,
    /\r\nitem1\.URL:https:\/\/ca\.linkedin\.com\/in\/marc-saad-hadidi-403042339\r\n/
  );
  assert.match(body, /\r\nitem1\.X-ABLabel:LinkedIn\r\n/);
  assert.doesNotMatch(body, /<!doctype|<html|<body/i);
  assert.equal(body.includes("\n") && !body.includes("\r\n"), false);
});
