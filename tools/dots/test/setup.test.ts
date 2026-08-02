import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { DashboardView, LinkReviewView, PackageReviewView } from "../src/application.js";
import { defaultDependencyProfileIds, dependencyProfiles } from "../src/deps-manifest.js";
import { runSetup, type SetupApplication, type SetupHooks } from "../src/setup.js";
import { prepareAction } from "../src/workflows.js";

const packageReview = (changes = 1, blocked = false): PackageReviewView => ({
  profiles: ["core"], brewExecutable: "/fake/brew", blocked, changes,
  items: [{ kind: "formula", name: "git", description: "Git", action: blocked ? "blocked" : changes ? "install-formula" : "noop" }],
});
const linkReview = (changes = 1, blocked = false): LinkReviewView => ({
  blocked, changes,
  items: [{ id: "zshrc", description: "Zsh", source: "/repo/zsh", target: "/home/zsh", action: blocked ? "blocked" : changes ? "create" : "noop" }],
});
const packageResult = (success = true) => ({
  success,
  items: [{ kind: "formula" as const, name: "git", action: "install-formula" as const, outcome: success ? "installed" as const : "failed" as const }],
});
const linkResult = (success = true) => ({
  success, rolledBack: false, recoveryRequired: false, rollbackErrors: [], createdParentsMayRemain: false,
  items: [{ id: "zshrc", action: "create" as const, target: "/home/zsh", outcome: success ? "applied" as const : "failed" as const }],
});
const dashboard = (errors = 0, warnings = 0): DashboardView => ({
  healthy: errors === 0 && warnings === 0, errors, warnings, links: [], dependencies: [],
  node: { required: ">=22.19.0", actual: "24.0.0", supported: true },
});

async function fixture(t: test.TestContext, options: {
  packageChanges?: number;
  packageBlocked?: boolean;
  packageSuccess?: boolean;
  linkChanges?: number;
  linkBlocked?: boolean;
  linkSuccess?: boolean;
  final?: DashboardView;
} = {}): Promise<{ app: SetupApplication; calls: string[]; selections: { ids: readonly string[]; all: boolean }[] }> {
  const root = await mkdtemp(join(tmpdir(), "dots-setup-"));
  const home = join(root, "home");
  await mkdir(home);
  t.after(() => rm(root, { recursive: true, force: true }));
  const calls: string[] = [];
  const selections: { ids: readonly string[]; all: boolean }[] = [];
  const app: SetupApplication = {
    dots: { paths: { home } },
    async preparePackages(ids, all) {
      calls.push("prepare-packages");
      selections.push({ ids, all });
      const review = packageReview(options.packageChanges ?? 1, options.packageBlocked ?? false);
      return prepareAction(review, review.blocked, async (installOptions) => {
        calls.push("commit-packages");
        await installOptions.onProgress?.({ kind: "formula", name: "git", action: "install-formula" });
        return packageResult(options.packageSuccess ?? true);
      });
    },
    async prepareLinks(ids, all) {
      assert.deepEqual(ids, []);
      assert.equal(all, true);
      calls.push("prepare-links");
      const review = linkReview(options.linkChanges ?? 1, options.linkBlocked ?? false);
      return prepareAction(review, review.blocked, async () => {
        calls.push("commit-links");
        return linkResult(options.linkSuccess ?? true);
      });
    },
    async dashboard() {
      calls.push("dashboard");
      return options.final ?? dashboard();
    },
  };
  return { app, calls, selections };
}

const approve: SetupHooks = { reviewPackages: () => true, reviewLinks: () => true };

