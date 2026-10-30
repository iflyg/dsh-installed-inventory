/**
 * dsh-installed-inventory — browser half.
 *
 * One file on purpose: the host mounts `exports["./client"]` as a
 * `window.__ModuleLoader__` module, react and react-dom come from the host, and
 * nothing is bundled. Keeping the panel in a single module makes the contract
 * easy to audit (no hidden imports, no extra requests).
 *
 * The list is laid out for a 1440×960 window: 20 rows plus every filter row and
 * the pager fit without a page scroll at that size, and the table itself scrolls
 * inside a sticky-header frame for the 40 / 100 row settings.
 */
window.__ModuleLoader__.load({
  id: "dsh-installed-inventory",
  factory: (require) => {
    const React = require("react");
    const module = { exports: {} };
    const exports = module.exports;
    const h = React.createElement;

    const NS = "installedInventory";
    const SECTION_ID = "installed-inventory";
    const TAB_ID = "dsh-installed-inventory";
    const DETAIL_ID = "installed-inventory-meta";
    const DEFAULT_ROUTE_ROOT = "/api/installed-inventory";

    /** How many UI-text pills show before the tail folds behind a summary. */
    const UI_TEXT_HEAD = 8;

    /** Page sizes offered by the pager, in the order the market shows them. */
    const PAGE_SIZES = [20, 40, 100];

    const zh = {
      tab: "已安装清单",
      title: "已安装清单",
      subtitle: "首列是包名，按作者分组。搜索界面名可直接定位到某个插件；只读，不安装也不启停。",
      refresh: "刷新",
      scan: "扫描中…",
      exportMd: "导出 Markdown",
      exportCsv: "导出 CSV",
      profile: "profile",
      search: "搜索界面名 / 包名 / 仓库 / 分类",
      viewFlat: "平铺",
      viewFamily: "按作者",
      collapseAll: "折叠全部",
      expandAll: "展开全部",
      filterAll: "全部",
      filterLoaded: "已加载",
      filterDisabled: "已停用",
      filterNotLoaded: "未加载",
      filterRisky: "有风险能力",
      filterWarn: "告警",
      filterUi: "有界面",
      colPkg: "包名",
      colName: "界面名",
      colVersion: "版本",
      colState: "安装时间",
      colCategory: "分类",
      colEntries: "入口",
      colFamily: "作者",
      installedUnknown: "时间未知",
      authorFromFamily: "（按同家族推定）",
      stateOn: "已启用",
      stateOff: "已停用",
      stateNotLoaded: "未加载",
      stateViaFamily: "随家族加载",
      nameFromLocale: "名称来源：locale",
      nameFromManifest: "名称来源：manifest",
      nameFromBundle: "名称来源：bundle",
      nameFromFallback: "名称来源：包名兜底",
      members: "个成员",
      aggregate: "聚合包",
      warnings: "条告警",
      newPackages: "新增",
      removedPackages: "移除",
      restartHint: "新装的插件要重启 DSH 才会被加载。",
      detail: "详情",
      close: "关闭",
      dPackages: "包",
      dVersion: "版本",
      dDeclared: "声明范围",
      dAuthor: "作者",
      dCategory: "分类",
      dFamily: "家族",
      dState: "状态",
      dInstalled: "安装时间",
      dLoadedBy: "加载方式",
      dDir: "安装目录",
      dRepo: "仓库",
      dEngine: "宿主要求",
      dSize: "体积",
      dMatrix: "能力矩阵",
      dPatch: "patch 条目",
      dSameFamily: "同家族其它插件",
      mDim: "维度",
      mHas: "有",
      mEvidence: "依据",
      copy: "复制",
      copied: "已复制",
      copyPath: "复制路径",
      openRepo: "打开仓库",
      goOfficial: "去官方页管理",
      empty: "没有匹配的插件",
      emptyHint: "清单为空时，先确认 profile 路径是否被正确解析。",
      loading: "正在读取插件清单…",
      error: "读取失败",
      retry: "重试",
      cached: "缓存",
      staticHint: "能力与分类均为静态推断（扫包内代码字符串与 description），非官方元数据。",
      patchEmpty: "该包没有 patch 条目（由 bundles 直接加载）。",
      detailEmpty: "无法识别当前插件。",
      matrix: "入口",
      surfaceLabel: "界面类型",
      surfaceAny: "全部",
      sfSettingsSection: "菜单",
      sfPluginTab: "插件页",
      sfSidebarRight: "右栏",
      sfSidebarLeft: "左栏",
      sfConversation: "会话",
      sfOverlay: "浮窗",
      sfTools: "工具",
      sfCommand: "命令",
      sfPluginDetail: "插件详情",
      whereMenu: "设置菜单",
      whereTab: "插件页",
      whereSidebar: "侧栏",
      whereChat: "会话区",
      whereOverlay: "浮层",
      whereConfig: "配置卡",
      whereFamily: "家族设置",
      whereLocale: "locale",
      whereCopy: "文案",
      showAll: "查看全部",
      seatInferred: "按界面文字推定",
      dEntries: "入口位置",
      dInfo: "信息",
      dCapability: "能力",
      dRisk: "风险能力",
      dUiTexts: "界面文字",
      uiTextHint: "静态扫描包内字符串得到的界面特征（设置菜单 / 标签页 / 侧栏等位置的文案）。运行时由其它插件注入的标签不计入此列。",
      entryRuntime: "标签由运行时渲染",
      noSurface: "没有界面入口",
      unnamed: "—",
      categoryLabel: "分类",
      categoryAny: "全部",
      categoryHint: "与市场同名分类；按包名 / 关键词 / 描述推断。",
      pagerTotal: "共",
      pagerUnit: "条",
      pagerPer: "每页",
      pagerPrev: "上一页",
      pagerNext: "下一页",
      pagerPage: "页",
      pagerPrefix: "第",
      backTop: "返回顶部",
      searchHit: "搜索命中",
      continued: "（续）",
      searchClear: "清空",
    };

    const en = {
      tab: "Installed",
      title: "Installed plugins",
      subtitle: "Package name first, grouped by author. Search a display name to locate a plugin. Read-only: no install, no toggle.",
      refresh: "Refresh",
      scan: "Scanning…",
      exportMd: "Export Markdown",
      exportCsv: "Export CSV",
      profile: "Profile",
      search: "Search name / package / repo / category",
      viewFlat: "Flat",
      viewFamily: "By author",
      collapseAll: "Collapse all",
      expandAll: "Expand all",
      filterAll: "All",
      filterLoaded: "Loaded",
      filterDisabled: "Disabled",
      filterNotLoaded: "Not loaded",
      filterRisky: "Risky",
      filterWarn: "Warnings",
      filterUi: "Has UI",
      colPkg: "Package",
      colName: "Display name",
      colVersion: "Version",
      colState: "Installed",
      colCategory: "Category",
      colEntries: "Entries",
      colFamily: "Author",
      installedUnknown: "unknown",
      authorFromFamily: "(inferred from family)",
      stateOn: "Enabled",
      stateOff: "Disabled",
      stateNotLoaded: "Not loaded",
      stateViaFamily: "Via family",
      nameFromLocale: "Name from locale",
      nameFromManifest: "Name from manifest",
      nameFromBundle: "Name from bundle",
      nameFromFallback: "Name from package",
      members: "members",
      aggregate: "aggregate",
      warnings: "warnings",
      newPackages: "added",
      removedPackages: "removed",
      restartHint: "Newly installed plugins load after DSH restarts.",
      detail: "Details",
      close: "Close",
      dPackages: "Package",
      dVersion: "Version",
      dDeclared: "Declared",
      dAuthor: "Author",
      dCategory: "Category",
      dFamily: "Family",
      dState: "State",
      dInstalled: "Installed",
      dLoadedBy: "Loaded by",
      dDir: "Directory",
      dRepo: "Repository",
      dEngine: "Host requirement",
      dSize: "Size",
      dMatrix: "Capability matrix",
      dPatch: "Patch rows",
      dSameFamily: "Other plugins in this family",
      mDim: "Surface",
      mHas: "Has",
      mEvidence: "Evidence",
      copy: "Copy",
      copied: "Copied",
      copyPath: "Copy path",
      openRepo: "Open repo",
      goOfficial: "Manage in official page",
      empty: "No plugin matches",
      emptyHint: "If the list is empty, check whether the profile path resolved correctly.",
      loading: "Reading the inventory…",
      error: "Failed to read",
      retry: "Retry",
      cached: "cached",
      staticHint: "Surfaces and categories are inferred from the shipped code and the manifest description, not from official metadata.",
      patchEmpty: "No patch row for this package (loaded straight from bundles).",
      detailEmpty: "Could not identify this plugin.",
      matrix: "Entries",
      surfaceLabel: "Surface",
      surfaceAny: "All",
      sfSettingsSection: "Menu",
      sfPluginTab: "Plugins page",
      sfSidebarRight: "Right",
      sfSidebarLeft: "Left",
      sfConversation: "Chat",
      sfOverlay: "Overlay",
      sfTools: "Tools",
      sfCommand: "Commands",
      sfPluginDetail: "Plugin detail",
      whereMenu: "Settings",
      whereTab: "Plugin tab",
      whereSidebar: "Sidebar",
      whereChat: "Chat",
      whereOverlay: "Overlay",
      whereConfig: "Config card",
      whereFamily: "Family settings",
      whereLocale: "locale",
      whereCopy: "Copy",
      showAll: "Show all",
      seatInferred: "inferred from interface text",
      dEntries: "Where it shows",
      dInfo: "Info",
      dCapability: "Capabilities",
      dRisk: "Risky capabilities",
      dUiTexts: "Interface text",
      uiTextHint: "Strings statically scanned from the package — copy found near the settings menu, plugin tab, sidebar and similar seats. Labels injected at runtime by other plugins are not included.",
      entryRuntime: "caption rendered at runtime",
      noSurface: "No UI entry",
      unnamed: "—",
      categoryLabel: "Category",
      categoryAny: "All",
      categoryHint: "Same taxonomy as the market, inferred from name / keywords / description.",
      pagerTotal: "Total",
      pagerUnit: "",
      pagerPer: "Rows",
      pagerPrev: "Prev",
      pagerNext: "Next",
      pagerPage: "",
      pagerPrefix: "Page",
      backTop: "Back to top",
      searchHit: "matches",
      continued: "(cont.)",
      searchClear: "Clear",
    };

    /** Route root published by the host at boot. */
    function bootConfig() {
      const value = globalThis.__DSH_INSTALLED_INVENTORY__;
      return value !== null && typeof value === "object" ? value : {};
    }

    function routeRoot() {
      const configured = bootConfig().routeRoot;
      return typeof configured === "string" && configured !== "" ? configured : DEFAULT_ROUTE_ROOT;
    }

    /** One same-origin JSON request; rejects on a non-2xx answer. */
    async function getJson(path) {
      const response = await fetch(`${routeRoot()}${path}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok || body?.ok !== true) {
        throw new Error(body?.error?.message ?? `HTTP ${response.status}`);
      }
      return body;
    }

    /** State key used by both the table and the filters. */
    function stateOf(plugin) {
      if (plugin.enabled === false) return "off";
      if (!plugin.inBundles && plugin.mountedBy === null) return "idle";
      if (plugin.mountedBy !== null && !plugin.inBundles) return "via";
      return "on";
    }

    /** Human state label. */
    function stateLabel(t, plugin) {
      const state = stateOf(plugin);
      if (state === "off") return t("stateOff");
      if (state === "idle") return t("stateNotLoaded");
      if (state === "via") return t("stateViaFamily");
      return t("stateOn");
    }

    /**
     * State-coloured badge carrying the install time.
     *
     * `mode: "table"` prints date over time inside the badge (state survives as
     * its colour plus the tooltip), `mode: "head"` keeps the plain one-line
     * state label used by the detail header.
     *
     * @param {Function} t - translator.
     * @param {object} plugin - scanned record.
     * @param {"table"|"head"} mode - render variant.
     * @returns {object} React element.
     */
    function stateBadge(t, plugin, mode) {
      const state = stateOf(plugin);
      const label = stateLabel(t, plugin);
      if (mode !== "table") return h("span", { className: `inv-state inv-state--${state}` }, label);
      const when = whenParts(plugin);
      const title = when.date === "" ? label : `${label} · ${when.date} ${when.time}`;
      return h(
        "span",
        { className: `inv-state inv-state--${state} inv-state--when`, title },
        when.date === ""
          ? h("span", { className: "inv-when-date inv-when-unknown" }, t("installedUnknown"))
          : [h("span", { key: "d", className: "inv-when-date" }, when.date), h("span", { key: "t", className: "inv-when-time" }, when.time)]
      );
    }

    /** Surface key → translator key, for the detail's entry fallback. */
    const SURFACE_LABEL_KEY = {
      settingsSection: "sfSettingsSection",
      pluginTab: "sfPluginTab",
      pluginDetail: "sfPluginDetail",
      sidebarRight: "sfSidebarRight",
      sidebarLeft: "sfSidebarLeft",
      conversation: "sfConversation",
      overlay: "sfOverlay",
    };

    /** Seat key → translator key for the where a UI text was found. */
    const WHERE_KEY = {
      menu: "whereMenu",
      tab: "whereTab",
      sidebar: "whereSidebar",
      chat: "whereChat",
      overlay: "whereOverlay",
      config: "whereConfig",
      family: "whereFamily",
      locale: "whereLocale",
      copy: "whereCopy",
    };

    /** Install timestamp as a comparable number; unknown packages sort last. */
    function timeOf(plugin) {
      const raw = typeof plugin?.installedAt === "string" && plugin.installedAt !== "" ? plugin.installedAt : plugin?.mtime;
      const stamp = typeof raw === "string" ? Date.parse(raw) : NaN;
      return Number.isNaN(stamp) ? 0 : stamp;
    }

    /**
     * Local date / time halves of the install timestamp.
     *
     * The state column shows two lines so a 20-row page still reads as a date
     * column: `2026-10-29` over `21:36`. The badge keeps the state colour, so
     * colour carries enablement and the text carries the time.
     *
     * @param {object} plugin - scanned record.
     * @returns {{date:string,time:string,iso:string}} padded halves, "" when unknown.
     */
    function whenParts(plugin) {
      const raw = typeof plugin?.installedAt === "string" && plugin.installedAt !== "" ? plugin.installedAt : plugin?.mtime;
      if (typeof raw !== "string" || raw === "") return { date: "", time: "", iso: "" };
      const stamp = new Date(raw);
      if (Number.isNaN(stamp.getTime())) return { date: "", time: "", iso: "" };
      const pad = (value) => String(value).padStart(2, "0");
      return {
        date: `${stamp.getFullYear()}-${pad(stamp.getMonth() + 1)}-${pad(stamp.getDate())}`,
        time: `${pad(stamp.getHours())}:${pad(stamp.getMinutes())}`,
        iso: raw,
      };
    }

    /** Surface filters, ordered the way the app reads: right rail, menu, chat… */
    const SURFACE_CHIPS = [
      ["sidebarRight", "sfSidebarRight"],
      ["settingsSection", "sfSettingsSection"],
      ["conversation", "sfConversation"],
      ["overlay", "sfOverlay"],
      ["sidebarLeft", "sfSidebarLeft"],
      ["pluginTab", "sfPluginTab"],
      ["tools", "sfTools"],
      ["command", "sfCommand"],
    ];

    /**
     * Category order for the chip row: the market's own shelf order, with any
     * label the scan produced but this list does not know appended at the end so
     * a future taxonomy entry still shows up instead of silently disappearing.
     */
    const CATEGORY_ORDER = [
      "AGI 架构探索",
      "UI 增强",
      "用量与计费",
      "主题与外观",
      "模型与账号接入",
      "身份与通信",
      "会话与消息",
      "记忆",
      "工具与能力",
      "WSL 与 Windows 互操作",
      "浏览器与网页",
      "视觉与多模态",
      "语音与音频",
      "文档与渲染",
      "技能包",
      "工作流与自动化",
      "Git 与代码评审",
      "通知与集成",
      "开发与运行时",
      "安全与权限",
      "远程与移动端",
      "插件市场与管理",
      "娱乐",
      "未分类",
    ];

    /** Does this plugin draw on that surface? */
    function hasSurface(plugin, key) {
      if (key === "tools") return plugin.tools === true;
      if (key === "command") return plugin.command === true;
      return (plugin.surfaces?.[key] ?? []).length > 0;
    }

    /** Entry pills: label plus the slot that proved it. */
    function entryPills(t, plugin) {
      const pills = [];
      const push = (label, evidence, tone) => pills.push({ label, evidence, tone: tone ?? "normal" });
      if (plugin.surfaces?.settingsSection?.length) push(t("sfSettingsSection"), plugin.surfaces.settingsSection[0]);
      if (plugin.surfaces?.pluginTab?.length) push(t("sfPluginTab"), plugin.surfaces.pluginTab[0]);
      if (plugin.surfaces?.sidebarRight?.length) push(t("sfSidebarRight"), plugin.surfaces.sidebarRight[0]);
      if (plugin.surfaces?.sidebarLeft?.length) push(t("sfSidebarLeft"), plugin.surfaces.sidebarLeft[0]);
      if (plugin.surfaces?.conversation?.length) push(t("sfConversation"), plugin.surfaces.conversation[0]);
      if (plugin.surfaces?.overlay?.length) push(t("sfOverlay"), plugin.surfaces.overlay[0]);
      if (plugin.tools) push(t("sfTools"), "tools.register");
      if (plugin.command) push(t("sfCommand"), "commands.register");
      if (pills.length === 0) push(plugin.ui ? "UI" : "—", plugin.ui ? "client bundle" : "", "muted");
      return pills;
    }

    function fmtSize(bytes) {
      if (!Number.isFinite(bytes) || bytes <= 0) return "";
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
      return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    }

    const NAME_SOURCE_KEY = {
      locale: "nameFromLocale",
      manifest: "nameFromManifest",
      bundle: "nameFromBundle",
      fallback: "nameFromFallback",
    };

    /**
     * Build the page-number strip: first, last, and a window around the current
     * page, with `…` standing in for the gaps.
     * @param {number} current - 1-based page.
     * @param {number} total - page count.
     * @returns {(number|string)[]} tokens.
     */
    function pageTokens(current, total) {
      if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
      const tokens = [1];
      const start = Math.max(2, current - 1);
      const end = Math.min(total - 1, current + 1);
      if (start > 2) tokens.push("…");
      for (let page = start; page <= end; page += 1) tokens.push(page);
      if (end < total - 1) tokens.push("…");
      tokens.push(total);
      return tokens;
    }

    function Panel(props) {
      const t = props.t;
      const [snapshot, setSnapshot] = React.useState(null);
      const [loading, setLoading] = React.useState(true);
      const [error, setError] = React.useState("");
      const [query, setQuery] = React.useState("");
      const [filter, setFilter] = React.useState("all");
      const [surface, setSurface] = React.useState("all");
      const [category, setCategory] = React.useState("all");
      const [view, setView] = React.useState("family");
      const [collapsed, setCollapsed] = React.useState({});
      const [catsOpen, setCatsOpen] = React.useState(true);
      const [page, setPage] = React.useState(1);
      const [pageSize, setPageSize] = React.useState(PAGE_SIZES[0]);
      const [selected, setSelected] = React.useState("");
      const [detail, setDetail] = React.useState(null);
      const [copied, setCopied] = React.useState("");
      const [scrolled, setScrolled] = React.useState(false);
      // Install-time group sort: "none" keeps the alphabetical family order,
      // "desc" puts the most recently installed family first, "asc" the oldest.
      const [sortDir, setSortDir] = React.useState("none");
      const revision = React.useRef(0);
      const profile = React.useRef("");
      const listRef = React.useRef(null);

      const load = React.useCallback(
        async (refresh) => {
          if (refresh !== true) setLoading(true);
          try {
            const suffix = profile.current === "" ? "" : `&profile=${encodeURIComponent(profile.current)}`;
            const body = await getJson(`/snapshot?refresh=${refresh === true ? 1 : 0}${suffix}`);
            setSnapshot(body.snapshot);
            revision.current = body.snapshot.revision ?? revision.current;
            setError("");
          } catch (failure) {
            setError(failure instanceof Error ? failure.message : String(failure));
          } finally {
            setLoading(false);
          }
        },
        []
      );

      React.useEffect(() => {
        load(false);
      }, [load]);

      // Cheap change detection: one tiny request, refetch only on a new revision.
      React.useEffect(() => {
        const timer = setInterval(async () => {
          if (document.visibilityState !== "visible") return;
          try {
            const body = await getJson("/revision");
            if (typeof body.rev === "number" && body.rev !== revision.current) {
              revision.current = body.rev;
              load(true);
            }
          } catch {
            // Offline or restarting host: keep showing the last good snapshot.
          }
        }, 4000);
        const onFocus = () => load(true);
        window.addEventListener("focus", onFocus);
        return () => {
          clearInterval(timer);
          window.removeEventListener("focus", onFocus);
        };
      }, [load]);

      React.useEffect(() => {
        if (selected === "") {
          setDetail(null);
          return undefined;
        }
        let cancelled = false;
        const suffix = profile.current === "" ? "" : `&profile=${encodeURIComponent(profile.current)}`;
        getJson(`/detail?name=${encodeURIComponent(selected)}${suffix}`)
          .then((body) => {
            if (!cancelled) setDetail(body);
          })
          .catch(() => {
            if (!cancelled) setDetail(null);
          });
        return () => {
          cancelled = true;
        };
      }, [selected]);

      const warningsByPlugin = React.useMemo(() => {
        const map = new Map();
        for (const warning of snapshot?.warnings ?? []) {
          if (warning.plugin === "") continue;
          const list = map.get(warning.plugin) ?? [];
          list.push(warning);
          map.set(warning.plugin, list);
        }
        return map;
      }, [snapshot]);

      const plugins = snapshot?.plugins ?? [];

      const shown = React.useMemo(() => {
        const needle = query.trim().toLowerCase();
        return plugins.filter((plugin) => {
          if (filter === "loaded" && stateOf(plugin) === "idle") return false;
          if (filter === "disabled" && stateOf(plugin) !== "off") return false;
          if (filter === "notLoaded" && stateOf(plugin) !== "idle") return false;
          if (filter === "risky" && (plugin.risk ?? []).length === 0) return false;
          if (filter === "ui" && plugin.ui !== true) return false;
          if (filter === "warn" && !warningsByPlugin.has(plugin.name)) return false;
          if (surface !== "all" && !hasSurface(plugin, surface)) return false;
          if (category !== "all" && (plugin.category?.label ?? "") !== category) return false;
          if (needle === "") return true;
          const hay = [
            plugin.name,
            plugin.repo ?? "",
            plugin.description ?? "",
            plugin.family?.label ?? "",
            plugin.category?.label ?? "",
            ...(plugin.displayNames ?? []),
            // Interface text: the words a user actually sees on screen. This is
            // how 「起子插件设置」 finds dsh-brief-sidebar even though the label
            // is registered at runtime and exists only as a bundle literal.
            ...((plugin.uiTexts ?? []).map((entry) => entry.text)),
          ]
            .join(" ")
            .toLowerCase();
          return hay.includes(needle);
        });
      }, [plugins, filter, query, warningsByPlugin, surface, category]);

      const byName = React.useMemo(() => new Map(plugins.map((plugin) => [plugin.name, plugin])), [plugins]);

      const groups = React.useMemo(() => {
        if (snapshot === null) return [];
        const visible = new Set(shown.map((plugin) => plugin.name));
        const list = snapshot.families
          .map((family) => ({
            ...family,
            plugins: family.members.map((name) => byName.get(name)).filter((plugin) => plugin !== undefined && visible.has(plugin.name)),
          }))
          .filter((family) => family.plugins.length > 0);
        // Install-time sort is a GROUP-level ordering: each family ranks by its
        // newest member (a suite installed today puts its whole author group on
        // top), members inside a family keep their name order.
        if (sortDir !== "none") {
          const familyTime = (family) => family.plugins.reduce((max, plugin) => Math.max(max, timeOf(plugin)), 0);
          list.sort((a, b) => (sortDir === "desc" ? familyTime(b) - familyTime(a) : familyTime(a) - familyTime(b)));
        }
        return list;
      }, [snapshot, byName, shown, sortDir]);

      /** A search should reveal its hits even inside a collapsed author. */
      const searching = query.trim() !== "";
      const isCollapsed = (family) => searching !== true && collapsed[family.key] === true;

      /**
       * Pages are filled by *plugin* count, not row count, so "每页 20" always
       * means twenty plugins. A family that straddles a page boundary repeats
       * its header at the top of the next page marked as a continuation, which
       * is what a reader expects from a grouped list.
       */
      const pages = React.useMemo(() => {
        const out = [];
        let current = { rows: [], count: 0 };
        const flush = () => {
          if (current.rows.length > 0) out.push(current);
          current = { rows: [], count: 0 };
        };
        const units =
          view === "flat"
            ? [
                {
                  key: "__flat",
                  family: null,
                  // Flat view sorts rows directly by install time; "none"
                  // keeps the display-name order the snapshot arrives in.
                  plugins:
                    sortDir === "none"
                      ? shown
                      : [...shown].sort((a, b) => (sortDir === "desc" ? timeOf(b) - timeOf(a) : timeOf(a) - timeOf(b))),
                },
              ]
            : groups.map((family) => ({
                key: family.key,
                family,
                plugins: isCollapsed(family) ? [] : family.plugins,
              }));
        for (const unit of units) {
          if (unit.family !== null) {
            if (current.count >= pageSize) flush();
            current.rows.push({ kind: "group", key: `g:${unit.key}`, family: unit.family, continued: false });
          }
          for (const plugin of unit.plugins) {
            if (current.count >= pageSize) {
              flush();
              if (unit.family !== null) current.rows.push({ kind: "group", key: `g:${unit.key}`, family: unit.family, continued: true });
            }
            current.rows.push({ kind: "plugin", key: `p:${plugin.name}`, plugin, child: unit.family !== null });
            current.count += 1;
          }
        }
        flush();
        return out;
      }, [view, shown, groups, collapsed, searching, pageSize, sortDir]);

      const pageCount = Math.max(1, pages.length);
      // Filter changes shrink the list under the current page; clamp instead of
      // rendering an empty page and forcing the user to hunt for the pager.
      const currentPage = Math.min(page, pageCount);
      const pageRows = pages[currentPage - 1]?.rows ?? [];

      /**
       * The "back to top" affordance. It is a real button only once the reader
       * can actually be scrolled away from the top: a 20-row page usually fits,
       * 40 and 100 never do, and a scrolled 20-row page does.
       */
      const onListScroll = (event) => {
        const top = event.currentTarget.scrollTop;
        setScrolled(top > 240);
      };
      const showBackTop = pageSize > PAGE_SIZES[0] || scrolled === true;

      // A new page or a new filter starts at the top of the list; keeping the
      // old scrollTop would land the reader in the middle of the page.
      React.useEffect(() => {
        const node = listRef.current;
        if (node !== null) node.scrollTop = 0;
        setScrolled(false);
      }, [currentPage, view, pageSize, query, category, surface, filter]);

      React.useEffect(() => {
        setPage(1);
      }, [query, filter, surface, category, view, pageSize]);

      const counts = snapshot?.counts ?? { total: 0, loaded: 0, disabled: 0, notLoaded: 0, warnings: 0, families: 0 };
      const changes = snapshot?.changes ?? { added: [], removed: [] };
      // Counts per surface, computed once per snapshot rather than per render.
      const surfaceCounts = React.useMemo(() => {
        const map = {};
        for (const [key] of SURFACE_CHIPS) map[key] = plugins.filter((plugin) => hasSurface(plugin, key)).length;
        return map;
      }, [plugins]);
      const categoryCounts = React.useMemo(() => {
        const map = new Map();
        for (const plugin of plugins) {
          const label = plugin.category?.label ?? "未分类";
          map.set(label, (map.get(label) ?? 0) + 1);
        }
        // Known shelves in market order first, then anything unexpected.
        const ordered = CATEGORY_ORDER.filter((label) => map.has(label)).map((label) => [label, map.get(label)]);
        for (const [label, count] of map) if (CATEGORY_ORDER.includes(label) === false) ordered.push([label, count]);
        return ordered;
      }, [plugins]);
      const hardWarnings = (snapshot?.warnings ?? []).filter((warning) => warning.severity !== "info");

      // No timer here: the "copied" label simply stays until the next copy. A
      // stray setTimeout outside ctx.effect is an HMR leak the contract check
      // rightly refuses.
      const copy = async (value, label) => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(label);
        } catch {
          setCopied("");
        }
      };

      const filterChips = [
        ["all", `${t("filterAll")} ${counts.total}`],
        ["loaded", `${t("filterLoaded")} ${counts.loaded}`],
        ["disabled", `${t("filterDisabled")} ${counts.disabled}`],
        ["notLoaded", `${t("filterNotLoaded")} ${counts.notLoaded}`],
        ["risky", t("filterRisky")],
        ["ui", t("filterUi")],
        ["warn", `${t("filterWarn")} ${hardWarnings.length}`],
      ];

      const anyCollapsed = groups.some((family) => collapsed[family.key] === true);
      const toggleAll = () => {
        if (anyCollapsed) {
          setCollapsed({});
          return;
        }
        const next = {};
        for (const family of groups) next[family.key] = true;
        setCollapsed(next);
      };

      const columns = view === "flat" ? 7 : 6;
      // The state column now carries two stacked lines (`2026-10-29` / `21:36`),
      // so it gets a point back from the package column.
      const colWidths = view === "flat" ? ["29%", "18%", "7%", "11%", "10%", "12%", "13%"] : ["32%", "21%", "7%", "11%", "12%", "17%"];

      const rowFor = (plugin, isChild) => {
        const state = stateOf(plugin);
        const warns = warningsByPlugin.get(plugin.name) ?? [];
        const name = plugin.displayNames?.[0] ?? plugin.name;
        const classes = ["inv-row"];
        if (isChild === true) classes.push("inv-row--child");
        if (selected === plugin.name) classes.push("inv-row--active");
        return h(
          "tr",
          {
            key: plugin.name,
            className: classes.join(" "),
            "data-state": state,
            onClick: () => setSelected(plugin.name === selected ? "" : plugin.name),
            title: plugin.description ?? "",
          },
          h(
            "td",
            { className: "inv-cell inv-cell--pkg" },
            h(
              "code",
              { className: warns.length > 0 ? "inv-pkg inv-pkg--warn" : "inv-pkg" },
              plugin.name
            )
          ),
          h(
            "td",
            { className: "inv-cell inv-cell--name" },
            h("span", { className: "inv-name" }, name),
            plugin.displayNameSource !== "locale"
              ? h("span", { className: "inv-dot", title: t(NAME_SOURCE_KEY[plugin.displayNameSource] ?? "nameFromFallback") }, "·")
              : null
          ),
          h(
            "td",
            { className: "inv-cell inv-cell--ver" },
            plugin.version,
            plugin.declaredVersion !== "" && plugin.declaredVersion !== plugin.version
              ? h("span", { className: "inv-declared", title: `${t("dDeclared")}: ${plugin.declaredVersion}` }, "≠")
              : null
          ),
          h(
            "td",
            { className: "inv-cell inv-cell--state" },
            stateBadge(t, plugin, "table")
          ),
          h(
            "td",
            { className: "inv-cell inv-cell--cat" },
            h("span", { className: "inv-cat", title: plugin.category?.evidence ?? "" }, plugin.category?.label ?? t("unnamed"))
          ),
          view === "flat" ? h("td", { className: "inv-cell inv-cell--family" }, plugin.family?.author ?? plugin.family?.label ?? "") : null,
          h(
            "td",
            { className: "inv-cell inv-cell--entries" },
            ...entryPills(t, plugin).map((pill, index) =>
              h("span", { key: `${plugin.name}-pill-${index}`, className: `inv-pill inv-pill--${pill.tone}`, title: pill.evidence }, pill.label)
            )
          )
        );
      };

      const groupFor = (family, continued) => {
        const familyWarnings = family.plugins.reduce((sum, plugin) => sum + (warningsByPlugin.get(plugin.name)?.length ?? 0), 0);
        const folded = isCollapsed(family);
        const titles = new Map();
        for (const plugin of family.plugins) {
          const label = plugin.category?.label ?? "未分类";
          titles.set(label, (titles.get(label) ?? 0) + 1);
        }
        const lead = [...titles.entries()].sort((a, b) => b[1] - a[1])[0];
        return h(
          "tr",
          {
            key: `g-${family.key}${continued === true ? "-cont" : ""}`,
            className: "inv-group",
            onClick: () => setCollapsed({ ...collapsed, [family.key]: folded !== true }),
          },
          h(
            "td",
            { colSpan: columns, className: "inv-group-cell" },
            h("span", { className: "inv-caret" }, folded ? "▸" : "▾"),
            family.author !== "" && family.author !== undefined
              ? h("span", { className: "inv-author" }, family.author)
              : h("span", { className: "inv-author inv-author--plain" }, family.label),
            continued === true ? h("span", { className: "inv-group-count" }, t("continued")) : null,
            h("span", { className: "inv-group-count" }, `${family.plugins.length} ${t("members")}`),
            family.aggregate !== null && family.aggregate !== undefined
              ? h("span", { className: "inv-group-badge" }, `${t("aggregate")} ${family.aggregate}`)
              : null,
            lead !== undefined ? h("span", { className: "inv-group-cat" }, lead[0]) : null,
            familyWarnings > 0 ? h("span", { className: "inv-group-warn" }, `${familyWarnings} ${t("warnings")}`) : null
          )
        );
      };

      return h(
        "div",
        { "data-inv": "root" },
        h(
          "div",
          { className: "inv-head" },
          h(
            "div",
            { className: "inv-headtext" },
            h("h2", { className: "inv-title" }, t("title")),
            h("p", { className: "inv-sub" }, t("subtitle"))
          ),
          h(
            "div",
            { className: "inv-actions" },
            snapshot !== null
              ? h(
                  "select",
                  {
                    className: "inv-select",
                    value: snapshot.profileName,
                    onChange: (event) => {
                      profile.current = event.target.value;
                      load(false);
                    },
                  },
                  ...(snapshot.profiles ?? []).map((entry) => h("option", { key: entry.name, value: entry.name }, entry.name))
                )
              : null,
            h("button", { className: "inv-btn", onClick: () => load(true), disabled: loading }, loading ? t("scan") : t("refresh")),
            h("a", { className: "inv-btn", href: `${routeRoot()}/export?format=md`, download: null }, t("exportMd")),
            h("a", { className: "inv-btn inv-btn--ghost", href: `${routeRoot()}/export?format=csv`, download: null }, t("exportCsv"))
          )
        ),
        changes.added.length > 0 || changes.removed.length > 0
          ? h(
              "div",
              { className: "inv-delta" },
              changes.added.length > 0 ? h("span", null, `${t("newPackages")} +${changes.added.length}：${changes.added.join("、")}`) : null,
              changes.removed.length > 0 ? h("span", null, `${t("removedPackages")} -${changes.removed.length}：${changes.removed.join("、")}`) : null,
              h("span", { className: "inv-delta-hint" }, t("restartHint"))
            )
          : null,
        hardWarnings.length > 0
          ? h(
              "div",
              { className: "inv-alert" },
              ...hardWarnings.slice(0, 3).map((warning, index) =>
                h(
                  "div",
                  { key: `warn-${index}`, className: "inv-alert-row" },
                  h("span", { className: "inv-alert-code" }, warning.code),
                  h("span", { className: "inv-alert-text" }, `${warning.plugin || "—"}：${warning.detail}`),
                  warning.where !== null && warning.where.line > 0
                    ? h("span", { className: "inv-alert-where" }, `${warning.where.file}:${warning.where.line}`)
                    : null
                )
              )
            )
          : null,
        h(
          "div",
          { className: "inv-toolbar" },
          h("input", {
            className: "inv-search",
            placeholder: t("search"),
            value: query,
            onChange: (event) => setQuery(event.target.value),
          }),
          query !== ""
            ? h("span", { className: "inv-searchhit" }, `${t("searchHit")} ${shown.length}`)
            : null,
          h(
            "div",
            { className: "inv-views" },
            h("button", { className: view === "family" ? "inv-tab inv-tab--on" : "inv-tab", onClick: () => setView("family") }, t("viewFamily")),
            h("button", { className: view === "flat" ? "inv-tab inv-tab--on" : "inv-tab", onClick: () => setView("flat") }, t("viewFlat")),
            h(
              "button",
              {
                className: "inv-tab inv-tab--action",
                onClick: toggleAll,
                disabled: view !== "family" || groups.length === 0,
                title: t("collapseAll"),
              },
              anyCollapsed ? t("expandAll") : t("collapseAll")
            )
          )
        ),
        h(
          "div",
          { className: "inv-filters" },
          h(
            "div",
            { className: "inv-chips" },
            ...filterChips.map(([key, label]) =>
              h("button", { key, className: filter === key ? "inv-chip inv-chip--on" : "inv-chip", onClick: () => setFilter(key) }, label)
            )
          ),
          h(
            "div",
            { className: "inv-chips inv-chips--surface" },
            h("span", { className: "inv-chips-label" }, t("surfaceLabel")),
            h("button", { className: surface === "all" ? "inv-chip inv-chip--on" : "inv-chip", onClick: () => setSurface("all") }, t("surfaceAny")),
            ...SURFACE_CHIPS.filter(([key]) => surfaceCounts[key] > 0).map(([key, labelKey]) =>
              h(
                "button",
                {
                  key,
                  className: surface === key ? "inv-chip inv-chip--on" : "inv-chip",
                  onClick: () => setSurface(surface === key ? "all" : key),
                },
                `${t(labelKey)} ${surfaceCounts[key]}`
              )
            )
          ),
          h(
            "div",
            { className: catsOpen === true ? "inv-cats" : "inv-cats inv-cats--folded" },
            h(
              "button",
              {
                className: "inv-cats-head",
                onClick: () => setCatsOpen((open) => open !== true),
                title: t("categoryHint"),
              },
              h("span", { className: "inv-caret" }, catsOpen === true ? "▾" : "▸"),
              h("span", { className: "inv-chips-label" }, t("categoryLabel")),
              catsOpen === true ? null : h("span", { className: "inv-cats-count" }, `${categoryCounts.length}`)
            ),
            // Rendered only while open, so the fold can never be defeated by a
            // stylesheet that happens to be stale.
            catsOpen === true
              ? h(
                  "div",
                  { className: "inv-cats-body" },
                  h(
                    "button",
                    { className: category === "all" ? "inv-chip inv-chip--on" : "inv-chip", onClick: () => setCategory("all") },
                    `${t("categoryAny")} ${plugins.length}`
                  ),
                  ...categoryCounts.map(([label, count]) =>
                    h(
                      "button",
                      {
                        key: label,
                        className: category === label ? "inv-chip inv-chip--on" : "inv-chip",
                        onClick: () => setCategory(category === label ? "all" : label),
                      },
                      `${label} ${count}`
                    )
                  )
                )
              : null
          )
        ),
        error !== ""
          ? h(
              "div",
              { className: "inv-error" },
              h("span", null, `${t("error")}：${error}`),
              h("button", { className: "inv-btn", onClick: () => load(true) }, t("retry"))
            )
          : null,
        h(
          "div",
          { className: "inv-listwrap" },
          h(
            "div",
            { className: "inv-tablewrap", ref: listRef, onScroll: onListScroll },
            loading && snapshot === null
              ? h("div", { className: "inv-skeleton" }, ...Array.from({ length: 10 }, (_, index) => h("div", { key: index, className: "inv-skeleton-row" })))
              : null,
            !loading && shown.length === 0
              ? h("div", { className: "inv-empty" }, h("p", null, t("empty")), h("p", { className: "inv-empty-hint" }, t("emptyHint")))
              : null,
            shown.length > 0
              ? h(
                  "table",
                  { className: "inv-table" },
                  h(
                    "colgroup",
                    null,
                    ...colWidths.map((width, index) => h("col", { key: `col-${index}`, style: { width } }))
                  ),
                  h(
                    "thead",
                    null,
                    h(
                      "tr",
                      null,
                      h("th", null, t("colPkg")),
                      h("th", null, t("colName")),
                      h("th", { className: "inv-th-narrow" }, t("colVersion")),
                      h(
                        "th",
                        {
                          className: "inv-th-narrow inv-th-sort",
                          onClick: () => setSortDir(sortDir === "none" ? "desc" : sortDir === "desc" ? "asc" : "none"),
                          title:
                            sortDir === "none"
                              ? t("colState")
                              : sortDir === "desc"
                                ? `${t("colState")} ▼`
                                : `${t("colState")} ▲`,
                        },
                        t("colState"),
                        h("span", { className: `inv-sort-arrow inv-sort-arrow--${sortDir}` }, sortDir === "desc" ? "▼" : sortDir === "asc" ? "▲" : "⇅")
                      ),
                      h("th", null, t("colCategory")),
                      view === "flat" ? h("th", null, t("colFamily")) : null,
                      h("th", null, t("colEntries"))
                    )
                  ),
                  h(
                    "tbody",
                    null,
                    ...pageRows.map((row) => (row.kind === "group" ? groupFor(row.family, row.continued) : rowFor(row.plugin, row.child)))
                  )
                )
              : null
          ),
          shown.length > 0 && showBackTop
            ? h(
                "button",
                {
                  className: "inv-top",
                  title: t("backTop"),
                  "aria-label": t("backTop"),
                  onClick: () => {
                    const node = listRef.current;
                    if (node !== null) node.scrollTo({ top: 0, behavior: "smooth" });
                  },
                },
                "↑"
              )
            : null,
          // Docked inside the list frame so the sheet can align itself with
          // the table without measuring the viewport.
          detail !== null
            ? h(DetailDrawer, { t, detail, onClose: () => setSelected(""), copy, copied, leftPct: "35%" })
            : null
        ),
        shown.length > 0
          ? h(
              "div",
              { className: "inv-pager" },
              h(
                "div",
                { className: "inv-pager-side" },
                h("span", { className: "inv-pager-total" }, `${t("pagerTotal")} ${shown.length} ${t("pagerUnit")}`)
              ),
              h(
                "div",
                { className: "inv-pager-pages" },
                h(
                  "button",
                  { className: "inv-page inv-page--nav", onClick: () => setPage(Math.max(1, currentPage - 1)), disabled: currentPage <= 1 },
                  `‹ ${t("pagerPrev")}`
                ),
                ...pageTokens(currentPage, pageCount).map((token, index) =>
                  typeof token === "number"
                    ? h(
                        "button",
                        {
                          key: `pg-${token}`,
                          className: token === currentPage ? "inv-page inv-page--on" : "inv-page",
                          onClick: () => setPage(token),
                        },
                        String(token)
                      )
                    : h("span", { key: `gap-${index}`, className: "inv-page-gap" }, "…")
                ),
                h(
                  "button",
                  { className: "inv-page inv-page--nav", onClick: () => setPage(Math.min(pageCount, currentPage + 1)), disabled: currentPage >= pageCount },
                  `${t("pagerNext")} ›`
                )
              ),
              h(
                "div",
                { className: "inv-pager-side inv-pager-side--end" },
                h("span", { className: "inv-pager-info" }, `${t("pagerPrefix")} ${currentPage} / ${pageCount} ${t("pagerPage")}`),
                h(
                  "label",
                  { className: "inv-pager-size" },
                  t("pagerPer"),
                  h(
                    "select",
                    { className: "inv-select inv-select--sm", value: pageSize, onChange: (event) => setPageSize(Number(event.target.value)) },
                    ...PAGE_SIZES.map((size) => h("option", { key: size, value: size }, String(size)))
                  )
                )
              )
            )
          : null,
        h("p", { className: "inv-foot" }, t("staticHint"))
      );
    }

    /**
     * Detail panel.
     *
     * Two layout rules learned from the first build: the panel must not be as
     * tall as the list it hangs off (a short plugin left 400px of blank panel
     * below the fold), and it must not steal the list's own scroll. So it is a
     * fixed, viewport-anchored sheet that sizes to its content, and the row
     * list stays readable behind a click-to-dismiss scrim.
     */
    function DetailDrawer(props) {
      const { t, detail, onClose, copy, copied } = props;
      const plugin = detail.plugin;
      const entries = detail.entries ?? [];

      React.useEffect(() => {
        const onKey = (event) => {
          if (event.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
      }, [onClose]);
      const capability = (detail.matrix ?? []).filter((cell) => cell.risk !== true);
      const risky = (detail.matrix ?? []).filter((cell) => cell.risk === true && cell.present === true);
      const uiTexts = plugin.uiTexts ?? [];
      // A registration that passes a variable (`label`, `id: FAMILY_SECTION_ID`)
      // leaves no literal caption for the entry scanner, so fall back to the
      // detected slots — otherwise a plugin that clearly draws a settings page
      // claims to have no UI at all.
      const surfaceRows =
        entries.length > 0
          ? []
          : Object.entries(plugin.surfaces ?? {}).flatMap(([key, slots]) =>
              (Array.isArray(slots) ? slots : []).map((slot) => ({ key, slot }))
            );
      // Last resort: the seats named by the interface-text fingerprints. A
      // bundle that registers `name: OVERLAY_SLOT` leaves no slot literal, but
      // its copy sits next to the overlay seat — say so, marked as inference,
      // instead of claiming the plugin draws nothing.
      const seatRows =
        entries.length === 0 && surfaceRows.length === 0
          ? [...new Set(uiTexts.map((entry) => entry.where).filter((where) => where !== "copy" && where !== "locale"))]
          : [];
      const uiTextPill = (entry) =>
        h(
          "span",
          { key: `${entry.text}-${entry.where}`, className: "inv-uitext", title: t("uiTextHint") },
          h("span", { className: "inv-uitext-text" }, entry.text),
          h("span", { className: "inv-uitext-where" }, t(WHERE_KEY[entry.where] ?? "whereCopy"))
        );

      const kv = (label, value) =>
        h("div", { className: "inv-kv" }, h("span", { className: "inv-kv-key" }, label), h("span", { className: "inv-kv-val" }, value));

      // ✓ proven by a slot literal, ~ only implied by a service dependency.
      // The tilde matters: without it a plugin that merely injects the sidebar
      // service reads as if it owns a tab there.
      const capPill = (cell) => {
        const mark = cell.present !== true ? "×" : cell.weak === true ? "~" : "✓";
        const tone =
          cell.present !== true ? "inv-cap" : cell.weak === true ? "inv-cap inv-cap--weak" : "inv-cap inv-cap--on";
        return h(
          "span",
          {
            key: `${cell.key}`,
            className: tone,
            title: cell.evidence !== "" ? cell.evidence : cell.label,
          },
          `${mark} ${cell.label}`
        );
      };

      return h(
        "div",
        { className: "inv-dock" },
        h("div", {
          className: "inv-scrim",
          role: "presentation",
          onClick: (event) => {
            event.stopPropagation();
            onClose();
          },
        }),
        h(
          "div",
          {
            className: "inv-drawer",
            role: "dialog",
            "aria-modal": "true",
            style: { "--inv-drawer-left": props.leftPct ?? "35%" },
            onClick: (event) => event.stopPropagation(),
          },
          h(
            "div",
            { className: "inv-drawer-head" },
            h(
              "div",
              { className: "inv-drawer-titles" },
              h("h3", { className: "inv-drawer-title" }, plugin.displayNames?.[0] ?? plugin.name),
              h(
                "div",
                { className: "inv-drawer-meta" },
                h("code", null, plugin.name),
                h("span", { className: "inv-drawer-dot" }, "·"),
                h("span", null, plugin.version),
                h("span", { className: "inv-drawer-dot" }, "·"),
                stateBadge(t, plugin, "head")
              )
            ),
            h("button", { className: "inv-close", onClick: onClose, title: t("close") }, "✕")
          ),
          h(
            "div",
            { className: "inv-drawer-body" },
            h("h4", { className: "inv-section" }, t("dEntries")),
            entries.length === 0 && surfaceRows.length === 0 && seatRows.length === 0
              ? h("p", { className: "inv-hint inv-hint--block" }, t("noSurface"))
              : h(
                  "div",
                  { className: "inv-entries" },
                  ...entries.map((entry, index) =>
                    h(
                      "div",
                      { key: `${entry.slot}-${entry.name}-${index}`, className: "inv-entry" },
                      h("span", { className: "inv-entry-where" }, entry.groupLabel),
                      entry.name !== ""
                        ? h("span", { className: "inv-entry-name" }, entry.name)
                        : h("span", { className: "inv-hint" }, t("entryRuntime")),
                      h("code", { className: "inv-entry-slot" }, entry.slot)
                    )
                  ),
                  ...surfaceRows.map((row, index) =>
                    h(
                      "div",
                      { key: `surface-${row.key}-${index}`, className: "inv-entry" },
                      h("span", { className: "inv-entry-where" }, t(SURFACE_LABEL_KEY[row.key] ?? "colEntries")),
                      h("span", { className: "inv-hint" }, t("entryRuntime")),
                      h("code", { className: "inv-entry-slot" }, row.slot)
                    )
                  ),
                  ...seatRows.map((seat, index) =>
                    h(
                      "div",
                      { key: `seat-${seat}-${index}`, className: "inv-entry" },
                      h("span", { className: "inv-entry-where" }, t(WHERE_KEY[seat] ?? "colEntries")),
                      h("span", { className: "inv-hint" }, t("seatInferred")),
                      h("code", { className: "inv-entry-slot" }, "—")
                    )
                  )
                ),
            h("h4", { className: "inv-section" }, t("dCapability")),
            h("div", { className: "inv-caps" }, ...capability.map(capPill)),
            risky.length > 0 ? h("h4", { className: "inv-section inv-section--risk" }, t("dRisk")) : null,
            risky.length > 0
              ? h(
                  "div",
                  { className: "inv-caps" },
                  ...risky.map((cell) =>
                    h("span", { key: cell.key, className: "inv-cap inv-cap--risk", title: cell.evidence }, `✓ ${cell.label}`)
                  )
                )
              : null,
            // UI-text fingerprints: the words this plugin's interface shows.
            // Searching 「起子插件设置」 must land on dsh-brief-sidebar even
            // though that label is registered at runtime — this block is where
            // the hit gets explained instead of looking like a false match.
            // Seat-tagged texts rank first; the tail hides behind a summary so
            // a chatty bundle cannot bury the useful rows.
            uiTexts.length > 0 ? h("h4", { className: "inv-section" }, t("dUiTexts")) : null,
            uiTexts.length > 0
              ? h(
                  "div",
                  { className: "inv-uitexts", title: t("uiTextHint") },
                  ...uiTexts.slice(0, UI_TEXT_HEAD).map(uiTextPill),
                  uiTexts.length > UI_TEXT_HEAD
                    ? h(
                        "details",
                        { className: "inv-uitexts-more" },
                        h("summary", null, `${t("showAll")} ${uiTexts.length}`),
                        h("div", { className: "inv-uitexts" }, ...uiTexts.slice(UI_TEXT_HEAD).map(uiTextPill))
                      )
                    : null
                )
              : null,
            h("h4", { className: "inv-section" }, t("dInfo")),
            h(
              "div",
              { className: "inv-kv-grid" },
              kv(t("dCategory"), plugin.category?.label ?? "—"),
              kv(t("dFamily"), plugin.family?.label ?? "—"),
              kv(
                t("dAuthor"),
                typeof plugin.author === "string" && plugin.author !== ""
                  ? h(
                      "span",
                      null,
                      plugin.author,
                      plugin.authorFromFamily === true
                        ? h("span", { className: "inv-kv-note", title: t("dFamily") }, t("authorFromFamily"))
                        : null
                    )
                  : "—"
              ),
              kv(t("dInstalled"), whenParts(plugin).date === "" ? "—" : `${whenParts(plugin).date} ${whenParts(plugin).time}`),
              kv(t("dSize"), fmtSize(plugin.sizeBytes) !== "" ? fmtSize(plugin.sizeBytes) : "—"),
              kv(t("dLoadedBy"), plugin.inBundles ? "dsh.profile.bundles" : plugin.mountedBy !== null ? `↳ ${plugin.mountedBy}` : "—"),
              kv(
                t("dRepo"),
                plugin.repo !== null
                  ? h("a", { className: "inv-link", href: plugin.repo.replace(/^git\+/, "").replace(/\.git$/, ""), target: "_blank", rel: "noreferrer" }, t("openRepo"))
                  : "—"
              )
            ),
            h(
              "div",
              { className: "inv-kv inv-kv--wide" },
              h("span", { className: "inv-kv-key" }, t("dDir")),
              h("code", { className: "inv-path" }, plugin.dir),
              h("button", { className: "inv-mini", onClick: () => copy(plugin.dir, "dir") }, copied === "dir" ? t("copied") : t("copyPath"))
            ),
            (detail.patchSnippets ?? []).length > 0
              ? h(
                  "details",
                  { className: "inv-details" },
                  h("summary", null, `${t("dPatch")} (${(detail.patchSnippets ?? []).length})`),
                  ...(detail.patchSnippets ?? []).map((snippet) =>
                    h("pre", { key: `${snippet.id}-${snippet.line}`, className: "inv-pre" }, `# ${snippet.id} @ ${snippet.line}\n${snippet.text}`)
                  )
                )
              : h("p", { className: "inv-hint inv-hint--block" }, t("patchEmpty"))
          )
        )
      );
    }

    /** Small block injected into the official plugin detail page. */
    function DetailMeta(props) {
      const t = props.t;
      const name = props?.plugin?.name ?? props?.pluginName ?? props?.name ?? "";
      const [data, setData] = React.useState(null);
      React.useEffect(() => {
        if (typeof name !== "string" || name === "") return undefined;
        let cancelled = false;
        getJson(`/detail?name=${encodeURIComponent(name)}`)
          .then((body) => {
            if (!cancelled) setData(body);
          })
          .catch(() => {});
        return () => {
          cancelled = true;
        };
      }, [name]);
      if (data === null) return null;
      const plugin = data.plugin;
      const present = (data.matrix ?? []).filter((cell) => cell.present === true && cell.risk !== true && cell.weak !== true);
      return h(
        "div",
        { "data-inv": "detail" },
        h("div", { className: "inv-detail-line" }, h("span", { className: "inv-kv-key" }, t("colName")), h("span", null, plugin.displayNames?.[0] ?? plugin.name)),
        h(
          "div",
          { className: "inv-detail-line" },
          h("span", { className: "inv-kv-key" }, t("colEntries")),
          h("span", null, present.length > 0 ? present.map((cell) => cell.label).join("、") : "—")
        )
      );
    }

    function installStyle() {
      // Re-inject instead of bailing out when a tag already exists. A
      // hot-reloaded build used to inherit the previous stylesheet: the new
      // markup was then laid out by old rules (the old `.inv-group-cell` was a
      // flex container, which is what squeezed the group header into columns
      // one character wide), and any class the old sheet did not know — such as
      // `.inv-cats--folded` — silently did nothing.
      for (const stale of Array.from(document.querySelectorAll('style[id^="dsh-installed-inventory.css"]'))) {
        stale.remove();
      }
      const style = document.createElement("style");
      style.id = "dsh-installed-inventory.css";
      style.textContent = [
        "[data-inv=root]{display:flex;flex-direction:column;gap:10px;padding:14px 16px 12px;color:var(--dsw-alias-label-primary,#1f2329);position:relative;min-height:100%;box-sizing:border-box}",
        "[data-inv=root] .inv-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap}",
        "[data-inv=root] .inv-title{margin:0;font-size:15px;font-weight:650}",
        "[data-inv=root] .inv-sub{margin:3px 0 0;font-size:11.5px;line-height:1.5;opacity:.6;max-width:760px}",
        "[data-inv=root] .inv-actions{display:flex;gap:6px;align-items:center;flex-wrap:wrap}",
        "[data-inv=root] .inv-btn{appearance:none;border:0;border-radius:8px;padding:5px 9px;font:inherit;font-size:11.5px;cursor:pointer;background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.07));color:inherit;text-decoration:none}",
        "[data-inv=root] .inv-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.12))}",
        "[data-inv=root] .inv-btn:disabled{opacity:.5;cursor:default}",
        "[data-inv=root] .inv-btn--ghost{background:transparent;border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.12))}",
        "[data-inv=root] .inv-select{appearance:none;border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.12));border-radius:8px;padding:4px 7px;font:inherit;font-size:11.5px;background:transparent;color:inherit}",
        "[data-inv=root] .inv-select--sm{padding:2px 5px;font-size:11px;border-radius:6px}",
        "[data-inv=root] .inv-delta{display:flex;gap:10px;flex-wrap:wrap;align-items:center;font-size:11.5px;padding:6px 10px;border-radius:8px;background:rgba(46,160,92,.12);color:#1f7a4d}",
        "[data-inv=root] .inv-delta-hint{opacity:.75}",
        "[data-inv=root] .inv-alert{border:1px solid rgba(230,170,40,.4);background:rgba(230,170,40,.1);border-radius:10px;padding:7px 10px;display:flex;flex-direction:column;gap:3px}",
        "[data-inv=root] .inv-alert-row{display:flex;gap:8px;font-size:11.5px;align-items:baseline}",
        "[data-inv=root] .inv-alert-code{font-family:var(--font-mono,monospace);font-size:10.5px;padding:1px 5px;border-radius:4px;background:rgba(0,0,0,.07)}",
        "[data-inv=root] .inv-alert-text{flex:1;overflow-wrap:anywhere}",
        "[data-inv=root] .inv-alert-where{opacity:.6;font-family:var(--font-mono,monospace);font-size:10.5px}",
        "[data-inv=root] .inv-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap}",
        "[data-inv=root] .inv-search{flex:1;min-width:220px;border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.12));border-radius:8px;padding:6px 10px;font:inherit;font-size:12px;background:transparent;color:inherit}",
        "[data-inv=root] .inv-searchhit{font-size:11px;opacity:.55;white-space:nowrap}",
        "[data-inv=root] .inv-views{display:flex;gap:2px;border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.12));border-radius:8px;padding:2px}",
        "[data-inv=root] .inv-tab{appearance:none;border:0;background:none;color:inherit;font:inherit;font-size:11.5px;padding:3px 9px;border-radius:6px;cursor:pointer;opacity:.62}",
        "[data-inv=root] .inv-tab--on{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.07));opacity:1;font-weight:600}",
        "[data-inv=root] .inv-tab--action{border-left:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.12));border-radius:0 6px 6px 0;margin-left:2px}",
        "[data-inv=root] .inv-tab:disabled{opacity:.3;cursor:default}",
        "[data-inv=root] .inv-filters{display:flex;flex-direction:column;gap:5px}",
        "[data-inv=root] .inv-chips{display:flex;gap:5px;flex-wrap:wrap;align-items:center}",
        "[data-inv=root] .inv-chips--surface{padding-top:1px}",
        "[data-inv=root] .inv-chips-label{font-size:10.5px;opacity:.45;margin-right:2px;white-space:nowrap}",
        "[data-inv=root] .inv-chip{appearance:none;border:1px solid transparent;border-radius:999px;padding:2px 8px;font:inherit;font-size:11px;cursor:pointer;background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.05));color:inherit;opacity:.75;white-space:nowrap}",
        "[data-inv=root] .inv-chip:hover{opacity:1}",
        "[data-inv=root] .inv-chip--on{border-color:var(--dsw-alias-label-accent,#2c6ef2);color:var(--dsw-alias-label-accent,#2c6ef2);opacity:1;background:transparent}",
        "[data-inv=root] .inv-cats{display:flex;gap:6px;align-items:flex-start;padding-top:1px}",
        "[data-inv=root] .inv-cats-head{appearance:none;border:0;background:none;color:inherit;font:inherit;display:flex;align-items:center;gap:2px;cursor:pointer;padding:2px 4px 2px 0;flex:none}",
        "[data-inv=root] .inv-cats-body{display:flex;gap:5px;flex-wrap:wrap;align-items:center;min-width:0}",
        "[data-inv=root] .inv-cats--folded .inv-cats-body{display:none}",
        "[data-inv=root] .inv-tablewrap{overflow:auto;border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.1));border-radius:10px;max-height:calc(100vh - 356px);min-height:180px}",
        "[data-inv=root] .inv-table{width:100%;border-collapse:separate;border-spacing:0;table-layout:fixed;font-size:12px}",
        "[data-inv=root] .inv-table th{position:sticky;top:0;z-index:2;text-align:left;font-weight:600;font-size:10.5px;letter-spacing:.03em;padding:6px 8px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.1));background:var(--dsw-alias-bg-layer-1,Canvas);color:var(--dsw-alias-label-secondary,#5a616b);white-space:nowrap}",
        "[data-inv=root] .inv-row{cursor:pointer}",
        "[data-inv=root] .inv-row td{border-bottom:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.06))}",
        "[data-inv=root] .inv-row:hover td{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.03))}",
        "[data-inv=root] .inv-row--active td{background:rgba(44,110,242,.08)}",
        "[data-inv=root] .inv-cell{padding:5px 8px;vertical-align:middle;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
        "[data-inv=root] .inv-row--child .inv-cell--pkg{padding-left:20px}",
        "[data-inv=root] .inv-pkg{font-family:var(--font-mono,monospace);font-size:11px;font-weight:600;opacity:.9}",
        "[data-inv=root] .inv-pkg--warn{box-shadow:inset 2px 0 0 #d19000;padding-left:5px}",
        "[data-inv=root] .inv-cell--name{opacity:.85}",
        "[data-inv=root] .inv-name{font-weight:500}",
        "[data-inv=root] .inv-dot{opacity:.35;margin-left:4px}",
        "[data-inv=root] .inv-cell--ver{font-family:var(--font-mono,monospace);font-size:10.5px;opacity:.7}",
        "[data-inv=root] .inv-declared{color:#9a6a00;margin-left:3px;font-size:10.5px}",
                "[data-inv=root] .inv-th-sort{cursor:pointer;user-select:none}",
        "[data-inv=root] .inv-th-sort:hover{color:var(--dsw-alias-label-primary,inherit)}",
        "[data-inv=root] .inv-sort-arrow{margin-left:3px;font-size:8.5px;opacity:.6}",
        "[data-inv=root] .inv-sort-arrow--none{opacity:.28}",
        "[data-inv=root] .inv-uitexts{display:flex;flex-wrap:wrap;gap:4px;row-gap:4px}",
        "[data-inv=root] .inv-uitext{display:inline-flex;align-items:baseline;gap:5px;padding:2px 8px;border-radius:999px;background:var(--dsw-alias-bg-layer-2,rgba(0,0,0,.045));font-size:10.5px}",
        "[data-inv=root] .inv-uitext-text{font-weight:600}",
        "[data-inv=root] .inv-uitext-where{font-size:9px;opacity:.5}",
        "[data-inv=root] .inv-uitexts-more{flex-basis:100%;margin-top:2px}",
        "[data-inv=root] .inv-uitexts-more summary{cursor:pointer;font-size:10px;opacity:.55;padding:2px 2px;width:fit-content}",
        "[data-inv=root] .inv-uitexts-more[open] summary{opacity:.75}",
"[data-inv=root] .inv-state{font-size:10.5px;padding:1px 6px;border-radius:999px;white-space:nowrap}",
        // The install-time badge keeps the state palette but stacks date over
        // time; tabular figures stop the column from jittering between dates.
        // `display:flex` rather than `inline-flex` on purpose: an inline-level
        // box taller than the cell's line box overflows it, and `.inv-cell`
        // clips — the time line lost its bottom half until this was a block.
        "[data-inv=root] .inv-state--when{display:flex;width:fit-content;flex-direction:column;align-items:flex-start;line-height:1.15;padding:1px 6px;border-radius:6px;font-variant-numeric:tabular-nums;font-family:var(--font-mono,monospace)}",
        "[data-inv=root] .inv-when-date{font-size:10px;font-weight:650}",
        "[data-inv=root] .inv-when-time{font-size:9px;opacity:.72;letter-spacing:.02em}",
        "[data-inv=root] .inv-when-unknown{font-size:9px;opacity:.6;font-family:inherit}",
        "[data-inv=root] .inv-cell--state{padding-top:1px;padding-bottom:1px}",
        "[data-inv=root] .inv-kv-note{margin-left:6px;font-size:9.5px;opacity:.5}",
        "[data-inv=root] .inv-state--on{color:#1f7a4d;background:rgba(46,160,92,.14)}",
        "[data-inv=root] .inv-state--off{color:#9a6a00;background:rgba(230,170,40,.18)}",
        "[data-inv=root] .inv-state--idle{color:#a33;background:rgba(200,60,60,.12)}",
        "[data-inv=root] .inv-state--via{color:#185fa5;background:rgba(44,110,242,.12)}",
        "[data-inv=root] .inv-cat{font-size:10.5px;padding:1px 6px;border-radius:6px;background:rgba(0,0,0,.05);white-space:nowrap}",
        "[data-inv=root] .inv-cell--entries{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
        "[data-inv=root] .inv-pill{display:inline-block;font-size:10px;padding:1px 6px;border-radius:999px;background:rgba(0,0,0,.05);margin-right:3px;opacity:.85}",
        "[data-inv=root] .inv-pill--muted{opacity:.4}",
        "[data-inv=root] .inv-group td{background:var(--dsw-alias-bg-layer-2,rgba(0,0,0,.035));cursor:pointer;padding:5px 8px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.08))}",
        "[data-inv=root] .inv-group-cell{display:table-cell;font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:22px}",
        "[data-inv=root] .inv-group-cell > *{vertical-align:middle}",
        "[data-inv=root] .inv-caret{opacity:.5;display:inline-block;width:12px;font-size:9px}",
        "[data-inv=root] .inv-author{font-weight:650;font-family:var(--font-mono,monospace);font-size:11px;margin-right:8px}",
        "[data-inv=root] .inv-author--plain{font-family:inherit}",
        "[data-inv=root] .inv-group-count{opacity:.55;margin-right:8px;font-size:11px}",
        "[data-inv=root] .inv-group-badge{font-size:10px;padding:1px 6px;border-radius:999px;background:rgba(44,110,242,.14);color:#185fa5;margin-right:6px}",
        "[data-inv=root] .inv-group-cat{font-size:10px;padding:1px 6px;border-radius:999px;background:rgba(0,0,0,.06);opacity:.7;margin-right:6px}",
        "[data-inv=root] .inv-group-warn{font-size:10px;padding:1px 6px;border-radius:999px;background:rgba(230,170,40,.18);color:#9a6a00}",
        "[data-inv=root] .inv-listwrap{position:relative}",
        "[data-inv=root] .inv-top{position:absolute;right:14px;bottom:14px;z-index:3;width:30px;height:30px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.12));background:var(--dsw-alias-bg-layer-1,Canvas);color:inherit;font-size:13px;line-height:1;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.14);opacity:.92}",
        "[data-inv=root] .inv-top:hover{opacity:1}",
        "[data-inv=root] .inv-cats-count{font-size:10px;opacity:.4;margin-left:3px}",
        "[data-inv=root] .inv-pager{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:12px;font-size:11.5px;padding:2px 2px 0}",
        "[data-inv=root] .inv-pager-side{display:flex;align-items:center;gap:8px;min-width:0}",
        "[data-inv=root] .inv-pager-side--end{justify-content:flex-end;flex-wrap:nowrap}",
        "[data-inv=root] .inv-pager-total{opacity:.6;white-space:nowrap}",
        "[data-inv=root] .inv-pager-size{display:flex;gap:4px;align-items:center;opacity:.75;white-space:nowrap}",
        "[data-inv=root] .inv-pager-pages{display:flex;gap:4px;align-items:center;justify-content:center}",
        "[data-inv=root] .inv-page{appearance:none;border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.12));background:var(--dsw-alias-bg-layer-1,Canvas);color:inherit;font:inherit;font-size:11.5px;height:26px;min-width:26px;padding:0 6px;border-radius:8px;cursor:pointer}",
        "[data-inv=root] .inv-page:hover:not(:disabled){border-color:var(--dsw-alias-label-accent,#2c6ef2)}",
        "[data-inv=root] .inv-page--on{background:var(--dsw-alias-label-accent,#2c6ef2);border-color:transparent;color:#fff;font-weight:650}",
        "[data-inv=root] .inv-page--nav{padding:0 9px}",
        "[data-inv=root] .inv-page:disabled{opacity:.35;cursor:default}",
        "[data-inv=root] .inv-page-gap{opacity:.4;padding:0 2px}",
        "[data-inv=root] .inv-pager-info{opacity:.5;white-space:nowrap}",
        "[data-inv=root] .inv-empty{padding:28px;text-align:center;font-size:12px;opacity:.7}",
        "[data-inv=root] .inv-empty-hint{font-size:11px;opacity:.6}",
        "[data-inv=root] .inv-error{display:flex;gap:10px;align-items:center;font-size:11.5px;color:#a33;background:rgba(200,60,60,.08);padding:8px 10px;border-radius:8px}",
        "[data-inv=root] .inv-skeleton{display:flex;flex-direction:column;gap:6px;padding:8px 10px}",
        "[data-inv=root] .inv-skeleton-row{height:22px;border-radius:6px;background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.05))}",
        "[data-inv=root] .inv-foot{margin:0;font-size:10.5px;line-height:1.4;opacity:.42}",
        // The detail sheet is docked to the list itself, not floating over the
        // window: top and bottom hug the table frame (so its top sits level
        // with the sticky header), and its left edge starts at the 界面名
        // column, keeping the package column readable behind it. Only the body
        // scrolls; the size never depends on the content.
        "[data-inv=root] .inv-scrim{position:fixed;inset:0;z-index:60;background:rgba(20,22,26,.22)}",
        "[data-inv=root] .inv-drawer{position:absolute;top:0;bottom:0;left:var(--inv-drawer-left,35%);right:0;z-index:61;display:flex;flex-direction:column;min-width:580px;min-height:min(430px,calc(100vh - 150px));background:var(--dsw-alias-bg-layer-1,Canvas);border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.1));border-radius:14px;box-shadow:0 18px 48px rgba(0,0,0,.2);padding:12px 16px 14px}",
        "[data-inv=root] .inv-drawer-head{flex:none;display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:2px;padding-bottom:8px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.08))}",
        "[data-inv=root] .inv-drawer-body{flex:1;min-height:0;overflow:auto;padding-top:8px}",
        "[data-inv=root] .inv-drawer-titles{min-width:0}",
        "[data-inv=root] .inv-drawer-meta{display:flex;gap:6px;align-items:center;flex-wrap:wrap;font-size:10.5px;opacity:.6;margin-top:3px}",
        "[data-inv=root] .inv-drawer-meta code{font-family:var(--font-mono,monospace);font-size:10px;opacity:.9}",
        "[data-inv=root] .inv-drawer-dot{opacity:.5}",
        "[data-inv=root] .inv-drawer-title{margin:0;font-size:14px;font-weight:650}",
        "[data-inv=root] .inv-close{appearance:none;border:0;background:none;color:inherit;font-size:13px;cursor:pointer;opacity:.5}",
        "[data-inv=root] .inv-kv-list{display:flex;flex-direction:column;gap:5px}",
        "[data-inv=root] .inv-kv{display:flex;gap:8px;font-size:11.5px;align-items:baseline}",
        "[data-inv=root] .inv-kv-key{width:74px;flex:none;opacity:.5}",
        "[data-inv=root] .inv-kv-val{flex:1;overflow-wrap:anywhere}",
        "[data-inv=root] .inv-path{font-family:var(--font-mono,monospace);font-size:10.5px;opacity:.8}",
        "[data-inv=root] .inv-mini{appearance:none;border:0;background:none;color:var(--dsw-alias-label-accent,#2c6ef2);font:inherit;font-size:10.5px;cursor:pointer;padding:0 4px}",
        "[data-inv=root] .inv-link{color:var(--dsw-alias-label-accent,#2c6ef2);font-size:11.5px}",
        "[data-inv=root] .inv-hint{font-size:10.5px;opacity:.55}",
        "[data-inv=root] .inv-section{margin:12px 0 5px;font-size:10.5px;font-weight:650;letter-spacing:.04em;text-transform:uppercase;opacity:.55}",
        "[data-inv=root] .inv-section--risk{color:#8a5f00;opacity:.9}",
        "[data-inv=root] .inv-caps{display:flex;flex-wrap:wrap;gap:4px}",
        "[data-inv=root] .inv-cap{font-size:10.5px;line-height:1.5;padding:1px 7px;border-radius:999px;background:rgba(0,0,0,.045);opacity:.42;white-space:nowrap}",
        "[data-inv=root] .inv-cap--on{opacity:1;background:rgba(46,160,92,.13);color:#1f7a4d}",
        "[data-inv=root] .inv-cap--weak{opacity:.85;background:rgba(44,110,242,.1);color:#185fa5}",
        "[data-inv=root] .inv-cap--risk{opacity:1;background:rgba(230,170,40,.16);color:#8a5f00}",
        "[data-inv=root] .inv-entries{display:flex;flex-direction:column;gap:1px}",
        "[data-inv=root] .inv-entry{display:flex;gap:8px;align-items:baseline;font-size:11.5px;padding:3px 0;border-bottom:1px dashed var(--dsw-alias-border-l1,rgba(0,0,0,.07))}",
        "[data-inv=root] .inv-entry-where{flex:none;width:72px;font-size:11px;opacity:.55}",
        "[data-inv=root] .inv-entry-name{flex:none;font-weight:600;max-width:200px;overflow-wrap:anywhere}",
        "[data-inv=root] .inv-entry-slot{flex:1;min-width:0;text-align:right;font-family:var(--font-mono,monospace);font-size:9.5px;opacity:.38;overflow-wrap:anywhere}",
        "[data-inv=root] .inv-kv-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:3px 18px}",
        "[data-inv=root] .inv-kv-grid .inv-kv-key{width:58px}",
        "[data-inv=root] .inv-kv--wide{margin-top:6px}",
        "[data-inv=root] .inv-hint--block{display:block;margin:2px 0 0}",
        "[data-inv=root] .inv-details{margin-top:10px}",
        "[data-inv=root] .inv-details summary{cursor:pointer;font-size:10.5px;font-weight:650;letter-spacing:.04em;text-transform:uppercase;opacity:.55}",
        "[data-inv=root] .inv-pre{margin:6px 0;padding:8px;border-radius:8px;background:var(--dsw-alias-bg-layer-2,rgba(0,0,0,.04));font-family:var(--font-mono,monospace);font-size:10px;line-height:1.5;overflow:auto;max-height:220px;white-space:pre}",
        "[data-inv=detail]{display:flex;flex-direction:column;gap:4px;font-size:11.5px;padding:4px 0}",
        "[data-inv=detail] .inv-detail-line{display:flex;gap:8px}",
        "[data-inv=detail] .inv-kv-key{width:64px;flex:none;opacity:.5}"
      ].join("\n");
      document.head.appendChild(style);
    }

    const inject = ["slots", "locale"];

    function apply(ctx) {
      installStyle();
      const t = ctx.locale.bind(NS);
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), "installed-inventory: dictionaries");

      ctx.slots.inject("plugins.tab", () =>
        ctx.slots.register(
          { name: "plugins.tab", id: TAB_ID, order: 62, label: () => t("tab"), locale: NS, inject: () => ({ t }) },
          () => React.createElement(Panel, { t })
        )
      );

      ctx.slots.inject("plugins.detail.section", () =>
        ctx.slots.register(
          { name: "plugins.detail.section", id: DETAIL_ID, order: 20, locale: NS, inject: () => ({ t }) },
          (slotProps) => React.createElement(DetailMeta, { ...(slotProps ?? {}), t })
        )
      );

      if (bootConfig().standaloneSection === true) {
        ctx.slots.inject("settings.section", () =>
          ctx.slots.register(
            { name: "settings.section", id: SECTION_ID, order: 46, label: () => t("tab"), locale: NS, inject: () => ({ t }) },
            () => React.createElement(Panel, { t })
          )
        );
      }
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});
