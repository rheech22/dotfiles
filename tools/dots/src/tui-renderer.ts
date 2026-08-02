import { sliceByColumn, truncateToWidth, visibleWidth, wrapTextWithAnsi, type Component } from "@earendil-works/pi-tui";
import { basename } from "node:path";
import type { LinkReviewView, PackageReviewView } from "./application.js";
import type { TuiController, TuiState } from "./tui-controller.js";
import { escapeControlCharacters } from "./reporters.js";
import { formatHumanPath, formatHumanText } from "./human-path.js";
import { linkReviewLines, operationResultLines, packageReviewLines, setupResultLines, wrapReviewLines } from "./tui-review-model.js";
import {
  bodyContentRows,
  compactConfirmationChrome,
  compactOverlayChrome,
  confirmationFits,
  confirmationLines,
  contextualFooterLines,
  isConfirmation,
  visiblePagedRows,
} from "./tui-layout.js";

export interface RendererDimensions {
  readonly rows: number;
}

const reset = "\u001b[0m";
const e = escapeControlCharacters;

function palette(enabled: boolean) {
  const color = (code: number, text: string): string => enabled ? `\u001b[${code}m${text}${reset}` : text;
  return {
    strong: (text: string) => color(1, text),
    dim: (text: string) => color(2, text),
    ok: (text: string) => color(32, text),
    change: (text: string) => color(36, text),
    warn: (text: string) => color(33, text),
    blocked: (text: string) => color(31, text),
    selected: (text: string) => color(7, text),
  };
}

type Palette = ReturnType<typeof palette>;

const border = {
  horizontal: "─",
  vertical: "│",
  topLeft: "╭",
  topRight: "╮",
  bottomLeft: "╰",
  bottomRight: "╯",
  topJoin: "┬",
  bottomJoin: "┴",
} as const;

function shortPath(path: string, home?: string): string {
  if (home) {
    const formatted = formatHumanPath(path, home);
    if (formatted.startsWith("~")) return e(formatted);
  }
  return e(basename(path));
}

const hp = (value: string, home?: string): string => e(home ? formatHumanPath(value, home) : value);
const ht = (value: string, home?: string): string => e(home ? formatHumanText(value, home) : value);

function fit(lines: readonly string[], width: number): string[] {
  return lines.flatMap((line) => wrapTextWithAnsi(line, Math.max(1, width))).map((line) => truncateToWidth(line, width));
}

function marker(state: string): "OK" | "CHANGE" | "WARN" | "BLOCKED" {
  if (state === "linked" || state === "installed-by-selected-brew") return "OK";
  if (state === "missing" || state === "wrong-link" || state === "occupied") return "CHANGE";
  if (state === "source-missing" || state === "blocked") return "BLOCKED";
  return "WARN";
}

function styleTokens(line: string, p: Palette): string {
  return line.replace(/\b(BLOCKED|FAILED|RECOVERY|CHANGE|MISSING|WARN|EXTERNAL|OK|COMPLETE|BREW)\b/g, (token) => {
    if (/BLOCKED|FAILED|RECOVERY/.test(token)) return p.blocked(token);
    if (/CHANGE|MISSING/.test(token)) return p.change(token);
    if (/WARN|EXTERNAL/.test(token)) return p.warn(token);
    return p.ok(token);
  });
}

