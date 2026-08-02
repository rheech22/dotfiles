import assert from "node:assert/strict";
import test from "node:test";
import type { DashboardView, LinkReviewView, LinkStatusView, PackageReviewView, PackageStatusView, PreparedLinkAction, PreparedPackageAction } from "../src/application.js";
import type { DotsApplication } from "../src/application.js";
import { TuiController, type TuiApplication } from "../src/tui-controller.js";
import { prepareAction } from "../src/workflows.js";
import { TuiExitLatch } from "../src/tui.js";
import { runTui } from "../src/tui.js";
import type { Terminal } from "@earendil-works/pi-tui";
import { renderDashboard } from "../src/tui-renderer.js";

const links: readonly LinkStatusView[] = [
  { id: "healthy", description: "Healthy", enabled: true, source: "/repo/healthy", target: "/home/healthy", state: "linked" },
  { id: "missing", description: "Missing", enabled: true, source: "/repo/missing", target: "/home/missing", state: "missing" },
  { id: "wrong", description: "Wrong", enabled: true, source: "/repo/wrong", target: "/home/wrong", state: "wrong-link", detail: "/other" },
  { id: "occupied", description: "Occupied", enabled: true, source: "/repo/occupied", target: "/home/occupied", state: "occupied" },
  { id: "source", description: "Source missing", enabled: true, source: "/repo/source", target: "/home/source", state: "source-missing" },
];

const dashboard: DashboardView = {
  healthy: false,
  errors: 1,
  warnings: 1,
  links,
  dependencies: [{ id: "git", description: "Git", required: true, available: true, path: "/usr/bin/git" }],
  node: { actual: "24.0.0", required: "22.19.0", supported: true },
};

const packageStatus: PackageStatusView = {
  blocked: false,
  brewExecutable: "/opt/homebrew/bin/brew",
  profiles: [
    { id: "base", description: "Base", summary: { installed: 0, external: 0, missing: 1, blocked: 0 }, resources: [{ kind: "formula", name: "git", description: "Git", state: "missing" }] },
    { id: "gui", description: "GUI", summary: { installed: 1, external: 0, missing: 0, blocked: 0 }, resources: [{ kind: "cask", name: "iterm2", description: "iTerm", state: "installed-by-selected-brew" }] },
  ],
};

function linkPrepared(ids: readonly string[], blocked = false, commit = async () => ({ success: true, items: [] })): PreparedLinkAction {
  const review: LinkReviewView = {
    blocked,
    changes: blocked ? 0 : ids.length,
    items: ids.map((id) => ({ id, description: id, source: `/repo/${id}`, target: `/home/${id}`, action: blocked ? "blocked" : "create", ...(blocked ? { reason: "blocked" } : {}) })),
  };
  return prepareAction(review, blocked, commit);
}

function packagePrepared(ids: readonly string[], blocked = false, commit = async () => ({ success: true, items: [] })): PreparedPackageAction {
  const review: PackageReviewView = {
    profiles: ids,
    brewExecutable: "/opt/homebrew/bin/brew",
    blocked,
    changes: blocked ? 0 : ids.length,
    items: ids.map((id) => ({ kind: "formula", name: id, description: id, action: blocked ? "blocked" : "install-formula", ...(blocked ? { reason: "blocked" } : {}) })),
  };
  return prepareAction(review, blocked, commit);
}

class FakeApp implements TuiApplication {
  readonly dots = { paths: { repo: "/Users/test/dotfiles", home: "/tmp/dots-tui-test-home" } } as DotsApplication["dots"];
  candidates: readonly string[] = ["/opt/homebrew/bin/brew"];
  selectedBrew: string | undefined;
  linkCommits = 0;
  packageCommits = 0;
  dashboards = 0;
  preparedLinks: PreparedLinkAction[] = [];

