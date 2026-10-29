/**
 * Marketplace-style category inference.
 *
 * The official market shows a fixed taxonomy ("UI 增强", "主题与外观", …) that no
 * installed package declares anywhere: it is server-side metadata that only
 * exists for packages published through the market. An installed inventory still
 * has to answer "which of these are themes, which are providers", so the same
 * taxonomy is reproduced here and filled from the three signals a local package
 * does carry — its name, its keywords, and its description.
 *
 * Two rules keep the result honest:
 *   - A hit in the package name outweighs the same word buried in a paragraph.
 *   - Specific categories outrank the catch-all "UI 增强": `browser-view` is a
 *     browser plugin that happens to draw UI, not a generic interface tweak.
 *
 * @module dsh-installed-inventory/categories
 */

/**
 * The taxonomy, ordered the way the market lists it. `ui` sits last on purpose:
 * it is the fallback for interface work that no specific bucket claims.
 * @type {{key:string,label:string,words:string[]}[]}
 */
export const CATEGORIES = [
  { key: "agi", label: "AGI 架构探索", words: ["agi", "架构探索", "architecture", "reasoning trace", "思维链"] },
  { key: "billing", label: "用量与计费", words: ["billing", "usage", "cost", "quota", "balance", "spend", "用量", "计费", "余额", "费用", "消耗"] },
  { key: "theme", label: "主题与外观", words: ["theme", "skin", "wallpaper", "appearance", "palette", "font", "style", "主题", "皮肤", "壁纸", "字体", "外观", "配色"] },
  { key: "model", label: "模型与账号接入", words: ["provider", "llm", "model", "openai", "anthropic", "claude", "gemini", "ollama", "登录", "账号", "模型", "接入模型"] },
  { key: "identity", label: "身份与通信", words: ["identity", "oauth", "sso", "auth", "login", "身份", "认证", "授权"] },
  { key: "chat", label: "会话与消息", words: ["conversation", "message", "chat", "session", "会话", "消息", "对话", "聊天"] },
  { key: "memory", label: "记忆", words: ["memory", "memories", "recall", "mneme", "context", "记忆", "上下文", "知识", "反思"] },
  { key: "tools", label: "工具与能力", words: ["tool", "toolkit", "command", "mcp", "工具", "命令", "能力"] },
  { key: "wsl", label: "WSL 与 Windows 互操作", words: ["wsl", "bash", "powershell", "shell", "terminal", "windows", "终端", "命令行", "互操作"] },
  { key: "web", label: "浏览器与网页", words: ["browser", "webview", "cdp", "网页", "浏览器", "抓取", "http"] },
  { key: "vision", label: "视觉与多模态", words: ["vision", "image", "ocr", "screenshot", "multimodal", "视觉", "图像", "多模态"] },
  { key: "voice", label: "语音与音频", words: ["voice", "audio", "speech", "tts", "asr", "music", "语音", "音频", "音乐"] },
  { key: "doc", label: "文档与渲染", words: ["markdown", "pdf", "docx", "mermaid", "latex", "render", "文档", "渲染", "导出"] },
  { key: "skill", label: "技能包", words: ["skill", "技能"] },
  { key: "workflow", label: "工作流与自动化", words: ["workflow", "orchestrat*", "swarm", "agent", "automation", "schedule", "dag", "工作流", "编排", "智能体", "自动化", "定时"] },
  { key: "git", label: "Git 与代码评审", words: ["git", "diff", "review", "branch", "commit", "代码审查", "评审", "代码"] },
  { key: "notify", label: "通知与集成", words: ["notify", "notification", "webhook", "connect", "feishu", "dingtalk", "wechat", "slack", "通知", "推送", "集成", "接入", "即时通讯"] },
  { key: "runtime", label: "开发与运行时", words: ["runtime", "diagnostic", "doctor", "debug", "build", "update", "backup", "诊断", "运行时", "开发", "升级", "备份", "迁移", "归档"] },
  { key: "security", label: "安全与权限", words: ["security", "permission", "sandbox", "safe", "audit", "安全", "权限", "审计"] },
  { key: "remote", label: "远程与移动端", words: ["remote", "ssh", "tunnel", "mobile", "pair", "远程", "移动", "隧道", "配对"] },
  { key: "market", label: "插件市场与管理", words: ["market", "mall", "plugin manager", "plugin index", "registry", "install", "inventory", "市场", "插件管理", "插件索引", "社区插件", "安装", "清单"] },
  { key: "fun", label: "娱乐", words: ["pet", "pua", "mascot", "game", "toy", "宠物", "娱乐", "游戏", "挂件"] },
  { key: "ui", label: "UI 增强", words: ["sidebar", "panel", "widget", "overlay", "layout", "tab", "ui", "界面", "侧栏", "面板", "标签"] },
];

