import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { basename, isAbsolute } from "node:path";
import type { DependencyProfile, DependencyResource, DependencyResourceKind } from "./deps-manifest.js";
import { dependencyProfiles, validateDependencyManifest } from "./deps-manifest.js";
import type { ProcessRequest, ProcessResult, ProcessRunner } from "./process.js";
import { resolveAbsoluteExecutable, resolveExecutable, spawnProcessRunner } from "./process.js";

const BREW_PREFIX_CANDIDATES = ["/opt/homebrew/bin/brew", "/usr/local/bin/brew"] as const;
const SAFETY_ENV = {
  HOMEBREW_NO_AUTO_UPDATE: "1",
  HOMEBREW_NO_INSTALL_UPGRADE: "1",
  HOMEBREW_NO_INSTALL_CLEANUP: "1",
  HOMEBREW_NO_INSTALLED_DEPENDENTS_CHECK: "1",
  HOMEBREW_NO_ASK: "1",
} as const;
const UNSAFE_INHERITED_ENV = [
  "HOMEBREW_CASK_OPTS",
  "HOMEBREW_NO_QUARANTINE",
  "HOMEBREW_API_DOMAIN",
  "HOMEBREW_ARTIFACT_DOMAIN",
  "HOMEBREW_BOTTLE_DOMAIN",
  "HOMEBREW_BREW_GIT_REMOTE",
  "HOMEBREW_CORE_GIT_REMOTE",
  "HOMEBREW_NO_INSTALL_FROM_API",
] as const;

export type DependencyPlanAction = "noop" | "tap" | "install-formula" | "install-cask" | "blocked";

export interface DependencyPlanItem {
  readonly kind: DependencyResourceKind;
  readonly name: string;
  readonly action: DependencyPlanAction;
  readonly command: string;
  readonly argv: readonly string[];
  readonly versions?: readonly string[];
  readonly preview?: readonly string[];
  readonly reason?: string;
}

export interface DependencyPlan {
  readonly profiles: readonly string[];
  readonly brewExecutable?: string;
  readonly items: readonly DependencyPlanItem[];
  readonly blocked: boolean;
  readonly changes: number;
}

export interface DependencyInstallItemResult {
  readonly kind: DependencyResourceKind;
  readonly name: string;
  readonly action: DependencyPlanAction;
  readonly outcome: "installed" | "noop" | "failed" | "not-started";
  readonly error?: string;
  readonly outputTruncated?: boolean;
}

export interface DependencyInstallResult {
  readonly success: boolean;
  readonly items: readonly DependencyInstallItemResult[];
}

export interface DependencyInstallProgress {
  readonly kind: DependencyResourceKind;
  readonly name: string;
  readonly action: Exclude<DependencyPlanAction, "noop" | "blocked">;
}

export interface DependencyInstallOptions {
  readonly onProgress?: (event: DependencyInstallProgress) => void | Promise<void>;
}

export type DependencyResourceState = "installed-by-selected-brew" | "available-externally" | "missing" | "blocked";

export interface DependencyResourceStatus {
  readonly kind: DependencyResourceKind;
  readonly name: string;
  readonly description: string;
  readonly state: DependencyResourceState;
  readonly versions?: readonly string[];
  readonly evidence?: string;
  readonly reason?: string;
}

export interface DependencyProfileStatus {
  readonly id: string;
  readonly description: string;
  readonly resources: readonly DependencyResourceStatus[];
  readonly summary: { readonly installed: number; readonly external: number; readonly missing: number; readonly blocked: number };
}

export interface DependencyStatusReport {
  readonly profiles: readonly DependencyProfileStatus[];
  readonly brewExecutable?: string;
  readonly blocked: boolean;
}

export type BrewCandidateResolver = (candidate: string) => Promise<string | undefined>;

export class DependencySelectorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DependencySelectorError";
  }
}

export function selectDependencyProfiles(
  profiles: readonly DependencyProfile[],
  ids: readonly string[],
  all: boolean,
): readonly DependencyProfile[] {
  if (ids.length === 0 && !all) throw new DependencySelectorError("deps requires at least one profile or --all");
  if (ids.length > 0 && all) throw new DependencySelectorError("Cannot combine profiles with --all");
  const requested = new Set(ids);
  const known = new Set(profiles.map(({ id }) => id));
  const unknown = [...requested].filter((id) => !known.has(id));
  if (unknown.length > 0) throw new DependencySelectorError(`Unknown dependency profile${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}`);
  return all ? profiles : profiles.filter(({ id }) => requested.has(id));
}

