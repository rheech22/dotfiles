import assert from "node:assert/strict";
import test from "node:test";
import { visibleWidth } from "@earendil-works/pi-tui";
import type { DashboardView, LinkReviewView, LinkStatusView, PackageReviewView } from "../src/application.js";
import { renderDashboard } from "../src/tui-renderer.js";
import type { TuiState } from "../src/tui-controller.js";
import { prepareAction } from "../src/workflows.js";

const dashboard: DashboardView = {
  healthy: false,
  errors: 1,
  warnings: 0,
  links: [{ id: "zsh", description: "Z shell configuration with a deliberately long description", enabled: true, source: "/very/long/repository/path/zshrc", target: "/very/long/home/path/.zshrc", state: "missing" }],
  dependencies: [{ id: "git", description: "Git", required: true, available: true, path: "/usr/bin/git" }],
  node: { actual: "24.0.0", required: "22.19.0", supported: true },
};

const workspace: TuiState = {
  mode: "workspace",
  route: "links",
  help: false,
  dashboard,
  statuses: dashboard.links,
  selected: new Set(["zsh"]),
  cursor: 0,
  planning: false,
};

test("HOME-local repository and paths never expose the username", () => {
  const privateDashboard: DashboardView = {
    ...dashboard,
    links: [{
      id: "config",
      description: "Config",
      enabled: true,
      source: "/Users/test/dotfiles/.config/tool/config",
      target: "/Users/test/.config/tool/config",
      state: "wrong-link",
      detail: "points to /Users/test/dotfiles/old\npath",
    }],
  };
  const state: TuiState = {
    mode: "workspace",
    route: "links",
    help: false,
    dashboard: privateDashboard,
    statuses: privateDashboard.links,
    selected: new Set(["config"]),
    cursor: 0,
    planning: false,
  };
  const output = renderDashboard(state, "/Users/test/dotfiles", 80, 24, false, "/Users/test").join("\n");
  assert.match(output, /^dots  ~\/dotfiles/m);
  assert.match(output, /Target: ~\/\.config\/tool\/config/);
  assert.doesNotMatch(output, /\/Users\/test|test\/dotfiles/);
  assert.equal(privateDashboard.links[0]?.target, "/Users/test/.config/tool/config");
});

function manyLinks(cursor: number): TuiState {
  const statuses: readonly LinkStatusView[] = Array.from({ length: 16 }, (_, index) => ({
    id: `link-${index + 1}`,
    description: `Link ${index + 1}`,
    enabled: true,
    source: `/repo/link-${index + 1}`,
    target: `/home/link-${index + 1}`,
    state: index % 3 === 0 ? "missing" : "linked",
  }));
  const selected = new Set(statuses.filter(({ state }) => state === "missing").map(({ id }) => id));
  const review: LinkReviewView = {
    blocked: false,
    changes: selected.size,
    items: [...selected].map((id) => ({ id, description: id, source: `/repo/${id}`, target: `/home/${id}`, action: "create" })),
  };
  return { mode: "workspace", route: "links", help: false, dashboard: { ...dashboard, links: statuses }, statuses, selected, cursor, planning: false, consequence: prepareAction(review, false, async () => ({ success: true, items: [] })) };
}

for (const [columns, rows] of [[120, 30], [80, 24], [60, 18], [40, 12]] as const) {
  test(`renderer is viewport-bounded at ${columns}x${rows}`, () => {
    const lines = renderDashboard(workspace, "/Users/test/dotfiles", columns, rows, false);
    assert.equal(lines.length, rows);
    assert.ok(lines.every((line) => visibleWidth(line) <= columns));
    assert.match(lines[0]!, /dots/);
    if (columns < 45) assert.match(lines.join("\n"), /Terminal too narrow/);
    else assert.match(lines.join("\n"), /Review/);
  });
}

test("navigation labels avoid internal state names and confirmation retains consequences", () => {
  const review: LinkReviewView = {
    blocked: false,
    changes: 1,
    items: [{ id: "zsh", description: "Zsh", source: "/repo/zsh", target: "/home/zsh", action: "backup-and-link", backup: "/home/.dots-backup/zsh" }],
  };
  const state: TuiState = { mode: "confirming", route: "links", help: false, dashboard, details: false, reviewOffset: 0, prepared: prepareAction(review, false, async () => ({ success: true, items: [] })) };
  const output = renderDashboard(state, "/Users/test/dotfiles", 80, 24, false).join("\n");
  assert.match(output, /backup-and-link/);
  assert.match(output, /backup \/home\/\.dots-backup\/zsh/);
  assert.match(output, /╭─+╮/);
  assert.match(output, /Links Confirmation/);
  assert.match(output, /Exact changes: 1/);
  assert.match(output, /Backups: 1/);
  assert.match(output, /\[y\] Apply\s+\[n\/Esc\] Return to review/);
  assert.doesNotMatch(output.toLowerCase(), /\blast\b|\barmed\b|confirm pending/);
});