function pad(line: string, width: number): string {
  const hasAnsi = line.includes("\u001b[");
  const rendered = truncateToWidth(line, Math.max(0, width), "...", hasAnsi);
  const fitted = hasAnsi ? rendered : rendered.replace(/\u001b\[[0-9;]*m/g, "");
  return `${fitted}${" ".repeat(Math.max(0, width - visibleWidth(fitted)))}`;
}

function stripSgr(line: string): string {
  return line.replace(/\u001b\[[0-9;]*m/g, "");
}

function titleBorder(title: string, width: number): string {
  if (width < 4) return border.horizontal.repeat(width);
  const label = truncateToWidth(` ${title} `, width - 2);
  return `${border.topLeft}${label}${border.horizontal.repeat(Math.max(0, width - 2 - visibleWidth(label)))}${border.topRight}`;
}

function titleSegment(title: string, width: number): string {
  const inner = Math.max(0, width - 2);
  const label = truncateToWidth(` ${title} `, inner);
  return `${label}${border.horizontal.repeat(Math.max(0, inner - visibleWidth(label)))}`;
}

function joinedTitleBorder(titles: readonly string[], widths: readonly number[]): string {
  return `${border.topLeft}${titles.map((title, index) => titleSegment(title, widths[index]!)).join(border.topJoin)}${border.topRight}`;
}

function joinedBottomBorder(widths: readonly number[]): string {
  return `${border.bottomLeft}${widths.map((width) => border.horizontal.repeat(Math.max(0, width - 2))).join(border.bottomJoin)}${border.bottomRight}`;
}

function frame(title: string, lines: readonly string[], width: number, p: Palette, height?: number): string[] {
  const inner = Math.max(1, width - 2);
  const content = lines.flatMap((line) => fit([line], inner));
  const totalHeight = height ?? content.length + 2;
  if (totalHeight <= 0) return [];
  if (totalHeight === 1) return [p.strong(`${border.topLeft}${border.horizontal.repeat(inner)}${border.topRight}`)];
  const contentHeight = Math.max(0, totalHeight - 2);
  return [
    p.strong(titleBorder(title, width)),
    ...Array.from({ length: contentHeight }, (_, index) => `${border.vertical}${pad(styleTokens(content[index] ?? "", p), inner)}${border.vertical}`),
    p.strong(`${border.bottomLeft}${border.horizontal.repeat(inner)}${border.bottomRight}`),
  ];
}

interface WindowedRow {
  readonly text: string;
  readonly itemIndex?: number;
}

function windowRows(items: readonly string[], cursor: number, budget: number): WindowedRow[] {
  if (budget <= 0 || items.length === 0) return [];
  if (items.length <= budget) return items.map((text, itemIndex) => ({ text, itemIndex }));
  const rowBudget = Math.max(1, budget - 1);
  const start = Math.max(0, Math.min(items.length - rowBudget, cursor - Math.floor(rowBudget / 2)));
  const end = Math.min(items.length, start + rowBudget);
  return [
    ...items.slice(start, end).map((text, index) => ({ text, itemIndex: start + index })),
    { text: `(${start + 1}-${end} of ${items.length})` },
  ];
}

function listFrame(title: string, items: readonly string[], cursor: number, width: number, height: number, p: Palette): string[] {
  if (height < 2) return frame(title, [], width, p, height);
  const inner = Math.max(1, width - 2);
  const rows = windowRows(items, cursor, height - 2);
  return [
    p.strong(titleBorder(title, width)),
    ...Array.from({ length: height - 2 }, (_, index) => {
      const row = rows[index];
      const raw = pad(row?.text ?? "", inner);
      return `${border.vertical}${row?.itemIndex === cursor ? p.selected(raw) : styleTokens(raw, p)}${border.vertical}`;
    }),
    p.strong(`${border.bottomLeft}${border.horizontal.repeat(inner)}${border.bottomRight}`),
  ];
}

function pageRows(lines: readonly string[], rowBudget: number, offset: number): string[] {
  if (lines.length <= rowBudget) return [...lines];
  const contentBudget = visiblePagedRows(lines.length, rowBudget);
  if (contentBudget <= 0) return rowBudget > 0 ? [`(0 of ${lines.length})`] : [];
  const start = Math.max(0, Math.min(lines.length - contentBudget, offset));
  const end = Math.min(lines.length, start + contentBudget);
  return [...lines.slice(start, end), `(${start + 1}-${end} of ${lines.length})`];
}

function linkMetrics(state: TuiState): { linked: number; total: number; actionable: number } {
  const enabled = state.dashboard?.links.filter(({ enabled, state: value }) => enabled && value !== "disabled") ?? [];
  return {
    linked: enabled.filter(({ state: value }) => value === "linked").length,
    total: enabled.length,
    actionable: enabled.filter(({ state: value }) => value === "missing" || value === "wrong-link" || value === "occupied").length,
  };
}

function workspaceStrip(state: TuiState, width: number, p: Palette): string[] {
  const dashboard = state.dashboard;
  const links = linkMetrics(state);
  const available = dashboard?.dependencies.filter(({ available: value }) => value).length ?? 0;
  const cliTotal = dashboard?.dependencies.length ?? 0;
  const active = (route: TuiState["route"], label: string): string => state.route === route ? `[${label}]` : label;
  const overviewStatus = !dashboard ? "loading" : dashboard.healthy ? `Ready | Node ${e(dashboard.node.actual)} OK`
    : `${dashboard.errors}E ${dashboard.warnings}W | Node ${e(dashboard.node.actual)} ${dashboard.node.supported ? "OK" : "BLOCKED"}`;
  const linkStatus = !dashboard ? "loading" : `${links.linked}/${links.total} linked | A:${links.actionable}`;
  const packageStatus = !dashboard ? "loading" : `CLI ${available}/${cliTotal} available`;
  const cards = [
    { title: active("overview", "1 Overview"), status: overviewStatus },
    { title: active("links", "2 Links"), status: linkStatus },
    { title: active("packages", "3 Packages"), status: packageStatus },
  ];
  if (width >= 100) {
    const cellWidth = Math.floor((width + 2) / 3);
    const widths = [cellWidth, cellWidth, width + 2 - cellWidth * 2];
    return [
      p.strong(joinedTitleBorder(cards.map(({ title }) => title), widths)),
      `${border.vertical}${cards.map((card, index) => pad(styleTokens(card.status, p), widths[index]! - 2)).join(border.vertical)}${border.vertical}`,
      p.strong(joinedBottomBorder(widths)),
    ];
  }
  const overviewCompact = !dashboard ? "loading" : dashboard.healthy ? `Node ${e(dashboard.node.actual)} OK`
    : `${dashboard.errors}E ${dashboard.warnings}W Node ${e(dashboard.node.actual)} ${dashboard.node.supported ? "OK" : "BLOCKED"}`;
  const narrow = width < 60;
  const first = `${active("overview", narrow ? "1 O" : "1 Overview")} ${overviewCompact}`;
  const second = narrow
    ? `${active("links", "2 L")} ${links.linked}/${links.total} A:${links.actionable} | ${active("packages", "3 Pkg")} CLI ${available}/${cliTotal}`
    : `${active("links", "2 Links")} ${links.linked}/${links.total} linked A:${links.actionable} | ${active("packages", "3 Packages")} CLI ${available}/${cliTotal}`;
  const inner = width - 2;
  return [
    p.strong(titleBorder("Workspaces", width)),
    `${border.vertical}${pad(styleTokens(first, p), inner)}${border.vertical}`,
    `${border.vertical}${pad(styleTokens(second, p), inner)}${border.vertical}`,
    p.strong(`${border.bottomLeft}${border.horizontal.repeat(inner)}${border.bottomRight}`),
  ];
}

function overview(state: TuiState, width: number, rowBudget: number, p: Palette): string[] {
  const dashboard = state.dashboard;
  if (!dashboard) return ["Loading current state..."];
  const enabledIssues = dashboard.links.filter(({ enabled, state: value }) => enabled && value !== "linked" && value !== "disabled");
  const requiredCli = dashboard.dependencies.filter(({ required, available: value }) => required && !value);
  const issues = [
    ...enabledIssues.map((item) => `${marker(item.state)} Link ${e(item.description)}: ${item.state}`),
    ...requiredCli.map((item) => `BLOCKED Required CLI ${e(item.description)} is unavailable`),
    ...(!dashboard.node.supported ? [`BLOCKED Node ${e(dashboard.node.actual)} is unsupported; required ${e(dashboard.node.required)}`] : []),
  ];
  const setupLines = [
    "Default profiles: core, terminal, developer, yazi, runtime.",
    "Packages and links have separate reviews and approvals.",
    "Re-running plans only work that remains outstanding.",
  ];
  const attentionLines = issues.length ? issues : ["OK No actionable link, required CLI, or Node issues."];
  if (rowBudget < 8) {
    return frame("Overview", [`s Setup: ${setupLines[1]}`, attentionLines[0]!], width, p, rowBudget);
  }
  if (width >= 100) {
    const leftWidth = Math.floor(width * 0.43);
    const rightWidth = width - leftWidth + 1;
    const contentRows = rowBudget - 2;
    const left = setupLines.flatMap((line) => fit([line], leftWidth - 2));
    const right = windowRows(attentionLines.flatMap((line) => fit([line], rightWidth - 2)), 0, contentRows).map(({ text }) => text);
    const top = joinedTitleBorder(["s Guided Setup", "Attention"], [leftWidth, rightWidth]);
    const bottom = joinedBottomBorder([leftWidth, rightWidth]);
    const rows = Array.from({ length: contentRows }, (_, index) => `${border.vertical}${pad(styleTokens(left[index] ?? "", p), leftWidth - 2)}${border.vertical}${pad(styleTokens(right[index] ?? "", p), rightWidth - 2)}${border.vertical}`);
    return [p.strong(top), ...rows, p.strong(bottom)];
  }
  const setupHeight = Math.min(setupLines.length + 2, rowBudget - 3);
  const attentionHeight = rowBudget - setupHeight;
  const visibleSetup = setupLines.slice(0, Math.max(1, setupHeight - 2));
  const attentionBudget = Math.max(1, attentionHeight - 2);
  const visibleAttention = windowRows(attentionLines.flatMap((line) => fit([line], width - 2)), 0, attentionBudget).map(({ text }) => text);
  return [
    ...frame("s Guided Setup", visibleSetup, width, p, setupHeight),
    ...frame("Attention", visibleAttention, width, p, attentionHeight),
  ];
}

function links(state: Extract<TuiState, { mode: "workspace"; route: "links" }>, width: number, rowBudget: number, p: Palette, home?: string): string[] {
  const item = state.statuses[state.cursor];
  const list = state.statuses.map((link, index) => {
    const checked = state.selected.has(link.id) ? "x" : " ";
    const cursor = index === state.cursor ? ">" : " ";
    return `${cursor} [${checked}] ${marker(link.state)} ${e(link.description)} [${e(link.id)}]`;
  });
  const consequence = state.consequence?.review;
  const detail = item ? [
    `State: ${marker(item.state)} ${item.state}`,
    `Selection: ${state.selected.size} link${state.selected.size === 1 ? "" : "s"}`,
    `Consequence: ${state.statuses.every(({ state: value }) => value === "linked") ? "OK All links healthy. No changes."
      : state.selected.size === 0 ? "WARN No changes selected. Use Space or a."
      : state.planning ? `WARN Computing for ${state.selected.size} selected...`
      : consequence ? `${consequence.blocked ? "BLOCKED" : "CHANGE"} ${consequence.changes} changes, ${consequence.items.filter(({ action }) => action === "blocked").length} blocked`
      : "WARN Not ready"}`,
    ...(item.detail ? [`Detail: ${ht(item.detail, home)}`] : []),
    `Source: ${hp(item.source, home)}`,
    `Target: ${hp(item.target, home)}`,
  ] : ["All healthy. No link rows are available."];
  return panes("Links", item ? e(item.description) : "Links healthy", list, detail, state.cursor, width, rowBudget, p);
}

function packages(state: Extract<TuiState, { mode: "workspace"; route: "packages" }>, width: number, rowBudget: number, p: Palette, home?: string): string[] {
  const profile = state.status.profiles[state.cursor];
  const metadata = state.profiles[state.cursor];
  const list = state.status.profiles.map((item, index) => {
    const checked = state.selected.has(item.id) ? "x" : " ";
    const label = item.summary.blocked ? "BLOCKED" : item.summary.missing ? `${item.summary.missing} MISSING`
      : item.summary.external ? `${item.summary.external} EXTERNAL` : "COMPLETE";
    return `${index === state.cursor ? ">" : " "} [${checked}] ${e(item.description)} ${label}`;
  });
  const selectedIds = state.selected.size ? state.selected : new Set(profile ? [profile.id] : []);
  const selectedProfiles = state.status.profiles.filter(({ id }) => selectedIds.has(id));
  const directChanges = new Set(selectedProfiles.flatMap(({ resources }) => resources
    .filter(({ state: value }) => value === "missing" || value === "available-externally")
    .map(({ kind, name }) => `${kind}:${name}`)));
  const detail = profile && metadata ? [
    `Homebrew: ${state.status.brewExecutable ? hp(state.status.brewExecutable, home) : "unavailable"}`,
    `Selected: ${state.selected.size === 0 ? `${e(profile.id)} (current)` : [...state.selected].map(e).join(", ")}`,
    `Direct changes: ${directChanges.size}`,
    "Resources",
    ...profile.resources.map((resource) => {
      const label = resource.state === "installed-by-selected-brew" ? "BREW"
        : resource.state === "available-externally" ? "EXTERNAL"
        : resource.state === "missing" ? "MISSING" : "BLOCKED";
      const evidence = resource.evidence ? ` at ${hp(resource.evidence, home)}` : "";
      const reason = resource.reason ? `; ${ht(resource.reason, home)}` : "";
      return `${label} ${resource.kind}:${e(resource.name)}${resource.state === "available-externally" ? " (unmanaged by selected Homebrew)" : ""}${evidence}${reason}`;
    }),
  ] : ["No package profiles."];
  return panes("Profiles", metadata ? `${e(metadata.description)} [${e(metadata.id)}]` : "No profile", list, detail, state.cursor, width, rowBudget, p);
}

function panes(leftTitle: string, rightTitle: string, left: readonly string[], right: readonly string[], cursor: number, width: number, rowBudget: number, p: Palette): string[] {
  if (width < 100) {
    if (rowBudget < 8) return frame("Workspace detail", ["Terminal too short for workspace detail"], width, p, rowBudget);
    const listHeight = Math.max(4, Math.min(Math.floor(rowBudget * 0.42), rowBudget - 4));
    const detailHeight = rowBudget - listHeight;
    return [
      ...listFrame(leftTitle, left, cursor, width, listHeight, p),
      ...frame(rightTitle, right, width, p, detailHeight),
    ];
  }
  const leftWidth = Math.floor(width * 0.43);
  const rightWidth = width - leftWidth + 1;
  const contentRows = Math.max(0, rowBudget - 2);
  const visibleLeft = windowRows(left, cursor, contentRows);
  const visibleRight = right.flatMap((line) => fit([line], rightWidth - 2)).slice(0, contentRows);
  const top = joinedTitleBorder([leftTitle, rightTitle], [leftWidth, rightWidth]);
  const bottom = joinedBottomBorder([leftWidth, rightWidth]);
  const rows = Array.from({ length: contentRows }, (_, index) => {
    const leftRow = visibleLeft[index];
    const leftRaw = pad(leftRow?.text ?? "", leftWidth - 2);
    const leftCell = leftRow?.itemIndex === cursor ? p.selected(leftRaw) : styleTokens(leftRaw, p);
    const rightCell = pad(styleTokens(visibleRight[index] ?? "", p), rightWidth - 2);
    return `${border.vertical}${leftCell}${border.vertical}${rightCell}${border.vertical}`;
  });
  return [p.strong(top), ...rows, p.strong(bottom)];
}

function review(state: Extract<TuiState, { mode: "reviewing" | "confirming" }>, rowBudget: number, width: number, home?: string): string[] {
  const review = state.prepared.review;
  const lines = wrapReviewLines([
    `${state.route === "links" ? "Links" : "Packages"} Review`,
    ...(state.route === "links" ? linkReviewLines(review as LinkReviewView, home) : packageReviewLines(review as PackageReviewView, state.details, home)),
  ], width);
  return pageRows(lines, rowBudget, state.reviewOffset);
}

function setupReview(state: Extract<TuiState, { mode: "setup-review" | "setup-confirming" }>, rowBudget: number, width: number, home?: string): string[] {
  const logical = state.phase === "packages"
    ? [`Setup 1/2 Packages`, ...packageReviewLines(state.review as PackageReviewView, state.details, home)]
    : [`Setup 2/2 Links`, ...linkReviewLines(state.review as LinkReviewView, home)];
  const lines = wrapReviewLines(logical, width);
  return pageRows(lines, rowBudget, state.reviewOffset);
}

function overlay(base: readonly string[], width: number, lines: readonly string[], p: Palette): string[] {
  if (base.length === 0) return [];
  const modalWidth = Math.min(width, Math.max(32, Math.min(Math.max(...lines.map(visibleWidth)) + 4, width - 6)));
  const innerWidth = Math.max(1, modalWidth - 4);
  const wrapped = lines.flatMap((line) => fit([line], innerWidth));
  const box = [
    `${border.topLeft}${border.horizontal.repeat(modalWidth - 2)}${border.topRight}`,
    ...wrapped.map((line) => `${border.vertical} ${pad(line, innerWidth)} ${border.vertical}`),
    `${border.bottomLeft}${border.horizontal.repeat(modalWidth - 2)}${border.bottomRight}`,
  ].map((line, index) => index === 0 || index === wrapped.length + 1 ? p.strong(line) : line);
  const top = Math.max(0, Math.floor((base.length - box.length) / 2));
  const left = Math.max(0, Math.floor((width - modalWidth) / 2));
  const result = [...base];
  for (let index = 0; index < box.length && top + index < result.length; index += 1) {
    const current = result[top + index] ?? "";
    const before = sliceByColumn(current, 0, left, true);
    const afterStart = left + modalWidth;
    const after = sliceByColumn(current, afterStart, Math.max(0, width - afterStart), true);
    result[top + index] = `${truncateToWidth(before, left, "", true)}${box[index]}${after}`;
  }
  return result;
}

function body(state: TuiState, width: number, rowBudget: number, p: Palette, home?: string): string[] {
  if (state.mode === "loading") return ["Loading current state..."];
  if (state.mode === "error") return [`BLOCKED ${ht(state.message, home)}`];
  if (state.mode === "choosing-brew") return ["Multiple Homebrew installations detected. Select for this session:", state.intent === "setup" ? "Selection continues Guided setup." : "Selection opens Packages.", ...windowRows(state.candidates.map((candidate, index) => `${index === state.cursor ? ">" : " "} ${hp(candidate, home)}`), state.cursor, rowBudget - 2).map(({ text }) => text)];
  if (state.mode === "setup-planning") return [`Setup planning: ${state.phase}`, `Profiles: ${state.profiles.map(e).join(", ")}`, "Preparing exact consequences; no mutation is active."];
  if (state.mode === "setup-review" || state.mode === "setup-confirming") return setupReview(state, rowBudget, width, home);
  if (state.mode === "setup-running") return [
    state.phase === "packages" ? "Setup Packages in progress" : "Setup Links transaction in progress",
    state.phase === "packages" ? `Current: ${e(state.current ?? "starting Homebrew")}` : "Current: applying link transaction",
    state.phase === "packages" ? `Completed/direct: ${state.completed}/${state.direct}` : "Progress: indeterminate; rollback is automatic on failure",
  ];
  if (state.mode === "setup-exit-pending") return [`Setup exit pending: ${state.phase}`, `Waiting for ${state.activity} to settle safely.`];
  if (state.mode === "setup-error") return [`BLOCKED Setup interaction failed: ${ht(state.message, home)}`];
  if (state.mode === "setup-result") {
    const lines = fit(setupResultLines(state.result, state.selectedBrew, home), width);
    return pageRows(lines, rowBudget, state.resultOffset);
  }
  if (state.mode === "reviewing" || state.mode === "confirming") return review(state, rowBudget, width, home);
  if (state.mode === "mutating" || state.mode === "exit-pending") return [
    `${state.route === "links" ? "Link transaction" : "Package installation"} in progress`,
    state.progress ? `Current: ${e(state.progress)}` : "Current: preparing safely",
    state.mode === "exit-pending" ? "Exit requested; waiting for operation to settle." : "Current operation will settle before exit.",
  ];
  if (state.mode === "result") {
    const lines = wrapReviewLines(operationResultLines(state.route, state.result, home), width);
    return pageRows(lines, rowBudget, state.resultOffset ?? 0);
  }
  if (state.mode === "workspace") {
    if (state.route === "overview") return overview(state, width, rowBudget, p);
    if (state.route === "links") return links(state, width, rowBudget, p, home);
    return packages(state, width, rowBudget, p, home);
  }
  return ["Loading current state..."];
}

function helpLines(state: TuiState): string[] {
  const lines = ["Help"];
  if (state.mode === "workspace") lines.push("1/2/3 or Left/Right: switch workspace");
  if (state.mode === "workspace" && state.route === "overview") lines.push("s: Guided setup", "r: refresh status");
  else if (state.mode === "workspace" && state.route === "links") lines.push("j/k or Up/Down: move", "Space: toggle | a: actionable | n: clear", "Enter: review selected links");
  else if (state.mode === "workspace" && state.route === "packages") lines.push("j/k or Up/Down: move", "Space: toggle profile", "Enter: review selected profiles");
  else if (state.mode === "reviewing" || state.mode === "setup-review") {
    lines.push("j/k or Up/Down: scroll");
    if (state.route === "packages" || (state.mode === "setup-review" && state.phase === "packages")) lines.push("d: toggle preview details");
    lines.push("Enter/y: open confirmation", state.mode === "setup-review" ? "n/Esc: decline phase" : "Esc: back");
  } else if (state.mode === "confirming" || state.mode === "setup-confirming") {
    lines.push("y: apply reviewed changes", state.mode === "setup-confirming" ? "n/Esc: decline phase" : "n/Esc: return to review");
  } else if (state.mode === "result" || state.mode === "setup-result") lines.push("j/k or Up/Down: scroll", "Enter/Esc: return");
  else if (state.mode === "mutating" || state.mode === "exit-pending" || state.mode === "setup-running" || state.mode === "setup-exit-pending" || state.mode === "setup-planning") lines.push("q: request exit after active work settles safely");
  else if (state.mode === "choosing-brew") lines.push("j/k or Up/Down: move", "Enter: use Homebrew for this session", "Esc: return to Overview");
  lines.push("?: close help", "q: safe exit");
  return lines;
}

export function renderDashboard(state: TuiState, repository: string, columns: number, rows: number, color = process.env.NO_COLOR === undefined, home?: string): string[] {
  const width = Math.max(1, columns);
  const height = Math.max(1, rows);
  const p = palette(color);
  if (width < 45) {
    const narrow = [p.strong(`dots  ${shortPath(repository, home)}`), p.blocked("BLOCKED Terminal too narrow"), `Need at least 45 columns; current ${width}`, truncateToWidth("q Exit", width)];
    while (narrow.length < height) narrow.splice(narrow.length - 1, 0, "");
    const rendered = narrow.slice(0, height).map((line) => truncateToWidth(line, width));
    return color ? rendered : rendered.map(stripSgr);
  }
  const compactConfirmation = compactConfirmationChrome(state, width);
  const compactOverlay = compactOverlayChrome(state, width);
  const header = [p.strong(`dots  ${shortPath(repository, home)}`), ...(compactOverlay ? [] : workspaceStrip(state, width, p))];
  const footerText = contextualFooterLines(state, width).flatMap((line) => fit([line], width)).slice(0, 2);
  const footerLines = footerText.length === 0 ? [] : width >= 100 ? [p.dim(border.horizontal.repeat(width)), p.dim(truncateToWidth(footerText.join("  "), width))] : footerText.map(p.dim);
  const available = bodyContentRows(state, width, height);
  let content = body(state, width, available, p, home).slice(0, available).map((line) => truncateToWidth(line.includes("\u001b[") ? line : styleTokens(line, p), width));
  while (content.length < available) content.push("");
  if (isConfirmation(state)) {
    const lines = confirmationLines(state, home);
    if (!confirmationFits(state, width, height, home)) {
      content = frame("Confirmation blocked", ["BLOCKED Terminal too short for confirmation", "Resize to review every consequence before approval.", "n/Esc Return without applying"], width, p, available);
    } else if (compactConfirmation) {
      content = frame(lines[0]!, lines.slice(1), width, p, available);
    } else {
      content = overlay(content, width, lines, p);
    }
  }
  if (state.help) content = width < 60
    ? frame("Help", helpLines(state).slice(1), width, p, available)
    : overlay(content, width, helpLines(state), p);
  const rendered = [...header, ...content, ...footerLines].slice(0, height).map((line) => {
    const fitted = truncateToWidth(line, width);
    return visibleWidth(fitted) <= width ? fitted : truncateToWidth(fitted, width);
  });
  return color ? rendered : rendered.map(stripSgr);
}

export class DashboardComponent implements Component {
  constructor(
    readonly controller: TuiController,
    readonly dimensions: () => RendererDimensions,
    readonly color = process.env.NO_COLOR === undefined,
  ) {}

  render(width: number): string[] {
    return renderDashboard(this.controller.state, this.controller.repository, width, this.dimensions().rows, this.color, this.controller.home);
  }

  handleInput(): void {}
  invalidate(): void {}
}
