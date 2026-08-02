import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import * as fs from "node:fs/promises";
import { mkdtemp, mkdir, readFile, readlink, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import type { RuntimePaths } from "../src/domain.js";
import { applyLinkPlan, createLinkPlan, inspectApplyLock, nodeFsOps, nodeLockOps, unlockApplyLock, type FsOps } from "../src/link.js";
import type { ConfigItem } from "../src/manifest.js";
import { DotsService } from "../src/service.js";
import { renderApply } from "../src/reporters.js";

const execFileAsync = promisify(execFile);

interface Fixture {
  readonly root: string;
  readonly repo: string;
  readonly home: string;
  readonly paths: RuntimePaths;
}

async function fixture(t: test.TestContext): Promise<Fixture> {
  const root = await mkdtemp(join(tmpdir(), "dots-link-"));
  const repo = join(root, "repo");
  const home = join(root, "home");
  await Promise.all([mkdir(join(repo, ".config"), { recursive: true }), mkdir(home)]);
  await writeFile(join(repo, "source-dots.sh"), "#!/bin/zsh\n");
  t.after(() => rm(root, { recursive: true, force: true }));
  return { root, repo, home, paths: { repo, home, path: "" } };
}

function config(id: string, target = `target/${id}`, enabled = true): ConfigItem {
  return { id, source: `source/${id}`, target, description: `${id} description`, enabled, disabledReason: "disabled" };
}

async function source(f: Fixture, item: ConfigItem): Promise<string> {
  const path = join(f.repo, item.source);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `source ${item.id}`);
  return path;
}

async function target(f: Fixture, item: ConfigItem): Promise<string> {
  const path = join(f.home, item.target);
  await mkdir(dirname(path), { recursive: true });
  return path;
}

const fixedClock = (): Date => new Date(2024, 0, 2, 3, 4, 5);

test("plans and applies create, then plans noop", async (t) => {
  const f = await fixture(t);
  const item = config("create");
  const sourcePath = await source(f, item);
  const plan = await createLinkPlan([item], f.paths, fixedClock);
  assert.equal(plan.items[0]?.action, "create");
  assert.equal(plan.items[0]?.source, await realpath(sourcePath));
  assert.equal((await applyLinkPlan(plan)).success, true);
  assert.equal(await readlink(join(f.home, item.target)), plan.items[0]?.sourceReferent);
  assert.equal((await createLinkPlan([item], f.paths, fixedClock)).items[0]?.action, "noop");
});

test("backs up occupied files and directories", async (t) => {
  const f = await fixture(t);
  const file = config("file");
  const directory = config("directory");
  await Promise.all([source(f, file), source(f, directory)]);
  const fileTarget = await target(f, file);
  const directoryTarget = await target(f, directory);
  await writeFile(fileTarget, "original file");
  await mkdir(directoryTarget);
  await writeFile(join(directoryTarget, "kept"), "original directory");
  const plan = await createLinkPlan([file, directory], f.paths, fixedClock);
  assert.deepEqual(plan.items.map(({ action }) => action), ["backup-and-link", "backup-and-link"]);
  const result = await applyLinkPlan(plan);
  assert.equal(result.success, true, JSON.stringify(result));
  assert.equal(await readFile(plan.items[0]!.backup!, "utf8"), "original file");
  assert.equal(await readFile(join(plan.items[1]!.backup!, "kept"), "utf8"), "original directory");
});

test("replaces wrong and dangling links through backups", async (t) => {
  const f = await fixture(t);
  const wrong = config("wrong");
  const dangling = config("dangling");
  await Promise.all([source(f, wrong), source(f, dangling)]);
  const wrongTarget = await target(f, wrong);
  const danglingTarget = await target(f, dangling);
  const other = join(f.root, "other");
  await writeFile(other, "other");
  await symlink(other, wrongTarget);
  await symlink(join(f.root, "absent"), danglingTarget);
  const plan = await createLinkPlan([wrong, dangling], f.paths, fixedClock);
  assert.deepEqual(plan.items.map(({ action }) => action), ["replace-link", "replace-link"]);
  const result = await applyLinkPlan(plan);
  assert.equal(result.success, true, JSON.stringify(result));
  assert.equal(await readlink(plan.items[0]!.backup!), other);
  assert.equal(await readlink(plan.items[1]!.backup!), join(f.root, "absent"));
});

