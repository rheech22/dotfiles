export type PreparedActionState = "prepared" | "committing" | "committed" | "cancelled";

export class PreparedActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PreparedActionError";
  }
}

export interface PreparedAction<Review, Result, CommitOptions = void> {
  readonly review: Review;
  readonly blocked: boolean;
  readonly state: PreparedActionState;
  commit(options: CommitOptions): Promise<Result>;
  cancel(): void;
}

export function prepareAction<Review, Result, CommitOptions>(
  review: Review,
  blocked: boolean,
  commitAction: (options: CommitOptions) => Promise<Result>,
): PreparedAction<Review, Result, CommitOptions> {
  let state: PreparedActionState = "prepared";
  return {
    review,
    blocked,
    get state() { return state; },
    async commit(options: CommitOptions): Promise<Result> {
      if (blocked) throw new PreparedActionError("Prepared action is blocked and cannot be committed");
      if (state !== "prepared") throw new PreparedActionError(`Prepared action is ${state} and cannot be committed`);
      state = "committing";
      try {
        const result = await commitAction(options);
        state = "committed";
        return result;
      } catch (error: unknown) {
        state = "committed";
        throw error;
      }
    },
    cancel(): void {
      if (state === "prepared") state = "cancelled";
    },
  };
}