for (const [columns, rows] of [[80, 24], [60, 18]] as const) {
  test(`${columns}x${rows} stacked Links keeps list and consequence visible`, () => {
    const lines = renderDashboard(manyLinks(0), "/Users/test/dotfiles", columns, rows, false);
    const output = lines.join("\n");
    assert.equal(lines.length, rows);
    assert.ok(lines.every((line) => visibleWidth(line) <= columns));
    assert.match(output, /> \[x\] CHANGE Link 1/);
    assert.match(output, /State: CHANGE missing/);
    assert.match(output, /Source: \/repo\/link-1/);
    assert.match(output, /Target: \/home\/link-1/);
    assert.match(output, /Selection: 6 links/);
    assert.match(output, /Consequence:/);
    assert.match(output, /changes, 0 blocked/);
  });
}

test("cursor near list end windows rows without displacing detail", () => {
  const output = renderDashboard(manyLinks(15), "/Users/test/dotfiles", 80, 24, false).join("\n");
  assert.match(output, /> \[x\] CHANGE Link 16/);
  assert.match(output, /\(13-16 of 16\)/);
  assert.match(output, /State: CHANGE missing/);
  assert.match(output, /Consequence:/);
});

test("NO_COLOR output is plain while semantic body color uses ANSI", () => {
  const plain = renderDashboard(manyLinks(0), "/Users/test/dotfiles", 80, 24, false).join("\n");
  const colored = renderDashboard(manyLinks(0), "/Users/test/dotfiles", 80, 24, true).join("\n");
  assert.doesNotMatch(plain, /\u001b\[/);
  assert.match(colored, /\u001b\[/);
  assert.match(colored, /\u001b\[[0-9]+m.*CHANGE/);
});

test("reviews omit noop rows, report unchanged, and deduplicate raw package detail", () => {
  const linkReview: LinkReviewView = {
    blocked: false,
    changes: 1,
    items: [
      { id: "early", description: "Early noop", source: "/r/early", target: "/h/early", action: "noop" },
      { id: "late", description: "Late change", source: "/r/late", target: "/h/late", action: "create" },
    ],
  };
  const linkState: TuiState = { mode: "reviewing", route: "links", help: false, dashboard, details: false, reviewOffset: 0, prepared: prepareAction(linkReview, false, async () => ({ success: true, items: [] })) };
  const linkOutput = renderDashboard(linkState, "/Users/test/dotfiles", 80, 24, false).join("\n");
  assert.match(linkOutput, /1 unchanged/);
  assert.match(linkOutput, /Late change/);
  assert.doesNotMatch(linkOutput, /Early noop/);

  const packageReview: PackageReviewView = {
    profiles: ["base"], brewExecutable: "/opt/homebrew/bin/brew", blocked: false, changes: 1,
    items: [
      { kind: "formula", name: "present", description: "Present", action: "noop" },
      { kind: "formula", name: "late", description: "Late", action: "install-formula", preview: ["Warning: repeated", "Warning: repeated", "Would install dep"] },
    ],
  };
  const packageState: TuiState = { mode: "reviewing", route: "packages", help: false, dashboard, details: true, reviewOffset: 0, prepared: prepareAction(packageReview, false, async () => ({ success: true, items: [] })) };
  const packageOutput = renderDashboard(packageState, "/Users/test/dotfiles", 80, 24, false).join("\n");
  assert.match(packageOutput, /1 unchanged/);
  assert.match(packageOutput, /Profiles: base/);
  assert.doesNotMatch(packageOutput, /formula:present/);
  assert.equal(packageOutput.match(/Warning: repeated/g)?.length, 1);

  const confirmation = renderDashboard({ ...packageState, mode: "confirming" }, "/Users/test/dotfiles", 80, 24, false).join("\n");
  assert.match(confirmation, /Packages Confirmation/);
  assert.match(confirmation, /Exact direct changes: 1/);
  assert.match(confirmation, /Selected Homebrew: \/opt\/homebrew\/bin\/brew/);
  assert.match(confirmation, /not rolled back/);
  assert.doesNotMatch(confirmation, /Preview lines mentioning|\| Profiles:/);
});

test("package profile reports external availability and resource source", () => {
  const state: TuiState = {
    mode: "workspace", route: "packages", help: false, dashboard,
    profiles: [{ id: "tools", description: "Tools", supported: true, resources: [] }],
    status: { blocked: false, brewExecutable: "/opt/homebrew/bin/brew", profiles: [{ id: "tools", description: "Tools", summary: { installed: 0, external: 1, missing: 0, blocked: 0 }, resources: [{ kind: "formula", name: "git", description: "Git", state: "available-externally", evidence: "/usr/bin/git" }] }] },
    selected: new Set(), cursor: 0, brewCandidates: ["/opt/homebrew/bin/brew"],
  };
  const output = renderDashboard(state, "/Users/test/dotfiles", 80, 24, false).join("\n");
  assert.match(output, /1 EXTERNAL/);
  assert.match(output, /EXTERNAL formula:git/);
});

test("hostile domain strings are escaped before generated ANSI styling", () => {
  const hostile = "bad\u001b]52;c;payload\u0007\nnext";
  const state: TuiState = {
    mode: "workspace", route: "links", help: false,
    dashboard: { ...dashboard, node: { ...dashboard.node, actual: hostile } },
    statuses: [{ id: hostile, description: hostile, enabled: true, source: `/repo/${hostile}`, target: `/home/${hostile}`, state: "wrong-link", detail: hostile }],
    selected: new Set([hostile]), cursor: 0, planning: false,
  };
  const lines = renderDashboard(state, `/repo/${hostile}`, 80, 24, true);
  const hostilePackage: PackageReviewView = {
    profiles: [hostile], brewExecutable: `/brew/${hostile}`, blocked: true, changes: 0,
    items: [{ kind: "formula", name: hostile, description: hostile, action: "blocked", reason: hostile, preview: [hostile] }],
  };
  const packageState: TuiState = { mode: "reviewing", route: "packages", help: false, dashboard, details: true, reviewOffset: 0, prepared: prepareAction(hostilePackage, true, async () => ({ success: false, items: [] })) };
  const packageLines = renderDashboard(packageState, `/repo/${hostile}`, 80, 24, true);
  const output = [...lines, ...packageLines].join("\n");
  assert.match(output, /\\u\{1b\}\]52;c;payload\\u\{07\}\\u\{0a\}next/);
  assert.doesNotMatch(output, /\u001b\]/);
  assert.doesNotMatch(output, /\u0007/);
  assert.ok([...lines, ...packageLines].every((line) => !/[\u0000-\u0009\u000b-\u001a\u001c-\u001f\u007f-\u009f]/.test(line)));
});

test("short confirmation is explicit and long reviews page to late backups", () => {
  const items: LinkReviewView["items"] = Array.from({ length: 30 }, (_, index) => ({
    id: `item-${index}`, description: `Change ${index}`, source: `/r/${index}`, target: `/h/${index}`,
    action: "backup-and-link", backup: `/backup/${index}`,
  }));
  const review: LinkReviewView = { blocked: false, changes: items.length, items };
  const prepared = prepareAction(review, false, async () => ({ success: true, items: [] }));
  const first: TuiState = { mode: "reviewing", route: "links", help: false, dashboard, details: false, reviewOffset: 0, prepared };
  const later: TuiState = { ...first, reviewOffset: 60 };
  const firstOutput = renderDashboard(first, "/repo", 60, 18, false).join("\n");
  const laterOutput = renderDashboard(later, "/repo", 60, 18, false).join("\n");
  assert.match(firstOutput, /\(1-11 of 62\)/);
  assert.doesNotMatch(firstOutput, /backup \/backup\/29/);
  assert.match(laterOutput, /backup \/backup\/29/);
  assert.match(laterOutput, /of 62\)/);

  const confirming: TuiState = { ...first, mode: "confirming" };
  const short = renderDashboard(confirming, "/repo", 60, 10, false).join("\n");
  assert.match(short, /Terminal too short for confirmation/);
  assert.doesNotMatch(short, /Links Confirmation/);
});

