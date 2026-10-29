/**
 * Markdown / CSV export.
 *
 * Export exists because the panel is a viewer, not a document: users paste these
 * tables into issues and chat threads when asking an author "is this package
 * yours?".
 *
 * @module dsh-installed-inventory/exporter
 */

/**
 * Render a snapshot as the same shape as the hand-written 对照表.
 * @param {object} snapshot - snapshot document.
 * @returns {string} markdown text.
 */
export function toMarkdown(snapshot) {
  const lines = [
    `# DSH 已安装插件清单（${snapshot.profileName}）`,
    "",
    `> 生成时间：${snapshot.generatedAt} · 数据目录：\`${snapshot.profileDir}\``,
    `> 共 ${snapshot.counts.total} 个包 · ${snapshot.counts.loaded} 已加载 · ${snapshot.counts.disabled} 已停用 · ${snapshot.counts.warnings} 条告警`,
    "",
    "| 界面名 | 包名 | 版本 | 状态 | 入口 | 家族 |",
    "|---|---|---|---|---|---|",
  ];
  for (const plugin of snapshot.plugins) {
    lines.push(
      `| ${cell(plugin.displayNames[0])} | \`${plugin.name}\` | ${plugin.version} | ${stateText(plugin)} | ${entryText(plugin)} | ${cell(plugin.family?.label ?? "")} |`
    );
  }
  if (snapshot.warnings.length > 0) {
    lines.push("", "## 告警", "");
    for (const warning of snapshot.warnings) {
      const where = warning.where === null ? "" : `（${warning.where.file}${warning.where.line ? `:${warning.where.line}` : ""}）`;
      lines.push(`- **[${warning.code}]** ${warning.plugin || "—"}：${warning.detail}${where}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

/**
 * Render a snapshot as CSV (UTF-8 with BOM so Excel opens it correctly).
 * @param {object} snapshot - snapshot document.
 * @returns {string} csv text.
 */
export function toCsv(snapshot) {
  const header = ["displayName", "name", "version", "declaredVersion", "state", "loaded", "entries", "category", "family", "repo", "dir"];
  const rows = [header.join(",")];
  for (const plugin of snapshot.plugins) {
    rows.push(
      [
        plugin.displayNames[0] ?? "",
        plugin.name,
        plugin.version,
        plugin.declaredVersion,
        stateText(plugin),
        plugin.inBundles ? "yes" : "no",
        entryText(plugin),
        plugin.category?.label ?? "",
        plugin.family?.label ?? "",
        plugin.repo ?? "",
        plugin.dir,
      ]
        .map(quote)
        .join(",")
    );
  }
  return `\ufeff${rows.join("\r\n")}\r\n`;
}

/**
 * Human state label.
 * @param {object} plugin - record.
 * @returns {string} label.
 */
function stateText(plugin) {
  if (plugin.enabled === false) return "已停用";
  if (!plugin.inBundles && plugin.mountedBy === null) return "未加载";
  if (plugin.mountedBy !== null && !plugin.inBundles) return "随家族加载";
  return "已启用";
}

/**
 * Compact entry summary, e.g. `菜单 右栏 命令`.
 * @param {object} plugin - record.
 * @returns {string} summary.
 */
function entryText(plugin) {
  const labels = [];
  if (plugin.surfaces?.settingsSection?.length) labels.push("菜单");
  if (plugin.surfaces?.pluginTab?.length) labels.push("插件页");
  if (plugin.surfaces?.sidebarRight?.length) labels.push("右栏");
  if (plugin.surfaces?.sidebarLeft?.length) labels.push("左栏");
  if (plugin.surfaces?.conversation?.length) labels.push("会话");
  if (plugin.surfaces?.overlay?.length) labels.push("浮层");
  if (plugin.tools) labels.push("工具");
  if (plugin.command) labels.push("命令");
  if (labels.length === 0) return plugin.ui ? "UI" : "—";
  return labels.join(" ");
}

/**
 * Escape a markdown table cell.
 * @param {string} value - raw text.
 * @returns {string} safe text.
 */
function cell(value) {
  return String(value ?? "").replace(/\|/g, "/").replace(/\n/g, " ");
}

/**
 * Quote a CSV field.
 * @param {string} value - raw text.
 * @returns {string} quoted field.
 */
function quote(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}
