import type {
  DashboardView,
  DotsApplication,
  LinkResultView,
  LinkReviewView,
  PackageResultView,
  PackageReviewView,
  PreparedLinkAction,
  PreparedPackageAction,
} from "./application.js";
import { DependencySelectorError, type DependencyInstallProgress } from "./deps.js";
import { defaultDependencyProfileIds, dependencyProfiles } from "./deps-manifest.js";
import { inspectApplyLock, type ApplyLockInspection } from "./link.js";

export type SetupPhase = "preflight" | "packages" | "links" | "doctor";
export type SetupStatus = "completed" | "cancelled" | "partial" | "failed";

export class SetupInteractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SetupInteractionError";
  }
}

export interface SetupSelection {
  readonly profiles?: readonly string[];
  readonly allPackages?: boolean;
}

export interface SetupHooks {
  readonly onPhaseChange?: (phase: SetupPhase) => void | Promise<void>;
  readonly reviewPackages?: (review: PackageReviewView) => boolean | Promise<boolean>;
  readonly reviewLinks?: (review: LinkReviewView) => boolean | Promise<boolean>;
  readonly onPackageProgress?: (event: DependencyInstallProgress) => void | Promise<void>;
}

export interface SetupOptions {
  readonly signal?: AbortSignal;
}

export interface SetupResult {
  readonly status: SetupStatus;
  readonly phase: SetupPhase;
  readonly profiles: readonly string[];
  readonly packageReview?: PackageReviewView;
  readonly packageResult?: PackageResultView;
  readonly linkReview?: LinkReviewView;
  readonly linkResult?: LinkResultView;
  readonly dashboard?: DashboardView;
  readonly summary: { readonly warnings: number; readonly errors: number; readonly message?: string };
}

export interface SetupApplication {
  readonly dots: { readonly paths: { readonly home: string } };
  preparePackages(ids: readonly string[], all: boolean, options?: { readonly signal?: AbortSignal }): Promise<PreparedPackageAction>;
  prepareLinks(ids: readonly string[], all: boolean): Promise<PreparedLinkAction>;
  dashboard(): Promise<DashboardView>;
}

function selectors(selection: SetupSelection): { ids: readonly string[]; all: boolean } {
  const explicit = selection.profiles ?? [];
  if (selection.allPackages && explicit.length > 0) throw new DependencySelectorError("Package profiles and --all-packages are mutually exclusive");
  const ids = [...new Set(explicit.length > 0 ? explicit : defaultDependencyProfileIds)];
  const known = new Set(dependencyProfiles.map(({ id }) => id));
  const unknown = ids.filter((id) => !known.has(id));
  if (unknown.length > 0) throw new DependencySelectorError(`Unknown dependency profile${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}`);
  return { ids: selection.allPackages ? [] : ids, all: selection.allPackages === true };
}

function lockFailure(lock: ApplyLockInspection): string | undefined {
  if (lock.state === "clear") return undefined;
  if (lock.state === "active") return `Apply lock is active at ${lock.path}; wait for pid ${lock.metadata?.pid ?? "unknown"}, then run 'dots links lock'`;
  if (lock.state === "stale") return `Apply lock is stale at ${lock.path}; inspect it with 'dots links lock', then run 'dots links unlock'`;
  return `Apply lock ownership is unknown at ${lock.path}; inspect it with 'dots links lock', then run 'dots links unlock --force'`;
}

function packageMutated(result: PackageResultView | undefined): boolean {
  return result?.items.some(({ outcome }) => outcome === "installed") === true;
}

function linksRetained(result: LinkResultView | undefined): boolean {
  return result?.items.some(({ outcome }) => outcome === "applied") === true;
}

function linkRecoveryRetained(result: LinkResultView | undefined): boolean {
  return result !== undefined && (result.recoveryRequired || result.rollbackErrors.length > 0
    || result.createdParentsMayRemain || result.items.some(({ outcome }) => outcome === "applied"));
}

