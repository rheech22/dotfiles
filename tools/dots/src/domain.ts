import type { ConfigItem, Dependency } from "./manifest.js";

export type LinkState =
  | { readonly state: "linked" }
  | { readonly state: "wrong-link"; readonly detail: WrongLinkDetail }
  | { readonly state: "occupied"; readonly kind: "file" | "directory" | "other" }
  | { readonly state: "missing" }
  | { readonly state: "source-missing" }
  | { readonly state: "disabled"; readonly reason: string };

export type WrongLinkDetail =
  | { readonly kind: "different"; readonly actualPath: string }
  | { readonly kind: "dangling"; readonly path: string }
  | { readonly kind: "loop"; readonly path: string }
  | { readonly kind: "error"; readonly message: string };

export interface LinkStatus {
  readonly id: string;
  readonly description: string;
  readonly source: string;
  readonly target: string;
  readonly result: LinkState;
}

export interface DependencyStatus {
  readonly id: string;
  readonly command: string;
  readonly description: string;
  readonly required: boolean;
  readonly available: boolean;
  readonly path?: string;
}

export interface NodeStatus {
  readonly required: string;
  readonly actual: string;
  readonly supported: boolean;
}

export interface DoctorReport {
  readonly links: readonly LinkStatus[];
  readonly dependencies: {
    readonly required: readonly DependencyStatus[];
    readonly optional: readonly DependencyStatus[];
  };
  readonly node: NodeStatus;
  readonly summary: {
    readonly errors: number;
    readonly warnings: number;
    readonly healthy: boolean;
  };
}

export interface Manifest {
  readonly items: readonly ConfigItem[];
  readonly dependencies: readonly Dependency[];
}

export interface RuntimePaths {
  readonly repo: string;
  readonly home: string;
  readonly path: string;
}

export type Fingerprint =
  | { readonly kind: "missing" }
  | {
    readonly kind: "file" | "directory" | "symlink" | "other";
    readonly dev: string;
    readonly ino: string;
    readonly mode: number;
    readonly size: string;
    readonly mtimeNs: string;
    readonly ctimeNs: string;
    readonly birthtimeNs: string;
    readonly linkTarget?: string;
  };

export interface PathPrecondition {
  readonly path: string;
  readonly fingerprint: Fingerprint;
}

export type PlanAction = "noop" | "create" | "backup-and-link" | "replace-link" | "blocked";

export interface LinkPlanItem {
  readonly id: string;
  readonly description: string;
  readonly source: string;
  readonly target: string;
  readonly action: PlanAction;
  readonly reason?: string;
  readonly backup?: string;
  readonly sourcePrecondition?: Fingerprint;
  readonly sourceReferent?: string;
  readonly sourceReferentPrecondition?: Fingerprint;
  readonly targetPrecondition: Fingerprint;
  readonly targetAncestorPreconditions: readonly PathPrecondition[];
}

export interface LinkPlan {
  readonly createdAt: string;
  readonly home: string;
  readonly repo: string;
  readonly items: readonly LinkPlanItem[];
  readonly blocked: boolean;
}

export interface ApplyItemResult {
  readonly id: string;
  readonly action: PlanAction;
  readonly target: string;
  readonly backup?: string;
  readonly outcome: "applied" | "noop" | "failed" | "rolled-back" | "not-started";
  readonly error?: string;
}

export interface ApplyResult {
  readonly success: boolean;
  readonly rolledBack: boolean;
  readonly items: readonly ApplyItemResult[];
  readonly rollbackErrors: readonly string[];
  readonly recoveryRequired: boolean;
  readonly lockCleanupError?: string;
  /** Parent directories created during apply may remain when empty. */
  readonly createdParentsMayRemain: boolean;
}

export class SelectorError extends Error {
  readonly ids: readonly string[];

  constructor(ids: readonly string[]) {
    super(`Unknown or unavailable item id${ids.length === 1 ? "" : "s"}: ${ids.join(", ")}`);
    this.name = "SelectorError";
    this.ids = ids;
  }
}