export function parseBrewTaps(stdout: string): ReadonlySet<string> {
  return new Set(stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
}

export function parseBrewList(stdout: string): ReadonlyMap<string, readonly string[]> {
  const installed = new Map<string, readonly string[]>();
  for (const line of stdout.split(/\r?\n/)) {
    const fields = line.trim().split(/\s+/).filter(Boolean);
    const name = fields.shift();
    if (name) installed.set(name, fields);
  }
  return installed;
}

function commandFor(resource: DependencyResource): readonly string[] {
  if (resource.kind === "tap") return ["tap", resource.name];
  if (resource.kind === "cask") return ["install", "--cask", resource.name];
  return ["install", resource.name];
}

function dryRunCommandFor(resource: DependencyResource): readonly string[] {
  if (resource.kind === "cask") return ["install", "--dry-run", "--cask", resource.name];
  return ["install", "--dry-run", resource.name];
}

function listingArgv(kind: DependencyResourceKind): readonly string[] {
  if (kind === "tap") return ["tap"];
  if (kind === "cask") return ["list", "--cask", "--versions"];
  return ["list", "--formula", "--versions"];
}

function processError(result: ProcessResult, operation = "query", truncationFatal = true): string | undefined {
  if (result.kind === "aborted") return `Homebrew ${operation} was aborted`;
  if (result.kind === "timeout") return `Homebrew ${operation} timed out after ${result.timeoutMs}ms`;
  if (result.kind === "spawn-error") return `Homebrew could not start: ${result.error}`;
  if (result.exitCode !== 0) {
    const detail = result.stderr.trim();
    return `Homebrew ${operation} exited ${result.exitCode}${detail ? `: ${detail}` : ""}`;
  }
  if (truncationFatal && (result.stdoutTruncated || result.stderrTruncated)) {
    return `Homebrew ${operation} output exceeded the capture limit`;
  }
  return undefined;
}

function escapePreview(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f-\u009f]/g, (character) =>
    `\\u{${character.codePointAt(0)?.toString(16).padStart(2, "0") ?? "00"}}`
  );
}

function previewLines(result: Extract<ProcessResult, { readonly kind: "exit" }>): readonly string[] {
  const combined = [result.stdout, result.stderr].filter(Boolean).join("\n");
  return combined.split(/\r?\n/).filter((line) => line.length > 0).map(escapePreview);
}

function freezePlan(plan: DependencyPlan): DependencyPlan {
  for (const item of plan.items) {
    Object.freeze(item.argv);
    if (item.versions) Object.freeze(item.versions);
    if (item.preview) Object.freeze(item.preview);
    Object.freeze(item);
  }
  Object.freeze(plan.profiles);
  Object.freeze(plan.items);
  return Object.freeze(plan);
}

interface SelectedResource extends DependencyResource {
  readonly supported: boolean;
  readonly unsupportedProfiles: readonly string[];
}

interface BrewResolution {
  readonly executable?: string;
  readonly error?: string;
}

export class DepsService {
  readonly profiles: readonly DependencyProfile[];
  readonly path: string;
  readonly env: NodeJS.ProcessEnv;
  readonly runner: ProcessRunner;
  readonly executableResolver: (name: string, path: string) => Promise<string | undefined>;
  readonly candidateResolver: BrewCandidateResolver;
  readonly platform: NodeJS.Platform;
  readonly selectedBrew: string | undefined;
  readonly appResolver: (path: string) => Promise<boolean>;
  readonly #plans = new WeakSet<DependencyPlan>();