export async function runSetup(
  app: DotsApplication | SetupApplication,
  selection: SetupSelection = {},
  hooks: SetupHooks = {},
  options: SetupOptions = {},
): Promise<SetupResult> {
  const selected = selectors(selection);
  const profiles = selected.all ? dependencyProfiles.map(({ id }) => id) : selected.ids;
  let phase: SetupPhase = "preflight";
  let packages: PreparedPackageAction | undefined;
  let links: PreparedLinkAction | undefined;
  let packageReview: PackageReviewView | undefined;
  let packageResult: PackageResultView | undefined;
  let linkReview: LinkReviewView | undefined;
  let linkResult: LinkResultView | undefined;
  const changePhase = async (next: SetupPhase): Promise<void> => {
    phase = next;
    await hooks.onPhaseChange?.(next);
  };
  const result = (status: SetupStatus, message?: string, dashboard?: DashboardView): SetupResult => ({
    status,
    phase,
    profiles,
    ...(packageReview ? { packageReview } : {}),
    ...(packageResult ? { packageResult } : {}),
    ...(linkReview ? { linkReview } : {}),
    ...(linkResult ? { linkResult } : {}),
    ...(dashboard ? { dashboard } : {}),
    summary: dashboard
      ? { warnings: dashboard.warnings, errors: dashboard.errors, ...(message ? { message } : {}) }
      : { warnings: 0, errors: status === "cancelled" ? 0 : 1, ...(message ? { message } : {}) },
  });
  const interrupted = (message: string): SetupResult => result(
    packageMutated(packageResult) || linksRetained(linkResult) || linkRecoveryRetained(linkResult) ? "partial" : "failed",
    message,
  );

  try {
    await changePhase("preflight");
    if (options.signal?.aborted) return result("cancelled", "Setup planning was cancelled");
    const lockMessage = lockFailure(await inspectApplyLock(app.dots.paths.home));
    if (lockMessage) return result("failed", lockMessage);

    await changePhase("packages");
    packages = await app.preparePackages(selected.ids, selected.all, options.signal ? { signal: options.signal } : {});
    if (options.signal?.aborted) {
      packages.cancel();
      return result("cancelled", "Setup planning was cancelled");
    }
    packageReview = packages.review;
    if (packages.blocked) {
      packages.cancel();
      return result("failed", "Package plan is blocked");
    }
    if (packageReview.changes > 0 && !await hooks.reviewPackages?.(packageReview)) {
      packages.cancel();
      return result("cancelled", "Package changes were declined");
    }
    packageResult = await packages.commit(hooks.onPackageProgress ? { onProgress: hooks.onPackageProgress } : {});
    if (!packageResult.success) return interrupted("Package installation did not complete");

    await changePhase("links");
    links = await app.prepareLinks([], true);
    linkReview = links.review;
    if (links.blocked) {
      links.cancel();
      return interrupted("Links were not applied because the link plan is blocked");
    }
    if (linkReview.changes > 0 && !await hooks.reviewLinks?.(linkReview)) {
      links.cancel();
      return packageMutated(packageResult)
        ? result("partial", "Links were not applied because link changes were declined")
        : result("cancelled", "Link changes were declined");
    }
    linkResult = await links.commit(undefined);
    if (!linkResult.success) return interrupted("Links were not completed");

    await changePhase("doctor");
    const dashboard = await app.dashboard();
    return result(dashboard.errors > 0 ? "failed" : "completed", undefined, dashboard);
  } catch (error: unknown) {
    packages?.cancel();
    links?.cancel();
    if (options.signal?.aborted && !packageMutated(packageResult) && !linkRecoveryRetained(linkResult)) {
      return result("cancelled", "Setup planning was cancelled");
    }
    if (error instanceof SetupInteractionError && !packageMutated(packageResult) && !linksRetained(linkResult)) throw error;
    const message = error instanceof Error ? error.message : String(error);
    return interrupted(linkReview ? `Links were not completed: ${message}` : message);
  }
}
