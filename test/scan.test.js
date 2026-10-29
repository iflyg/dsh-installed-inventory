import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildFamilies, normalizeRepo, scopeOf, stemOf } from "../lib/family.js";
import { readLocaleTitles, resolveDisplayNames } from "../lib/naming.js";
import { scanProfile } from "../lib/scan.js";
import { satisfies } from "../lib/warnings.js";

/**
 * Build a synthetic profile on disk.
 * @param {{name:string, version?:string, dsh?:object, keywords?:string[], repo?:string|null, locale?:string, client?:string, deps?:string[], host?:string}[]} packages - plugin specs.
 * @param {{bundles?:string[], patch?:string, deps?:Record<string,string>}} profile - profile-level data.
 * @returns {string} profile directory.
 */
function makeProfile(packages, profile) {
  const root = mkdtempSync(join(tmpdir(), "inv-"));
  mkdirSync(join(root, "profiles", "desktop", "node_modules"), { recursive: true });
  const dir = join(root, "profiles", "desktop");
  const dependencies = profile.deps ?? {};
  for (const pkg of packages) {
    const pkgDir = join(dir, "node_modules", ...pkg.name.split("/"));
    mkdirSync(join(pkgDir, "lib"), { recursive: true });
    writeFileSync(
      join(pkgDir, "package.json"),
      JSON.stringify({
        name: pkg.name,
        version: pkg.version ?? "1.0.0",
        description: pkg.description ?? "",
        keywords: pkg.keywords ?? ["dsh-plugin"],
        repository: pkg.repo === undefined ? null : pkg.repo === null ? undefined : { type: "git", url: pkg.repo },
        dsh: pkg.dsh ?? { bundle: { patch: "./cordis.patch.yml" } },
        exports: pkg.client === undefined ? undefined : { "./client": "./lib/client.js" },
        main: "lib/index.js",
        dependencies: Object.fromEntries((pkg.deps ?? []).map((name) => [name, "1.0.0"])),
      }),
      "utf8"
    );
    writeFileSync(join(pkgDir, "lib", "index.js"), pkg.host ?? "export function apply() {}\n", "utf8");
    if (pkg.client !== undefined) writeFileSync(join(pkgDir, "lib", "client.js"), pkg.client, "utf8");
    if (pkg.locale !== undefined) {
      mkdirSync(join(pkgDir, "locale"), { recursive: true });
      writeFileSync(join(pkgDir, "locale", "zh.json"), pkg.locale, "utf8");
    }
    if (profile.deps === undefined) dependencies[pkg.name] = "1.0.0";
  }
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: "dsh-profile-desktop", private: true, dependencies, dsh: { profile: { bundles: profile.bundles ?? packages.map((pkg) => pkg.name) } } }),
    "utf8"
  );
  writeFileSync(join(dir, "cordis.patch.yml"), profile.patch ?? "- id: x\n  name: y\n", "utf8");
  return dir;
}

test("display name ladder prefers locale, then bundle label, then package name", () => {
  const dir = makeProfile(
    [
      { name: "dsh-with-locale", locale: JSON.stringify({ meta: { title: "上下文 (dsh-context)" } }) },
      { name: "dsh-bundle-label", client: 'const zh = { nav: "智能体小队", title: "x" };' },
      { name: "dsh-bare" },
    ],
    {}
  );
  try {
    const base = join(dir, "node_modules");
    assert.deepEqual(resolveDisplayNames(join(base, "dsh-with-locale"), { name: "dsh-with-locale" }, "dsh-with-locale"), {
      names: ["上下文 (dsh-context)"],
      source: "locale",
    });
    const bundleManifest = JSON.parse(readFileSync(join(base, "dsh-bundle-label", "package.json"), "utf8"));
    assert.deepEqual(resolveDisplayNames(join(base, "dsh-bundle-label"), bundleManifest, "dsh-bundle-label"), {
      names: ["智能体小队"],
      source: "bundle",
    });
    assert.deepEqual(resolveDisplayNames(join(base, "dsh-bare"), { name: "dsh-bare" }, "dsh-bare"), {
      names: ["dsh-bare"],
      source: "fallback",
    });
    assert.deepEqual(readLocaleTitles(join(base, "dsh-bare")), []);
  } finally {
    rmSync(join(dir, "..", ".."), { recursive: true, force: true });
  }
});

test("families merge by scope, repository and multi-segment stem", () => {
  const packages = [
    { name: "@scope/one", repo: "https://github.com/a/one.git" },
    { name: "@scope/two", repo: "https://github.com/a/two.git" },
    { name: "dsh-plugin-wallpaper-engine", repo: "https://github.com/b/wall.git" },
    { name: "dsh-plugin-wallpaper-engine-fx", repo: null },
    { name: "dsh-plugin-wallpaper-engine-fonts", repo: null },
    { name: "dsh-context", repo: null },
    { name: "dsh-doctor", repo: null },
  ];
  const { families, byName } = buildFamilies(packages);
  assert.equal(byName["@scope/one"].key, byName["@scope/two"].key);
  assert.equal(byName["dsh-plugin-wallpaper-engine-fx"].key, byName["dsh-plugin-wallpaper-engine"].key);
  assert.notEqual(byName["dsh-context"].key, byName["dsh-doctor"].key);
  const wall = families.find((family) => family.members.includes("dsh-plugin-wallpaper-engine-fx"));
  assert.equal(wall.members.length, 3);
});