test("package review paging reaches every Homebrew preview line", () => {
  const preview = Array.from({ length: 24 }, (_, index) => `preview consequence ${index + 1}`);
  const review: PackageReviewView = {
    profiles: ["terminal"],
    brewExecutable: "/opt/homebrew/bin/brew",
    blocked: false,
    changes: 1,
    items: [{ kind: "formula", name: "tool", description: "Tool", action: "install-formula", preview }],
  };
  const prepared = prepareAction(review, false, async () => ({ success: true, items: [] }));
  const first: TuiState = { mode: "reviewing", route: "packages", help: false, dashboard, details: true, reviewOffset: 0, prepared };
  const later: TuiState = { ...first, reviewOffset: 40 };
  const firstOutput = renderDashboard(first, "/repo", 60, 18, false).join("\n");
  const laterOutput = renderDashboard(later, "/repo", 60, 18, false).join("\n");
  assert.match(firstOutput, /preview consequence 1/);
  assert.doesNotMatch(firstOutput, /preview consequence 24/);
  assert.match(laterOutput, /preview consequence 24/);
  assert.match(laterOutput, /of 30\)/);
});

test("Overview presents workspace summaries, Guided Setup, and Attention without duplicate hints", () => {
  const state: TuiState = { mode: "workspace", route: "overview", help: false, dashboard };
  const output = renderDashboard(state, "/repo", 80, 24, false).join("\n");
  assert.match(output, /1 Overview/);
  assert.match(output, /2 Links/);
  assert.match(output, /3 Packages/);
  assert.match(output, /CLI 1\/1/);
  assert.match(output, /s Guided Setup/);
  assert.match(output, /Attention/);
  assert.match(output, /CHANGE Link/);
  assert.doesNotMatch(output, /Next:/);
  assert.equal(output.match(/Guided Setup/g)?.length, 1);
  assert.doesNotMatch(output, /4 Setup/);
});