test("setup selects defaults, all profiles, explicit replacements, and deduped selectors", async (t) => {
  const defaults = await fixture(t, { packageChanges: 0, linkChanges: 0 });
  assert.equal((await runSetup(defaults.app)).status, "completed");
  assert.deepEqual(defaults.selections[0], { ids: defaultDependencyProfileIds, all: false });

  const all = await fixture(t, { packageChanges: 0, linkChanges: 0 });
  const allResult = await runSetup(all.app, { allPackages: true });
  assert.deepEqual(all.selections[0], { ids: [], all: true });
  assert.deepEqual(allResult.profiles, dependencyProfiles.map(({ id }) => id));

  const explicit = await fixture(t, { packageChanges: 0, linkChanges: 0 });
  await runSetup(explicit.app, { profiles: ["runtime", "core", "runtime"] });
  assert.deepEqual(explicit.selections[0], { ids: ["runtime", "core"], all: false });
});

test("blocked and declined package plans stop before links and blocked plans are not reviewed", async (t) => {
  const blocked = await fixture(t, { packageBlocked: true });
  let blockedReviews = 0;
  const blockedResult = await runSetup(blocked.app, {}, { reviewPackages: () => { blockedReviews += 1; return true; } });
  assert.equal(blockedResult.status, "failed");
  assert.equal(blockedReviews, 0);
  assert.deepEqual(blocked.calls, ["prepare-packages"]);

  const declined = await fixture(t);
  const declinedResult = await runSetup(declined.app, {}, { reviewPackages: () => false });
  assert.equal(declinedResult.status, "cancelled");
  assert.deepEqual(declined.calls, ["prepare-packages"]);
});

test("zero-change packages commit without review; partial package failure stops links", async (t) => {
  const noop = await fixture(t, { packageChanges: 0, linkChanges: 0 });
  let reviews = 0;
  await runSetup(noop.app, {}, { reviewPackages: () => { reviews += 1; return false; } });
  assert.equal(reviews, 0);
  assert.deepEqual(noop.calls.slice(0, 3), ["prepare-packages", "commit-packages", "prepare-links"]);

  const partial = await fixture(t, { packageSuccess: false });
  const result = await runSetup(partial.app, {}, approve);
  assert.equal(result.status, "failed");
  assert.equal(result.packageResult?.items[0]?.outcome, "failed");
  assert.deepEqual(partial.calls, ["prepare-packages", "commit-packages"]);
});

test("successful packages create a fresh link action; blocked, declined, and failed links stop", async (t) => {
  const blocked = await fixture(t, { linkBlocked: true });
  let reviews = 0;
  const blockedResult = await runSetup(blocked.app, {}, { ...approve, reviewLinks: () => { reviews += 1; return true; } });
  assert.equal(blockedResult.status, "partial");
  assert.equal(reviews, 0);
  assert.deepEqual(blocked.calls, ["prepare-packages", "commit-packages", "prepare-links"]);

  const declined = await fixture(t);
  assert.equal((await runSetup(declined.app, {}, { ...approve, reviewLinks: () => false })).status, "partial");
  assert.equal(declined.calls.includes("commit-links"), false);

  const failed = await fixture(t, { linkSuccess: false });
  assert.equal((await runSetup(failed.app, {}, approve)).status, "partial");
  assert.equal(failed.calls.includes("dashboard"), false);
});

test("both no-op phases commit exactly once and use a fresh final dashboard", async (t) => {
  const value = await fixture(t, { packageChanges: 0, linkChanges: 0 });
  const phases: string[] = [];
  const result = await runSetup(value.app, {}, { onPhaseChange: (phase) => { phases.push(phase); } });
  assert.equal(result.status, "completed");
  assert.deepEqual(phases, ["preflight", "packages", "links", "doctor"]);
  assert.deepEqual(value.calls, ["prepare-packages", "commit-packages", "prepare-links", "commit-links", "dashboard"]);
});

test("final doctor errors fail while warnings complete", async (t) => {
  const error = await fixture(t, { packageChanges: 0, linkChanges: 0, final: dashboard(1, 0) });
  const errorResult = await runSetup(error.app);
  assert.equal(errorResult.status, "failed");
  assert.deepEqual(errorResult.summary, { errors: 1, warnings: 0 });

  const warning = await fixture(t, { packageChanges: 0, linkChanges: 0, final: dashboard(0, 2) });
  const warningResult = await runSetup(warning.app);
  assert.equal(warningResult.status, "completed");
  assert.deepEqual(warningResult.summary, { errors: 0, warnings: 2 });
});