  async dashboard(): Promise<DashboardView> { this.dashboards += 1; return dashboard; }
  async linksStatus(): Promise<readonly LinkStatusView[]> { return links; }
  async prepareLinks(ids: readonly string[]): Promise<PreparedLinkAction> {
    const prepared = linkPrepared(ids, false, async () => { this.linkCommits += 1; return { success: true, items: [] }; });
    this.preparedLinks.push(prepared);
    return prepared;
  }
  packageProfiles() { return packageStatus.profiles.map(({ id, description }) => ({ id, description, supported: true, resources: [] })); }
  async packageStatus(): Promise<PackageStatusView> { return packageStatus; }
  async preparePackages(ids: readonly string[]): Promise<PreparedPackageAction> {
    return packagePrepared(ids, false, async () => { this.packageCommits += 1; return { success: true, items: [] }; });
  }
  async brewCandidates(): Promise<readonly string[]> { return this.candidates; }
  withSelectedBrew(path: string): TuiApplication { this.selectedBrew = path; this.candidates = [path]; return this; }
}

const immediateSchedule = (callback: () => void): ReturnType<typeof setTimeout> => {
  callback();
  return 0 as unknown as ReturnType<typeof setTimeout>;
};

test("initial actionable links are selected but source-missing is not", async () => {
  const controller = new TuiController({ app: new FakeApp(), initialRoute: "links", debounceMs: 0, schedule: immediateSchedule });
  await controller.start();
  assert.equal(controller.state.mode, "workspace");
  if (controller.state.mode !== "workspace" || controller.state.route !== "links") return;
  assert.deepEqual([...controller.state.selected], ["missing", "wrong", "occupied"]);
});

test("profile multi-select and route switching cancel screen-local prepared action", async () => {
  const app = new FakeApp();
  const controller = new TuiController({ app, initialRoute: "links", debounceMs: 0, schedule: immediateSchedule });
  await controller.start();
  await new Promise((resolve) => setImmediate(resolve));
  const prepared = app.preparedLinks.at(-1)!;
  await controller.input("3");
  assert.equal(prepared.state, "cancelled");
  await controller.input("space");
  await controller.input("down");
  await controller.input("space");
  if (controller.state.mode !== "workspace" || controller.state.route !== "packages") return assert.fail("packages expected");
  assert.deepEqual([...controller.state.selected], ["base", "gui"]);
});

test("stale async route load cannot overwrite a newer workspace", async () => {
  const app = new FakeApp();
  let release: (() => void) | undefined;
  const first = new Promise<void>((resolve) => { release = resolve; });
  let calls = 0;
  app.dashboard = async () => {
    calls += 1;
    if (calls === 1) await first;
    return dashboard;
  };
  const controller = new TuiController({ app, initialRoute: "links" });
  const loading = controller.start();
  await new Promise((resolve) => setImmediate(resolve));
  await controller.input("3");
  assert.equal(controller.state.route, "packages");
  release?.();
  await loading;
  assert.equal(controller.state.route, "packages");
});

test("review and confirmation block workspace route keys without cancel or commit", async () => {
  const app = new FakeApp();
  const controller = new TuiController({ app, initialRoute: "links", debounceMs: 0, schedule: immediateSchedule });
  await controller.start();
  await controller.input("enter");
  const linkAction = controller.state.mode === "reviewing" ? controller.state.prepared : undefined;
  await controller.input("3");
  assert.equal(controller.state.mode, "reviewing");
  assert.equal(controller.state.route, "links");
  assert.equal(linkAction?.state, "prepared");
  await controller.input("enter");
  assert.equal(controller.state.mode, "confirming");
  await controller.input("1");
  await controller.input("3");
  assert.equal(controller.state.mode, "confirming");
  assert.equal(controller.state.route, "links");
  assert.equal(linkAction?.state, "prepared");
  assert.equal(app.linkCommits, 0);
  assert.equal(app.packageCommits, 0);
});

test("blocked and noop reviews remain explicit, and repeated confirmation commits once", async () => {
  const app = new FakeApp();
  app.prepareLinks = async (ids) => linkPrepared(ids, true, async () => { app.linkCommits += 1; return { success: true, items: [] }; });
  const blocked = new TuiController({ app, initialRoute: "links", debounceMs: 0, schedule: immediateSchedule });
  await blocked.start();
  await blocked.input("enter");
  await blocked.input("enter");
  await blocked.input("y");
  assert.equal(app.linkCommits, 0);

  const noopApp = new FakeApp();
  noopApp.prepareLinks = async () => linkPrepared([]);
  const noop = new TuiController({ app: noopApp, initialRoute: "links", debounceMs: 0, schedule: immediateSchedule });
  await noop.start();
  await noop.input("enter");
  assert.equal(noop.state.mode, "reviewing");
  if (noop.state.mode === "reviewing") assert.equal(noop.state.prepared.review.changes, 0);

  const goodApp = new FakeApp();
  const good = new TuiController({ app: goodApp, initialRoute: "links", debounceMs: 0, schedule: immediateSchedule });
  await good.start();
  await good.input("enter");
  await good.input("y");
  await Promise.all([good.input("y"), good.input("y")]);
  assert.equal(goodApp.linkCommits, 1);
});

