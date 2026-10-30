/**
 * Render smoke test for the browser half.
 *
 * The host's React is not installable here, so this runs the real component
 * against a ~60-line hook runtime: hooks keep state between passes, effects run
 * once, and a second pass happens after the async snapshot lands. It catches the
 * class of failure that a syntax check cannot — a hook order mistake, a missing
 * field, a bad key — before the plugin is installed into the running app.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { scanProfile } from "../lib/scan.js";

const profileDir = "E:/DeepSeek Harness/.dsh/profiles/desktop";
const snapshot = await scanProfile({ profileDir });

let captured = null;
const head = [];
globalThis.document = {
  head: { appendChild: (node) => head.push(node) },
  getElementById: () => null,
  querySelectorAll: () => [],
  createElement: () => ({ set textContent(value) { this._text = value; }, get textContent() { return this._text; } }),
};

const React = {
  createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
  Fragment: "Fragment",
  useState: null,
  useEffect: null,
  useMemo: null,
  useCallback: null,
  useRef: null
};

globalThis.window = {
  __ModuleLoader__: { load: (module) => { captured = module; } },
  addEventListener: () => {},
  removeEventListener: () => {},
};

new Function("window", "document", readFileSync(new URL("../lib/client.js", import.meta.url), "utf8"))(
  globalThis.window,
  globalThis.document
);
assert.ok(captured !== null, "client module registered");

// Minimal hook runtime -------------------------------------------------------
let hookIndex = 0;
let states = [];
let setters = [];
let effects = [];
let refs = [];

React.useState = (initial) => {
  const index = hookIndex++;
  if (states.length <= index) states[index] = typeof initial === "function" ? initial() : initial;
  setters[index] = (next) => {
    states[index] = typeof next === "function" ? next(states[index]) : next;
  };
  return [states[index], setters[index]];
};
React.useEffect = (fn) => {
  effects.push(fn);
};
React.useMemo = (fn) => fn();
React.useCallback = (fn) => fn;
React.useRef = (initial) => {
  const index = hookIndex++;
  refs[index] = refs[index] ?? { current: initial };
  return refs[index];
};

const realSetInterval = globalThis.setInterval;
globalThis.setInterval = () => 0;
globalThis.clearInterval = () => {};
globalThis.fetch = async (url) => {
  const path = String(url);
  if (path.includes("/snapshot")) return { ok: true, status: 200, json: async () => ({ ok: true, snapshot }) };
  if (path.includes("/detail")) {
    const name = decodeURIComponent(String(path).split("name=")[1] ?? "").split("&")[0];
    return {
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        plugin: snapshot.plugins.find((entry) => entry.name === name) ?? snapshot.plugins[0],
        entries: [],
        matrix: [],
        patchSnippets: [],
      }),
    };
  }
  if (path.includes("/revision")) return { ok: true, status: 200, json: async () => ({ ok: true, rev: 1 }) };
  return { ok: false, status: 404, json: async () => ({ ok: false, error: { message: "no" } }) };
};

const t = (key) => key;

// `apply` registers the components; capture the tab render function.
const slots = [];
const clientCtx = {
  effect: (factory) => factory(),
  locale: { bind: () => t, register: () => () => {} },
  slots: {
    inject: (_name, factory) => factory(),
    register: (spec, component) => {
      slots.push({ name: spec.name, component });
      return () => {};
    },
  },
};
const exportsOf = captured.factory((name) => (name === "react" ? React : undefined));
exportsOf.apply(clientCtx);
const tab = slots.find((slot) => slot.name === "plugins.tab");
assert.ok(tab !== undefined, "plugins.tab registered");

/**
 * Evaluate element objects the way React would: function components are called,
 * host elements keep their children. The slot hands back `<Panel/>`, not the
 * rendered tree, so this step is required before anything can be asserted on.
 * @param {unknown} node - element, array, or primitive.
 * @returns {unknown} rendered tree.
 */
