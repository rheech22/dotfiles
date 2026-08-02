import * as fs from "node:fs/promises";
import type { BigIntStats } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type {
  ApplyItemResult,
  ApplyResult,
  Fingerprint,
  LinkPlan,
  LinkPlanItem,
  PathPrecondition,
  RuntimePaths,
} from "./domain.js";
import type { ConfigItem } from "./manifest.js";

export interface FsOps {
  lstat(path: string, options: { bigint: true }): Promise<BigIntStats>;
  readlink(path: string): Promise<string>;
  realpath(path: string): Promise<string>;
  mkdir(path: string, options: { recursive: true }): Promise<string | undefined>;
  mkdirExclusive(path: string): Promise<void>;
  rmdir(path: string): Promise<void>;
  rename(oldPath: string, newPath: string): Promise<void>;
  symlink(target: string, path: string): Promise<void>;
  rm(path: string, options: { force: true; recursive?: true }): Promise<void>;
  writeFile(path: string, data: string, options: { flag: "wx"; mode: number }): Promise<void>;
  readFile(path: string, encoding: "utf8"): Promise<string>;
}

export const nodeFsOps: FsOps = {
  lstat: fs.lstat,
  readlink: fs.readlink,
  realpath: fs.realpath,
  mkdir: fs.mkdir,
  mkdirExclusive: async (path) => { await fs.mkdir(path); },
  rmdir: fs.rmdir,
  rename: fs.rename,
  symlink: fs.symlink,
  rm: fs.rm,
  writeFile: fs.writeFile,
  readFile: fs.readFile,
};

const LOCK_NAME = ".dots-apply.lock";
const LOCK_METADATA = "owner.json";

export interface ApplyLockMetadataV1 {
  readonly schemaVersion: 1;
  readonly version: "dots-lock-v1";
  readonly pid: number;
  readonly startedAt: string;
}

export interface ApplyLockMetadata {
  readonly schemaVersion: 2;
  readonly version: "dots-lock-v2";
  readonly pid: number;
  readonly startedAt: string;
  readonly processBirthIdentity: string;
  readonly nonce: string;
}

type ParsedLockMetadata = ApplyLockMetadata | ApplyLockMetadataV1;
export type ProcessIdentityProvider = (pid: number) => Promise<string | undefined>;

export type ApplyLockState = "clear" | "active" | "stale" | "unknown";

export interface ApplyLockInspection {
  readonly state: ApplyLockState;
  readonly path: string;
  readonly metadata?: ApplyLockMetadata;
  readonly reason?: string;
  readonly directoryFingerprint?: Fingerprint;
  readonly metadataFingerprint?: Fingerprint;
}

export interface LockOps {
  lstat(path: string, options: { bigint: true }): Promise<BigIntStats>;
  readFile(path: string, encoding: "utf8"): Promise<string>;
  rename(oldPath: string, newPath: string): Promise<void>;
  rm(path: string, options: { recursive: true; force: true }): Promise<void>;
}

export const nodeLockOps: LockOps = { lstat: fs.lstat, readFile: fs.readFile, rename: fs.rename, rm: fs.rm };

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code
    : undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function fingerprint(path: string, ops: FsOps): Promise<Fingerprint> {
  try {
    const stat = await ops.lstat(path, { bigint: true });
    const kind = stat.isSymbolicLink() ? "symlink"
      : stat.isFile() ? "file"
      : stat.isDirectory() ? "directory"
      : "other";
    const base = {
      kind,
      dev: stat.dev.toString(),
      ino: stat.ino.toString(),
      mode: Number(stat.mode),
      size: stat.size.toString(),
      mtimeNs: stat.mtimeNs.toString(),
      ctimeNs: stat.ctimeNs.toString(),
      birthtimeNs: stat.birthtimeNs.toString(),
    } as const;
    return kind === "symlink" ? { ...base, linkTarget: await ops.readlink(path) } : base;
  } catch (error: unknown) {
    if (errorCode(error) === "ENOENT") return { kind: "missing" };
    throw error;
  }
}