test("stale apply lock fails preflight before package mutation", async (t) => {
  const value = await fixture(t);
  await mkdir(join(value.app.dots.paths.home, ".dots-apply.lock"));
  const result = await runSetup(value.app, {}, approve);
  assert.equal(result.status, "failed");
  assert.equal(result.phase, "preflight");
  assert.match(result.summary.message ?? "", /dots links unlock --force/);
  assert.deepEqual(value.calls, []);
});

test("aborted package planning is cancellation rather than failure", async (t) => {
  const value = await fixture(t);
  const controller = new AbortController();
  const app: SetupApplication = {
    ...value.app,
    async preparePackages(ids, all) {
      const prepared = await value.app.preparePackages(ids, all);
      controller.abort();
      return prepared;
    },
  };
  const result = await runSetup(app, {}, approve, { signal: controller.signal });
  assert.equal(result.status, "cancelled");
  assert.equal(result.phase, "packages");
  assert.equal(result.summary.errors, 0);
  assert.equal(value.calls.includes("commit-packages"), false);
  assert.equal(value.calls.includes("prepare-links"), false);
});

test("rejected aborted package planning is cancellation rather than failure", async (t) => {
  const value = await fixture(t);
  const controller = new AbortController();
  const app: SetupApplication = {
    ...value.app,
    async preparePackages() {
      controller.abort();
      throw new Error("aborted planning");
    },
  };
  const result = await runSetup(app, {}, approve, { signal: controller.signal });
  assert.equal(result.status, "cancelled");
  assert.equal(result.summary.errors, 0);
  assert.equal(value.calls.includes("prepare-links"), false);
});

test("link review exception after package mutation is partial and retains completed package data", async (t) => {
  const value = await fixture(t);
  const result = await runSetup(value.app, {}, {
    reviewPackages: () => true,
    reviewLinks: () => { throw new Error("review adapter failed"); },
  });
  assert.equal(result.status, "partial");
  assert.equal(result.phase, "links");
  assert.equal(result.packageResult?.success, true);
  assert.equal(result.linkReview?.changes, 1);
  assert.match(result.summary.message ?? "", /Links were not completed/);
  assert.equal(value.calls.includes("commit-links"), false);
});

test("first-link rollback recovery evidence classifies setup as partial", async (t) => {
  const value = await fixture(t, { packageChanges: 0 });
  value.app.prepareLinks = async () => prepareAction(linkReview(), false, async () => ({
    success: false,
    rolledBack: false,
    recoveryRequired: true,
    rollbackErrors: ["first target could not be restored"],
    createdParentsMayRemain: true,
    items: [{ id: "zshrc", action: "create", target: "/home/zsh", outcome: "failed" }],
  }));
  const result = await runSetup(value.app, {}, approve);
  assert.equal(result.status, "partial");
  assert.equal(result.linkResult?.recoveryRequired, true);
});

test("active and stale lock preflight failures give exact recovery commands without mutation", async (t) => {
  for (const [label, pid, command] of [["active", process.pid, "dots links lock"], ["stale", 999999, "dots links unlock"]] as const) {
    await t.test(label, async (child) => {
      const value = await fixture(child);
      const lock = join(value.app.dots.paths.home, ".dots-apply.lock");
      await mkdir(lock);
      await writeFile(join(lock, "owner.json"), JSON.stringify({ schemaVersion: 1, version: "dots-lock-v1", pid, startedAt: new Date().toISOString() }));
      const result = await runSetup(value.app, {}, approve);
      assert.equal(result.status, "failed");
      assert.match(result.summary.message ?? "", new RegExp(command.replaceAll(" ", "\\s")));
      assert.deepEqual(value.calls, []);
    });
  }
});