  constructor(options: {
    readonly profiles?: readonly DependencyProfile[];
    readonly path?: string;
    readonly env?: NodeJS.ProcessEnv;
    readonly runner?: ProcessRunner;
    readonly executableResolver?: (name: string, path: string) => Promise<string | undefined>;
    readonly candidateResolver?: BrewCandidateResolver;
    readonly platform?: NodeJS.Platform;
    readonly selectedBrew?: string;
    readonly appResolver?: (path: string) => Promise<boolean>;
  } = {}) {
    this.profiles = options.profiles ?? dependencyProfiles;
    validateDependencyManifest(this.profiles);
    this.env = options.env ?? process.env;
    this.path = options.path ?? this.env.PATH ?? "";
    this.runner = options.runner ?? spawnProcessRunner;
    this.executableResolver = options.executableResolver ?? resolveExecutable;
    this.candidateResolver = options.candidateResolver ?? resolveAbsoluteExecutable;
    this.platform = options.platform ?? process.platform;
    this.selectedBrew = options.selectedBrew ?? options.env?.DOTS_BREW;
    this.appResolver = options.appResolver ?? (async (path) => access(path, constants.F_OK).then(() => true, () => false));
  }

  async brewCandidates(): Promise<readonly string[]> {
    if (this.selectedBrew !== undefined) {
      if (!isAbsolute(this.selectedBrew) || basename(this.selectedBrew) !== "brew") return [];
      const selected = await this.candidateResolver(this.selectedBrew);
      return selected ? [selected] : [];
    }
    const candidates = await Promise.all([
      ...(this.platform === "darwin" ? BREW_PREFIX_CANDIDATES.map((candidate) => this.candidateResolver(candidate)) : []),
      this.executableResolver("brew", this.path),
    ]);
    return [...new Set(candidates.filter((candidate): candidate is string => candidate !== undefined))];
  }

  withSelectedBrew(selectedBrew: string): DepsService {
    return new DepsService({
      profiles: this.profiles,
      path: this.path,
      env: this.env,
      runner: this.runner,
      executableResolver: this.executableResolver,
      candidateResolver: this.candidateResolver,
      platform: this.platform,
      selectedBrew,
      appResolver: this.appResolver,
    });
  }