async function lockFingerprint(path: string, ops: Pick<LockOps, "lstat">): Promise<Fingerprint> {
  try {
    const stat = await ops.lstat(path, { bigint: true });
    const kind = stat.isSymbolicLink() ? "symlink" : stat.isFile() ? "file" : stat.isDirectory() ? "directory" : "other";
    return {
      kind, dev: stat.dev.toString(), ino: stat.ino.toString(), mode: Number(stat.mode), size: stat.size.toString(),
      mtimeNs: stat.mtimeNs.toString(), ctimeNs: stat.ctimeNs.toString(), birthtimeNs: stat.birthtimeNs.toString(),
    };
  } catch (error: unknown) {
    if (errorCode(error) === "ENOENT") return { kind: "missing" };
    throw error;
  }
}

function parseLockMetadata(value: string): ParsedLockMetadata | undefined {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") return undefined;
    const metadata = parsed as Record<string, unknown>;
    if (!Number.isSafeInteger(metadata.pid) || (metadata.pid as number) <= 0
      || typeof metadata.startedAt !== "string" || !Number.isFinite(Date.parse(metadata.startedAt))) return undefined;
    if (metadata.schemaVersion === 1 && metadata.version === "dots-lock-v1") return metadata as unknown as ApplyLockMetadataV1;
    if (metadata.schemaVersion !== 2 || metadata.version !== "dots-lock-v2"
      || typeof metadata.processBirthIdentity !== "string" || metadata.processBirthIdentity.length === 0
      || typeof metadata.nonce !== "string" || metadata.nonce.length < 16) return undefined;
    return metadata as unknown as ApplyLockMetadata;
  } catch {
    return undefined;
  }
}

const execFileAsync = promisify(execFile);

export const processBirthIdentity: ProcessIdentityProvider = async (pid) => {
  try {
    const { stdout } = await execFileAsync("/bin/ps", ["-o", "lstart=", "-p", String(pid)], {
      encoding: "utf8", timeout: 5_000, maxBuffer: 64 * 1024,
    });
    const identity = stdout.trim().replace(/\s+/g, " ");
    return identity || undefined;
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 1) return undefined;
    throw error;
  }
};

export async function inspectApplyLock(
  home: string,
  ops: LockOps = nodeLockOps,
  identityProvider: ProcessIdentityProvider = processBirthIdentity,
): Promise<ApplyLockInspection> {
  const path = resolve(home, LOCK_NAME);
  const directoryFingerprint = await lockFingerprint(path, ops);
  if (directoryFingerprint.kind === "missing") return { state: "clear", path };
  if (directoryFingerprint.kind !== "directory") {
    return {
      state: "unknown", path, reason: "lock path is not a directory", directoryFingerprint,
      metadataFingerprint: { kind: "missing" },
    };
  }
  const metadataPath = resolve(path, LOCK_METADATA);
  const metadataFingerprint = await lockFingerprint(metadataPath, ops);
  if (metadataFingerprint.kind !== "file") {
    return { state: "unknown", path, reason: "lock metadata is missing or not a file", directoryFingerprint, metadataFingerprint };
  }
  let raw: string;
  try {
    raw = await ops.readFile(metadataPath, "utf8");
  } catch (error: unknown) {
    return { state: "unknown", path, reason: `lock metadata cannot be read: ${errorMessage(error)}`, directoryFingerprint, metadataFingerprint };
  }
  const metadata = parseLockMetadata(raw);
  if (!metadata) return { state: "unknown", path, reason: "lock metadata is invalid", directoryFingerprint, metadataFingerprint };
  if (metadata.schemaVersion === 1) {
    return { state: "unknown", path, reason: "legacy v1 lock has no process birth identity", directoryFingerprint, metadataFingerprint };
  }
  let currentIdentity: string | undefined;
  try {
    currentIdentity = await identityProvider(metadata.pid);
  } catch (error: unknown) {
    return { state: "unknown", path, metadata, reason: `process birth identity lookup failed: ${errorMessage(error)}`, directoryFingerprint, metadataFingerprint };
  }
  return {
    state: currentIdentity === undefined || currentIdentity !== metadata.processBirthIdentity ? "stale" : "active",
    path,
    metadata,
    directoryFingerprint,
    metadataFingerprint,
  };
}

