import { isProbablyReaderable, Readability } from "@mozilla/readability";

/*
    title: article title;
    content: HTML string of processed article content;
    textContent: text content of the article, with all the HTML tags removed;
    length: length of an article, in characters;
    excerpt: article description, or short excerpt from the content;
    byline: author metadata;
    dir: content direction;
    siteName: name of the site;
    lang: content language;
    publishedTime: published time;
*/
interface ReadabilityType {
  title: string | null | undefined;
  content: string | null | undefined;
  textContent: string | null | undefined;
  length: number | null | undefined;
  excerpt: string | null | undefined;
  byline: string | null | undefined;
  dir: string | null | undefined;
  siteName: string | null | undefined;
  lang: string | null | undefined;
  publishedTime: string | null | undefined;
}

interface ActionItem {
  type: "button" | "link" | "input" | "select" | "form" | "interactive";
  label: string;
  href?: string;
  disabled: boolean;
  ariaRole?: string;
  inputType?: string;
  formAction?: string;
  importance: "primary" | "secondary" | "navigation" | "unknown";
  boundingRect?: { top: number; left: number; width: number; height: number };
}

interface ParsedActions {
  actions: ActionItem[];
  forms: { action: string; method: string; inputs: string[] }[];
  navigationLinks: ActionItem[];
  primaryActions: ActionItem[];
}

