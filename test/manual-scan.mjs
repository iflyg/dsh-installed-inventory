import { scanProfile } from "../lib/scan.js";
import { toMarkdown } from "../lib/exporter.js";
import { buildMatrix } from "../lib/routes.js";

const profileDir = process.argv[2] ?? "E:/DeepSeek Harness/.dsh/profiles/desktop";
const started = Date.now();
const snapshot = await scanProfile({ profileDir });
const elapsed = Date.now() - started;

console.log("scanMs", snapshot.scanMs, "wall", elapsed);
console.log("counts", snapshot.counts);
console.log("patchEntries", snapshot.patchEntries, "patchOk", snapshot.patchOk);

const byCode = {};
for (const warning of snapshot.warnings) byCode[warning.code] = (byCode[warning.code] ?? 0) + 1;
console.log("warnings", byCode);

console.log("\nfamilies (top 8):");
for (const family of snapshot.families.slice(0, 8)) {
  console.log(`  ${family.label}  members=${family.members.length}  aggregate=${family.aggregate ?? "-"}`);
}

const sample = ["dsh-context", "@furongjun1999/dsh-memory", "@michengai/dsh-codex-ui", "dsh-plugin-wallpaper-engine-fx", "@linxin666/dsh-client-ui-skin-center"];
for (const name of sample) {
  const plugin = snapshot.plugins.find((entry) => entry.name === name);
  if (plugin === undefined) {
    console.log(`\n${name}: NOT FOUND`);
    continue;
  }
  const cells = buildMatrix(plugin).filter((cell) => cell.present).map((cell) => cell.label);
  console.log(`\n${plugin.displayNames[0]}  (${name})`);
  console.log(`  source=${plugin.displayNameSource} state=${plugin.enabled} bundles=${plugin.inBundles} via=${plugin.mountedBy} cat=${plugin.category.label}`);
  console.log(`  surfaces=${cells.join(" / ") || "-"}`);
  console.log(`  risk=${plugin.risk.join(",") || "-"} size=${plugin.sizeBytes ?? "?"}`);
}

const markdown = toMarkdown(snapshot);
console.log("\nmarkdown head:\n" + markdown.split("\n").slice(0, 8).join("\n"));
