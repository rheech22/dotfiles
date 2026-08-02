import type {
  DashboardView,
  LinkStatusView,
  PackageProfileView,
  PackageStatusView,
  PreparedLinkAction,
  PreparedPackageAction,
} from "./application.js";
import { DotsApplication } from "./application.js";
import { defaultDependencyProfileIds } from "./deps-manifest.js";
import { runSetup, type SetupPhase, type SetupResult } from "./setup.js";
import { TuiSetupCoordinator, type SetupReviewPhase } from "./tui-setup-coordinator.js";
import { operationResultLines, reviewRowCount, setupResultLines, wrapReviewLines } from "./tui-review-model.js";
import { bodyContentRows, maximumPageOffset } from "./tui-layout.js";

export type Workspace = "overview" | "links" | "packages";
export type Operation = "links" | "packages";

export interface TuiApplication {
  readonly dots: DotsApplication["dots"];
  dashboard(): Promise<DashboardView>;
  linksStatus(ids: readonly string[], all: boolean, includeDisabled: boolean): Promise<readonly LinkStatusView[]>;
  prepareLinks(ids: readonly string[], all: boolean): Promise<PreparedLinkAction>;
  packageProfiles(id?: string): readonly PackageProfileView[];
  packageStatus(ids: readonly string[], all: boolean): Promise<PackageStatusView>;
  preparePackages(ids: readonly string[], all: boolean, options?: { readonly signal?: AbortSignal }): Promise<PreparedPackageAction>;
  brewCandidates(): Promise<readonly string[]>;
  withSelectedBrew(path: string): TuiApplication;
}

interface BaseState {
  readonly dashboard?: DashboardView;
  readonly help: boolean;
}

export interface LinksWorkspace extends BaseState {
  readonly mode: "workspace";
  readonly route: "links";
  readonly statuses: readonly LinkStatusView[];
  readonly selected: ReadonlySet<string>;
  readonly cursor: number;
  readonly consequence?: PreparedLinkAction;
  readonly planning: boolean;
}

export interface PackagesWorkspace extends BaseState {
  readonly mode: "workspace";
  readonly route: "packages";
  readonly profiles: readonly PackageProfileView[];
  readonly status: PackageStatusView;
  readonly selected: ReadonlySet<string>;
  readonly cursor: number;
  readonly brewCandidates: readonly string[];
}

export type TuiState =
  | (BaseState & { readonly mode: "loading"; readonly route: Workspace })
  | (BaseState & { readonly mode: "workspace"; readonly route: "overview" })
  | LinksWorkspace
  | PackagesWorkspace
  | (BaseState & { readonly mode: "choosing-brew"; readonly route: "packages" | "overview"; readonly candidates: readonly string[]; readonly cursor: number; readonly intent: "packages" | "setup" })
  | (BaseState & { readonly mode: "reviewing" | "confirming"; readonly route: Operation; readonly prepared: PreparedLinkAction | PreparedPackageAction; readonly details: boolean; readonly reviewOffset: number })
  | (BaseState & { readonly mode: "mutating" | "exit-pending"; readonly route: Operation; readonly prepared: PreparedLinkAction | PreparedPackageAction; readonly progress?: string })
  | (BaseState & { readonly mode: "result"; readonly route: Operation; readonly review: PreparedLinkAction["review"] | PreparedPackageAction["review"]; readonly result: unknown; readonly resultOffset?: number })
  | (BaseState & { readonly mode: "setup-planning"; readonly route: "overview"; readonly phase: SetupPhase; readonly profiles: readonly string[]; readonly selectedBrew?: string })
  | (BaseState & { readonly mode: "setup-review" | "setup-confirming"; readonly route: "overview"; readonly phase: SetupReviewPhase; readonly profiles: readonly string[]; readonly review: PreparedLinkAction["review"] | PreparedPackageAction["review"]; readonly details: boolean; readonly reviewOffset: number; readonly selectedBrew?: string })
  | (BaseState & { readonly mode: "setup-running"; readonly route: "overview"; readonly phase: SetupReviewPhase; readonly profiles: readonly string[]; readonly current?: string; readonly completed: number; readonly direct: number; readonly selectedBrew?: string })
  | (BaseState & { readonly mode: "setup-exit-pending"; readonly route: "overview"; readonly phase: SetupPhase; readonly activity: "planning" | "review" | "running"; readonly profiles: readonly string[]; readonly selectedBrew?: string })
  | (BaseState & { readonly mode: "setup-result"; readonly route: "overview"; readonly result: SetupResult; readonly resultOffset: number; readonly selectedBrew?: string })
  | (BaseState & { readonly mode: "setup-error"; readonly route: "overview"; readonly message: string; readonly selectedBrew?: string })
  | (BaseState & { readonly mode: "error"; readonly route: Workspace; readonly message: string });