test("backup timestamp is deterministic and collision-safe", async (t) => {
  const f = await fixture(t);
  const item = config("collision");
  await source(f, item);
  const targetPath = await target(f, item);
  await writeFile(targetPath, "occupied");
  await writeFile(`${targetPath}.backup.20240102_030405`, "existing");
  await writeFile(`${targetPath}.backup.20240102_030405.1`, "existing");
  const plan = await createLinkPlan([item], f.paths, fixedClock);
  assert.equal(plan.items[0]?.backup, `${await realpath(dirname(targetPath))}/${item.id}.backup.20240102_030405.2`);
});

test("apply never overwrites a backup created after planning", async (t) => {
  const f = await fixture(t);
  const item = config("late-backup");
  await source(f, item);
  const targetPath = await target(f, item);
  await writeFile(targetPath, "original target");
  const plan = await createLinkPlan([item], f.paths, fixedClock);
  const backup = plan.items[0]!.backup!;
  await writeFile(backup, "late backup");
  const result = await applyLinkPlan(plan);
  assert.equal(result.success, false);
  assert.equal(await readFile(targetPath, "utf8"), "original target");
  assert.equal(await readFile(backup, "utf8"), "late backup");
});

test("detects a target identity swap during the backup move", async (t) => {
  const f = await fixture(t);
  const item = config("rename-race");
  await source(f, item);
  const targetPath = await target(f, item);
  const displacedOriginal = join(f.root, "displaced-original");
  await writeFile(targetPath, "original target");
  const plan = await createLinkPlan([item], f.paths, fixedClock);
  const plannedTarget = plan.items[0]!.target;
  const backup = plan.items[0]!.backup!;
  const ops: FsOps = {
    ...nodeFsOps,
    rename: async (oldPath, newPath) => {
      if (oldPath === plannedTarget && newPath === backup) {
        await fs.rename(oldPath, displacedOriginal);
        await fs.mkdir(oldPath);
      }
      await fs.rename(oldPath, newPath);
    },
  };
  const result = await applyLinkPlan(plan, ops);
  assert.equal(result.success, false);
  assert.equal(result.rolledBack, true, JSON.stringify(result));
  assert.match(result.items[0]?.error ?? "", /target identity changed/);
  assert.equal((await fs.lstat(plannedTarget)).isDirectory(), true);
  assert.equal(await readFile(displacedOriginal, "utf8"), "original target");
});

test("planning is a dry run and stale plans are rejected without losing data", async (t) => {
  const f = await fixture(t);
  const item = config("stale");
  await source(f, item);
  const targetPath = await target(f, item);
  const plan = await createLinkPlan([item], f.paths, fixedClock);
  await assert.rejects(() => fs.lstat(targetPath), /ENOENT/);
  await writeFile(targetPath, "arrived later");
  const result = await applyLinkPlan(plan);
  assert.equal(result.success, false);
  assert.match(result.items[0]?.error ?? "", /stale plan/);
  assert.equal(await readFile(targetPath, "utf8"), "arrived later");
});

test("apply failure rolls back all earlier targets", async (t) => {
  const f = await fixture(t);
  const first = config("first");
  const second = config("second");
  await Promise.all([source(f, first), source(f, second)]);
  const firstTarget = await target(f, first);
  const secondTarget = await target(f, second);
  await Promise.all([writeFile(firstTarget, "first original"), writeFile(secondTarget, "second original")]);
  const plan = await createLinkPlan([first, second], f.paths, fixedClock);
  const canonicalSecondTarget = plan.items[1]!.target;
  const operations: FsOps = {
    lstat: fs.lstat,
    readlink: fs.readlink,
    realpath: fs.realpath,
    mkdir: fs.mkdir,
    mkdirExclusive: async (path) => { await fs.mkdir(path); },
    rmdir: fs.rmdir,
    rename: fs.rename,
    rm: fs.rm,
    writeFile: fs.writeFile,
    symlink: async (sourcePath, targetPath) => {
      if (targetPath === canonicalSecondTarget) throw new Error("injected symlink failure");
      await fs.symlink(sourcePath, targetPath);
    },
  };
  const result = await applyLinkPlan(plan, operations);
  assert.equal(result.success, false);
  assert.equal(result.rolledBack, true);
  assert.deepEqual(result.rollbackErrors, []);
  assert.equal(await readFile(firstTarget, "utf8"), "first original");
  assert.equal(await readFile(secondTarget, "utf8"), "second original");
  await assert.rejects(() => fs.lstat(plan.items[0]!.backup!), /ENOENT/);
});