export async function unlockApplyLock(
  inspection: ApplyLockInspection,
  force: boolean,
  ops: LockOps = nodeLockOps,
): Promise<void> {
  if (inspection.state === "clear") return;
  if (inspection.state === "active") throw new Error(`active apply lock owned by pid ${inspection.metadata?.pid ?? "unknown"}`);
  if (inspection.state === "unknown" && !force) throw new Error("unknown apply lock requires --force");
  if (!inspection.directoryFingerprint || !inspection.metadataFingerprint) throw new Error("lock inspection is incomplete");
  const currentDirectory = await lockFingerprint(inspection.path, ops);
  const currentMetadata = await lockFingerprint(resolve(inspection.path, LOCK_METADATA), ops);
  if (!sameFingerprint(currentDirectory, inspection.directoryFingerprint)
    || !sameFingerprint(currentMetadata, inspection.metadataFingerprint)) throw new Error("apply lock changed since inspection; refusing to remove it");
  const quarantine = `${inspection.path}.unlock-${process.pid}-${randomUUID()}`;
  await ops.rename(inspection.path, quarantine);
  const movedDirectory = await lockFingerprint(quarantine, ops);
  const directoryMatches = inspection.directoryFingerprint.kind === "directory"
    ? sameDirectoryIdentity(movedDirectory, inspection.directoryFingerprint)
    : sameEntryIdentity(movedDirectory, inspection.directoryFingerprint);
  const metadataMatches = inspection.directoryFingerprint.kind !== "directory"
    || sameFingerprint(await lockFingerprint(resolve(quarantine, LOCK_METADATA), ops), inspection.metadataFingerprint);
  if (!directoryMatches || !metadataMatches) {
    try {
      if ((await lockFingerprint(inspection.path, ops)).kind === "missing") await ops.rename(quarantine, inspection.path);
    } catch {
      // Preserve both paths for manual recovery rather than deleting uncertain ownership.
    }
    throw new Error("apply lock changed during unlock; refusing to remove it");
  }
  await ops.rm(quarantine, { recursive: true, force: true });
}

function sameFingerprint(left: Fingerprint, right: Fingerprint): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sameEntryIdentity(left: Fingerprint, right: Fingerprint): boolean {
  if (left.kind === "missing" || right.kind === "missing") return left.kind === right.kind;
  return left.kind === right.kind
    && left.dev === right.dev
    && left.ino === right.ino
    && left.mode === right.mode
    && left.size === right.size
    && left.mtimeNs === right.mtimeNs
    && left.birthtimeNs === right.birthtimeNs
    && left.linkTarget === right.linkTarget;
}

function sameDirectoryIdentity(left: Fingerprint, right: Fingerprint): boolean {
  return left.kind === "directory" && right.kind === "directory"
    && left.dev === right.dev && left.ino === right.ino && left.mode === right.mode;
}

function isStrictlyWithin(root: string, path: string): boolean {
  const relation = relative(root, path);
  return relation.length > 0 && relation !== ".." && !relation.startsWith(`..${sep}`) && !isAbsolute(relation);
}

function overlaps(left: string, right: string): boolean {
  return left === right || isStrictlyWithin(left, right) || isStrictlyWithin(right, left);
}

function timestamp(date: Date): string {
  const part = (value: number): string => value.toString().padStart(2, "0");
  return `${date.getFullYear()}${part(date.getMonth() + 1)}${part(date.getDate())}_${part(date.getHours())}${part(date.getMinutes())}${part(date.getSeconds())}`;
}

async function targetAncestors(home: string, target: string, ops: FsOps): Promise<readonly PathPrecondition[]> {
  const paths: string[] = [home];
  const parts = relative(home, dirname(target)).split(sep).filter(Boolean);
  let current = home;
  for (const part of parts) {
    current = resolve(current, part);
    paths.push(current);
  }
  const conditions: PathPrecondition[] = [];
  for (const path of paths) {
    const entry = await fingerprint(path, ops);
    if (entry.kind === "symlink") throw new Error(`symlinked target ancestor: ${path}`);
    if (entry.kind !== "missing" && entry.kind !== "directory") throw new Error(`non-directory target ancestor: ${path}`);
    conditions.push({ path, fingerprint: entry });
  }
  return conditions;
}

