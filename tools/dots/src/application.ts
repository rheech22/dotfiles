import { delimiter, dirname, resolve } from "node:path";
import type { ApplyResult, DoctorReport, LinkStatus } from "./domain.js";
import type {
  DependencyInstallOptions,
  DependencyInstallResult,
  DependencyProfileStatus,
  DependencyResourceStatus,
} from "./deps.js";
import { DepsService } from "./deps.js";
import { dependencyProfiles } from "./deps-manifest.js";
import { DotsService, resolveRuntimePaths } from "./service.js";
import { prepareAction, type PreparedAction } from "./workflows.js";

export interface DashboardView {
  readonly healthy: boolean;
  readonly errors: number;
  readonly warnings: number;
  readonly links: readonly LinkStatusView[];
  readonly dependencies: readonly DashboardDependencyView[];
  readonly node: DoctorReport["node"];
}

export interface DashboardDependencyView {
  readonly id: string;
  readonly description: string;
  readonly required: boolean;
  readonly available: boolean;
  readonly path?: string;
  readonly remediationProfile?: string;
}

export interface LinkListItemView {
  readonly id: string;
  readonly description: string;
  readonly enabled: boolean;
  readonly disabledReason?: string;
}

export interface LinkStatusView extends LinkListItemView {
  readonly source: string;
  readonly target: string;
  readonly state: LinkStatus["result"]["state"];
  readonly detail?: string;
}

export interface LinkReviewItemView {
  readonly id: string;
  readonly description: string;
  readonly source: string;
  readonly target: string;
  readonly action: "noop" | "create" | "backup-and-link" | "replace-link" | "blocked";
  readonly backup?: string;
  readonly reason?: string;
}

export interface LinkReviewView {
  readonly blocked: boolean;
  readonly changes: number;
  readonly items: readonly LinkReviewItemView[];
}

export interface LinkResultView extends ApplyResult {}

export interface PackageProfileView {
  readonly id: string;
  readonly description: string;
  readonly supported: boolean;
  readonly resources: readonly PackageResourceView[];
}

export interface PackageResourceView {
  readonly kind: "tap" | "formula" | "cask";
  readonly name: string;
  readonly description: string;
  readonly runtimeCommand?: string;
  readonly runtimeApp?: string;
}

export interface PackageStatusView {
  readonly blocked: boolean;
  readonly brewExecutable?: string;
  readonly profiles: readonly DependencyProfileStatus[];
}

export interface PackageReviewItemView {
  readonly kind: "tap" | "formula" | "cask";
  readonly name: string;
  readonly description: string;
  readonly action: "noop" | "tap" | "install-formula" | "install-cask" | "blocked";
  readonly versions?: readonly string[];
  readonly preview?: readonly string[];
  readonly reason?: string;
}

export interface PackageReviewView {
  readonly profiles: readonly string[];
  readonly brewExecutable?: string;
  readonly blocked: boolean;
  readonly changes: number;
  readonly items: readonly PackageReviewItemView[];
}

export interface PackageResultView extends DependencyInstallResult {}

export type PreparedLinkAction = PreparedAction<LinkReviewView, LinkResultView, void>;
export type PreparedPackageAction = PreparedAction<PackageReviewView, PackageResultView, DependencyInstallOptions>;

function linkDetail(status: LinkStatus): string | undefined {
  const result = status.result;
  if (result.state === "disabled") return result.reason;
  if (result.state === "occupied") return result.kind;
  if (result.state !== "wrong-link") return undefined;
  if (result.detail.kind === "different") return result.detail.actualPath;
  if (result.detail.kind === "error") return result.detail.message;
  return result.detail.path;
}

function linkStatusView(status: LinkStatus): LinkStatusView {
  const detail = linkDetail(status);
  return {
    id: status.id,
    description: status.description,
    enabled: status.result.state !== "disabled",
    source: status.source,
    target: status.target,
    state: status.result.state,
    ...(detail ? { detail } : {}),
    ...(status.result.state === "disabled" ? { disabledReason: status.result.reason } : {}),
  };
}

function packageDescription(profiles: DepsService["profiles"], kind: string, name: string): string {
  for (const profile of profiles) {
    const resource = profile.resources.find((item) => item.kind === kind && item.name === name);
    if (resource) return resource.description ?? resource.name;
  }
  return name;
}

function remediationProfiles(): ReadonlyMap<string, string> {
  const result = new Map<string, string>();
  for (const profile of dependencyProfiles) {
    for (const resource of profile.resources) {
      if (resource.runtimeCommand) result.set(resource.runtimeCommand, profile.id);
    }
  }
  return result;
}

export class DotsApplication {
  readonly dots: DotsService;
  readonly packages: DepsService;

  constructor(
    dots: DotsService = new DotsService(resolveRuntimePaths()),
    packages: DepsService = new DepsService({ env: process.env }),
  ) {
    this.dots = dots;
    this.packages = packages;
  }