test("stale link consequence is cancelled and cannot replace newer selection", async () => {
  const app = new FakeApp();
  const callbacks: Array<() => void> = [];
  const controller = new TuiController({ app, initialRoute: "links", schedule: (callback) => { callbacks.push(callback); return callbacks.length as unknown as ReturnType<typeof setTimeout>; } });
  await controller.start();
  await controller.input("n");
  await controller.input("space");
  callbacks[0]?.();
  callbacks[1]?.();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(app.preparedLinks[0]?.state, "cancelled");
  if (controller.state.mode !== "workspace" || controller.state.route !== "links") return assert.fail("links expected");
  assert.equal(controller.state.consequence?.review.items[0]?.id, "healthy");
});

test("q during mutation waits for settle and result Enter refreshes workspace", async () => {
  let release: (() => void) | undefined;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  const app = new FakeApp();
  app.prepareLinks = async (ids) => linkPrepared(ids, false, async () => { app.linkCommits += 1; await pending; return { success: true, items: [] }; });
  let exits = 0;
  const controller = new TuiController({ app, initialRoute: "links", debounceMs: 0, schedule: immediateSchedule, onExit: () => { exits += 1; } });
  await controller.start();
  await controller.input("enter");
  await controller.input("y");
  const applying = controller.input("y");
  await new Promise((resolve) => setImmediate(resolve));
  await controller.input("q");
  assert.equal(controller.state.mode, "exit-pending");
  assert.equal(exits, 0);
  release?.();
  await applying;
  assert.equal(exits, 1);

  const resultController = new TuiController({ app: new FakeApp(), initialRoute: "links", debounceMs: 0, schedule: immediateSchedule });
  await resultController.start();
  await resultController.input("enter");
  await resultController.input("y");
  await resultController.input("y");
  assert.equal(resultController.state.mode, "result");
  await resultController.input("enter");
  assert.equal(resultController.state.mode, "workspace");
});

test("dual Homebrew selection is session-only and rebuilds application", async () => {
  const app = new FakeApp();
  app.candidates = ["/opt/homebrew/bin/brew", "/usr/local/bin/brew"];
  const controller = new TuiController({ app, initialRoute: "packages" });
  await controller.start();
  assert.equal(controller.state.mode, "choosing-brew");
  await controller.input("down");
  await controller.input("enter");
  assert.equal(app.selectedBrew, "/usr/local/bin/brew");
  assert.equal(controller.state.mode, "workspace");
});

const settle = async (): Promise<void> => {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
};