test("single-segment names never merge by prefix", () => {
  assert.equal(stemOf("dsh-context"), null);
  assert.equal(stemOf("dsh-plugin-wallpaper-engine-fx"), "wallpaper-engine");
  assert.equal(scopeOf("@a/b"), "@a");
  assert.equal(normalizeRepo("git+https://github.com/Owner/Repo.git"), "owner/repo");
});

test("semver ranges: caret, tilde, exact and non-registry specs", () => {
  assert.equal(satisfies("0.19.2", "^0.19.2"), true);
  assert.equal(satisfies("0.19.1", "^0.19.2"), false);
  assert.equal(satisfies("0.19.9", "~0.19.2"), true);
  assert.equal(satisfies("0.20.0", "~0.19.2"), false);
  assert.equal(satisfies("1.0.0", "file:../x"), true);
  assert.equal(satisfies("1.0.0", "1.0.0"), true);
});

test("scan produces counts, surfaces and audit warnings for a synthetic profile", async () => {
  const dir = makeProfile(
    [
      {
        name: "dsh-alpha",
        locale: JSON.stringify({ meta: { title: "阿尔法" } }),
        client: 'ctx.slots.register({ name: "settings.section", id: "a" }, () => null);',
        host: 'import { exec } from "node:child_process"; export function apply(ctx) { ctx.get("commands").register({ name: "alpha" }); }',
      },
      { name: "@fam/beta", client: 'ctx.slots.register({ name: "sidebar.right.pane.tab", id: "b" }, () => null);' },
      { name: "@fam/gamma", deps: ["@fam/beta"] },
      { name: "dsh-lonely", deps: [] },
    ],
    {
      bundles: ["dsh-alpha", "@fam/gamma"],
      deps: { "dsh-alpha": "^1.0.0", "@fam/beta": "1.0.0", "@fam/gamma": "1.0.0", "dsh-lonely": "1.0.0" },
      patch: `- id: alpha
  name: dsh-alpha
  config:
    a: 1
- id: alpha
  name: dsh-alpha
  config:
    a: 2
- id: ghost
  name: dsh-ghost
  disabled: true
`,
    }
  );
  try {
    const snapshot = await scanProfile({ profileDir: dir });
    assert.equal(snapshot.counts.total, 4);
    assert.equal(snapshot.profileName, "desktop");
    const alpha = snapshot.plugins.find((plugin) => plugin.name === "dsh-alpha");
    assert.equal(alpha.displayNames[0], "阿尔法");
    assert.equal(alpha.surfaces.settingsSection[0], "settings.section");
    assert.equal(alpha.command, true);
    assert.deepEqual(alpha.risk, ["shell"]);
    assert.equal(alpha.patchEntries.length, 2);

    const beta = snapshot.plugins.find((plugin) => plugin.name === "@fam/beta");
    assert.equal(beta.surfaces.sidebarRight[0], "sidebar.right.pane.tab");
    assert.equal(beta.mountedBy, "@fam/gamma");

    const codes = snapshot.warnings.map((warning) => warning.code);
    assert.ok(codes.includes("DUP_ID"));
    assert.ok(codes.includes("ZOMBIE_ENTRY"));
    assert.ok(codes.includes("NOT_LOADED"));
  } finally {
    rmSync(join(dir, "..", ".."), { recursive: true, force: true });
  }
});

test("host-internal packages are never reported as zombies", async () => {
  const dir = makeProfile([{ name: "dsh-alpha" }], {
    bundles: ["dsh-alpha"],
    patch: '- id: model\n  name: "@deepseek-ai/dsh-agent-default-model"\n  config:\n    model: x\n',
  });
  try {
    const snapshot = await scanProfile({ profileDir: dir });
    assert.equal(snapshot.warnings.some((warning) => warning.code === "ZOMBIE_ENTRY"), false);
  } finally {
    rmSync(join(dir, "..", ".."), { recursive: true, force: true });
  }
});

test("a newly installed package shows up as a change, not as a full surprise", async () => {
  const dir = makeProfile([{ name: "dsh-alpha" }, { name: "dsh-beta" }], {});
  try {
    const before = await scanProfile({ profileDir: dir });
    assert.deepEqual(before.changes.added, []);
    assert.deepEqual(before.changes.removed, []);

    // Simulate `dsh plugin add dsh-gamma`: a new directory plus a manifest entry.
    const gammaDir = join(dir, "node_modules", "dsh-gamma");
    mkdirSync(join(gammaDir, "lib"), { recursive: true });
    writeFileSync(join(gammaDir, "package.json"), JSON.stringify({ name: "dsh-gamma", version: "2.0.0", keywords: ["dsh-plugin"], dsh: {} }), "utf8");
    const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    manifest.dependencies["dsh-gamma"] = "2.0.0";
    writeFileSync(join(dir, "package.json"), JSON.stringify(manifest), "utf8");

    const after = await scanProfile({ profileDir: dir, previous: before });
    assert.deepEqual(after.changes.added, ["dsh-gamma"]);
    assert.equal(after.counts.total, 3);
    assert.ok(after.warnings.some((warning) => warning.code === "NOT_LOADED" && warning.plugin === "dsh-gamma"));
  } finally {
    rmSync(join(dir, "..", ".."), { recursive: true, force: true });
  }
});