  async dashboard(): Promise<DashboardView> {
    const report = await this.dots.doctor(false);
    const remediation = remediationProfiles();
    return {
      healthy: report.summary.healthy,
      errors: report.summary.errors,
      warnings: report.summary.warnings,
      links: report.links.map(linkStatusView),
      dependencies: [...report.dependencies.required, ...report.dependencies.optional].map((dependency) => ({
        id: dependency.id,
        description: dependency.description,
        required: dependency.required,
        available: dependency.available,
        ...(dependency.path ? { path: dependency.path } : {}),
        ...(remediation.get(dependency.command) ? { remediationProfile: remediation.get(dependency.command)! } : {}),
      })),
      node: report.node,
    };
  }

  linksList(includeDisabled = false): readonly LinkListItemView[] {
    return this.dots.manifest.items.filter((item) => includeDisabled || item.enabled !== false).map((item) => ({
      id: item.id,
      description: item.description,
      enabled: item.enabled !== false,
      ...(item.disabledReason ? { disabledReason: item.disabledReason } : {}),
    }));
  }

  async linksStatus(ids: readonly string[], all: boolean, includeDisabled: boolean): Promise<readonly LinkStatusView[]> {
    const statuses = all ? await this.dots.status([], includeDisabled) : await this.dots.status(ids, includeDisabled);
    return statuses.map(linkStatusView);
  }

  async prepareLinks(ids: readonly string[], all: boolean): Promise<PreparedLinkAction> {
    const plan = await this.dots.plan(ids, all);
    const review: LinkReviewView = {
      blocked: plan.blocked,
      changes: plan.items.filter(({ action }) => action !== "noop" && action !== "blocked").length,
      items: plan.items.map((item) => ({
        id: item.id,
        description: item.description,
        source: item.source,
        target: item.target,
        action: item.action,
        ...(item.backup ? { backup: item.backup } : {}),
        ...(item.reason ? { reason: item.reason } : {}),
      })),
    };
    return prepareAction(review, plan.blocked, async () => this.dots.apply(plan));
  }

  packageProfiles(id?: string): readonly PackageProfileView[] {
    const selected = id ? this.packages.profiles.filter((profile) => profile.id === id) : this.packages.profiles;
    if (id && selected.length === 0) throw new Error(`Unknown dependency profile: ${id}`);
    return selected.map((profile) => ({
      id: profile.id,
      description: profile.description ?? profile.id,
      supported: !profile.platforms || profile.platforms.includes(this.packages.platform),
      resources: profile.resources.map((resource) => ({
        kind: resource.kind,
        name: resource.name,
        description: resource.description ?? resource.name,
        ...(resource.runtimeCommand ? { runtimeCommand: resource.runtimeCommand } : {}),
        ...(resource.runtimeApp ? { runtimeApp: resource.runtimeApp } : {}),
      })),
    }));
  }

  async packageStatus(ids: readonly string[], all: boolean, options: { readonly signal?: AbortSignal } = {}): Promise<PackageStatusView> {
    const report = await this.packages.status(ids, all, options.signal);
    return report;
  }

  async preparePackages(ids: readonly string[], all: boolean, options: { readonly signal?: AbortSignal } = {}): Promise<PreparedPackageAction> {
    const plan = await this.packages.plan(ids, all, options.signal);
    const review: PackageReviewView = {
      profiles: plan.profiles,
      ...(plan.brewExecutable ? { brewExecutable: plan.brewExecutable } : {}),
      blocked: plan.blocked,
      changes: plan.changes,
      items: plan.items.map((item) => ({
        kind: item.kind,
        name: item.name,
        description: packageDescription(this.packages.profiles, item.kind, item.name),
        action: item.action,
        ...(item.versions ? { versions: item.versions } : {}),
        ...(item.preview ? { preview: item.preview } : {}),
        ...(item.reason ? { reason: item.reason } : {}),
      })),
    };
    return prepareAction(review, plan.blocked, async (options) => this.packages.install(plan, options));
  }

  brewCandidates(): Promise<readonly string[]> {
    return this.packages.brewCandidates();
  }

  withSelectedBrew(path: string): DotsApplication {
    const prefix = dirname(dirname(path));
    const runtimePath = [resolve(prefix, "bin"), resolve(prefix, "sbin"), this.dots.paths.path].filter(Boolean).join(delimiter);
    const dots = new DotsService({ ...this.dots.paths, path: runtimePath }, this.dots.manifest, this.dots.nodeVersion);
    const packages = new DepsService({
      profiles: this.packages.profiles, path: runtimePath, env: { ...this.packages.env, PATH: runtimePath },
      runner: this.packages.runner, executableResolver: this.packages.executableResolver,
      candidateResolver: this.packages.candidateResolver, platform: this.packages.platform,
      selectedBrew: path, appResolver: this.packages.appResolver,
    });
    return new DotsApplication(dots, packages);
  }
}

export function packageStatusItems(view: PackageStatusView): readonly DependencyResourceStatus[] {
  return view.profiles.flatMap(({ resources }) => resources);
}

export function packageAvailableCount(view: PackageStatusView): number {
  return packageStatusItems(view).filter(({ state }) =>
    state === "installed-by-selected-brew" || state === "available-externally"
  ).length;
}
