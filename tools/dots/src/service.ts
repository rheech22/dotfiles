import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ApplyResult, DoctorReport, LinkPlan, LinkStatus, Manifest, RuntimePaths } from "./domain.js";
import { SelectorError } from "./domain.js";
import { inspectDependency, inspectLink } from "./inspect.js";
import { applyLinkPlan, createLinkPlan, inspectApplyLock, unlockApplyLock, type ApplyLockInspection } from "./link.js";
import { configItems, dependencies } from "./manifest.js";

const REQUIRED_NODE = "22.19.0";

export class DotsConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DotsConfigError";
  }
}

export function resolveRuntimePaths(env: NodeJS.ProcessEnv = process.env): RuntimePaths {
  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const home = env.HOME;
  if (!home) throw new DotsConfigError("HOME is not set");
  const repo = resolve(env.DOTFILES_DIR ?? packageRoot, env.DOTFILES_DIR ? "." : "../..");
  if (!existsSync(resolve(repo, ".config")) || !existsSync(resolve(repo, "source-dots.sh"))) {
    throw new DotsConfigError(`Dotfiles repository not found at ${repo}; set DOTFILES_DIR explicitly`);
  }
  return {
    repo,
    home: resolve(home),
    path: env.PATH ?? "",
  };
}

export function nodeSupported(version: string): boolean {
  if (!/^v?\d+\.\d+\.\d+$/.test(version)) return false;
  const parts = version.replace(/^v/, "").split(".").map((part) => Number.parseInt(part, 10));
  const [major = 0, minor = 0, patch = 0] = parts;
  return major > 22 || (major === 22 && (minor > 19 || (minor === 19 && patch >= 0)));
}

export function doctorExitCode(summary: DoctorReport["summary"]): 0 | 1 | 3 {
  if (summary.errors > 0) return 1;
  if (summary.warnings > 0) return 3;
  return 0;
}

export class DotsService {
  readonly manifest: Manifest;
  readonly paths: RuntimePaths;
  readonly nodeVersion: string;

  constructor(
    paths: RuntimePaths,
    manifest: Manifest = { items: configItems, dependencies },
    nodeVersion: string = process.versions.node,
  ) {
    this.paths = paths;
    this.manifest = manifest;
    this.nodeVersion = nodeVersion;
  }

  async status(ids: readonly string[] = [], includeAll = false): Promise<readonly LinkStatus[]> {
    const available = this.manifest.items.filter((item) => includeAll || item.enabled !== false);
    const byId = new Map(available.map((item) => [item.id, item]));
    const requested = new Set(ids);
    const unknown = [...requested].filter((id) => !byId.has(id));
    if (unknown.length > 0) throw new SelectorError(unknown);
    const selected = ids.length === 0
      ? available.filter((item) => !item.optional || existsSync(resolve(this.paths.repo, item.source)))
      : available.filter((item) => requested.has(item.id));
    return Promise.all(selected.map((item) => inspectLink(item, this.paths.repo, this.paths.home)));
  }

  async doctor(includeAll = false): Promise<DoctorReport> {
    const [links, dependencyStatuses] = await Promise.all([
      this.status([], includeAll),
      Promise.all(this.manifest.dependencies.map((dependency) => inspectDependency(dependency, this.paths.path))),
    ]);
    const required = dependencyStatuses.filter((dependency) => dependency.required);
    const optional = dependencyStatuses.filter((dependency) => !dependency.required);
    const node = { required: REQUIRED_NODE, actual: this.nodeVersion, supported: nodeSupported(this.nodeVersion) };
    const errors = links.filter(({ result }) =>
      result.state === "wrong-link" || result.state === "occupied" || result.state === "source-missing"
    ).length + required.filter(({ available }) => !available).length + (node.supported ? 0 : 1);
    const warnings = links.filter(({ result }) => result.state === "missing").length
      + optional.filter(({ available }) => !available).length;
    return {
      links,
      dependencies: { required, optional },
      node,
      summary: { errors, warnings, healthy: errors === 0 && warnings === 0 },
    };
  }

  async plan(ids: readonly string[], all = false, now?: () => Date): Promise<LinkPlan> {
    const available = this.manifest.items.filter((item) => item.enabled !== false);
    const byId = new Map(available.map((item) => [item.id, item]));
    const requested = new Set(ids);
    const unknown = [...requested].filter((id) => !byId.has(id));
    if (unknown.length > 0) throw new SelectorError(unknown);
    const selected = all
      ? available.filter((item) => !item.optional || existsSync(resolve(this.paths.repo, item.source)))
      : available.filter((item) => requested.has(item.id));
    return createLinkPlan(selected, this.paths, now);
  }

  async apply(plan: LinkPlan): Promise<ApplyResult> {
    return applyLinkPlan(plan);
  }

  inspectLock(): Promise<ApplyLockInspection> {
    return inspectApplyLock(this.paths.home);
  }

  unlockLock(inspection: ApplyLockInspection, force: boolean): Promise<void> {
    return unlockApplyLock(inspection, force);
  }
}