function renderTree(node) {
  if (node === null || node === undefined || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map(renderTree);
  if (typeof node.type === "function") {
    const saved = hookIndex;
    hookIndex = 0;
    const inner = renderTree(node.type(node.props));
    hookIndex = saved;
    return inner;
  }
  return { ...node, children: (node.children ?? []).map(renderTree) };
}

const renderPanel = () => {
  hookIndex = 0;
  effects = [];
  return renderTree(tab.component({}));
};

// First pass: no snapshot yet. Effects are collected, then run by hand — this
// is the stand-in for React's commit phase.
let tree = renderPanel();
const firstEffects = effects;
effects = [];
for (const effect of firstEffects) effect();
await new Promise((resolve) => realSetInterval(resolve, 60));
// Second pass: the snapshot effect resolved and queued setSnapshot.
tree = renderPanel();

/** Flatten a rendered tree into its text content. */
function text(node) {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join(" ");
  if (typeof node === "object") return [node.props?.title ?? "", text(node.children)].join(" ");
  return "";
}

/** Collect every element of a type / class from the tree. */
function findAll(node, predicate, out = []) {
  if (node === null || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const child of node) findAll(child, predicate, out);
    return out;
  }
  if (predicate(node)) out.push(node);
  for (const child of node.children ?? []) findAll(child, predicate, out);
  return out;
}

const textOf = text(tree);
assert.ok(textOf.includes("dsh-client-ui-browser-view"), "package name column renders");
assert.ok(textOf.includes("collapseAll"), "collapse-all control renders");
assert.ok(textOf.includes("categoryLabel"), "category filter block renders");
// 71 plugins at 20 per page is four pages; the pager prints
// "pagerPrefix 1 / 4 pagerPage" — centred numbers, total left, per-page right.
assert.ok(/pagerPrefix 1 \/ 4 pagerPage/.test(textOf), `pager reports four pages: ${textOf.slice(-260)}`);
const pagerSides = findAll(tree, (node) => typeof node.props?.className === "string" && node.props.className.startsWith("inv-pager-side"));
assert.equal(pagerSides.length, 2, "pager has a left and a right side around the centred pages");

const rows = findAll(tree, (node) => typeof node.props?.className === "string" && node.props.className.includes("inv-row"));
// 20 rows per page, one of them is the author header row, so 19 plugins max.
assert.ok(rows.length > 0 && rows.length <= 20, `page holds at most 20 rows, got ${rows.length}`);

const groups = findAll(tree, (node) => typeof node.props?.className === "string" && node.props.className === "inv-group");
assert.ok(groups.length > 0, "author group headers render");

// The first cell of every plugin row is the package name.
for (const row of rows) {
  const cells = (row.children ?? []).filter((child) => child?.type === "td");
  assert.equal(cells.length, 6, `family view has six columns, got ${cells.length}`);
  const cellText = text(cells[0]);
  assert.ok(/(^|@)[\w@./-]+/.test(cellText), `first cell looks like a package name: ${cellText}`);
}

// The fourth column is the install-time badge: the state palette is kept for
// colour, but the text is a date stacked over a time.
for (const row of rows) {
  const cells = (row.children ?? []).filter((child) => child?.type === "td");
  const badge = findAll(cells[3], (node) => typeof node.props?.className === "string" && node.props.className.includes("inv-state--when"))[0];
  assert.ok(badge !== undefined, "install-time badge renders in the state column");
  assert.ok(/inv-state--(on|off|idle|via)/.test(badge.props.className), `badge keeps a state tone: ${badge.props.className}`);
  const stamp = text(badge);
  assert.ok(/\d{4}-\d{2}-\d{2}/.test(stamp), `badge shows a date: ${stamp}`);
  assert.ok(/\d{2}:\d{2}/.test(stamp), `badge shows a time: ${stamp}`);
  assert.ok(typeof badge.props.title === "string" && badge.props.title !== "", "badge tooltip carries the state");
}

// The author header spans the whole table instead of leaving phantom cells.
for (const group of groups) {
  const cell = (group.children ?? [])[0];
  assert.equal(cell.props.colSpan, 6, "group header spans six columns");
  assert.ok(text(cell).includes("@"), "group header names the author");
}

// Folding the category block must actually remove its chips, not just hide
// them behind a class that an older stylesheet may not know about.
const catsHead = findAll(tree, (node) => node.props?.className === "inv-cats-head")[0];
assert.ok(catsHead !== undefined, "category fold control renders");
assert.ok(findAll(tree, (node) => node.props?.className === "inv-cats-body").length === 1, "category chips render while open");
catsHead.props.onClick();
tree = renderPanel();
assert.ok(findAll(tree, (node) => node.props?.className === "inv-cats-body").length === 0, "folded category block drops its chips");
catsHead.props.onClick();
tree = renderPanel();
assert.ok(findAll(tree, (node) => node.props?.className === "inv-cats-body").length === 1, "category block opens again");