test("rejects lexical source and target escapes and an empty target", async (t) => {
  const f = await fixture(t);
  const outside = join(f.root, "outside");
  await writeFile(outside, "outside");
  const sourceEscape: ConfigItem = { ...config("source-escape"), source: "../outside" };
  const targetEscape: ConfigItem = { ...config("target-escape"), target: "../outside-target" };
  const rootTarget: ConfigItem = { ...config("root-target"), target: "" };
  await Promise.all([source(f, targetEscape), source(f, rootTarget)]);
  const plan = await createLinkPlan([sourceEscape, targetEscape, rootTarget], f.paths, fixedClock);
  assert.equal(plan.blocked, true);
  assert.deepEqual(plan.items.map(({ action }) => action), ["blocked", "blocked", "blocked"]);
  assert.match(plan.items[0]?.reason ?? "", /escapes repository/);
  assert.match(plan.items[1]?.reason ?? "", /escapes home/);
  assert.match(plan.items[2]?.reason ?? "", /home itself/);
});

test("rejects a source symlink whose referent escapes the repository", async (t) => {
  const f = await fixture(t);
  const item = config("escaped-referent");
  const sourcePath = join(f.repo, item.source);
  const outside = join(f.root, "outside-source");
  await mkdir(dirname(sourcePath), { recursive: true });
  await writeFile(outside, "outside");
  await symlink(outside, sourcePath);
  const plan = await createLinkPlan([item], f.paths, fixedClock);
  assert.equal(plan.items[0]?.action, "blocked");
  assert.match(plan.items[0]?.reason ?? "", /referent escapes repository/);
});

test("rejects symlinked target ancestors", async (t) => {
  const f = await fixture(t);
  const item = config("ancestor", "linked/target");
  await source(f, item);
  const outside = join(f.root, "outside-directory");
  await mkdir(outside);
  await symlink(outside, join(f.home, "linked"));
  const plan = await createLinkPlan([item], f.paths, fixedClock);
  assert.equal(plan.items[0]?.action, "blocked");
  assert.match(plan.items[0]?.reason ?? "", /symlinked target ancestor/);
});

test("rejects an existing target ancestor replaced during mkdir", async (t) => {
  const f = await fixture(t);
  const item = config("ancestor-race", "stable/new/target");
  await source(f, item);
  const stable = join(f.home, "stable");
  await mkdir(stable);
  const plan = await createLinkPlan([item], f.paths, fixedClock);
  const ops: FsOps = {
    ...nodeFsOps,
    mkdir: async (path, options) => {
      await fs.rename(stable, `${stable}.replaced`);
      await fs.mkdir(stable);
      return fs.mkdir(path, options);
    },
  };
  const result = await applyLinkPlan(plan, ops);
  assert.equal(result.success, false);
  assert.match(result.items[0]?.error ?? "", /target ancestor changed/);
  await assert.rejects(() => fs.lstat(join(f.home, item.target)), /ENOENT/);
});

test("rejects duplicate and ancestor-descendant targets", async (t) => {
  const f = await fixture(t);
  const duplicateA = config("duplicate-a", "same");
  const duplicateB = config("duplicate-b", "same");
  const parent = config("parent", "tree");
  const child = config("child", "tree/child");
  await Promise.all([duplicateA, duplicateB, parent, child].map((item) => source(f, item)));
  const plan = await createLinkPlan([duplicateA, duplicateB, parent, child], f.paths, fixedClock);
  assert.deepEqual(plan.items.map(({ action }) => action), ["blocked", "blocked", "blocked", "blocked"]);
  assert.match(plan.items[0]?.reason ?? "", /duplicate target/);
  assert.match(plan.items[2]?.reason ?? "", /target overlaps/);
});