for (const [columns, rows] of [[80, 24], [60, 18]] as const) {
  test(`setup package review and confirmation retain consequences at ${columns}x${rows}`, () => {
    const review: PackageReviewView = {
      profiles: ["core", "terminal", "developer", "yazi", "runtime"],
      brewExecutable: "/opt/homebrew/bin/brew",
      blocked: false,
      changes: 2,
      items: [
        { kind: "formula", name: "git", description: "Git", action: "install-formula", preview: ["Would install git"] },
        { kind: "formula", name: "fzf", description: "Fzf", action: "install-formula" },
      ],
    };
    const state: TuiState = { mode: "setup-confirming", route: "overview", phase: "packages", help: false, dashboard, profiles: review.profiles, review, details: false, reviewOffset: 0 };
    const lines = renderDashboard(state, "/repo", columns, rows, false);
    const output = lines.join("\n");
    assert.equal(lines.length, rows);
    assert.ok(lines.every((line) => visibleWidth(line) <= columns));
    assert.match(output, /Setup 1\/2 Packages/);
    assert.equal(output.match(/Setup 1\/2 Packages/g)?.length, 1);
    assert.match(output, /Packages Confirmation/);
    assert.match(output, /Exact direct changes: 2/);
    assert.match(output, /No rollback/);
    assert.match(output, /links are reviewed separately/i);
    assert.match(output, /\[y\] Install packages/);
  });
}

test("setup link confirmation includes exact changes and backups, with short guard", () => {
  const hostile = "zsh\u001b]52;c;payload\u0007";
  const review: LinkReviewView = {
    blocked: false,
    changes: 1,
    items: [{ id: hostile, description: hostile, source: `/repo/${hostile}`, target: `/home/${hostile}`, action: "backup-and-link", backup: `/backup/${hostile}` }],
  };
  const state: TuiState = { mode: "setup-confirming", route: "overview", phase: "links", help: false, dashboard, profiles: ["core"], review, details: false, reviewOffset: 0 };
  const output = renderDashboard(state, "/repo", 80, 24, true).join("\n");
  assert.match(output, /Setup 2\/2 Links/);
  assert.equal(output.match(/Setup 2\/2 Links/g)?.length, 1);
  assert.match(output, /Links Confirmation/);
  assert.match(output, /Exact changes: 1/);
  assert.match(output, /Backups: 1/);
  assert.match(output, /\\u\{1b\}/);
  assert.doesNotMatch(output, /\u001b\]/);
  const short = renderDashboard(state, "/repo", 60, 10, false).join("\n");
  assert.match(short, /Terminal too short for confirmation/);
  assert.doesNotMatch(short, /Links Confirmation/);
});

for (const columns of [60, 80] as const) {
  test(`wrapped hostile setup review exposes late suffix at ${columns} columns`, () => {
    const hostile = `bad\u001b]52;c;payload\u0007-${"x".repeat(180)}-END-SUFFIX`;
    const review: LinkReviewView = {
      blocked: true,
      changes: 0,
      items: [{ id: "hostile", description: "Hostile", source: "/repo/x", target: "/home/x", action: "blocked", reason: hostile }],
    };
    const state: TuiState = { mode: "setup-review", route: "overview", phase: "links", help: false, profiles: ["core"], review, details: false, reviewOffset: 999 };
    const output = renderDashboard(state, "/repo", columns, 18, false).join("\n");
    assert.match(output, /END-SUFFIX/);
    assert.match(output, /\\u\{1b\}/);
    assert.doesNotMatch(output, /\u001b\]|\u0007/);
  });
}