export interface TuiControllerOptions {
  readonly app?: TuiApplication;
  readonly initialRoute?: Workspace;
  readonly onChange?: () => void;
  readonly onExit?: () => void;
  readonly onMutationOutcome?: (success: boolean) => void;
  readonly canConfirm?: () => boolean;
  readonly debounceMs?: number;
  readonly schedule?: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  readonly cancelSchedule?: (handle: ReturnType<typeof setTimeout>) => void;
  readonly setupRunner?: typeof runSetup;
  readonly onSetupTask?: (task: Promise<void>) => void;
  readonly viewport?: () => { readonly columns: number; readonly rows: number };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function actionableLink(state: LinkStatusView["state"]): boolean {
  return state === "missing" || state === "wrong-link" || state === "occupied";
}

export class TuiController {
  state: TuiState;
  #app: TuiApplication;
  readonly #onChange: () => void;
  readonly #onExit: () => void;
  readonly #onMutationOutcome: (success: boolean) => void;
  readonly #debounceMs: number;
  readonly #schedule: NonNullable<TuiControllerOptions["schedule"]>;
  readonly #cancelSchedule: NonNullable<TuiControllerOptions["cancelSchedule"]>;
  readonly #canConfirm: () => boolean;
  #generation = 0;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #applying = false;
  #setup: TuiSetupCoordinator | undefined;
  readonly #setupRunner: typeof runSetup;
  readonly #onSetupTask: NonNullable<TuiControllerOptions["onSetupTask"]>;
  #selectedBrew: string | undefined;
  #setupGeneration = 0;
  readonly #viewport: NonNullable<TuiControllerOptions["viewport"]>;

  constructor(options: TuiControllerOptions = {}) {
    this.#app = options.app ?? new DotsApplication();
    const route = options.initialRoute ?? "overview";
    this.state = { mode: "loading", route, help: false };
    this.#onChange = options.onChange ?? (() => undefined);
    this.#onExit = options.onExit ?? (() => undefined);
    this.#onMutationOutcome = options.onMutationOutcome ?? (() => undefined);
    this.#debounceMs = options.debounceMs ?? 120;
    this.#schedule = options.schedule ?? setTimeout;
    this.#cancelSchedule = options.cancelSchedule ?? clearTimeout;
    this.#canConfirm = options.canConfirm ?? (() => true);
    this.#setupRunner = options.setupRunner ?? runSetup;
    this.#onSetupTask = options.onSetupTask ?? (() => undefined);
    this.#viewport = options.viewport ?? (() => ({ columns: 80, rows: 24 }));
  }

  get repository(): string {
    return this.#app.dots.paths.repo;
  }

  get home(): string {
    return this.#app.dots.paths.home;
  }

  async start(): Promise<void> {
    await this.#load(this.state.route);
  }

