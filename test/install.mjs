import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const profileDir = "E:/DeepSeek Harness/.dsh/profiles/desktop";
const sourceDir = "C:/Users/Tofei8.cn/WorkBuddy/2026-10-28-20-46-51/dsh-installed-inventory";
const targetDir = join(profileDir, "node_modules", "dsh-installed-inventory");
const backupDir = join("E:/DeepSeek Harness/.dsh", `repair-backup-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-addinventory`);
const manifestPath = join(profileDir, "package.json");

// 1. backup the two files we are about to touch
mkdirSync(backupDir, { recursive: true });
cpSync(manifestPath, join(backupDir, "package.json"));
cpSync(join(profileDir, "cordis.patch.yml"), join(backupDir, "cordis.patch.yml"));

// 2. copy the package
if (existsSync(targetDir)) rmSync(targetDir, { recursive: true, force: true });
mkdirSync(targetDir, { recursive: true });
for (const entry of ["lib", "package.json", "cordis.patch.yml", "README.md", "LICENSE"]) {
  cpSync(join(sourceDir, entry), join(targetDir, entry), { recursive: true });
}

// 3. register dependency + bundle
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const before = {
  deps: Object.keys(manifest.dependencies ?? {}).length,
  bundles: (manifest.dsh?.profile?.bundles ?? []).length,
};
manifest.dependencies = manifest.dependencies ?? {};
manifest.dependencies["dsh-installed-inventory"] = `file:${sourceDir.replace(/\\/g, "/")}`;
manifest.dsh = manifest.dsh ?? {};
manifest.dsh.profile = manifest.dsh.profile ?? {};
manifest.dsh.profile.bundles = manifest.dsh.profile.bundles ?? [];
if (!manifest.dsh.profile.bundles.includes("dsh-installed-inventory")) {
  manifest.dsh.profile.bundles.push("dsh-installed-inventory");
}
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

const after = JSON.parse(readFileSync(manifestPath, "utf8"));
console.log("backup:", backupDir);
console.log("installed:", targetDir);
console.log("deps", before.deps, "->", Object.keys(after.dependencies).length);
console.log("bundles", before.bundles, "->", after.dsh.profile.bundles.length);
console.log("last bundle:", after.dsh.profile.bundles.at(-1));
