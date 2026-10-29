/**
 * Integration check without a running DSH: fake the two host seams we rely on
 * (`connection.fetch.register` and the client slot registry) and drive the real
 * code paths. If this passes, the only unknown left is whether DSH itself
 * renders the tab.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { apply as hostApply } from "../lib/index.js";

const profileDir = "E:/DeepSeek Harness/.dsh/profiles/desktop";

// --- host half -------------------------------------------------------------
const routes = new Map();
const effects = [];
const injected = [];
const ctx = {
  get: (key) => (key === "profileContext" ? { dir: profileDir, name: "desktop" } : undefined),
  effect: (factory, label) => {
    effects.push({ label, dispose: factory() });
    return () => {};
  },
  on: (event, handler) => {
    if (event === "webserver/index-inject") {
      const table = [];
      handler(table);
      injected.push(...table);
    }
  },
  connection: {
    fetch: {
      register: (spec) => {
        routes.set(spec.path, spec.fetch);
        return () => routes.delete(spec.path);
      },
    },
  },
};

hostApply(ctx, {});
console.log("routes:", [...routes.keys()].join(", "));
console.log("effects:", effects.map((effect) => effect.label).join(", "));
console.log("index-inject:", injected.map((entry) => entry.name).join(", "));
assert.ok(routes.has("/api/installed-inventory/snapshot"));

const snapshotBody = await routes.get("/api/installed-inventory/snapshot")(new Request("http://localhost/api/installed-inventory/snapshot"));
const snapshot = snapshotBody.body ? await snapshotBody.json() : null;
const payload = snapshot ?? (await (async () => JSON.parse(await new Response(snapshotBody).text()))());
console.log("status:", snapshotBody.status, "total:", payload.snapshot.counts.total, "warnings:", payload.snapshot.warnings.length);

const self = payload.snapshot.plugins.find((plugin) => plugin.name === "dsh-installed-inventory");
console.log("self record:", JSON.stringify({
  display: self.displayNames[0],
  source: self.displayNameSource,
  loaded: self.inBundles,
  entries: Object.entries(self.surfaces).filter(([, v]) => v.length > 0).map(([k]) => k),
  category: self.category.label,
  family: self.family.label,
}));
assert.equal(self.inBundles, true);
assert.ok(self.surfaces.pluginTab.length > 0);

const detailResponse = await routes.get("/api/installed-inventory/detail")(
  new Request(`http://localhost/api/installed-inventory/detail?name=${encodeURIComponent("dsh-context")}`)
);
const detail = await detailResponse.json();
const present = detail.matrix.filter((row) => row.present).map((row) => `${row.label}${row.risk ? "(risk)" : ""}`);
console.log("detail matrix (dsh-context):", present.join(" / "));
console.log("patch snippets:", detail.patchSnippets.length, "size:", detail.plugin.sizeBytes);

const exportResponse = await routes.get("/api/installed-inventory/export")(new Request("http://localhost/api/installed-inventory/export?format=md"));
const markdown = await exportResponse.text();
console.log("md head:", markdown.split("\n").slice(0, 3).join(" | "));

// --- client half -----------------------------------------------------------
const captured = {};
// Minimal DOM stubs: apply() injects one <style> element.
const head = [];
globalThis.document = {
  head: { appendChild: (node) => head.push(node) },
  getElementById: () => null,
  querySelectorAll: () => [],
  createElement: () => ({ set textContent(value) { this._text = value; }, get textContent() { return this._text; } }),
};
globalThis.window = {
  __ModuleLoader__: {
    load: (module) => {
      captured.id = module.id;
      captured.exports = module.factory((name) => {
        if (name === "react") {
          return {
            createElement: (type, props, ...children) => ({ type, props, children }),
            useState: () => [null, () => {}],
            useEffect: () => {},
            useMemo: (factory) => factory(),
            useCallback: (fn) => fn,
            useRef: (value) => ({ current: value }),
          };
        }
        throw new Error(`unexpected require: ${name}`);
      });
    },
  },
};

const source = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");
new Function("window", "document", source)(globalThis.window, globalThis.document);
console.log("client id:", captured.id, "inject:", captured.exports.inject.join(","));

const slots = [];
const clientCtx = {
  effect: (factory) => factory(),
  locale: {
    bind: (ns) => (key) => `${ns}.${key}`,
    register: () => () => {},
  },
  slots: {
    inject: (name, factory) => factory(),
    register: (spec, render) => {
      slots.push({ name: spec.name, id: spec.id, order: spec.order, hasRender: typeof render === "function" });
      return () => {};
    },
  },
};
captured.exports.apply(clientCtx);
console.log("client slots:", JSON.stringify(slots), "style injected:", head.length === 1);
assert.equal(slots.length, 2);
assert.deepEqual(slots.map((slot) => slot.name).sort(), ["plugins.detail.section", "plugins.tab"]);

for (const effect of effects.reverse()) effect.dispose();
console.log("\nALL INTEGRATION CHECKS PASSED");