test("rejects overlap between a target and a selected source", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "dots-overlap-"));
  const home = join(root, "home");
  const repo = join(home, "repo");
  await mkdir(join(repo, "source"), { recursive: true });
  t.after(() => rm(root, { recursive: true, force: true }));
  const item = config("inside", "repo/source");
  await writeFile(join(repo, item.source), "source");
  const plan = await createLinkPlan([item], { repo, home, path: "" }, fixedClock);
  assert.equal(plan.items[0]?.action, "blocked");
  assert.match(plan.items[0]?.reason ?? "", /overlaps selected source/);
});

test("exclusive HOME lock rejects a concurrent apply without mutation", async (t) => {
  const f = await fixture(t);
  const item = config("locked");
  await source(f, item);
  const plan = await createLinkPlan([item], f.paths, fixedClock);
  let releaseFirst: (() => void) | undefined;
  let markStarted: (() => void) | undefined;
  const started = new Promise<void>((resolvePromise) => { markStarted = resolvePromise; });
  const release = new Promise<void>((resolvePromise) => { releaseFirst = resolvePromise; });
  const slowOps: FsOps = {
    ...nodeFsOps,
    symlink: async (sourcePath, targetPath) => {
      markStarted?.();
      await release;
      await fs.symlink(sourcePath, targetPath);
    },
  };
  const first = applyLinkPlan(plan, slowOps);
  await started;
  const second = await applyLinkPlan(plan);
  assert.equal(second.success, false);
  assert.match(second.items[0]?.error ?? "", /apply lock unavailable/);
  await assert.rejects(() => fs.lstat(plan.items[0]!.target), /ENOENT/);
  releaseFirst?.();
  assert.equal((await first).success, true);
});

test("apply lock metadata is written before mutation and removed after rollback", async (t) => {
  const f = await fixture(t);
  const item = config("metadata");
  await source(f, item);
  const plan = await createLinkPlan([item], f.paths, fixedClock);
  let metadata: unknown;
  const ops: FsOps = {
    ...nodeFsOps,
    symlink: async (sourcePath, targetPath) => {
      metadata = JSON.parse(await readFile(join(f.home, ".dots-apply.lock", "owner.json"), "utf8"));
      await fs.symlink(sourcePath, targetPath);
    },
  };
  assert.equal((await applyLinkPlan(plan, ops)).success, true);
  assert.deepEqual(metadata, {
    schemaVersion: 2, version: "dots-lock-v2", pid: process.pid,
    startedAt: (metadata as { startedAt: string }).startedAt,
    processBirthIdentity: (metadata as { processBirthIdentity: string }).processBirthIdentity,
    nonce: (metadata as { nonce: string }).nonce,
  });
  assert.equal(Number.isFinite(Date.parse((metadata as { startedAt: string }).startedAt)), true);
  assert.ok((metadata as { nonce: string }).nonce.length >= 16);
  assert.equal((await inspectApplyLock(f.home)).state, "clear");
});

test("metadata write failure aborts before mutation and cleans the lock", async (t) => {
  const f = await fixture(t);
  const item = config("metadata-failure");
  await source(f, item);
  const plan = await createLinkPlan([item], f.paths, fixedClock);
  let mutations = 0;
  const ops: FsOps = {
    ...nodeFsOps,
    writeFile: async () => { throw new Error("injected metadata failure"); },
    symlink: async () => { mutations += 1; },
  };
  const result = await applyLinkPlan(plan, ops);
  assert.equal(result.success, false);
  assert.equal(mutations, 0);
  assert.match(result.items[0]?.error ?? "", /metadata/);
  assert.equal((await inspectApplyLock(f.home)).state, "clear");
});