async function resolvesTo(source: string, target: string, ops: FsOps): Promise<boolean> {
  try {
    return await ops.realpath(source) === await ops.realpath(target);
  } catch {
    return false;
  }
}

interface Draft {
  readonly item: ConfigItem;
  readonly source: string;
  readonly target: string;
  readonly targetPrecondition: Fingerprint;
  readonly targetAncestorPreconditions: readonly PathPrecondition[];
  sourcePrecondition?: Fingerprint;
  sourceReferent?: string;
  sourceReferentPrecondition?: Fingerprint;
  action: LinkPlanItem["action"];
  reason?: string;
  backup?: string;
}

function block(draft: Draft, reason: string): void {
  draft.action = "blocked";
  draft.reason = draft.reason ? `${draft.reason}; ${reason}` : reason;
  delete draft.backup;
}

export async function createLinkPlan(
  items: readonly ConfigItem[],
  paths: RuntimePaths,
  now: () => Date = () => new Date(),
  ops: FsOps = nodeFsOps,
): Promise<LinkPlan> {
  const [repo, home] = await Promise.all([ops.realpath(paths.repo), ops.realpath(paths.home)]);
  const date = now();
  const stamp = timestamp(date);
  const drafts: Draft[] = [];
  for (const item of items) {
    const source = resolve(repo, item.source);
    const target = resolve(home, item.target);
    let targetPrecondition: Fingerprint = { kind: "missing" };
    let ancestors: readonly PathPrecondition[] = [];
    let setupError: string | undefined;
    try {
      if (!isStrictlyWithin(repo, source)) throw new Error(`source escapes repository: ${item.source}`);
      if (!isStrictlyWithin(home, target)) throw new Error(`target escapes home or is home itself: ${item.target}`);
      targetPrecondition = await fingerprint(target, ops);
      ancestors = await targetAncestors(home, target, ops);
    } catch (error: unknown) {
      setupError = errorMessage(error);
    }
    const draft: Draft = { item, source, target, targetPrecondition, targetAncestorPreconditions: ancestors, action: "blocked" };
    drafts.push(draft);
    if (setupError) {
      block(draft, setupError);
      continue;
    }
    if (item.enabled === false) {
      block(draft, item.disabledReason ?? "disabled");
      continue;
    }
    try {
      draft.sourcePrecondition = await fingerprint(source, ops);
      if (draft.sourcePrecondition.kind === "missing") throw new Error("source missing");
      draft.sourceReferent = await ops.realpath(source);
      if (!isStrictlyWithin(repo, draft.sourceReferent)) throw new Error(`source referent escapes repository: ${draft.sourceReferent}`);
      draft.sourceReferentPrecondition = await fingerprint(draft.sourceReferent, ops);
      if (draft.sourceReferentPrecondition.kind === "missing") throw new Error("source referent missing");
    } catch (error: unknown) {
      block(draft, `source error: ${errorMessage(error)}`);
      continue;
    }
    if (targetPrecondition.kind === "missing") draft.action = "create";
    else if (targetPrecondition.kind === "symlink") draft.action = await resolvesTo(draft.sourceReferent, target, ops) ? "noop" : "replace-link";
    else draft.action = "backup-and-link";
  }

  for (let leftIndex = 0; leftIndex < drafts.length; leftIndex += 1) {
    const left = drafts[leftIndex]!;
    if (overlaps(left.target, resolve(home, ".dots-apply.lock"))) block(left, "target overlaps apply lock path");
    if (left.target === left.source || left.target === left.sourceReferent) block(left, "source and target are the same path");
    if (isStrictlyWithin(left.target, repo)) block(left, "target contains repository");
    for (const sourceDraft of drafts) {
      if (overlaps(left.target, sourceDraft.source) || (sourceDraft.sourceReferent && overlaps(left.target, sourceDraft.sourceReferent))) {
        block(left, `target overlaps selected source: ${sourceDraft.item.id}`);
      }
    }
    for (let rightIndex = leftIndex + 1; rightIndex < drafts.length; rightIndex += 1) {
      const right = drafts[rightIndex]!;
      if (left.target === right.target) {
        block(left, `duplicate target with ${right.item.id}`);
        block(right, `duplicate target with ${left.item.id}`);
      } else if (overlaps(left.target, right.target)) {
        block(left, `target overlaps ${right.item.id}`);
        block(right, `target overlaps ${left.item.id}`);
      }
    }
  }

  const reserved = new Set(drafts.flatMap((draft) => [draft.source, draft.target, ...(draft.sourceReferent ? [draft.sourceReferent] : [])]));
  for (const draft of drafts) {
    if (draft.action !== "backup-and-link" && draft.action !== "replace-link") continue;
    const base = `${draft.target}.backup.${stamp}`;
    let candidate = base;
    let suffix = 1;
    while ([...reserved].some((path) => overlaps(candidate, path)) || (await fingerprint(candidate, ops)).kind !== "missing") {
      candidate = `${base}.${suffix++}`;
    }
    draft.backup = candidate;
    reserved.add(candidate);
  }

  const planned: LinkPlanItem[] = drafts.map((draft) => {
    const base = {
      id: draft.item.id,
      description: draft.item.description,
      source: draft.source,
      target: draft.target,
      action: draft.action,
      targetPrecondition: draft.targetPrecondition,
      targetAncestorPreconditions: draft.targetAncestorPreconditions,
    };
    return {
      ...base,
      ...(draft.reason === undefined ? {} : { reason: draft.reason }),
      ...(draft.backup === undefined ? {} : { backup: draft.backup }),
      ...(draft.sourcePrecondition === undefined ? {} : { sourcePrecondition: draft.sourcePrecondition }),
      ...(draft.sourceReferent === undefined ? {} : { sourceReferent: draft.sourceReferent }),
      ...(draft.sourceReferentPrecondition === undefined ? {} : { sourceReferentPrecondition: draft.sourceReferentPrecondition }),
    };
  });
  return { createdAt: date.toISOString(), home, repo, items: planned, blocked: planned.some(({ action }) => action === "blocked") };
}

