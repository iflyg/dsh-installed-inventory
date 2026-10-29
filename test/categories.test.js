import test from "node:test";
import assert from "node:assert/strict";
import { CATEGORY_LABELS, classifyPackage } from "../lib/categories.js";
import { buildFamilies } from "../lib/family.js";

/**
 * Classify a name with an optional description.
 * @param {string} name - package name.
 * @param {string} [description] - manifest description.
 * @param {string[]} [keywords] - manifest keywords.
 * @returns {string} category label.
 */
function labelOf(name, description = "", keywords = ["dsh-plugin"]) {
  return classifyPackage({ name, description, keywords }, {}).label;
}

test("short ASCII words match on boundaries, not inside other words", () => {
  // `michengai` ends in "ai" and contains "agi" nowhere near a boundary; the
  // first build filed an IM connector under AGI research because of it.
  assert.notEqual(labelOf("@michengai/dsh-im-connect", "Connect IM platforms"), "AGI 架构探索");
  // "repair" contains "pair" (remote pairing) and "preview" contains "review".
  assert.notEqual(labelOf("dsh-ui-repair", "Windows titlebar patch"), "远程与移动端");
  assert.equal(labelOf("dsh-preview-market", "preview market for plugins"), "插件市场与管理");
});

test("a suffix hit beats a longer word in the middle of the name", () => {
  assert.equal(labelOf("dsh-claude-style", "Claude Code desktop theme"), "主题与外观");
  assert.equal(labelOf("dsh-better-sidebar", "file tree and editor"), "UI 增强");
});

test("the dsh prefix does not hide a keyword", () => {
  assert.equal(labelOf("dshmarket", "visual plugin market"), "插件市场与管理");
});

test("every category label is inside the published taxonomy", () => {
  const extra = labelOf("dsh-unknown-thing", "");
  assert.ok(extra === "未分类" || CATEGORY_LABELS.includes(extra));
});

test("families expose the author used as the group title", () => {
  const { families } = buildFamilies([
    { name: "@linxin666/dsh-web-all", repo: "https://github.com/zhu1090093659/dsh-web", dependencies: { "@linxin666/dsh-client-ui-market": "1.0.0" } },
    { name: "@linxin666/dsh-client-ui-market", repo: "https://github.com/zhu1090093659/dsh-web", dependencies: {} },
  ]);
  assert.equal(families.length, 1);
  assert.equal(families[0].author, "@linxin666");
  assert.equal(families[0].label, "@linxin666");
  assert.equal(families[0].aggregate, "@linxin666/dsh-web-all");
});