  async input(key: string): Promise<void> {
    if (key === "?") {
      this.state = { ...this.state, help: !this.state.help };
      return this.#changed();
    }
    if (key === "q") return this.#quit();
    if (this.state.help) {
      if (key === "escape") this.state = { ...this.state, help: false };
      return this.#changed();
    }
    if (this.state.mode === "mutating" || this.state.mode === "exit-pending" || this.state.mode === "setup-running" || this.state.mode === "setup-exit-pending") return;
    if (this.state.mode === "setup-review" || this.state.mode === "setup-confirming") {
      if (key === "up" || key === "k" || key === "down" || key === "j") {
        const delta = key === "up" || key === "k" ? -1 : 1;
        this.state = { ...this.state, reviewOffset: Math.max(0, Math.min(this.#reviewMaximum(true), this.state.reviewOffset + delta)) };
      } else if (this.state.mode === "setup-review" && key === "d" && this.state.phase === "packages") {
        this.state = { ...this.state, details: !this.state.details, reviewOffset: 0 };
      } else if (this.state.mode === "setup-review" && (key === "enter" || key === "y") && !this.state.review.blocked) {
        this.state = { ...this.state, mode: "setup-confirming" };
      } else if ((key === "escape" || key === "n") && this.state.mode === "setup-review") {
        this.#declineSetupReview();
      } else if (this.state.mode === "setup-confirming" && key === "y" && this.#canConfirm()) {
        this.#approveSetupReview();
      } else if (this.state.mode === "setup-confirming" && (key === "escape" || key === "n")) {
        this.#declineSetupReview();
      }
      return this.#changed();
    }
    if (this.state.mode === "setup-result") {
      if (key === "up" || key === "k" || key === "down" || key === "j") {
        const delta = key === "up" || key === "k" ? -1 : 1;
        this.state = { ...this.state, resultOffset: Math.max(0, Math.min(this.#setupResultMaximum(), this.state.resultOffset + delta)) };
        this.#changed();
      } else if (key === "enter" || key === "escape") await this.#load("overview");
      return;
    }
    if (this.state.mode === "setup-error") {
      if (key === "escape" || key === "enter") await this.#load("overview");
      return;
    }
    if (this.state.mode === "setup-planning") return;
    if (this.state.mode === "reviewing" || this.state.mode === "confirming") {
      if (key === "up" || key === "k" || key === "down" || key === "j") {
        const delta = key === "up" || key === "k" ? -1 : 1;
        const maximum = this.#reviewMaximum(false);
        this.state = { ...this.state, reviewOffset: Math.max(0, Math.min(maximum, this.state.reviewOffset + delta)) };
        return this.#changed();
      }
    }
    if (this.state.mode === "confirming") {
      if (key === "y") await this.#apply();
      else if (key === "n" || key === "escape") this.state = { ...this.state, mode: "reviewing" };
      return this.#changed();
    }
    if (this.state.mode === "reviewing") {
      if (key === "d" && this.state.route === "packages") this.state = { ...this.state, details: !this.state.details, reviewOffset: 0 };
      else if ((key === "enter" || key === "y") && !this.state.prepared.blocked) this.state = { ...this.state, mode: "confirming" };
      else if (key === "escape") await this.#cancelReview();
      return this.#changed();
    }
    if (this.state.mode === "result") {
      if (key === "up" || key === "k" || key === "down" || key === "j") {
        const delta = key === "up" || key === "k" ? -1 : 1;
        this.state = { ...this.state, resultOffset: Math.max(0, Math.min(this.#resultMaximum(), (this.state.resultOffset ?? 0) + delta)) };
        this.#changed();
      } else if (key === "enter" || key === "escape") await this.#load(this.state.route);
      return;
    }
    if ((this.state.mode === "workspace" || this.state.mode === "loading" || this.state.mode === "error")
      && (key === "1" || key === "2" || key === "3" || key === "left" || key === "right")) {
      const routes: readonly Workspace[] = ["overview", "links", "packages"];
      const next = key === "1" ? 0 : key === "2" ? 1 : key === "3" ? 2
        : (routes.indexOf(this.state.route) + (key === "right" ? 1 : 2)) % 3;
      await this.#load(routes[next]!);
      return;
    }
    if (this.state.mode === "choosing-brew") return this.#brewInput(key);
    if (this.state.mode === "error") {
      if (key === "r") await this.#load(this.state.route);
      else if (key === "escape") await this.#load("overview");
      return;
    }
    if (this.state.mode !== "workspace") return;

    const route = this.state.route;
    if (key === "escape" && route !== "overview") return this.#load("overview");
    if (key === "r") return this.#load(route);
    if (route === "overview") {
      if (key === "l" || key === "enter") await this.#load("links");
      else if (key === "p") await this.#load("packages");
      else if (key === "s") await this.#startSetup();
      return;
    }
    if (key === "up" || key === "k" || key === "down" || key === "j") {
      const count = route === "links" ? this.state.statuses.length : this.state.profiles.length;
      const delta = key === "up" || key === "k" ? -1 : 1;
      this.state = { ...this.state, cursor: Math.max(0, Math.min(count - 1, this.state.cursor + delta)) };
      return this.#changed();
    }
    if (route === "links") await this.#linksInput(key);
    else await this.#packagesInput(key);
  }

  async #load(route: Workspace): Promise<void> {
    this.#cancelPrepared();
    const generation = ++this.#generation;
    const dashboard = this.state.dashboard;
    this.state = { mode: "loading", route, help: false, ...(dashboard ? { dashboard } : {}) };
    this.#changed();
    try {
      const nextDashboard = await this.#app.dashboard();
      if (generation !== this.#generation) return;
      if (route === "overview") {
        this.state = { mode: "workspace", route, help: false, dashboard: nextDashboard };
      } else if (route === "links") {
        const statuses = await this.#app.linksStatus([], true, false);
        if (generation !== this.#generation) return;
        const selected = new Set(statuses.filter(({ state }) => actionableLink(state)).map(({ id }) => id));
        this.state = { mode: "workspace", route, help: false, dashboard: nextDashboard, statuses, selected, cursor: 0, planning: false };
        this.#scheduleLinksPlan();
      } else {
        const candidates = await this.#app.brewCandidates();
        if (generation !== this.#generation) return;
        if (candidates.length > 1) {
          this.state = { mode: "choosing-brew", route, help: false, dashboard: nextDashboard, candidates, cursor: 0, intent: "packages" };
        } else {
          const [profiles, status] = [this.#app.packageProfiles(), await this.#app.packageStatus([], true)];
          if (generation !== this.#generation) return;
          this.state = { mode: "workspace", route, help: false, dashboard: nextDashboard, profiles, status, selected: new Set(), cursor: 0, brewCandidates: candidates };
        }
      }
    } catch (error: unknown) {
      if (generation === this.#generation) this.state = { mode: "error", route, help: false, message: message(error), ...(dashboard ? { dashboard } : {}) };
    }
    this.#changed();
  }

  async #linksInput(key: string): Promise<void> {
    if (this.state.mode !== "workspace" || this.state.route !== "links") return;
    const selected = new Set(this.state.selected);
    if (key === "space") {
      const item = this.state.statuses[this.state.cursor];
      if (item && item.state !== "source-missing") selected.has(item.id) ? selected.delete(item.id) : selected.add(item.id);
    } else if (key === "a") {
      for (const item of this.state.statuses) if (actionableLink(item.state)) selected.add(item.id);
    } else if (key === "n") selected.clear();
    else if (key === "enter") return this.#review("links", [...selected]);
    else return;
    this.#cancelPrepared();
    const { consequence: discarded, ...current } = this.state;
    void discarded;
    this.state = { ...current, selected, planning: selected.size > 0 };
    this.#changed();
    this.#scheduleLinksPlan();
  }

  async #packagesInput(key: string): Promise<void> {
    if (this.state.mode !== "workspace" || this.state.route !== "packages") return;
    const selected = new Set(this.state.selected);
    const current = this.state.profiles[this.state.cursor];
    if (key === "space" && current) selected.has(current.id) ? selected.delete(current.id) : selected.add(current.id);
    else if (key === "enter" && current) return this.#review("packages", selected.size ? [...selected] : [current.id]);
    else return;
    this.state = { ...this.state, selected };
    this.#changed();
  }

  #scheduleLinksPlan(): void {
    if (this.state.mode !== "workspace" || this.state.route !== "links" || this.state.selected.size === 0) return;
    if (this.#timer) this.#cancelSchedule(this.#timer);
    const ids = [...this.state.selected];
    const generation = ++this.#generation;
    this.#timer = this.#schedule(() => { void this.#prepareLinkConsequence(ids, generation); }, this.#debounceMs);
  }

  async #prepareLinkConsequence(ids: readonly string[], generation: number): Promise<void> {
    try {
      const prepared = await this.#app.prepareLinks(ids, false);
      if (generation !== this.#generation || this.state.mode !== "workspace" || this.state.route !== "links") {
        prepared.cancel();
        return;
      }
      this.state.consequence?.cancel();
      this.state = { ...this.state, consequence: prepared, planning: false };
    } catch (error: unknown) {
      if (generation === this.#generation) this.state = { mode: "error", route: "links", help: false, message: message(error), ...(this.state.dashboard ? { dashboard: this.state.dashboard } : {}) };
    }
    this.#changed();
  }

  async #review(operation: Operation, ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return;
    const generation = ++this.#generation;
    try {
      let prepared: PreparedLinkAction | PreparedPackageAction;
      if (operation === "links" && this.state.mode === "workspace" && this.state.route === "links"
        && this.state.consequence && [...this.state.selected].every((id) => ids.includes(id)) && this.state.selected.size === ids.length) {
        prepared = this.state.consequence;
      } else {
        prepared = operation === "links" ? await this.#app.prepareLinks(ids, false) : await this.#app.preparePackages(ids, false);
      }
      if (generation !== this.#generation) return prepared.cancel();
      this.state = { mode: "reviewing", route: operation, help: false, prepared, details: false, reviewOffset: 0, ...(this.state.dashboard ? { dashboard: this.state.dashboard } : {}) };
    } catch (error: unknown) {
      if (generation === this.#generation) this.state = { mode: "error", route: operation, help: false, message: message(error), ...(this.state.dashboard ? { dashboard: this.state.dashboard } : {}) };
    }
    this.#changed();
  }

  async #cancelReview(): Promise<void> {
    if (this.state.mode !== "reviewing") return;
    const route = this.state.route;
    this.state.prepared.cancel();
    await this.#load(route);
  }

  async #apply(): Promise<void> {
    if (this.state.mode !== "confirming" || this.#applying || this.state.prepared.blocked || !this.#canConfirm()) return;
    this.#applying = true;
    const prepared = this.state.prepared;
    const route = this.state.route;
    const dashboard = this.state.dashboard;
    this.state = { mode: "mutating", route, help: false, prepared, ...(dashboard ? { dashboard } : {}) };
    this.#changed();
    try {
      let started = 0;
      const total = route === "packages" ? (prepared as PreparedPackageAction).review.changes : 0;
      const result = route === "links"
        ? await (prepared as PreparedLinkAction).commit()
        : await (prepared as PreparedPackageAction).commit({ onProgress: ({ kind, name }) => {
          if (this.state.mode === "mutating" || this.state.mode === "exit-pending") {
            this.state = { ...this.state, progress: `${kind}:${name} (${started}/${total} completed)` };
            started += 1;
            this.#changed();
          }
        } });
      this.#onMutationOutcome(result.success);
      if (this.state.mode === "exit-pending") this.#onExit();
      else this.state = { mode: "result", route, help: false, review: prepared.review, result, resultOffset: 0, ...(dashboard ? { dashboard } : {}) };
    } catch (error: unknown) {
      this.#onMutationOutcome(false);
      if (this.state.mode === "exit-pending") this.#onExit();
      else this.state = { mode: "error", route, help: false, message: message(error), ...(dashboard ? { dashboard } : {}) };
    } finally {
      this.#applying = false;
      this.#changed();
    }
  }

  async #brewInput(key: string): Promise<void> {
    if (this.state.mode !== "choosing-brew") return;
    if (key === "up" || key === "k" || key === "down" || key === "j") {
      const delta = key === "up" || key === "k" ? -1 : 1;
      this.state = { ...this.state, cursor: Math.max(0, Math.min(this.state.candidates.length - 1, this.state.cursor + delta)) };
      return this.#changed();
    }
    if (key === "escape") return this.#load("overview");
    if (key !== "enter") return;
    const selected = this.state.candidates[this.state.cursor];
    if (!selected) return;
    this.#app = this.#app.withSelectedBrew(selected);
    this.#selectedBrew = selected;
    if (this.state.intent === "setup") this.#beginSetup();
    else await this.#load("packages");
  }

  async #startSetup(): Promise<void> {
    const generation = ++this.#setupGeneration;
    const dashboard = this.state.dashboard;
    this.state = { mode: "setup-planning", route: "overview", help: false, phase: "preflight", profiles: defaultDependencyProfileIds, ...(dashboard ? { dashboard } : {}) };
    this.#changed();
    try {
      const candidates = await this.#app.brewCandidates();
      if (generation !== this.#setupGeneration || this.#setupExitRequested()) return;
      if (candidates.length > 1) {
        this.state = { mode: "choosing-brew", route: "overview", help: false, candidates, cursor: 0, intent: "setup", ...(dashboard ? { dashboard } : {}) };
        return this.#changed();
      }
      this.#beginSetup(generation);
    } catch (error: unknown) {
      if (generation !== this.#setupGeneration) return;
      this.state = { mode: "setup-error", route: "overview", help: false, message: message(error), ...(dashboard ? { dashboard } : {}) };
      this.#onMutationOutcome(false);
      this.#changed();
    }
  }

  #beginSetup(generation = ++this.#setupGeneration): void {
    const dashboard = this.state.dashboard;
    const profiles = defaultDependencyProfileIds;
    let packageResourcesStarted = 0;
    const common = { route: "overview" as const, help: false, profiles, ...(dashboard ? { dashboard } : {}), ...(this.#selectedBrew ? { selectedBrew: this.#selectedBrew } : {}) };
    this.state = { mode: "setup-planning", phase: "preflight", ...common };
    const coordinator = new TuiSetupCoordinator(this.#app, { profiles }, {
      onPhaseChange: (phase) => {
        if (generation !== this.#setupGeneration) return;
        if (this.state.mode !== "setup-exit-pending") this.state = { mode: "setup-planning", phase, ...common };
        this.#changed();
      },
      onReview: (phase, review) => {
        if (generation !== this.#setupGeneration) return;
        if (this.state.mode !== "setup-exit-pending") this.state = { mode: "setup-review", phase, review, details: false, reviewOffset: 0, ...common };
        this.#changed();
      },
      onPackageProgress: (kind, name) => {
        if (generation !== this.#setupGeneration) return;
        if (this.state.mode === "setup-running") {
          this.state = { ...this.state, current: `${kind}:${name}`, completed: packageResourcesStarted };
          packageResourcesStarted += 1;
          this.#changed();
        }
      },
    }, this.#setupRunner);
    this.#setup = coordinator;
    const task = coordinator.task.then((result) => {
      if (generation !== this.#setupGeneration) return;
      const exiting = this.state.mode === "setup-exit-pending";
      this.#setup = undefined;
      if (result.status === "partial" || result.status === "failed") this.#onMutationOutcome(false);
      if (exiting) this.#onExit();
      else this.state = { mode: "setup-result", route: "overview", help: false, result, resultOffset: 0, ...(result.dashboard ? { dashboard: result.dashboard } : dashboard ? { dashboard } : {}), ...(this.#selectedBrew ? { selectedBrew: this.#selectedBrew } : {}) };
      this.#changed();
    }, (error: unknown) => {
      if (generation !== this.#setupGeneration) return;
      const exiting = this.state.mode === "setup-exit-pending";
      this.#setup = undefined;
      this.#onMutationOutcome(false);
      if (exiting) this.#onExit();
      else this.state = { mode: "setup-error", route: "overview", help: false, message: message(error), ...(dashboard ? { dashboard } : {}), ...(this.#selectedBrew ? { selectedBrew: this.#selectedBrew } : {}) };
      this.#changed();
    });
    this.#onSetupTask(task);
    this.#changed();
  }

  #setupExitRequested(): boolean {
    return this.state.mode === "setup-exit-pending";
  }

  #approveSetupReview(): void {
    if (this.state.mode !== "setup-confirming") return;
    const direct = this.state.review.changes;
    const phase = this.state.phase;
    this.state = { mode: "setup-running", route: "overview", help: false, phase, profiles: this.state.profiles, completed: 0, direct, ...(this.state.dashboard ? { dashboard: this.state.dashboard } : {}), ...(this.state.selectedBrew ? { selectedBrew: this.state.selectedBrew } : {}) };
    this.#setup?.respond(phase, true);
  }

  #declineSetupReview(): void {
    if (this.state.mode !== "setup-review" && this.state.mode !== "setup-confirming") return;
    const phase = this.state.phase;
    this.state = { mode: "setup-planning", route: "overview", help: false, phase, profiles: this.state.profiles, ...(this.state.dashboard ? { dashboard: this.state.dashboard } : {}), ...(this.state.selectedBrew ? { selectedBrew: this.state.selectedBrew } : {}) };
    this.#setup?.respond(phase, false);
  }

  #quit(): void {
    if (this.state.mode.startsWith("setup-") && this.state.mode !== "setup-result" && this.state.mode !== "setup-error") {
      const activity = this.state.mode === "setup-running" ? "running" : this.state.mode === "setup-review" || this.state.mode === "setup-confirming" ? "review" : "planning";
      const phase = "phase" in this.state ? this.state.phase : "preflight";
      const profiles = "profiles" in this.state && this.state.route === "overview" ? this.state.profiles : defaultDependencyProfileIds;
      this.state = { mode: "setup-exit-pending", route: "overview", help: false, phase, activity, profiles, ...(this.state.dashboard ? { dashboard: this.state.dashboard } : {}), ...(this.#selectedBrew ? { selectedBrew: this.#selectedBrew } : {}) };
      this.#setup?.requestExit();
      if (!this.#setup) this.#setupGeneration += 1;
      this.#changed();
      if (!this.#setup) this.#onExit();
      return;
    }
    if (this.state.mode === "mutating") {
      this.state = { ...this.state, mode: "exit-pending" };
      this.#changed();
      return;
    }
    if (this.state.mode === "exit-pending") return;
    this.#cancelPrepared();
    this.#onExit();
  }

  #cancelPrepared(): void {
    this.#generation += 1;
    if (this.#timer) this.#cancelSchedule(this.#timer);
    this.#timer = undefined;
    if (this.state.mode === "workspace" && this.state.route === "links") this.state.consequence?.cancel();
    if (this.state.mode === "reviewing" || this.state.mode === "confirming") this.state.prepared.cancel();
  }

  #reviewMaximum(setup: boolean): number {
    const state = this.state;
    if (setup && state.mode !== "setup-review" && state.mode !== "setup-confirming") return 0;
    if (!setup && state.mode !== "reviewing" && state.mode !== "confirming") return 0;
    const dimensions = this.#viewport();
    const width = Math.max(1, dimensions.columns);
    const visibleContent = bodyContentRows(state, width, dimensions.rows);
    const route = setup ? (state as Extract<TuiState, { mode: "setup-review" | "setup-confirming" }>).phase
      : (state as Extract<TuiState, { mode: "reviewing" | "confirming" }>).route;
    const review = setup ? (state as Extract<TuiState, { mode: "setup-review" | "setup-confirming" }>).review
      : (state as Extract<TuiState, { mode: "reviewing" | "confirming" }>).prepared.review;
    const details = state.mode === "setup-review" || state.mode === "setup-confirming" || state.mode === "reviewing" || state.mode === "confirming"
      ? state.details : false;
    return maximumPageOffset(reviewRowCount(route, review, details, width, setup, this.home), visibleContent);
  }

  #resultMaximum(): number {
    if (this.state.mode !== "result") return 0;
    const dimensions = this.#viewport();
    const count = wrapReviewLines(operationResultLines(this.state.route, this.state.result, this.home), dimensions.columns).length;
    return maximumPageOffset(count, bodyContentRows(this.state, dimensions.columns, dimensions.rows));
  }

  #setupResultMaximum(): number {
    if (this.state.mode !== "setup-result") return 0;
    const dimensions = this.#viewport();
    const count = wrapReviewLines(setupResultLines(this.state.result, this.state.selectedBrew, this.home), dimensions.columns).length;
    return maximumPageOffset(count, bodyContentRows(this.state, dimensions.columns, dimensions.rows));
  }

  #changed(): void {
    this.#onChange();
  }
}