const waitFor = async (condition: () => boolean): Promise<void> => {
  for (let attempt = 0; attempt < 100 && !condition(); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  assert.equal(condition(), true, "timed out waiting for controller state");
};

test("Overview s runs default setup through separate package and link approvals", async () => {
  const app = new FakeApp();
  const modes: string[] = [];
  app.dashboard = async () => ({ ...dashboard, healthy: true, errors: 0, warnings: 0 });
  let selectedProfiles: readonly string[] = [];
  app.preparePackages = async (ids) => {
    selectedProfiles = ids;
    return packagePrepared(ids, false, async (options) => {
      app.packageCommits += 1;
      await options?.onProgress?.({ kind: "formula", name: "git", action: "install-formula" });
      return { success: true, items: [{ kind: "formula", name: "git", action: "install-formula", outcome: "installed" }] };
    });
  };
  app.prepareLinks = async () => linkPrepared(["zsh"], false, async () => {
    app.linkCommits += 1;
    return { success: true, rolledBack: false, rollbackErrors: [], recoveryRequired: false, createdParentsMayRemain: false, items: [{ id: "zsh", action: "create", target: "/home/zsh", outcome: "applied" }] };
  });
  let controller: TuiController;
  controller = new TuiController({ app, onChange: () => { modes.push(controller.state.mode); } });
  await controller.start();
  await controller.input("s");
  await waitFor(() => selectedProfiles.length > 0);
  assert.deepEqual(selectedProfiles, ["core", "terminal", "developer", "yazi", "runtime"]);
  assert.equal(controller.state.mode, "setup-review");
  if (controller.state.mode === "setup-review") assert.equal(controller.state.phase, "packages");
  await controller.input("enter");
  await controller.input("y");
  await settle();
  assert.equal(app.packageCommits, 1);
  assert.ok(modes.includes("setup-running"));
  assert.equal(controller.state.mode, "setup-review");
  if (controller.state.mode === "setup-review") assert.equal(controller.state.phase, "links");
  await controller.input("y");
  await controller.input("y");
  await settle();
  assert.equal(app.linkCommits, 1);
  assert.equal(controller.state.mode, "setup-result");
  if (controller.state.mode === "setup-result") assert.equal(controller.state.result.status, "completed");
  await controller.input("enter");
  assert.equal(controller.state.mode, "workspace");
  assert.equal(controller.state.route, "overview");
});

test("setup Homebrew chooser preserves setup intent and session-only selection", async () => {
  const app = new FakeApp();
  app.candidates = ["/opt/homebrew/bin/brew", "/usr/local/bin/brew"];
  const controller = new TuiController({ app });
  await controller.start();
  await controller.input("s");
  assert.equal(controller.state.mode, "choosing-brew");
  if (controller.state.mode === "choosing-brew") assert.equal(controller.state.intent, "setup");
  await controller.input("down");
  await controller.input("enter");
  await waitFor(() => controller.state.mode === "setup-review");
  assert.equal(app.selectedBrew, "/usr/local/bin/brew");
  assert.equal(controller.state.mode, "setup-review");
});

test("declining setup packages cancels before mutation with no links", async () => {
  const app = new FakeApp();
  const controller = new TuiController({ app });
  await controller.start();
  await controller.input("s");
  await settle();
  await controller.input("n");
  await settle();
  assert.equal(app.packageCommits, 0);
  assert.equal(app.linkCommits, 0);
  assert.equal(controller.state.mode, "setup-result");
  if (controller.state.mode === "setup-result") assert.equal(controller.state.result.status, "cancelled");
});

test("declining setup links after installation is partial and latches failure", async () => {
  const app = new FakeApp();
  app.preparePackages = async (ids) => packagePrepared(ids, false, async () => ({ success: true, items: [{ kind: "formula", name: "git", action: "install-formula", outcome: "installed" }] }));
  app.prepareLinks = async () => linkPrepared(["zsh"]);
  const latch = new TuiExitLatch();
  const controller = new TuiController({ app, onMutationOutcome: (success) => { if (!success) latch.fail(); } });
  await controller.start();
  await controller.input("s");
  await settle();
  await controller.input("y");
  await controller.input("y");
  await settle();
  assert.equal(controller.state.mode, "setup-review");
  await controller.input("escape");
  await settle();
  assert.equal(controller.state.mode, "setup-result");
  if (controller.state.mode === "setup-result") assert.equal(controller.state.result.status, "partial");
  assert.equal(latch.code, 1);
});

test("setup package failure never reaches link review", async () => {
  const app = new FakeApp();
  let linkPlans = 0;
  app.preparePackages = async (ids) => packagePrepared(ids, false, async () => ({ success: false, items: [{ kind: "formula", name: "git", action: "install-formula", outcome: "failed", error: "boom" }] }));
  app.prepareLinks = async () => { linkPlans += 1; return linkPrepared(["zsh"]); };
  const controller = new TuiController({ app });
  await controller.start();
  await controller.input("s");
  await settle();
  await controller.input("y");
  await controller.input("y");
  await settle();
  assert.equal(linkPlans, 0);
  assert.equal(controller.state.mode, "setup-result");
  if (controller.state.mode === "setup-result") assert.equal(controller.state.result.status, "failed");
});

test("short-terminal guard blocks setup approval", async () => {
  const app = new FakeApp();
  const controller = new TuiController({ app, canConfirm: () => false });
  await controller.start();
  await controller.input("s");
  await settle();
  await controller.input("enter");
  assert.equal(controller.state.mode, "setup-confirming");
  await controller.input("y");
  assert.equal(controller.state.mode, "setup-confirming");
  assert.equal(app.packageCommits, 0);
});

test("q declines a setup review, while q during setup commit waits for settle", async () => {
  const reviewApp = new FakeApp();
  let reviewExits = 0;
  const reviewController = new TuiController({ app: reviewApp, onExit: () => { reviewExits += 1; } });
  await reviewController.start();
  await reviewController.input("s");
  await settle();
  await reviewController.input("q");
  await settle();
  assert.equal(reviewExits, 1);
  assert.equal(reviewApp.packageCommits, 0);

  let release: (() => void) | undefined;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  const commitApp = new FakeApp();
  commitApp.preparePackages = async (ids) => packagePrepared(ids, false, async () => {
    await pending;
    return { success: true, items: [] };
  });
  let commitExits = 0;
  const commitController = new TuiController({ app: commitApp, onExit: () => { commitExits += 1; } });
  await commitController.start();
  await commitController.input("s");
  await settle();
  await commitController.input("y");
  await commitController.input("y");
  await settle();
  await commitController.input("q");
  assert.equal(commitController.state.mode, "setup-exit-pending");
  assert.equal(commitExits, 0);
  release?.();
  await settle();
  assert.equal(commitExits, 1);
});

test("q aborts deferred setup planning and late Homebrew discovery cannot revive setup", async () => {
  const planningApp = new FakeApp();
  let planningSignal: AbortSignal | undefined;
  planningApp.preparePackages = async (_ids, _all, options) => {
    planningSignal = options?.signal;
    return new Promise<PreparedPackageAction>((_resolve, reject) => {
      options?.signal?.addEventListener("abort", () => reject(new Error("planning aborted")), { once: true });
    });
  };
  let exits = 0;
  const planning = new TuiController({ app: planningApp, onExit: () => { exits += 1; } });
  await planning.start();
  await planning.input("s");
  await waitFor(() => planningSignal !== undefined);
  await planning.input("q");
  await waitFor(() => exits === 1);
  assert.equal(planningSignal?.aborted, true);

  let releaseCandidates: ((value: readonly string[]) => void) | undefined;
  const discoveryApp = new FakeApp();
  discoveryApp.brewCandidates = () => new Promise((resolve) => { releaseCandidates = resolve; });
  let discoveryExits = 0;
  const discovery = new TuiController({ app: discoveryApp, onExit: () => { discoveryExits += 1; } });
  discovery.state = { mode: "workspace", route: "overview", help: false, dashboard };
  const start = discovery.input("s");
  await waitFor(() => releaseCandidates !== undefined);
  await discovery.input("q");
  releaseCandidates?.(["/opt/homebrew/bin/brew", "/usr/local/bin/brew"]);
  await start;
  assert.equal(discoveryExits, 1);
  assert.equal(discovery.state.mode, "setup-exit-pending");
});

test("invisible confirmation cannot commit and review navigation changes offset", async () => {
  const app = new FakeApp();
  app.prepareLinks = async () => linkPrepared(Array.from({ length: 20 }, (_, index) => `item-${index}`), false, async () => {
    app.linkCommits += 1;
    return { success: true, items: [] };
  });
  const controller = new TuiController({ app, initialRoute: "links", debounceMs: 0, schedule: immediateSchedule, canConfirm: () => false });
  await controller.start();
  await controller.input("enter");
  await controller.input("j");
  await controller.input("down");
  assert.equal(controller.state.mode, "reviewing");
  if (controller.state.mode === "reviewing") assert.equal(controller.state.reviewOffset, 2);
  await controller.input("y");
  assert.equal(controller.state.mode, "confirming");
  await controller.input("y");
  assert.equal(app.linkCommits, 0);
  assert.equal(controller.state.mode, "confirming");
});

test("setup result scrolling clamps to the rendered viewport", async () => {
  const controller = new TuiController({ app: new FakeApp(), viewport: () => ({ columns: 80, rows: 24 }) });
  controller.state = {
    mode: "setup-result", route: "overview", help: false, resultOffset: 999,
    result: { status: "cancelled", phase: "packages", profiles: ["core"], summary: { warnings: 0, errors: 0 } },
  };
  await controller.input("j");
  assert.equal(controller.state.mode, "setup-result");
  if (controller.state.mode === "setup-result") assert.equal(controller.state.resultOffset, 0);
});

test("exit latch preserves mutation failure across refresh and signal codes win", () => {
  const latch = new TuiExitLatch();
  latch.observe({ mode: "result", route: "links", help: false, review: { blocked: false, changes: 0, items: [] }, result: { success: false } });
  latch.observe({ mode: "workspace", route: "overview", help: false, dashboard });
  assert.equal(latch.code, 1);
  latch.signal(130);
  latch.fail();
  assert.equal(latch.code, 130);

  const recovered = new TuiExitLatch();
  recovered.observe({ mode: "error", route: "overview", help: false, message: "temporary" });
  assert.equal(recovered.code, 1);
  recovered.observe({ mode: "workspace", route: "overview", help: false, dashboard });
  assert.equal(recovered.code, 0);
});

test("read-only q cleans up without awaiting a pending inspection", async () => {
  class FakeTerminal implements Terminal {
    readonly columns = 80;
    readonly rows = 24;
    readonly kittyProtocolActive = false;
    stopped = false;
    readonly titles: string[] = [];
    readonly progress: boolean[] = [];
    start(onInput: (data: string) => void): void { queueMicrotask(() => onInput("q")); }
    stop(): void { this.stopped = true; }
    async drainInput(): Promise<void> {}
    write(): void {}
    moveBy(): void {}
    hideCursor(): void {}
    showCursor(): void {}
    clearLine(): void {}
    clearFromCursor(): void {}
    clearScreen(): void {}
    setTitle(title: string): void { this.titles.push(title); }
    setProgress(active: boolean): void { this.progress.push(active); }
  }
  const app = new FakeApp();
  app.dashboard = () => new Promise<DashboardView>(() => undefined);
  const terminal = new FakeTerminal();
  const result = await Promise.race([
    runTui(app as unknown as DotsApplication, "overview", { terminal }),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("TUI cleanup timed out")), 250)),
  ]);
  assert.equal(result, 0);
  assert.equal(terminal.stopped, true);
  assert.deepEqual(terminal.titles, ["dots", ""]);
  assert.equal(terminal.progress.at(-1), false);
});