async function validateSource(item: LinkPlanItem, ops: FsOps): Promise<void> {
  if (!item.sourcePrecondition || !item.sourceReferent || !item.sourceReferentPrecondition) throw new Error("plan lacks source preconditions");
  if (!sameFingerprint(await fingerprint(item.source, ops), item.sourcePrecondition)) throw new Error("stale plan: source entry changed");
  if (await ops.realpath(item.source) !== item.sourceReferent) throw new Error("stale plan: source referent changed");
  if (!sameFingerprint(await fingerprint(item.sourceReferent, ops), item.sourceReferentPrecondition)) throw new Error("stale plan: source referent metadata changed");
}

async function validateAncestors(
  conditions: readonly PathPrecondition[],
  afterMkdir: boolean,
  canonicalHome: string,
  expected: ReadonlyMap<string, Fingerprint>,
  ops: FsOps,
): Promise<void> {
  const firstMissing = conditions.findIndex((condition) => (expected.get(condition.path) ?? condition.fingerprint).kind === "missing");
  for (const condition of conditions) {
    const index = conditions.indexOf(condition);
    const current = await fingerprint(condition.path, ops);
    if (current.kind === "symlink") throw new Error(`unsafe symlinked target ancestor: ${condition.path}`);
    if (condition.path === canonicalHome) {
      if (current.kind !== "directory" || await ops.realpath(condition.path) !== canonicalHome) {
        throw new Error(`canonical home changed: ${condition.path}`);
      }
    } else if (afterMkdir && firstMissing >= 0 && index >= firstMissing) {
      if (current.kind !== "directory") throw new Error(`target ancestor was not safely created: ${condition.path}`);
    } else if (afterMkdir) {
      if (!sameDirectoryIdentity(current, expected.get(condition.path) ?? condition.fingerprint)) {
        throw new Error(`stale plan: target ancestor changed: ${condition.path}`);
      }
    } else if (!sameFingerprint(current, expected.get(condition.path) ?? condition.fingerprint)) {
      throw new Error(`stale plan: target ancestor changed: ${condition.path}`);
    }
  }
}