console.log(`render ok: ${rows.length} rows, ${groups.length} groups, ${snapshot.plugins.length} plugins total`);

// The detail sheet must be docked inside the list frame: its top is level with
// the table header and its left edge starts at the 界面名 column, so no viewport
// measuring is involved and it cannot drift from the table.
states[12] = snapshot.plugins[0].name;
tree = renderPanel();
const detailEffects = effects;
effects = [];
for (const effect of detailEffects) effect();
await new Promise((resolve) => realSetInterval(resolve, 30));
tree = renderPanel();
const drawer = findAll(tree, (node) => node.props?.className === "inv-drawer")[0];
assert.ok(drawer !== undefined, "detail drawer renders once a row is selected");
assert.equal(drawer.props.style["--inv-drawer-left"], "35%", "drawer starts at the 界面名 column");
const wrap = findAll(tree, (node) => node.props?.className === "inv-listwrap")[0];
assert.equal(findAll(wrap, (node) => node.props?.className === "inv-dock").length, 1, "drawer is docked inside the list frame");
assert.equal(findAll(wrap, (node) => node.props?.className === "inv-scrim").length, 1, "scrim still closes on an outside click");
states[12] = "";

// A page larger than the default one always offers "back to top".
states[11] = 40;
const bigTree = renderPanel();
assert.ok(findAll(bigTree, (node) => node.props?.className === "inv-top").length === 1, "back-to-top button appears above 20 rows");
states[11] = 20;

// The install-time header is a three-state sort control, and sorting is a
// GROUP-level ordering (families rank by their newest member).
const sortHead = findAll(tree, (node) => typeof node.props?.className === "string" && node.props.className.includes("inv-th-sort"))[0];
assert.ok(sortHead !== undefined, "install-time header is a sort control");
sortHead.props.onClick();
states[16] = "desc";
const descTree = renderPanel();
const descGroups = findAll(descTree, (node) => node.props?.className === "inv-group");
assert.ok(descGroups.length > 0, "sorted family view still renders group headers");
assert.ok(
  findAll(descTree, (node) => typeof node.props?.className === "string" && node.props.className.includes("inv-th-sort")).some(
    (node) => text(node) === "colState▼" || text(node).includes("▼")
  ),
  "sort header shows the descending arrow"
);
states[16] = "none";

// A package with UI-text fingerprints exposes them in the detail sheet, so a
// hit like 「起子插件设置」→ dsh-brief-sidebar can be explained in place.
const withTexts = snapshot.plugins.find((plugin) => (plugin.uiTexts ?? []).length > 0);
if (withTexts !== undefined) {
  states[12] = withTexts.name;
  tree = renderPanel();
  const textEffects = effects;
  effects = [];
  for (const effect of textEffects) effect();
  await new Promise((resolve) => realSetInterval(resolve, 30));
  tree = renderPanel();
  assert.ok(text(tree).includes("dUiTexts"), "detail sheet shows the interface-text section");
  assert.ok(
    findAll(tree, (node) => typeof node.props?.className === "string" && node.props.className === "inv-uitext").length > 0,
    "interface texts render as pills"
  );
  states[12] = "";
}

// Flat view: seven columns, no author headers. `view` is the eighth useState in
// the panel, so flipping its slot is enough to re-render down that branch.
states[7] = "flat";
const flatTree = renderPanel();
const flatRows = findAll(flatTree, (node) => typeof node.props?.className === "string" && node.props.className.includes("inv-row"));
assert.ok(flatRows.length > 0, "flat view lists plugins");
for (const row of flatRows) {
  assert.equal((row.children ?? []).filter((child) => child?.type === "td").length, 7, "flat view has seven columns");
}
assert.equal(findAll(flatTree, (node) => node.props?.className === "inv-group").length, 0, "flat view has no group headers");
console.log("flat view ok");

// The stubbed interval keeps a handle open; end explicitly.
process.exit(0);