test("lock inspection and unlock distinguish active, stale, unknown, and replacement races", async (t) => {
  const f = await fixture(t);
  const lock = join(f.home, ".dots-apply.lock");
  await mkdir(lock);
  await writeFile(join(lock, "owner.json"), JSON.stringify({ schemaVersion: 2, version: "dots-lock-v2", pid: 999999, startedAt: new Date().toISOString(), processBirthIdentity: "old", nonce: "1234567890abcdef" }));
  const stale = await inspectApplyLock(f.home, nodeLockOps, async () => undefined);
  assert.equal(stale.state, "stale");
  await unlockApplyLock(stale, false);
  assert.equal((await inspectApplyLock(f.home)).state, "clear");

  await mkdir(lock);
  await writeFile(join(lock, "owner.json"), JSON.stringify({ schemaVersion: 2, version: "dots-lock-v2", pid: process.pid, startedAt: new Date().toISOString(), processBirthIdentity: "same", nonce: "1234567890abcdef" }));
  const active = await inspectApplyLock(f.home, nodeLockOps, async () => "same");
  assert.equal(active.state, "active");
  await assert.rejects(() => unlockApplyLock(active, true), /active/);
  await rm(lock, { recursive: true });

  await mkdir(lock);
  const unknown = await inspectApplyLock(f.home);
  assert.equal(unknown.state, "unknown");
  await assert.rejects(() => unlockApplyLock(unknown, false), /--force/);
  await unlockApplyLock(unknown, true);

  await mkdir(lock);
  await writeFile(join(lock, "owner.json"), JSON.stringify({ schemaVersion: 2, version: "dots-lock-v2", pid: 999999, startedAt: new Date().toISOString(), processBirthIdentity: "old", nonce: "1234567890abcdef" }));
  const raced = await inspectApplyLock(f.home, nodeLockOps, async () => undefined);
  const raceOps = {
    ...nodeLockOps,
    rename: async (oldPath: string, newPath: string) => {
      await writeFile(join(oldPath, "owner.json"), "changed");
      await nodeLockOps.rename(oldPath, newPath);
    },
  };
  await assert.rejects(() => unlockApplyLock(raced, false, raceOps), /changed during unlock/);
  assert.notEqual((await inspectApplyLock(f.home)).state, "clear");
});

test("v2 lock identity detects PID reuse and lookup failure while v1 remains unknown", async (t) => {
  const f = await fixture(t);
  const lock = join(f.home, ".dots-apply.lock");
  const owner = join(lock, "owner.json");
  await mkdir(lock);
  await writeFile(owner, JSON.stringify({ schemaVersion: 2, version: "dots-lock-v2", pid: 42, startedAt: new Date().toISOString(), processBirthIdentity: "birth-a", nonce: "1234567890abcdef" }));
  assert.equal((await inspectApplyLock(f.home, nodeLockOps, async () => "birth-a")).state, "active");
  assert.equal((await inspectApplyLock(f.home, nodeLockOps, async () => "birth-b")).state, "stale");
  assert.equal((await inspectApplyLock(f.home, nodeLockOps, async () => undefined)).state, "stale");
  assert.equal((await inspectApplyLock(f.home, nodeLockOps, async () => { throw new Error("ps unavailable"); })).state, "unknown");
  await writeFile(owner, JSON.stringify({ schemaVersion: 1, version: "dots-lock-v1", pid: 42, startedAt: new Date().toISOString() }));
  assert.equal((await inspectApplyLock(f.home, nodeLockOps, async () => "birth-a")).state, "unknown");
});

test("normal cleanup never removes a replacement lock", async (t) => {
  const f = await fixture(t);
  const item = config("replacement-lock");
  await source(f, item);
  const plan = await createLinkPlan([item], f.paths, fixedClock);
  const lock = join(f.home, ".dots-apply.lock");
  const displaced = `${lock}.apply-a`;
  const replacement = { schemaVersion: 2, version: "dots-lock-v2", pid: 99, startedAt: new Date().toISOString(), processBirthIdentity: "apply-b", nonce: "abcdef1234567890" };
  const ops: FsOps = {
    ...nodeFsOps,
    symlink: async (sourcePath, targetPath) => {
      await nodeFsOps.symlink(sourcePath, targetPath);
      await nodeFsOps.rename(lock, displaced);
      await nodeFsOps.mkdirExclusive(lock);
      await nodeFsOps.writeFile(join(lock, "owner.json"), `${JSON.stringify(replacement)}\n`, { flag: "wx", mode: 0o600 });
    },
  };
  const result = await applyLinkPlan(plan, ops, async () => "apply-a");
  assert.equal(result.success, false);
  assert.match(result.lockCleanupError ?? "", /ownership changed/);
  assert.deepEqual(JSON.parse(await readFile(join(lock, "owner.json"), "utf8")), replacement);
  assert.equal((await inspectApplyLock(f.home, nodeLockOps, async () => "apply-b")).state, "active");
  const excluded = await applyLinkPlan(await createLinkPlan([item], f.paths, fixedClock), nodeFsOps, async () => "apply-c");
  assert.equal(excluded.success, false);
  assert.match(excluded.items[0]?.error ?? "", /lock unavailable/);
});

