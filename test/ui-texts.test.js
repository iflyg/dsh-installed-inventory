import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractUiTexts } from "../lib/ui-texts.js";

const manifest = {
  name: "dsh-fake",
  version: "1.0.0",
  exports: { "./client": "./lib/client.js" },
  dsh: { bundle: { patch: "./cordis.patch.yml" } },
};

function makePkg(files) {
  const dir = mkdtempSync(join(tmpdir(), "uitext-"));
  for (const [rel, body] of Object.entries(files)) {
    const target = join(dir, rel);
    mkdirSync(join(target, ".."), { recursive: true });
    writeFileSync(target, body, "utf8");
  }
  return dir;
}

test("a runtime-registered label is harvestable from the bundle", () => {
  const dir = makePkg({
    "lib/client.js": `
      // the family-host backstop pattern: the label literal sits nowhere near
      // the actual slots.register call, exactly like dsh-brief-sidebar's.
      const claim = () => "起子插件设置";
      slots.register({ name: "settings.section", id: "x", order: 40, label });
    `,
  });
  try {
    const texts = extractUiTexts(dir, manifest, "dsh-fake");
    const hit = texts.find((entry) => entry.text === "起子插件设置");
    assert.ok(hit !== undefined, "label literal is harvested");
    assert.ok(["menu", "config", "family"].includes(hit.where), `label is seat-tagged, got ${hit.where}`);
    // identifiers and slot paths never surface as UI text
    assert.equal(texts.find((entry) => entry.text === "settings.section"), undefined);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("locale strings and seat-adjacent latin labels are harvested, junk is not", () => {
  const dir = makePkg({
    "lib/client.js": `
      slots.register({ name: "plugins.tab", id: "backup", order: 1 });
      const zh = { nav: "备份助手" };
    `,
    "locale/zh.json": JSON.stringify({ meta: { title: "备份与恢复" }, rows: ["定时备份", "ignore-this-way-too-long-".repeat(3)] }),
  });
  try {
    const texts = extractUiTexts(dir, manifest, "dsh-fake");
    assert.ok(texts.some((entry) => entry.text === "备份与恢复" && entry.where === "locale"), "locale title harvested");
    assert.ok(texts.some((entry) => entry.text === "定时备份"), "locale row value harvested");
    assert.ok(texts.some((entry) => entry.text === "backup" && entry.where === "tab"), "seat-adjacent latin label harvested");
    // seat-adjacent junk (slot paths, identifiers) must not surface
    assert.equal(texts.find((entry) => entry.text === "plugins.tab"), undefined);
    assert.equal(texts.find((entry) => entry.text === "id"), undefined);
    assert.equal(texts.some((entry) => entry.text.includes("ignore-this-way-too-long")), false, "over-long strings dropped");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
