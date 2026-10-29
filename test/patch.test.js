import test from "node:test";
import assert from "node:assert/strict";
import { parsePatch } from "../lib/patch.js";

const DOC = `# profile patch layer
- id: agent-default-model
  name: "@deepseek-ai/dsh-agent-default-model"
  config:
    provider: localhost
    models:
      - id: qwen2.5:1.5b
      - id: llama3.2:3b
- id: prompt-with-list
  name: some-plugin
  config:
    systemPrompt: |
      You are a helper.
      - id: not-an-entry
      - id: still-not-an-entry
  disabled: true
- insert:
    - id: bundled-child
      name: child-plugin
      config:
        enabled: true
- id: web-ui-pet
  name: "@linxin666/dsh-pet"
  config:
    size: 2
- id: web-ui-pet
  disabled: true
`;

test("parses root and insert entries, ignoring config lists", () => {
  const result = parsePatch(DOC);
  assert.equal(result.ok, true);
  assert.deepEqual(
    result.entries.map((entry) => entry.id),
    ["agent-default-model", "prompt-with-list", "bundled-child", "web-ui-pet", "web-ui-pet"]
  );
});

test("model ids inside config never become entries", () => {
  const ids = parsePatch(DOC).entries.map((entry) => entry.id);
  assert.ok(!ids.includes("qwen2.5:1.5b"));
  assert.ok(!ids.includes("not-an-entry"));
});

test("keys after a block scalar still belong to their entry", () => {
  const entry = parsePatch(DOC).entries.find((item) => item.id === "prompt-with-list");
  assert.equal(entry.disabled, true);
  assert.equal(entry.hasConfig, true);
});

test("collects every duplicate id, not just the first", () => {
  const result = parsePatch(DOC);
  assert.deepEqual(result.duplicates, ["web-ui-pet"]);
});

test("empty document is not an error", () => {
  assert.equal(parsePatch("[]\n").ok, true);
  assert.equal(parsePatch("").ok, false);
});