test("controller paging reaches final review and result lines using rendered body budgets", async () => {
  for (const viewport of [{ columns: 60, rows: 18 }, { columns: 45, rows: 12 }] as const) {
    const preview = Array.from({ length: 24 }, (_, index) => `preview consequence ${index + 1}`);
    const review: PackageReviewView = {
      profiles: ["terminal"], brewExecutable: "/opt/homebrew/bin/brew", blocked: false, changes: 1,
      items: [{ kind: "formula", name: "tool", description: "Tool", action: "install-formula", preview }],
    };
    const controller = new TuiController({ app: new FakeApp(), viewport: () => viewport });
    controller.state = { mode: "reviewing", route: "packages", help: false, dashboard, details: true, reviewOffset: 0, prepared: prepareAction(review, false, async () => ({ success: true, items: [] })) };
    for (let index = 0; index < 80; index += 1) await controller.input(index % 2 === 0 ? "j" : "down");
    assert.match(renderDashboard(controller.state, "/repo", viewport.columns, viewport.rows, false).join("\n"), /preview consequence 24/);

    controller.state = {
      mode: "result", route: "links", help: false, dashboard, review: { blocked: false, changes: 1, items: [] }, resultOffset: 0,
      result: { success: false, rollbackErrors: Array.from({ length: 18 }, (_, index) => `rollback line ${index + 1}`), items: [] },
    };
    for (let index = 0; index < 80; index += 1) await controller.input(index % 2 === 0 ? "j" : "down");
    assert.match(renderDashboard(controller.state, "/repo", viewport.columns, viewport.rows, false).join("\n"), /rollback line 18/);

    controller.state = {
      mode: "setup-result", route: "overview", help: false, resultOffset: 0,
      result: {
        status: "failed", phase: "links", profiles: ["core"], summary: { warnings: 0, errors: 18 },
        linkResult: { success: false, rolledBack: false, rollbackErrors: Array.from({ length: 18 }, (_, index) => `setup rollback ${index + 1}`), recoveryRequired: true, createdParentsMayRemain: false, items: [] },
      },
    };
    for (let index = 0; index < 80; index += 1) await controller.input(index % 2 === 0 ? "j" : "down");
    assert.match(renderDashboard(controller.state, "/repo", viewport.columns, viewport.rows, false).join("\n"), /setup rollback 18/);
  }
});
