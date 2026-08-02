import type { LinkReviewView, PackageReviewView } from "./application.js";
import { runSetup, type SetupApplication, type SetupPhase, type SetupResult, type SetupSelection } from "./setup.js";

export type SetupReviewPhase = "packages" | "links";

export interface TuiSetupCoordinatorHooks {
  readonly onPhaseChange: (phase: SetupPhase) => void;
  readonly onReview: (phase: SetupReviewPhase, review: PackageReviewView | LinkReviewView) => void;
  readonly onPackageProgress: (kind: string, name: string) => void;
}

type SetupRunner = typeof runSetup;

export class TuiSetupCoordinator {
  readonly task: Promise<SetupResult>;
  #pending: { readonly phase: SetupReviewPhase; readonly resolve: (approved: boolean) => void } | undefined;
  #exitRequested = false;
  #activity: "planning" | "review" | "mutation" = "planning";
  readonly #abortController = new AbortController();

  constructor(
    app: SetupApplication,
    selection: SetupSelection,
    hooks: TuiSetupCoordinatorHooks,
    runner: SetupRunner = runSetup,
  ) {
    const review = (phase: SetupReviewPhase, value: PackageReviewView | LinkReviewView): Promise<boolean> => {
      if (this.#exitRequested) return Promise.resolve(false);
      this.#activity = "review";
      hooks.onReview(phase, value);
      return new Promise<boolean>((resolve) => { this.#pending = { phase, resolve }; });
    };
    this.task = runner(app, selection, {
      onPhaseChange: (phase) => {
        this.#activity = "planning";
        return hooks.onPhaseChange(phase);
      },
      reviewPackages: (value) => review("packages", value),
      reviewLinks: (value) => review("links", value),
      onPackageProgress: ({ kind, name }) => hooks.onPackageProgress(kind, name),
    }, { signal: this.#abortController.signal });
  }

  respond(phase: SetupReviewPhase, approved: boolean): boolean {
    if (this.#pending?.phase !== phase) return false;
    const pending = this.#pending;
    this.#pending = undefined;
    if (approved) this.#activity = "mutation";
    pending.resolve(approved);
    return true;
  }

  requestExit(): void {
    this.#exitRequested = true;
    if (this.#pending) {
      this.respond(this.#pending.phase, false);
      return;
    }
    if (this.#activity === "planning") this.#abortController.abort();
  }
}