async function refreshAncestorExpectations(expected: Map<string, Fingerprint>, ops: FsOps): Promise<void> {
  for (const path of expected.keys()) expected.set(path, await fingerprint(path, ops));
}

interface Mutation {
  readonly index: number;
  readonly target: string;
  readonly backup?: string;
  linkCreated: boolean;
  backupMoved: boolean;
  linkFingerprint?: Fingerprint;
  backupFingerprint?: Fingerprint;
}

function itemResult(item: LinkPlanItem, outcome: ApplyItemResult["outcome"], error?: string): ApplyItemResult {
  return {
    id: item.id,
    action: item.action,
    target: item.target,
    ...(item.backup === undefined ? {} : { backup: item.backup }),
    outcome,
    ...(error === undefined ? {} : { error }),
  };
}

export async function applyLinkPlan(
  plan: LinkPlan,
  ops: FsOps = nodeFsOps,
  identityProvider: ProcessIdentityProvider = processBirthIdentity,
): Promise<ApplyResult> {
  const notStarted = (): readonly ApplyItemResult[] => plan.items.map((item) => itemResult(item, "not-started"));
  if (plan.blocked || plan.items.some(({ action }) => action === "blocked")) {
    return { success: false, rolledBack: false, recoveryRequired: false, items: notStarted(), rollbackErrors: [], createdParentsMayRemain: false };
  }
  const lock = resolve(plan.home, LOCK_NAME);
  let birthIdentity: string | undefined;
  try {
    birthIdentity = await identityProvider(process.pid);
    if (!birthIdentity) throw new Error("current process was not found");
  } catch (error: unknown) {
    const message = `apply lock process identity unavailable: ${errorMessage(error)}`;
    return { success: false, rolledBack: false, recoveryRequired: false, items: plan.items.map((item) => itemResult(item, "not-started", message)), rollbackErrors: [], createdParentsMayRemain: false };
  }
  try {
    await ops.mkdirExclusive(lock);
  } catch (error: unknown) {
    const message = `apply lock unavailable at ${lock}: ${errorMessage(error)}`;
    return {
      success: false,
      rolledBack: false,
      recoveryRequired: false,
      items: plan.items.map((item) => itemResult(item, "not-started", message)),
      rollbackErrors: [],
      createdParentsMayRemain: false,
    };
  }
  const lockMetadata: ApplyLockMetadata = {
    schemaVersion: 2,
    version: "dots-lock-v2",
    pid: process.pid,
    startedAt: new Date().toISOString(),
    processBirthIdentity: birthIdentity,
    nonce: randomUUID(),
  };
  try {
    await ops.writeFile(resolve(lock, LOCK_METADATA), `${JSON.stringify(lockMetadata)}\n`, { flag: "wx", mode: 0o600 });
  } catch (error: unknown) {
    const message = `apply lock metadata unavailable at ${lock}: ${errorMessage(error)}`;
    try {
      await ops.rm(resolve(lock, LOCK_METADATA), { force: true });
      await ops.rmdir(lock);
    } catch (cleanupError: unknown) {
      return {
        success: false, rolledBack: false, recoveryRequired: false,
        items: plan.items.map((item) => itemResult(item, "not-started", `${message}; lock cleanup failed: ${errorMessage(cleanupError)}`)),
        rollbackErrors: [], createdParentsMayRemain: false,
      };
    }
    return {
      success: false, rolledBack: false, recoveryRequired: false,
      items: plan.items.map((item) => itemResult(item, "not-started", message)),
      rollbackErrors: [], createdParentsMayRemain: false,
    };
  }

  let ownedDirectoryFingerprint: Fingerprint;
  let ownedMetadataFingerprint: Fingerprint;
  try {
    [ownedDirectoryFingerprint, ownedMetadataFingerprint] = await Promise.all([
      lockFingerprint(lock, ops), lockFingerprint(resolve(lock, LOCK_METADATA), ops),
    ]);
  } catch (error: unknown) {
    const message = `apply lock identity unavailable at ${lock}: ${errorMessage(error)}`;
    try {
      await ops.rm(resolve(lock, LOCK_METADATA), { force: true });
      await ops.rmdir(lock);
    } catch (cleanupError: unknown) {
      return { success: false, rolledBack: false, recoveryRequired: false, items: plan.items.map((item) => itemResult(item, "not-started", `${message}; lock cleanup failed: ${errorMessage(cleanupError)}`)), rollbackErrors: [], createdParentsMayRemain: false };
    }
    return { success: false, rolledBack: false, recoveryRequired: false, items: plan.items.map((item) => itemResult(item, "not-started", message)), rollbackErrors: [], createdParentsMayRemain: false };
  }

  const outcomes: ApplyItemResult[] = [];
  const mutations: Mutation[] = [];
  const ancestorExpected = new Map<string, Fingerprint>();
  for (const item of plan.items) {
    for (const condition of item.targetAncestorPreconditions) {
      if (!ancestorExpected.has(condition.path)) ancestorExpected.set(condition.path, condition.fingerprint);
    }
  }
  const rollbackErrors: string[] = [];
  let lockCleanupError: string | undefined;
  let createdParentsMayRemain = false;
  let failed = false;
  try {
    for (const [index, item] of plan.items.entries()) {
      try {
        await validateSource(item, ops);
        await validateAncestors(item.targetAncestorPreconditions, false, plan.home, ancestorExpected, ops);
        if (item.action !== "noop") {
          await ops.mkdir(dirname(item.target), { recursive: true });
          createdParentsMayRemain = true;
          await validateAncestors(item.targetAncestorPreconditions, true, plan.home, ancestorExpected, ops);
          await refreshAncestorExpectations(ancestorExpected, ops);
        }
        if (!sameFingerprint(await fingerprint(item.target, ops), item.targetPrecondition)) throw new Error("stale plan: target changed");
        if (item.action === "noop") {
          if (!await resolvesTo(item.sourceReferent!, item.target, ops)) throw new Error("stale plan: target no longer resolves to source");
          outcomes.push(itemResult(item, "noop"));
          continue;
        }
        const mutation: Mutation = item.backup === undefined
          ? { index, target: item.target, linkCreated: false, backupMoved: false }
          : { index, target: item.target, backup: item.backup, linkCreated: false, backupMoved: false };
        mutations.push(mutation);
        if (item.backup) {
          // The HOME lock excludes other dots processes. Node has no portable rename-no-replace
          // path API, so a hostile same-user process can still race this final absence check.
          if ((await fingerprint(item.backup, ops)).kind !== "missing") throw new Error(`backup already exists: ${item.backup}`);
          await ops.rename(item.target, item.backup);
          mutation.backupMoved = true;
          mutation.backupFingerprint = await fingerprint(item.backup, ops);
          if (!sameEntryIdentity(mutation.backupFingerprint, item.targetPrecondition)) {
            throw new Error("stale plan: target identity changed during backup move");
          }
        }
        await ops.symlink(item.sourceReferent!, item.target);
        mutation.linkCreated = true;
        mutation.linkFingerprint = await fingerprint(item.target, ops);
        if (mutation.linkFingerprint.kind !== "symlink" || !await resolvesTo(item.sourceReferent!, item.target, ops)) {
          throw new Error("created link does not resolve to source");
        }
        outcomes.push(itemResult(item, "applied"));
        await refreshAncestorExpectations(ancestorExpected, ops);
      } catch (error: unknown) {
        failed = true;
        outcomes.push(itemResult(item, "failed", errorMessage(error)));
        break;
      }
    }

    if (failed) {
      for (const mutation of mutations.toReversed()) {
        const item = plan.items[mutation.index]!;
        let restored = true;
        if (mutation.linkCreated) {
          let current: Fingerprint | undefined;
          try {
            current = await fingerprint(mutation.target, ops);
          } catch (error: unknown) {
            rollbackErrors.push(`${mutation.target}: target could not be verified during rollback: ${errorMessage(error)}`);
          }
          if (!mutation.linkFingerprint || !current || !sameFingerprint(current, mutation.linkFingerprint)) {
            rollbackErrors.push(`${mutation.target}: created target cannot be proven unchanged; manual recovery${mutation.backup ? ` from ${mutation.backup}` : ""} required`);
            restored = false;
          } else {
            try {
              await ops.rm(mutation.target, { force: true });
            } catch (error: unknown) {
              rollbackErrors.push(`${mutation.target}: could not remove created link: ${errorMessage(error)}`);
              restored = false;
            }
          }
        }
        if (mutation.backupMoved) {
          let currentBackup: Fingerprint | undefined;
          let currentTarget: Fingerprint | undefined;
          try {
            [currentBackup, currentTarget] = await Promise.all([
              fingerprint(mutation.backup!, ops),
              fingerprint(mutation.target, ops),
            ]);
          } catch (error: unknown) {
            rollbackErrors.push(`${mutation.target}: backup restore preconditions could not be verified: ${errorMessage(error)}`);
          }
          if (!mutation.backupFingerprint || !currentBackup || !sameFingerprint(currentBackup, mutation.backupFingerprint)) {
            rollbackErrors.push(`${mutation.target}: backup changed; manual recovery from ${mutation.backup} required`);
            restored = false;
          } else if (!currentTarget || currentTarget.kind !== "missing") {
            rollbackErrors.push(`${mutation.target}: target occupied during rollback; backup left at ${mutation.backup}`);
            restored = false;
          } else {
            try {
              await ops.rename(mutation.backup!, mutation.target);
            } catch (error: unknown) {
              rollbackErrors.push(`${mutation.target}: could not restore ${mutation.backup}: ${errorMessage(error)}`);
              restored = false;
            }
          }
        }
        const previous = outcomes[mutation.index];
        if (restored && previous?.outcome === "applied") outcomes[mutation.index] = itemResult(item, "rolled-back");
      }
      for (let index = outcomes.length; index < plan.items.length; index += 1) outcomes.push(itemResult(plan.items[index]!, "not-started"));
    }
  } finally {
    try {
      const currentDirectory = await lockFingerprint(lock, ops);
      const currentMetadata = await lockFingerprint(resolve(lock, LOCK_METADATA), ops);
      if (!sameFingerprint(currentDirectory, ownedDirectoryFingerprint)
        || !sameFingerprint(currentMetadata, ownedMetadataFingerprint)) throw new Error("apply lock ownership changed");
      const quarantine = `${lock}.cleanup-${process.pid}-${randomUUID()}`;
      await ops.rename(lock, quarantine);
      const movedDirectory = await lockFingerprint(quarantine, ops);
      const movedMetadata = await lockFingerprint(resolve(quarantine, LOCK_METADATA), ops);
      const movedRaw = await ops.readFile(resolve(quarantine, LOCK_METADATA), "utf8");
      const movedOwner = parseLockMetadata(movedRaw);
      if (!sameDirectoryIdentity(movedDirectory, ownedDirectoryFingerprint)
        || !sameFingerprint(movedMetadata, ownedMetadataFingerprint)
        || movedOwner?.schemaVersion !== 2 || movedOwner.nonce !== lockMetadata.nonce) {
        if ((await lockFingerprint(lock, ops)).kind === "missing") await ops.rename(quarantine, lock);
        throw new Error("apply lock ownership changed during cleanup");
      }
      await ops.rm(quarantine, { recursive: true, force: true });
    } catch (error: unknown) {
      lockCleanupError = `${lock}: lock cleanup failed: ${errorMessage(error)}`;
    }
  }

  if (!failed && rollbackErrors.length === 0 && !lockCleanupError) {
    return { success: true, rolledBack: false, recoveryRequired: false, items: outcomes, rollbackErrors, createdParentsMayRemain };
  }
  const performed = mutations.some(({ linkCreated, backupMoved }) => linkCreated || backupMoved);
  return {
    success: false,
    rolledBack: performed && rollbackErrors.length === 0,
    recoveryRequired: rollbackErrors.length > 0,
    ...(lockCleanupError === undefined ? {} : { lockCleanupError }),
    items: outcomes,
    rollbackErrors,
    createdParentsMayRemain,
  };
}