/** Order used by the filter chips, including the catch-all bucket. */
export const CATEGORY_LABELS = CATEGORIES.map((category) => category.label);

/** Label used when nothing matched with any confidence. */
export const OTHER_LABEL = "未分类";

/**
 * Classify one package.
 *
 * @param {{name:string, description?:string, keywords?:string[]}} manifest - published metadata.
 * @param {{ui?:boolean, surfaces?:Record<string,string[]>}} surfaces - detected surfaces, used as a weak hint.
 * @returns {{key:string,label:string,evidence:string}} best bucket.
 */
export function classifyPackage(manifest, surfaces = {}) {
  const rawName = String(manifest?.name ?? "").toLowerCase();
  // `dshmarket` has no separator before `market`; dropping the `dsh` prefix
  // lets the same word rules work for both `dsh-market` and `dshmarket`.
  const name = rawName.replace(/^@[^/]+\//, "").replace(/^dsh[-_]?/, "");
  const keywords = Array.isArray(manifest?.keywords) ? manifest.keywords.join(" ").toLowerCase() : "";
  const description = String(manifest?.description ?? "").toLowerCase();
  // Both languages live in the same haystack; the name field is scanned
  // separately because a hit there is worth roughly three times a prose hit.
  const prose = `${keywords} ${description}`;

  let best = { key: "other", label: OTHER_LABEL, evidence: "", score: 0, order: 999 };
  CATEGORIES.forEach((category, index) => {
    const scored = scoreOf(category, name, prose);
    // Earlier categories are more specific, so they win an exact tie.
    if (scored.score > best.score || (scored.score === best.score && scored.score > 0 && index < best.order)) {
      best = { ...scored, key: category.key, label: category.label, order: index };
    }
  });

  // A client bundle that only tweaks chrome is still UI 增强 when nothing more
  // specific claimed it — that is exactly what the market's own shelf means.
  if (best.score === 0 && surfaces.ui === true) {
    return { key: "ui", label: "UI 增强", evidence: "client bundle" };
  }
  return { key: best.key, label: best.label, evidence: best.evidence };
}

/**
 * Score one category against the name and prose.
 *
 * Matching is word-boundary based for ASCII words. Plain substring matching
 * reads `michengai` as "AGI" and `repair` as "pair", which is how the first
 * pass put a plugin installer under AGI research.
 *
 * @param {{words:string[]}} category - rules.
 * @param {string} name - lowercased package name, `dsh` prefix removed.
 * @param {string} prose - lowercased keywords + description.
 * @returns {{score:number,evidence:string}} score and the winning word.
 */
function scoreOf(category, name, prose) {
  let score = 0;
  let evidence = "";
  for (const word of category.words) {
    const inName = matches(name, word);
    const inProse = matches(prose, word);
    if (!inName && !inProse) continue;
    // A name hit is worth roughly three prose hits; a hit that ends the name
    // (`…-sidebar`, `…-style`) is worth more than one in the middle, because
    // package names read right to left in specificity.
    const suffix = inName && /^[a-z]{3,}$/.test(word) && endsWithSegment(name, word);
    const weight = word.length + (inName ? 12 : 0) + (suffix ? 8 : 0);
    if (weight > score) {
      score = weight;
      evidence = inName ? `name:${word}` : word;
    }
  }
  return { score, evidence };
}

/**
 * Does the text contain this word as a word?
 * Chinese words fall back to substring matching; ASCII words require both
 * sides to be non-alphanumeric so `agi` no longer matches `michengai`.
 * @param {string} text - lowercased haystack.
 * @param {string} word - lowercased needle.
 * @returns {boolean} presence.
 */
function matches(text, word) {
  if (/^[\x00-\x7F]+$/.test(word) === false) return text.includes(word);
  // A trailing `*` means "prefix": `orchestrat*` has to match `orchestrator`.
  const prefix = word.endsWith("*");
  const body = prefix ? word.slice(0, -1) : word;
  const escaped = body.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (prefix) return new RegExp(`(?<![a-z0-9])${escaped}[a-z]*`).test(text);
  return new RegExp(`(?<![a-z0-9])${escaped}(?:s)?(?![a-z0-9])`).test(text);
}

/**
 * Does the package name end with this word as its final dash-separated segment?
 * @param {string} name - package name.
 * @param {string} word - needle.
 * @returns {boolean} true when it is the last segment.
 */
function endsWithSegment(name, word) {
  const bare = name.replace(/^@[^/]+\//, "");
  return bare === word || bare.endsWith(`-${word}`);
}