function parseActions(document: HTMLDocument): ParsedActions | null {
  const win = document.defaultView;
  if (!win) return null;

  const norm = (s: string) => s.replace(/\s+/g, " ").trim();
  const clamp = (s: string, n: number) =>
    s.length <= n ? s : s.slice(0, n - 1) + "…";

  const isVisibleEl = (el: Element): boolean => {
    const e = el as HTMLElement;
    try {
      const cs = win.getComputedStyle(e);
      if (
        cs.display === "none" ||
        cs.visibility === "hidden" ||
        cs.opacity === "0"
      )
        return false;
    } catch {
      // getComputedStyle can throw for detached elements
      return false;
    }
    if (e.hidden || e.getAttribute("aria-hidden") === "true") return false;
    const r = e.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    return true;
  };

  const getLabelForElement = (el: Element): string => {
    const e = el as HTMLElement;

    // aria-label
    const aria = norm(e.getAttribute("aria-label") || "");
    if (aria) return aria;

    // aria-labelledby
    const labelledBy = e.getAttribute("aria-labelledby");
    if (labelledBy) {
      const labelEl = document.getElementById(labelledBy);
      if (labelEl) {
        const t = norm(labelEl.textContent || "");
        if (t) return t;
      }
    }

    // <label for="...">
    const id = e.getAttribute("id");
    if (id) {
      const lab = document.querySelector(`label[for="${CSS.escape(id)}"]`);
      if (lab) {
        const t = norm(lab.textContent || "");
        if (t) return t;
      }
    }

    // wrapping label
    const wrappingLabel = e.closest("label");
    if (wrappingLabel) {
      const t = norm(wrappingLabel.textContent || "");
      if (t) return t;
    }

    // text content (for buttons/links)
    const textContent = norm(e.textContent || "");
    if (textContent && textContent.length <= 100) return textContent;

    // title attribute
    const title = norm(e.getAttribute("title") || "");
    if (title) return title;

    // placeholder (for inputs)
    const placeholder = norm((e as HTMLInputElement).placeholder || "");
    if (placeholder) return placeholder;

    // value (for submit buttons)
    const value = norm((e as HTMLInputElement).value || "");
    if (value && e.tagName.toLowerCase() === "input") return value;

    // name attribute as fallback
    const name = norm(e.getAttribute("name") || "");
    if (name) return name;

    return "";
  };

  const determineImportance = (
    el: Element,
    type: ActionItem["type"],
  ): ActionItem["importance"] => {
    const e = el as HTMLElement;
    // Fixed: className might be SVGAnimatedString, use getAttribute as fallback
    const classAttr = e.getAttribute("class") || "";
    const classes = (
      typeof e.className === "string" ? e.className : classAttr
    ).toLowerCase();
    const id = (e.id || "").toLowerCase();
    const role = (e.getAttribute("role") || "").toLowerCase();

    // Primary indicators
    const primaryPatterns =
      /primary|cta|submit|checkout|buy|purchase|signup|sign-up|register|login|log-in|confirm|save|send|continue|next|proceed/i;
    if (
      primaryPatterns.test(classes) ||
      primaryPatterns.test(id) ||
      primaryPatterns.test(e.textContent || "")
    ) {
      return "primary";
    }

    const inputType = (e as HTMLInputElement).type?.toLowerCase();
    if (inputType === "submit") return "primary";

    if (
      role === "navigation" ||
      e.closest("nav") ||
      /nav|menu|header|footer/i.test(classes)
    ) {
      return "navigation";
    }

    if (type === "link" && e.closest("nav,header,footer,[role='navigation']")) {
      return "navigation";
    }

    const secondaryPatterns = /secondary|cancel|back|close|dismiss|skip/i;
    if (secondaryPatterns.test(classes) || secondaryPatterns.test(id)) {
      return "secondary";
    }

    return "unknown";
  };

  const extractAction = (el: Element): ActionItem | null => {
    if (!isVisibleEl(el)) return null;

    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute("role")?.toLowerCase();
    const e = el as HTMLElement;

    let type: ActionItem["type"];
    let href: string | undefined;
    let inputType: string | undefined;
    const formAction: string | undefined = undefined; // Fixed: was declared but never assigned

    if (tag === "button" || role === "button") {
      type = "button";
    } else if (tag === "a") {
      type = "link";
      href = (el as HTMLAnchorElement).href || undefined;
      // Skip anchor links and javascript: links for primary actions
      if (href?.startsWith("#") || href?.startsWith("javascript:")) {
        href = undefined;
      }
    } else if (tag === "input") {
      const inp = el as HTMLInputElement;
      inputType = inp.type?.toLowerCase() || "text";
      if (inputType === "submit" || inputType === "button") {
        type = "button";
      } else {
        type = "input";
      }
    } else if (tag === "select") {
      type = "select";
    } else if (role === "link") {
      type = "link";
    } else if (role === "tab" || role === "menuitem" || role === "option") {
      type = "interactive";
    } else {
      type = "interactive";
    }

    const label = clamp(getLabelForElement(el), 150);
    if (!label && type !== "input" && type !== "select") return null;

    const disabled = !!(
      (e as HTMLButtonElement).disabled ||
      el.getAttribute("aria-disabled") === "true" ||
      el.hasAttribute("disabled")
    );

    const rect = e.getBoundingClientRect();
    const importance = determineImportance(el, type);

    return {
      type,
      label,
      href,
      disabled,
      ariaRole: role || undefined,
      inputType,
      formAction,
      importance,
      boundingRect: {
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
    };
  };

  // Extract all interactive elements
  const selectors = [
    "button",
    "a[href]",
    "input[type='submit']",
    "input[type='button']",
    "[role='button']",
    "[role='link']",
    "[role='tab']",
    "[role='menuitem']",
    "[onclick]",
    "[tabindex='0']",
  ].join(",");

  const elements = Array.from(document.querySelectorAll(selectors));
  const actions: ActionItem[] = [];

  for (const el of elements) {
    const action = extractAction(el);
    if (action) {
      actions.push(action);
    }
  }

  // Dedupe by label + type (keep first occurrence)
  const seen = new Set<string>();
  const uniqueActions = actions.filter((a) => {
    const key = `${a.type}:${a.label}:${a.href || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Extract forms
  const forms = Array.from(document.querySelectorAll("form"))
    .filter(isVisibleEl)
    .slice(0, 20)
    .map((form) => {
      const f = form as HTMLFormElement;
      const inputs = Array.from(f.querySelectorAll("input,select,textarea"))
        .filter(isVisibleEl)
        .map((inp) => getLabelForElement(inp) || inp.getAttribute("name") || "")
        .filter(Boolean);
      return {
        action: f.action || "",
        method: (f.method || "GET").toUpperCase(),
        inputs,
      };
    });

  // Categorize
  const navigationLinks = uniqueActions.filter(
    (a) => a.importance === "navigation",
  );
  const primaryActions = uniqueActions.filter(
    (a) => a.importance === "primary",
  );

  return {
    actions: uniqueActions.slice(0, 100),
    forms,
    navigationLinks: navigationLinks.slice(0, 30),
    primaryActions: primaryActions.slice(0, 15),
  };
}

function parseTextContent(document: HTMLDocument) {
  const readability = new Readability(document);

  // Readability.parse() shape varies by lib build; keep it flexible
  let siteContent: any | null;

  if (isProbablyReaderable(document)) {
    siteContent = readability.parse();
  } else {
    // --- Non-readerable app/dashboard: summarize as "UI state" ---
    const win = document.defaultView;
    if (!win) return null;

    const MAX_TEXT_CHARS = 12000; // total visible text budget
    const MAX_CONTROLS = 120; // cap control inventory
    const MAX_TABLES = 8; // cap tables
    const MAX_TABLE_ROWS_SAMPLE = 5; // per-table sample rows

    const clamp = (s: string, n: number) =>
      s.length <= n ? s : s.slice(0, n - 1) + "…";
    const norm = (s: string) => s.replace(/\s+/g, " ").trim();

    const isVisibleEl = (el: Element) => {
      const e = el as HTMLElement;
      const cs = win.getComputedStyle(e);
      if (
        cs.display === "none" ||
        cs.visibility === "hidden" ||
        cs.opacity === "0"
      )
        return false;
      // hidden attribute or aria-hidden
      if (e.hidden || e.getAttribute("aria-hidden") === "true") return false;
      const r = e.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return false;
      // For "what's going on", prioritize viewport-visible content
      const vw = win.innerWidth || 0;
      const vh = win.innerHeight || 0;
      const intersectsViewport =
        r.bottom >= 0 && r.right >= 0 && r.top <= vh && r.left <= vw;
      return intersectsViewport;
    };

    const isVisibleTextNode = (n: Node) => {
      if (n.nodeType !== Node.TEXT_NODE) return false;
      const text = norm(n.textContent || "");
      if (!text) return false;

      const parent = n.parentElement;
      if (!parent) return false;
      if (!isVisibleEl(parent)) return false;

      // ignore style/script/noscript
      const tag = parent.tagName.toLowerCase();
      if (tag === "script" || tag === "style" || tag === "noscript")
        return false;

      return true;
    };

    const labelForControl = (el: Element) => {
      const e = el as HTMLElement;

      // aria-label beats everything
      const aria = norm(e.getAttribute("aria-label") || "");
      if (aria) return aria;

      // <label for="...">
      const id = e.getAttribute("id");
      if (id) {
        const lab = document.querySelector(`label[for="${CSS.escape(id)}"]`);
        if (lab) {
          const t = norm(lab.textContent || "");
          if (t) return t;
        }
      }

      // wrapping label
      const wrappingLabel = e.closest("label");
      if (wrappingLabel) {
        const t = norm(wrappingLabel.textContent || "");
        if (t) return t;
      }

      // fallback: text content (buttons/links) or placeholder/name/title
      const t = norm(e.textContent || "");
      if (t && t.length <= 80) return t;

      const ph = norm((e as HTMLInputElement).placeholder || "");
      if (ph) return ph;

      const name = norm(e.getAttribute("name") || "");
      if (name) return name;

      const title = norm(e.getAttribute("title") || "");
      if (title) return title;

      return "";
    };

    const controlState = (el: Element) => {
      const tag = el.tagName.toLowerCase();
      const e = el as any;

      const common = {
        disabled: !!(e.disabled || el.getAttribute("aria-disabled") === "true"),
        expanded: el.getAttribute("aria-expanded") ?? undefined,
        selected: el.getAttribute("aria-selected") ?? undefined,
        checked:
          tag === "input" && (e.type === "checkbox" || e.type === "radio")
            ? String(!!e.checked)
            : (el.getAttribute("aria-checked") ?? undefined),
      };

      if (tag === "input") {
        const type = (e.type || "text").toLowerCase();
        // Avoid leaking secrets: don’t include password values
        const value =
          type === "password"
            ? "(password)"
            : type === "checkbox" || type === "radio"
              ? undefined
              : norm(String(e.value ?? ""));
        return {
          ...common,
          type: `input:${type}`,
          value: value ? clamp(value, 120) : undefined,
        };
      }

      if (tag === "textarea") {
        const value = norm(String(e.value ?? ""));
        return {
          ...common,
          type: "textarea",
          value: value ? clamp(value, 200) : undefined,
        };
      }

      if (tag === "select") {
        const sel = el as HTMLSelectElement;
        const selected = sel.selectedOptions?.[0]?.textContent
          ? norm(sel.selectedOptions[0].textContent!)
          : "";
        return {
          ...common,
          type: "select",
          value: selected ? clamp(selected, 120) : undefined,
        };
      }

      if (tag === "button") return { ...common, type: "button" };
      if (tag === "a")
        return {
          ...common,
          type: "link",
          value: clamp(norm((el as HTMLAnchorElement).href || ""), 160),
        };

      // role-based
      const role = (el.getAttribute("role") || "").toLowerCase();
      if (role) return { ...common, type: `role:${role}` };

      return { ...common, type: tag };
    };

    const extractVisibleText = (root: Element, budgetChars: number) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          return isVisibleTextNode(node)
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        },
      });

      let out = "";
      let n: Node | null;
      while ((n = walker.nextNode())) {
        const t = norm(n.textContent || "");
        if (!t) continue;

        // Stop at budget
        if (out.length + t.length + 1 > budgetChars) {
          out +=
            (out ? "\n" : "") +
            clamp(t, Math.max(0, budgetChars - out.length - 1));
          break;
        }
        out += (out ? "\n" : "") + t;
      }
      return out;
    };

    const extractHeadings = (root: Element) => {
      const hs = Array.from(root.querySelectorAll("h1,h2,h3,h4,h5,h6"))
        .filter(isVisibleEl)
        .slice(0, 60)
        .map((h) => ({
          level: parseInt(h.tagName.slice(1), 10),
          text: clamp(norm(h.textContent || ""), 140),
        }))
        .filter((h) => h.text.length > 0);
      return hs;
    };

    const summarizeTable = (table: HTMLTableElement) => {
      // columns
      const headerCells = Array.from(table.querySelectorAll("thead th")).length
        ? Array.from(table.querySelectorAll("thead th"))
        : Array.from(table.querySelectorAll("tr th"));

      const columns = headerCells
        .map((th) => clamp(norm(th.textContent || ""), 80))
        .filter(Boolean);

      const rows = Array.from(table.querySelectorAll("tbody tr")).length
        ? Array.from(table.querySelectorAll("tbody tr"))
        : Array.from(table.querySelectorAll("tr")).slice(
            columns.length ? 1 : 0,
          );

      const visibleRows = rows.filter((r) => isVisibleEl(r)).slice(0, 40);
      const rowCount = rows.length;

      const sampleRows = visibleRows
        .slice(0, MAX_TABLE_ROWS_SAMPLE)
        .map((tr) => {
          const cells = Array.from(tr.querySelectorAll("td,th")).map((td) =>
            clamp(norm(td.textContent || ""), 120),
          );
          return cells;
        });

      return {
        columns: columns.slice(0, 16),
        rowCount,
        sampleRows,
      };
    };

    const navLinkDensity = (el: Element) => {
      const text = norm(el.textContent || "");
      if (!text) return 1;
      const links = el.querySelectorAll("a").length;
      // crude proxy: if many links and little text, likely nav-ish
      return Math.min(1, links / Math.max(1, text.length / 50));
    };

    const scoreRegion = (el: Element) => {
      if (!isVisibleEl(el)) return -Infinity;
      const r = (el as HTMLElement).getBoundingClientRect();
      const area = Math.max(0, r.width) * Math.max(0, r.height);

      const text = extractVisibleText(el, 2000); // cheap partial for scoring
      const textLen = text.length;

      const controls = el.querySelectorAll(
        "button,input,select,textarea,a,[role='button'],[role='link']",
      ).length;
      const tables = el.querySelectorAll(
        "table,[role='table'],[role='grid']",
      ).length;

      const linkDensity = navLinkDensity(el);

      // weights tuned for "main pane" selection
      const score =
        textLen * 1.0 +
        controls * 120 +
        tables * 250 +
        Math.sqrt(area) * 0.15 -
        linkDensity * 900;

      return score;
    };

    // 1) pick candidate "main-ish" containers
    const candidates = Array.from(
      document.querySelectorAll(
        "main,[role='main'],#app,#root,[data-testid='app'],body > *",
      ),
    );

    const scored = candidates
      .map((el) => ({ el, score: scoreRegion(el) }))
      .filter((x) => Number.isFinite(x.score))
      .sort((a, b) => b.score - a.score);

    const chosenRegions = scored.slice(0, 3).map((x) => x.el);
    const root = chosenRegions[0] ?? document.body;

    // 2) extract headings + visible text from dominant region
    const headings = extractHeadings(root);

    // Split budgets across regions to avoid missing right pane / dialog
    const perRegionBudget = Math.floor(
      MAX_TEXT_CHARS / Math.max(1, chosenRegions.length),
    );
    const regionTexts = chosenRegions.map((el, i) => ({
      regionIndex: i,
      text: extractVisibleText(el, perRegionBudget),
    }));

    const visibleText = regionTexts
      .map((rt) => rt.text)
      .filter(Boolean)
      .join("\n\n")
      .slice(0, MAX_TEXT_CHARS);

    // 3) controls inventory (dominant region only + top-level dialogs)
    const dialogs = Array.from(
      document.querySelectorAll("[role='dialog'],dialog"),
    )
      .filter(isVisibleEl)
      .slice(0, 2);
    const controlRoots = [root, ...dialogs];

    const controls = Array.from(
      new Set(
        controlRoots.flatMap((cr) =>
          Array.from(
            cr.querySelectorAll(
              "button,input,select,textarea,a,[role='button'],[role='link'],[role='tab']",
            ),
          ).filter(isVisibleEl),
        ),
      ),
    )
      .slice(0, MAX_CONTROLS)
      .map((el) => {
        const tag = el.tagName.toLowerCase();
        const role = (el.getAttribute("role") || "").toLowerCase();
        const label = labelForControl(el);
        const state = controlState(el);
        return {
          kind: role ? `role:${role}` : tag,
          label: label ? clamp(label, 140) : "",
          state,
        };
      })
      .filter((c) => c.label || c.kind.startsWith("role:tab"));

    // 4) alerts / toasts / errors
    const alerts = Array.from(
      document.querySelectorAll(
        "[role='alert'],[aria-live],[data-toast],.toast,.Toastify,.error,.alert",
      ),
    )
      .filter(isVisibleEl)
      .slice(0, 10)
      .map((el) => clamp(norm(el.textContent || ""), 240))
      .filter(Boolean);

    // 5) tables summary
    const tables = Array.from(root.querySelectorAll("table"))
      .filter(isVisibleEl)
      .slice(0, MAX_TABLES)
      .map((t) => summarizeTable(t as HTMLTableElement));

    // 6) make a compact markdown-ish "screen transcript" for the LLM
    const title = norm(document.title || "") || "(untitled page)";
    const url = norm(document.location?.href || "");

    const headingsMd = headings.length
      ? headings
          .map((h) => `${"  ".repeat(Math.max(0, h.level - 1))}- ${h.text}`)
          .join("\n")
      : "";

    const controlsMd = controls.length
      ? controls
          .slice(0, 40)
          .map((c) => {
            const bits: string[] = [];
            if (c.label) bits.push(c.label);
            bits.push(`[${c.state.type}]`);
            if (c.state.value) bits.push(`= ${c.state.value}`);
            if (c.state.disabled) bits.push("(disabled)");
            if (c.state.selected === "true") bits.push("(selected)");
            if (c.state.checked === "true") bits.push("(checked)");
            return `- ${bits.join(" ")}`;
          })
          .join("\n")
      : "";

    const tablesMd = tables.length
      ? tables
          .map((t, i) => {
            const cols = t.columns?.length
              ? `Columns: ${t.columns.join(" | ")}`
              : "Columns: (unknown)";
            const samples = t.sampleRows
              .map((row) => `  - ${row.slice(0, 8).join(" | ")}`)
              .join("\n");
            return `Table ${i + 1} (${t.rowCount} rows)\n${cols}\n${samples}`;
          })
          .join("\n\n")
      : "";

    const alertsMd = alerts.length
      ? alerts.map((a) => `- ${a}`).join("\n")
      : "";

    const snapshotMd = [
      `# ${title}`,
      url ? `URL: ${url}` : "",
      headingsMd ? `## Headings / Sections\n${headingsMd}` : "",
      alertsMd ? `## Alerts / Messages\n${alertsMd}` : "",
      visibleText
        ? `## Visible Text\n${clamp(visibleText, MAX_TEXT_CHARS)}`
        : "",
      controlsMd ? `## Key Controls (sample)\n${controlsMd}` : "",
      tablesMd ? `## Tables (summary)\n${tablesMd}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    // Put it into a "Readability-like" object so downstream summarization code can stay uniform.
    // (If you want, you can keep snapshot JSON separately too.)
    siteContent = {
      title,
      byline: null,
      dir: document.documentElement.getAttribute("dir") || null,
      lang: document.documentElement.getAttribute("lang") || null,
      content: snapshotMd, // NOTE: not HTML; it's a compact transcript
      textContent: snapshotMd, // convenient for LLM
      length: snapshotMd.length,
      excerpt: clamp(norm(visibleText || snapshotMd), 220),
      siteName: null,
      publishedTime: null,
      // optional: attach structured data for your own use
      _uiSnapshot: {
        title,
        url,
        headings,
        alerts,
        controls,
        tables,
      },
    };
  }

  return siteContent;
}

// TODO: Create actual personalities based on user needs
// Reassuring to anxious usergroup,
type SummaryPersonality = "friendly" | "concise" | "detailed";

// Updated to integrate with agent system
async function createSummary(
  stuffToSummarize: ReadabilityType,
  parsedActions: ParsedActions | null,
  _personality: SummaryPersonality,
  options: { verbose?: boolean } = {},
) {
  const { summarizePage } = await import("./agents");
  return summarizePage(stuffToSummarize, parsedActions, options);
}

export { parseActions, parseTextContent, createSummary };
export type { ActionItem, ParsedActions, ReadabilityType, SummaryPersonality };