  async #resolveBrew(): Promise<BrewResolution> {
    if (this.selectedBrew !== undefined) {
      if (!isAbsolute(this.selectedBrew)) return { error: `Selected Homebrew path must be absolute: ${this.selectedBrew}` };
      if (basename(this.selectedBrew) !== "brew") return { error: `Selected Homebrew path must name a brew executable: ${this.selectedBrew}` };
      const executable = await this.candidateResolver(this.selectedBrew);
      return executable ? { executable } : { error: `Selected Homebrew path is not executable: ${this.selectedBrew}` };
    }
    if (this.platform === "darwin") {
      const candidates = (await Promise.all([
        ...BREW_PREFIX_CANDIDATES.map((candidate) => this.candidateResolver(candidate)),
        this.executableResolver("brew", this.path),
      ]))
        .filter((candidate): candidate is string => candidate !== undefined);
      const unique = [...new Set(candidates)];
      if (unique.length > 1) {
        return { error: `Multiple Homebrew installations detected (${unique.join(", ")}); select one with --brew or DOTS_BREW` };
      }
      if (unique[0]) return { executable: unique[0] };
    }
    const executable = await this.executableResolver("brew", this.path);
    return executable ? { executable } : { error: "Homebrew executable was not found in PATH" };
  }

  #selectResources(selected: readonly DependencyProfile[]): readonly SelectedResource[] {
    const resources = new Map<string, { resource: DependencyResource; supported: boolean; unsupportedProfiles: string[] }>();
    for (const profile of selected) {
      const supported = !profile.platforms || profile.platforms.includes(this.platform);
      for (const resource of profile.resources) {
        const key = `${resource.kind}:${resource.name}`;
        const existing = resources.get(key);
        if (existing) {
          existing.supported ||= supported;
          if (!supported) existing.unsupportedProfiles.push(profile.id);
        } else {
          resources.set(key, { resource, supported, unsupportedProfiles: supported ? [] : [profile.id] });
        }
      }
    }
    const ordered: SelectedResource[] = [];
    for (const kind of ["tap", "formula", "cask"] as const) {
      for (const { resource, supported, unsupportedProfiles } of resources.values()) {
        if (resource.kind === kind) ordered.push({ ...resource, supported, unsupportedProfiles });
      }
    }
    return ordered;
  }

  async status(ids: readonly string[], all = false, signal?: AbortSignal): Promise<DependencyStatusReport> {
    const selected = selectDependencyProfiles(this.profiles, ids, all);
    const resources = this.#selectResources(selected);
    const unsafeEnvironment = UNSAFE_INHERITED_ENV.filter((name) => this.env[name] !== undefined);
    const resolution = unsafeEnvironment.length === 0 ? await this.#resolveBrew() : {};
    const globalError = unsafeEnvironment.length > 0
      ? `Unsafe Homebrew environment variables are set: ${unsafeEnvironment.join(", ")}`
      : resolution.error;
    const parsed = new Map<DependencyResourceKind, ReadonlySet<string> | ReadonlyMap<string, readonly string[]>>();
    const errors = new Map<DependencyResourceKind, string>();
    if (resolution.executable) {
      for (const kind of ["tap", "formula", "cask"] as const) {
        if (!resources.some((resource) => resource.supported && resource.kind === kind)) continue;
        const result = await this.runner.run({ executable: resolution.executable, argv: listingArgv(kind), env: this.env, ...(signal ? { signal } : {}) });
        const error = processError(result);
        if (error) errors.set(kind, error);
        else if (result.kind === "exit") parsed.set(kind, kind === "tap" ? parseBrewTaps(result.stdout) : parseBrewList(result.stdout));
      }
    }

    const byKey = new Map<string, DependencyResourceStatus>();
    for (const resource of resources) {
      const key = `${resource.kind}:${resource.name}`;
      const commandPath = resource.runtimeCommand
        ? await this.executableResolver(resource.runtimeCommand, this.path)
        : undefined;
      const appAvailable = resource.runtimeApp ? await this.appResolver(resource.runtimeApp) : false;
      const evidence = commandPath ?? (appAvailable ? resource.runtimeApp : undefined);
      const reason = !resource.supported
        ? `Profile ${resource.unsupportedProfiles.join(", ")} is not supported on ${this.platform}`
        : globalError ?? errors.get(resource.kind);
      if (reason) {
        if (evidence && resource.supported) {
          byKey.set(key, { kind: resource.kind, name: resource.name, description: resource.description ?? resource.name,
            state: "available-externally", evidence, reason });
          continue;
        }
        byKey.set(key, { kind: resource.kind, name: resource.name, description: resource.description ?? resource.name, state: "blocked", reason });
        continue;
      }
      const state = parsed.get(resource.kind);
      if (state?.has(resource.name)) {
        const versions = resource.kind === "tap" ? undefined : (state as ReadonlyMap<string, readonly string[]>).get(resource.name);
        byKey.set(key, { kind: resource.kind, name: resource.name, description: resource.description ?? resource.name,
          state: "installed-by-selected-brew", ...(versions?.length ? { versions } : {}) });
        continue;
      }
      byKey.set(key, { kind: resource.kind, name: resource.name, description: resource.description ?? resource.name,
        state: evidence ? "available-externally" : "missing", ...(evidence ? { evidence } : {}) });
    }

    const profiles = selected.map((profile): DependencyProfileStatus => {
      const profileResources = profile.resources.map((resource) => byKey.get(`${resource.kind}:${resource.name}`)!);
      return {
        id: profile.id,
        description: profile.description ?? profile.id,
        resources: profileResources,
        summary: {
          installed: profileResources.filter(({ state }) => state === "installed-by-selected-brew").length,
          external: profileResources.filter(({ state }) => state === "available-externally").length,
          missing: profileResources.filter(({ state }) => state === "missing").length,
          blocked: profileResources.filter(({ state }) => state === "blocked").length,
        },
      };
    });
    return {
      profiles,
      ...(resolution.executable ? { brewExecutable: resolution.executable } : {}),
      blocked: profiles.some((profile) => profile.summary.blocked > 0),
    };
  }

  async plan(ids: readonly string[], all = false, signal?: AbortSignal): Promise<DependencyPlan> {
    const selected = selectDependencyProfiles(this.profiles, ids, all);
    const resources = this.#selectResources(selected);
    const unsafeEnvironment = UNSAFE_INHERITED_ENV.filter((name) => this.env[name] !== undefined);
    if (unsafeEnvironment.length > 0) {
      const reason = `Unsafe Homebrew environment variables are set: ${unsafeEnvironment.join(", ")}`;
      return this.#recordPlan({
        profiles: selected.map(({ id }) => id),
        items: resources.map((resource) => ({
          kind: resource.kind,
          name: resource.name,
          action: "blocked",
          command: "brew",
          argv: commandFor(resource),
          reason,
        })),
        blocked: true,
        changes: 0,
      });
    }
    const brewResolution = await this.#resolveBrew();
    const brew = brewResolution.executable;
    if (!brew) {
      return this.#recordPlan({
        profiles: selected.map(({ id }) => id),
        items: resources.map((resource) => ({
          kind: resource.kind,
          name: resource.name,
          action: "blocked",
          command: "brew",
          argv: commandFor(resource),
          reason: resource.supported
            ? brewResolution.error ?? "Homebrew is unavailable"
            : `Profile ${resource.unsupportedProfiles.join(", ")} is not supported on ${this.platform}`,
        })),
        blocked: true,
        changes: 0,
      });
    }

    const queryResources = resources.filter(({ supported }) => supported);
    const byKind = new Map<DependencyResourceKind, ProcessResult>();
    for (const kind of ["tap", "formula", "cask"] as const) {
      if (!queryResources.some((resource) => resource.kind === kind)) continue;
      byKind.set(kind, await this.runner.run({ executable: brew, argv: listingArgv(kind), env: this.env, ...(signal ? { signal } : {}) }));
    }
    const parsed = new Map<DependencyResourceKind, ReadonlySet<string> | ReadonlyMap<string, readonly string[]>>();
    const errors = new Map<DependencyResourceKind, string>();
    for (const [kind, result] of byKind) {
      const error = processError(result);
      if (error) errors.set(kind, error);
      else if (result.kind === "exit") parsed.set(kind, kind === "tap" ? parseBrewTaps(result.stdout) : parseBrewList(result.stdout));
    }

    const items: DependencyPlanItem[] = [];
    const safetyEnv = { ...this.env, ...SAFETY_ENV };
    for (const resource of resources) {
      const argv = commandFor(resource);
      if (!resource.supported) {
        items.push({
          kind: resource.kind,
          name: resource.name,
          action: "blocked",
          command: brew,
          argv,
          reason: `Profile ${resource.unsupportedProfiles.join(", ")} is not supported on ${this.platform}`,
        });
        continue;
      }
      const error = errors.get(resource.kind);
      if (error) {
        items.push({ kind: resource.kind, name: resource.name, action: "blocked", command: brew, argv, reason: error });
        continue;
      }
      const state = parsed.get(resource.kind);
      if (state?.has(resource.name)) {
        const versions = resource.kind === "tap" ? undefined : (state as ReadonlyMap<string, readonly string[]>).get(resource.name);
        items.push({ kind: resource.kind, name: resource.name, action: "noop", command: brew, argv, ...(versions ? { versions } : {}) });
        continue;
      }
      const action = resource.kind === "tap" ? "tap" : resource.kind === "cask" ? "install-cask" : "install-formula";
      if (resource.kind === "tap") {
        items.push({ kind: resource.kind, name: resource.name, action, command: brew, argv });
        continue;
      }
      const dryRun = await this.runner.run({ executable: brew, argv: dryRunCommandFor(resource), env: safetyEnv, ...(signal ? { signal } : {}) });
      const dryRunError = processError(dryRun, "dry-run");
      if (dryRunError || dryRun.kind !== "exit") {
        items.push({ kind: resource.kind, name: resource.name, action: "blocked", command: brew, argv, reason: dryRunError ?? "Homebrew dry-run failed" });
        continue;
      }
      items.push({ kind: resource.kind, name: resource.name, action, command: brew, argv, preview: previewLines(dryRun) });
    }
    return this.#recordPlan({
      profiles: selected.map(({ id }) => id),
      brewExecutable: brew,
      items,
      blocked: items.some(({ action }) => action === "blocked"),
      changes: items.filter(({ action }) => action !== "noop" && action !== "blocked").length,
    });
  }

  #recordPlan(plan: DependencyPlan): DependencyPlan {
    const frozen = freezePlan(plan);
    this.#plans.add(frozen);
    return frozen;
  }

  #installBase(plan: DependencyPlan): DependencyInstallItemResult[] {
    return plan.items.map((item) => ({
      kind: item.kind,
      name: item.name,
      action: item.action,
      outcome: item.action === "noop" ? "noop" : "not-started",
    }));
  }

  #fail(base: DependencyInstallItemResult[], error: string, preferredIndex?: number): DependencyInstallResult {
    const pendingIndex = base.findIndex(({ outcome }) => outcome === "not-started");
    const index = preferredIndex ?? (pendingIndex >= 0 ? pendingIndex : base.length > 0 ? 0 : -1);
    if (index >= 0) base[index] = { ...base[index]!, outcome: "failed", error };
    return { success: false, items: base };
  }

  #sameReviewedState(reviewed: DependencyPlan, fresh: DependencyPlan): boolean {
    if (reviewed.brewExecutable !== fresh.brewExecutable || reviewed.items.length !== fresh.items.length) return false;
    return reviewed.items.every((item, index) => {
      const next = fresh.items[index];
      return next !== undefined
        && item.kind === next.kind
        && item.name === next.name
        && item.action === next.action
        && item.command === next.command
        && item.argv.join("\u0000") === next.argv.join("\u0000")
        && (item.versions ?? []).join("\u0000") === (next.versions ?? []).join("\u0000")
        && (item.preview ?? []).join("\u0000") === (next.preview ?? []).join("\u0000");
    });
  }

  async install(plan: DependencyPlan, options: DependencyInstallOptions = {}): Promise<DependencyInstallResult> {
    const base = this.#installBase(plan);
    if (!this.#plans.has(plan)) return this.#fail(base, "Dependency plan was not created by this service");

    const fresh = await this.plan(plan.profiles, false);
    if (!this.#sameReviewedState(plan, fresh)) {
      return this.#fail(base, "Dependency plan is stale; Homebrew path or dependency state changed since review");
    }
    if (plan.blocked || !plan.brewExecutable) {
      const blocked = plan.items.findIndex(({ action }) => action === "blocked");
      return this.#fail(base, plan.items[blocked]?.reason ?? "Dependency plan is blocked", blocked);
    }
    if (plan.changes === 0) return { success: true, items: base };

    const env = { ...this.env, ...SAFETY_ENV };
    for (let index = 0; index < plan.items.length; index += 1) {
      const item = plan.items[index]!;
      if (item.action === "noop") continue;
      const expectedArgv = commandFor(item);
      const expectedAction = item.kind === "tap" ? "tap" : item.kind === "cask" ? "install-cask" : "install-formula";
      if (item.command !== plan.brewExecutable || item.action !== expectedAction
        || item.argv.length !== expectedArgv.length || item.argv.some((value, position) => value !== expectedArgv[position])) {
        return this.#fail(base, "Dependency plan contains an invalid install command", index);
      }

      const stateResult = await this.runner.run({
        executable: plan.brewExecutable,
        argv: listingArgv(item.kind),
        env: this.env,
      });
      const stateError = processError(stateResult, "state recheck");
      if (stateError || stateResult.kind !== "exit") {
        return this.#fail(base, stateError ?? "Homebrew state recheck failed", index);
      }
      const installed = item.kind === "tap"
        ? parseBrewTaps(stateResult.stdout).has(item.name)
        : parseBrewList(stateResult.stdout).has(item.name);
      if (installed) {
        base[index] = { ...base[index]!, outcome: "noop" };
        continue;
      }

      if (item.kind !== "tap") {
        const dryRun = await this.runner.run({
          executable: plan.brewExecutable,
          argv: dryRunCommandFor(item),
          env,
        });
        const dryRunError = processError(dryRun, "dry-run");
        if (dryRunError || dryRun.kind !== "exit") {
          return this.#fail(base, dryRunError ?? "Homebrew dry-run failed", index);
        }
        const currentPreview = previewLines(dryRun);
        const reviewedPreview = item.preview ?? [];
        if (currentPreview.length !== reviewedPreview.length
          || currentPreview.some((line, position) => line !== reviewedPreview[position])) {
          return this.#fail(base, "Dependency plan is stale; Homebrew dry-run preview changed since review", index);
        }
      }
      await options.onProgress?.({ kind: item.kind, name: item.name, action: item.action });
      // Once Homebrew starts mutating, forced timeout can leave its own state inconsistent.
      const request: ProcessRequest = { executable: plan.brewExecutable, argv: expectedArgv, env, timeoutMs: 0 };
      const result = await this.runner.run(request);
      const error = processError(result, "install", false);
      if (error) return this.#fail(base, error, index);
      const outputTruncated = result.kind === "exit" && (result.stdoutTruncated || result.stderrTruncated);
      base[index] = { ...base[index]!, outcome: "installed", ...(outputTruncated ? { outputTruncated: true } : {}) };
    }
    return { success: true, items: base };
  }
}