test("setup partial and stale-lock results explain retained changes and remediation", () => {
  const partial: TuiState = {
    mode: "setup-result", route: "overview", help: false, resultOffset: 0, selectedBrew: "/usr/local/bin/brew",
    result: {
      status: "partial", phase: "links", profiles: ["core"],
      packageReview: { profiles: ["core"], brewExecutable: "/usr/local/bin/brew", blocked: false, changes: 1, items: [] },
      packageResult: { success: true, items: [{ kind: "formula", name: "git", action: "install-formula", outcome: "installed" }] },
      summary: { warnings: 0, errors: 1, message: "Links were not applied because link changes were declined" },
    },
  };
  const partialOutput = renderDashboard(partial, "/repo", 60, 18, false).join("\n");
  assert.match(partialOutput, /Setup partial; retained changes require attention/);
  assert.match(partialOutput, /Links: not applied; package changes are retained/);
  assert.match(partialOutput, /RETAINED package formula:git/);
  assert.match(partialOutput, /export DOTS_BREW=\/usr\/local\/bin\/brew/);

  const command = "Apply lock is stale at /home/.local/state/dots/apply.lock; inspect it with 'dots links lock', then run 'dots links unlock'";
  const stale: TuiState = {
    mode: "setup-result", route: "overview", help: false, resultOffset: 0,
    result: { status: "failed", phase: "preflight", profiles: ["core"], summary: { warnings: 0, errors: 1, message: command } },
  };
  const staleOutput = renderDashboard(stale, "/repo", 80, 24, false).join("\n");
  assert.match(staleOutput, /dots links lock/);
  assert.match(staleOutput, /dots links unlock/);
  assert.match(staleOutput, /Recovery remove stale lock: dots links unlock/);
});

function packageWorkspace(): TuiState {
  return {
    mode: "workspace", route: "packages", help: false, dashboard,
    profiles: [{ id: "base", description: "Base tools", supported: true, resources: [] }],
    status: {
      blocked: false,
      brewExecutable: "/opt/homebrew/bin/brew",
      profiles: [{
        id: "base", description: "Base tools",
        summary: { installed: 0, external: 0, missing: 1, blocked: 0 },
        resources: [{ kind: "formula", name: "git", description: "Git", state: "missing" }],
      }],
    },
    selected: new Set(["base"]), cursor: 0, brewCandidates: ["/opt/homebrew/bin/brew"],
  };
}

for (const [name, state, leftTitle, rightTitle] of [
  ["Links", manyLinks(0), "Links", "Link 1"],
  ["Packages", packageWorkspace(), "Profiles", "Base tools [base]"],
] as const) {
  test(`120-column ${name} panes share exact frame boundaries`, () => {
    const lines = renderDashboard(state, "/repo", 120, 30, false);
    const top = lines.find((line) => line.includes(`╭ ${leftTitle}`) && line.includes(rightTitle));
    assert.ok(top);
    assert.equal(visibleWidth(top), 120);
    const paneRows = lines.filter((line) => line.startsWith("│") && (line.match(/│/g)?.length ?? 0) === 3);
    assert.ok(paneRows.length > 0);
    assert.ok(paneRows.every((line) => visibleWidth(line) === 120));
  });
}