test("lock cleanup failures are reported", async (t) => {
  const f = await fixture(t);
  const item = config("lock-cleanup");
  await source(f, item);
  const plan = await createLinkPlan([item], f.paths, fixedClock);
  const ops: FsOps = {
    ...nodeFsOps,
    rename: async (oldPath, newPath) => {
      if (oldPath.endsWith(".dots-apply.lock")) throw new Error("injected lock cleanup failure");
      await nodeFsOps.rename(oldPath, newPath);
    },
  };
  const result = await applyLinkPlan(plan, ops);
  assert.equal(result.success, false);
  assert.equal(result.recoveryRequired, false);
  assert.match(result.lockCleanupError ?? "", /lock cleanup failed/);
  const leftover = await inspectApplyLock(f.home, nodeLockOps, async () => "different-birth");
  assert.equal(leftover.state, "stale");
  await unlockApplyLock(leftover, true);
  assert.equal((await applyLinkPlan(await createLinkPlan([item], f.paths, fixedClock))).success, true);
});

test("rollback preserves a target replaced after creation and reports recovery", async (t) => {
  const f = await fixture(t);
  const first = config("replace-target-first");
  const second = config("replace-target-second");
  await Promise.all([source(f, first), source(f, second)]);
  await Promise.all([writeFile(await target(f, first), "first original"), writeFile(await target(f, second), "second original")]);
  const plan = await createLinkPlan([first, second], f.paths, fixedClock);
  const firstTarget = plan.items[0]!.target;
  const secondTarget = plan.items[1]!.target;
  const ops: FsOps = {
    ...nodeFsOps,
    symlink: async (sourcePath, targetPath) => {
      if (targetPath === secondTarget) {
        await fs.rm(firstTarget, { force: true });
        await writeFile(firstTarget, "unrelated replacement");
        throw new Error("injected failure");
      }
      await fs.symlink(sourcePath, targetPath);
    },
  };
  const result = await applyLinkPlan(plan, ops);
  assert.equal(result.recoveryRequired, true);
  assert.equal(result.rolledBack, false);
  assert.equal(await readFile(firstTarget, "utf8"), "unrelated replacement");
  assert.equal(await readFile(plan.items[0]!.backup!, "utf8"), "first original");
  assert.match(result.rollbackErrors.join("\n"), /created target.*manual recovery/);
});

test("rollback preserves a replaced backup and never overwrites it", async (t) => {
  const f = await fixture(t);
  const first = config("replace-backup-first");
  const second = config("replace-backup-second");
  await Promise.all([source(f, first), source(f, second)]);
  await Promise.all([writeFile(await target(f, first), "first original"), writeFile(await target(f, second), "second original")]);
  const plan = await createLinkPlan([first, second], f.paths, fixedClock);
  const firstBackup = plan.items[0]!.backup!;
  const secondTarget = plan.items[1]!.target;
  const ops: FsOps = {
    ...nodeFsOps,
    symlink: async (sourcePath, targetPath) => {
      if (targetPath === secondTarget) {
        await fs.rm(firstBackup, { force: true });
        await writeFile(firstBackup, "unrelated backup replacement");
        throw new Error("injected failure");
      }
      await fs.symlink(sourcePath, targetPath);
    },
  };
  const result = await applyLinkPlan(plan, ops);
  assert.equal(result.recoveryRequired, true);
  assert.equal(await readFile(firstBackup, "utf8"), "unrelated backup replacement");
  await assert.rejects(() => fs.lstat(plan.items[0]!.target), /ENOENT/);
  assert.match(result.rollbackErrors.join("\n"), /backup changed.*manual recovery/);
});

test("human apply output includes backup and safety warnings", () => {
  const output = renderApply({
    success: false,
    rolledBack: false,
    recoveryRequired: true,
    createdParentsMayRemain: true,
    rollbackErrors: ["manual recovery from /safe/backup"],
    items: [{ id: "x", action: "backup-and-link", target: "/safe/target", backup: "/safe/backup", outcome: "failed" }],
  });
  assert.match(output, /backup=\/safe\/backup/);
  assert.match(output, /manual recovery is required/);
  assert.match(output, /empty parent directories may remain/);
});