test("selected reverse styling resets before the divider and right-pane status", () => {
  const lines = renderDashboard(manyLinks(0), "/repo", 120, 30, true);
  const selected = lines.find((line) => line.includes("\u001b[7m"));
  assert.ok(selected);
  assert.match(selected, /\u001b\[7m[^\n]*\u001b\[0m│State: \u001b\[36mCHANGE\u001b\[0m/);
  const resetDivider = selected.indexOf("\u001b[0m│");
  assert.ok(resetDivider > 0);
  assert.doesNotMatch(selected.slice(0, resetDivider), /\u001b\[36m/);
  assert.match(selected.slice(resetDivider), /\u001b\[36mCHANGE/);
});

for (const [columns, rows] of [[80, 24], [60, 18]] as const) {
  test(`${columns}x${rows} stacked Packages keeps profile and resources bounded`, () => {
    const lines = renderDashboard(packageWorkspace(), "/repo", columns, rows, false);
    const output = lines.join("\n");
    assert.equal(lines.length, rows);
    assert.ok(lines.every((line) => visibleWidth(line) <= columns));
    assert.match(output, /Profiles/);
    assert.match(output, /Base tools \[base\]/);
    assert.match(output, /Homebrew: \/opt\/homebrew\/bin\/brew/);
    assert.match(output, /Selected: base/);
    assert.match(output, /Direct changes: 1/);
    assert.match(output, /Resources/);
  });
}

test("NO_COLOR narrow output has no SGR after truncation", () => {
  const output = renderDashboard(manyLinks(0), "/repo", 60, 18, false).join("\n");
  assert.doesNotMatch(output, /\u001b\[/);
});

test("Overview metrics exclude disabled links and show healthy and blocked attention states", () => {
  const healthyDashboard: DashboardView = {
    healthy: true, errors: 0, warnings: 0,
    links: [
      { ...dashboard.links[0]!, description: "Enabled", state: "linked" },
      { ...dashboard.links[0]!, id: "disabled", description: "Disabled", enabled: false, state: "disabled" },
    ],
    dependencies: dashboard.dependencies,
    node: dashboard.node,
  };
  const healthy = renderDashboard({ mode: "workspace", route: "overview", help: false, dashboard: healthyDashboard }, "/repo", 120, 30, false).join("\n");
  assert.match(healthy, /1\/1 linked/);
  assert.doesNotMatch(healthy, /2\/2 linked/);
  assert.match(healthy, /OK No actionable link, required CLI, or Node issues/);

  const blockedDashboard: DashboardView = {
    ...dashboard,
    dependencies: [...dashboard.dependencies, { id: "required", description: "Required tool", required: true, available: false }],
    node: { actual: "20.0.0", required: "22.19.0", supported: false },
  };
  const blocked = renderDashboard({ mode: "workspace", route: "overview", help: false, dashboard: blockedDashboard }, "/repo", 80, 24, false).join("\n");
  assert.match(blocked, /Required CLI Required tool is unavailable/);
  assert.match(blocked, /Node 20.0.0 is unsupported/);
});

test("workspace strip and contextual footers own shortcuts without duplication", () => {
  const overview = renderDashboard({ mode: "workspace", route: "overview", help: false, dashboard }, "/repo", 120, 30, false).join("\n");
  assert.equal(overview.match(/1 Overview/g)?.length, 1);
  assert.equal(overview.match(/2 Links/g)?.length, 1);
  assert.equal(overview.match(/3 Packages/g)?.length, 1);
  assert.equal(overview.match(/Guided Setup/g)?.length, 1);
  assert.doesNotMatch(overview, /1\/2\/3 Switch|Next:/);
  assert.equal(overview.match(/s Guided Setup/g)?.length, 1);
  assert.match(overview, /r Refresh \| \? Help \| q Quit/);
  assert.doesNotMatch(overview, /s Setup \|/);

  const review: LinkReviewView = { blocked: false, changes: 1, items: [{ id: "x", description: "X", source: "/r/x", target: "/h/x", action: "create" }] };
  const prepared = prepareAction(review, false, async () => ({ success: true, items: [] }));
  const confirmation = renderDashboard({ mode: "confirming", route: "links", help: false, dashboard, details: false, reviewOffset: 0, prepared }, "/repo", 80, 24, false).join("\n");
  assert.equal(confirmation.match(/\[y\]/g)?.length, 1);
  assert.equal(confirmation.match(/n\/Esc/g)?.length, 1);
  assert.doesNotMatch(confirmation, /\? Help \| q Safe exit|y Apply \|/);

  const result = renderDashboard({ mode: "result", route: "links", help: false, dashboard, review, result: { success: true, items: [] }, resultOffset: 0 }, "/repo", 80, 24, false).join("\n");
  assert.doesNotMatch(result, /Enter Refresh workspace/);
  assert.equal(result.match(/Enter Refresh/g)?.length, 1);
});

test("Help only exposes actions valid for the current state", () => {
  const overviewHelp = renderDashboard({ mode: "workspace", route: "overview", help: true, dashboard }, "/repo", 80, 24, false).join("\n");
  assert.match(overviewHelp, /Guided setup/);
  assert.match(overviewHelp, /refresh status/);

  const linksHelp = renderDashboard({ ...manyLinks(0), help: true }, "/repo", 80, 24, false).join("\n");
  assert.match(linksHelp, /switch workspace/);
  assert.match(linksHelp, /Space: toggle/);

  const packagesHelp = renderDashboard({ ...packageWorkspace(), help: true }, "/repo", 80, 24, false).join("\n");
  assert.match(packagesHelp, /toggle profile/);
  assert.match(packagesHelp, /review selected profiles/);

  const review: LinkReviewView = { blocked: false, changes: 1, items: [{ id: "x", description: "X", source: "/r/x", target: "/h/x", action: "create" }] };
  const prepared = prepareAction(review, false, async () => ({ success: true, items: [] }));
  const reviewHelp = renderDashboard({ mode: "reviewing", route: "links", help: true, dashboard, details: false, reviewOffset: 0, prepared }, "/repo", 80, 24, false).join("\n");
  assert.match(reviewHelp, /scroll/);
  assert.match(reviewHelp, /open confirmation/);
  assert.doesNotMatch(reviewHelp, /switch workspace|Space: toggle/);

  const confirmHelp = renderDashboard({ mode: "confirming", route: "links", help: true, dashboard, details: false, reviewOffset: 0, prepared }, "/repo", 80, 24, false).join("\n");
  assert.match(confirmHelp, /apply reviewed changes/);
  assert.match(confirmHelp, /return to review/);
  assert.doesNotMatch(confirmHelp, /switch workspace|Space: toggle/);

  const resultHelp = renderDashboard({ mode: "result", route: "links", help: true, dashboard, review, result: { success: true, items: [] }, resultOffset: 0 }, "/repo", 80, 24, false).join("\n");
  assert.match(resultHelp, /scroll/);
  assert.match(resultHelp, /Enter\/Esc: return/);
  assert.doesNotMatch(resultHelp, /switch workspace|Space: toggle|review selected/);

  const runningHelp = renderDashboard({ mode: "mutating", route: "links", help: true, dashboard, prepared }, "/repo", 80, 24, false).join("\n");
  assert.match(runningHelp, /after active work settles safely/);
  assert.doesNotMatch(runningHelp, /switch workspace|Space: toggle|open confirmation/);
});

test("45x12 Help uses a complete standalone rounded frame", () => {
  const lines = renderDashboard({ ...manyLinks(0), help: true }, "/repo", 45, 12, false);
  const output = lines.join("\n");
  assert.equal(lines.length, 12);
  assert.ok(lines.every((line) => visibleWidth(line) <= 45));
  assert.match(output, /╭ Help ─+╮/);
  assert.match(output, /switch workspace/);
  assert.match(output, /Enter: review selected links/);
  assert.match(output, /\?: close help/);
  assert.match(output, /q: safe exit/);
  assert.match(output, /╰─+╯/);
});

test("45x12 confirmation keeps the complete modal visible and bounded", () => {
  const review: LinkReviewView = {
    blocked: false,
    changes: 1,
    items: [{ id: "x", description: "X", source: "/r/x", target: "/h/x", action: "backup-and-link", backup: "/h/.backup/x" }],
  };
  const state: TuiState = { mode: "confirming", route: "links", help: false, dashboard, details: false, reviewOffset: 0, prepared: prepareAction(review, false, async () => ({ success: true, items: [] })) };
  const lines = renderDashboard(state, "/repo", 45, 12, false);
  const output = lines.join("\n");
  assert.equal(lines.length, 12);
  assert.ok(lines.every((line) => visibleWidth(line) <= 45));
  assert.match(output, /Links Confirmation/);
  assert.match(output, /Exact changes: 1/);
  assert.match(output, /Backups: 1/);
  assert.match(output, /rollback attempt/);
  assert.match(output, /Return to review/);
  assert.doesNotMatch(output, /Terminal too short/);
});

function longListState(route: "links" | "packages", cursor = 1): TuiState {
  const long = `A deliberately long selected title ${"segment ".repeat(24)}END`;
  if (route === "links") {
    const statuses: readonly LinkStatusView[] = [
      { id: "long-first", description: long, enabled: true, source: "/repo/first", target: "/home/first", state: "missing" },
      { id: "selected-second", description: "Selected second logical row", enabled: true, source: "/repo/second", target: "/home/second", state: "wrong-link" },
    ];
    return { mode: "workspace", route, help: false, dashboard: { ...dashboard, links: statuses }, statuses, selected: new Set(["selected-second"]), cursor, planning: false };
  }
  return {
    mode: "workspace", route, help: false, dashboard,
    profiles: [
      { id: "long-first", description: long, supported: true, resources: [] },
      { id: "selected-second", description: "Selected second profile", supported: true, resources: [] },
    ],
    status: {
      blocked: false, brewExecutable: "/opt/homebrew/bin/brew",
      profiles: [
        { id: "long-first", description: long, summary: { installed: 0, external: 0, missing: 1, blocked: 0 }, resources: [] },
        { id: "selected-second", description: "Selected second profile", summary: { installed: 1, external: 0, missing: 0, blocked: 0 }, resources: [] },
      ],
    },
    selected: new Set(["selected-second"]), cursor, brewCandidates: ["/opt/homebrew/bin/brew"],
  };
}

for (const width of [80, 60] as const) {
  for (const route of ["links", "packages"] as const) {
    test(`long ${route} item remains one row before selected second item at ${width} columns`, () => {
      const lines = renderDashboard(longListState(route), "/repo", width, width === 60 ? 18 : 24, true);
      const reversed = lines.filter((line) => line.includes("\u001b[7m"));
      assert.equal(reversed.length, 1);
      assert.match(reversed[0]!, route === "links" ? /Selected second logical row/ : /Selected second profile/);
      assert.doesNotMatch(reversed[0]!, /deliberately long/);
      const plain = lines.join("\n").replace(/\u001b\[[0-9;]*m/g, "");
      assert.equal(plain.match(/A deliberately long/g)?.length, 1);
      assert.match(plain, /\.\.\./);
    });
  }
}

for (const route of ["links", "packages"] as const) {
  for (const width of [100, 60, 45] as const) {
    test(`NO_COLOR strips every SGR for long selected ${route} title at ${width} columns`, () => {
      const output = renderDashboard(longListState(route), `/repository/${"x".repeat(160)}`, width, width === 45 ? 12 : 24, false).join("\n");
      assert.doesNotMatch(output, /\u001b\[[0-9;]*m/);
    });
  }
}

test("60x18 Overview retains both exact section bottom borders", () => {
  const lines = renderDashboard({ mode: "workspace", route: "overview", help: false, dashboard }, "/repo", 60, 18, false);
  const setup = lines.findIndex((line) => line.includes("Guided Setup"));
  const attention = lines.findIndex((line) => line.includes("Attention"));
  assert.ok(setup >= 0 && attention > setup);
  assert.match(lines[attention - 1]!, /^╰─+╯$/);
  const footer = lines.findIndex((line) => line.includes("r Refresh"));
  assert.match(lines[footer - 1]!, /^╰─+╯$/);
});

test("45x12 short master-detail is bounded and structurally honest", () => {
  for (const route of ["links", "packages"] as const) {
    const lines = renderDashboard(longListState(route), "/repo", 45, 12, false);
    const output = lines.join("\n");
    assert.equal(lines.length, 12);
    assert.ok(lines.every((line) => visibleWidth(line) <= 45));
    assert.match(output, /Terminal too short for workspace detail/);
    assert.doesNotMatch(output, /Selected second (logical row|profile)/);
    assert.match(output, /\? Help \| q Quit/);
  }
});

test("long link detail cannot displace selection consequence", () => {
  const value = manyLinks(0);
  assert.equal(value.mode, "workspace");
  assert.equal(value.route, "links");
  const statuses = value.statuses.map((item, index) => index === 0
    ? { ...item, state: "wrong-link" as const, detail: `/unexpected/${"nested/".repeat(20)}target` }
    : item);
  const output = renderDashboard({ ...value, statuses }, "/repo", 60, 18, false).join("\n");
  assert.match(output, /Selection:/);
  assert.match(output, /Consequence:/);
});

test("workspace metrics retain all key numbers across approved breakpoints", () => {
  const metricsDashboard: DashboardView = {
    healthy: true, errors: 0, warnings: 0,
    links: Array.from({ length: 15 }, (_, index) => ({ id: `link-${index}`, description: `Link ${index}`, enabled: true, source: `/r/${index}`, target: `/h/${index}`, state: "linked" as const })),
    dependencies: Array.from({ length: 18 }, (_, index) => ({ id: `cli-${index}`, description: `CLI ${index}`, required: true, available: true, path: `/bin/${index}` })),
    node: { actual: "24.0.0", required: "22.19.0", supported: true },
  };
  for (const width of [120, 100, 99, 80, 60, 45] as const) {
    const output = renderDashboard({ mode: "workspace", route: "overview", help: false, dashboard: metricsDashboard }, "/repo", width, width === 45 ? 12 : 24, false).join("\n");
    assert.match(output, /Node 24\.0\.0/);
    assert.match(output, /15\/15/);
    assert.match(output, /A:0/);
    assert.match(output, /18\/18/);
    assert.match(output, width < 60 ? /\[1 O\]/ : /\[1 Overview\]/);
    if (width >= 100) assert.match(output, /15\/15 linked \| A:0[\s│]+CLI 18\/18 available/);
    assert.doesNotMatch(output, /╮╭/);
  }
});

test("45x12 package confirmations show complete safety information and actions", () => {
  const review: PackageReviewView = {
    profiles: ["core"], brewExecutable: "/opt/homebrew/bin/brew", blocked: false, changes: 2,
    items: [{ kind: "formula", name: "git", description: "Git", action: "install-formula" }],
  };
  const normal: TuiState = { mode: "confirming", route: "packages", help: false, dashboard, details: false, reviewOffset: 0, prepared: prepareAction(review, false, async () => ({ success: true, items: [] })) };
  const setup: TuiState = { mode: "setup-confirming", route: "overview", phase: "packages", help: false, dashboard, profiles: ["core"], review, details: false, reviewOffset: 0 };
  for (const [state, action, warning] of [[normal, "Return to review", "not rolled back"], [setup, "Decline phase", "No rollback"]] as const) {
    const lines = renderDashboard(state, "/repo", 45, 12, false);
    const output = lines.join("\n");
    assert.equal(lines.length, 12);
    assert.ok(lines.every((line) => visibleWidth(line) <= 45));
    assert.match(output, /\/opt\/homebrew\/bin\/brew/);
    assert.match(output, new RegExp(warning));
    assert.match(output, /\[y\]/);
    assert.match(output, /n\/Esc/);
    assert.match(output.replace(/\s*│\n│/g, " "), new RegExp(action));
    assert.doesNotMatch(output, /Packages Review|Preview:/);
  }
});