test("human apply output shortens embedded HOME paths without changing control escaping", () => {
  const home = "/Users/test";
  const output = renderApply({
    success: false,
    rolledBack: false,
    recoveryRequired: true,
    createdParentsMayRemain: false,
    rollbackErrors: [`recover ${home}/.config/a\ncarefully`],
    items: [{ id: "x", action: "backup-and-link", target: `${home}/.config/a`, backup: `${home}/backup`, outcome: "failed", error: `failed at ${home}/.config/a` }],
  }, home);
  assert.match(output, /target=~\/\.config\/a backup=~\/backup/);
  assert.match(output, /recover ~\/\.config\/a\\u\{0a\}carefully/);
  assert.doesNotMatch(output, /\/Users\/test/);
});

test("human output distinguishes lock cleanup from data recovery", () => {
  const output = renderApply({
    success: false,
    rolledBack: false,
    recoveryRequired: false,
    lockCleanupError: "/home/.dots-apply.lock: lock cleanup failed",
    createdParentsMayRemain: false,
    rollbackErrors: [],
    items: [{ id: "x", action: "create", target: "/home/x", outcome: "applied" }],
  });
  assert.match(output, /Apply completed, but the transaction lock could not be removed/);
  assert.match(output, /LOCK CLEANUP ERROR/);
  assert.doesNotMatch(output, /manual recovery is required/);
});

test("blocked plans never start mutations", async (t) => {
  const f = await fixture(t);
  const valid = config("valid");
  const missing = config("missing");
  await source(f, valid);
  const plan = await createLinkPlan([valid, missing], f.paths, fixedClock);
  assert.equal(plan.blocked, true);
  assert.deepEqual(plan.items.map(({ action }) => action), ["create", "blocked"]);
  const result = await applyLinkPlan(plan);
  assert.equal(result.success, false);
  await assert.rejects(() => fs.lstat(join(f.home, valid.target)), /ENOENT/);
});

test("plan selectors require enabled ids while --all selects enabled items", async (t) => {
  const f = await fixture(t);
  const enabled = config("enabled");
  const disabled = config("disabled", "target/disabled", false);
  await source(f, enabled);
  const service = new DotsService(f.paths, { items: [enabled, disabled], dependencies: [] });
  assert.deepEqual((await service.plan([], true, fixedClock)).items.map(({ id }) => id), ["enabled"]);
  await assert.rejects(() => service.plan(["disabled"], false, fixedClock), /unavailable/i);
});

test("CLI enforces selectors and non-TTY confirmation, while --yes applies", async (t) => {
  const f = await fixture(t);
  const sourcePath = join(f.repo, ".config/zsh/.zshrc");
  await mkdir(dirname(sourcePath), { recursive: true });
  await writeFile(sourcePath, "zsh");
  const cli = join(import.meta.dirname, "../src/cli.ts");
  const env = { ...process.env, HOME: f.home, DOTFILES_DIR: f.repo, NO_COLOR: "1" };
  delete env.FORCE_COLOR;
  await assert.rejects(
    () => execFileAsync(process.execPath, ["--import", "tsx", cli, "link", "zshrc"], { env }),
    (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === 2,
  );
  await assert.rejects(
    () => execFileAsync(process.execPath, ["--import", "tsx", cli, "plan"], { env }),
    (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === 2,
  );
  const dryRun = await execFileAsync(process.execPath, ["--import", "tsx", cli, "link", "zshrc", "--dry-run", "--json"], { env });
  assert.equal(JSON.parse(dryRun.stdout).items[0].action, "create");
  assert.match(dryRun.stderr, /deprecated/);
  await assert.rejects(() => fs.lstat(join(f.home, ".zshrc")), /ENOENT/);
  const applied = await execFileAsync(process.execPath, ["--import", "tsx", cli, "link", "zshrc", "--yes", "--json"], { env });
  assert.equal(JSON.parse(applied.stdout).summary.success, true);
  assert.match(applied.stderr, /deprecated/);
  assert.equal(await realpath(join(f.home, ".zshrc")), await realpath(sourcePath));
});
