import { wrapTextWithAnsi } from "@earendil-works/pi-tui";
import type { LinkReviewView, PackageReviewView } from "./application.js";
import { escapeControlCharacters } from "./reporters.js";
import { formatHumanPath } from "./human-path.js";
import type { TuiState } from "./tui-controller.js";

const e = escapeControlCharacters;

export function isConfirmation(state: TuiState): boolean {
  return state.mode === "confirming" || state.mode === "setup-confirming";
}

export function compactConfirmationChrome(state: TuiState, width: number): boolean {
  return isConfirmation(state) && width < 60;
}

export function compactOverlayChrome(state: TuiState, width: number): boolean {
  return width < 60 && (isConfirmation(state) || state.help);
}

export function workspaceStripHeight(state: TuiState, width: number): number {
  if (compactOverlayChrome(state, width)) return 0;
  return width >= 100 ? 3 : 4;
}

export function contextualFooterLines(state: TuiState, width: number): string[] {
  if (state.help) return ["Esc Close help | q Quit"];
  if (isConfirmation(state)) return [];
  if (state.mode === "reviewing") return [`Scroll | ${state.route === "packages" ? "d Details | " : ""}Enter Confirm | Esc Back | ? Help | q Quit`];
  if (state.mode === "choosing-brew") return ["Move | Enter Use | Esc Overview | ? Help | q Quit"];
  if (state.mode === "setup-review") return [`Scroll | ${state.phase === "packages" ? "d Details | " : ""}Enter Confirm | n/Esc Decline phase | ? Help | q Quit`];
  if (state.mode === "setup-planning") return ["q Cancel when safe and exit"];
  if (state.mode === "setup-running" || state.mode === "setup-exit-pending") return ["q Exit after setup settles"];
  if (state.mode === "setup-result") return ["Scroll | Enter/Esc Overview | ? Help | q Quit"];
  if (state.mode === "setup-error") return ["Enter/Esc Overview | ? Help | q Quit"];
  if (state.mode === "mutating" || state.mode === "exit-pending") return ["q Exit after settle"];
  if (state.mode === "result") return ["Scroll | Enter Refresh | ? Help | q Quit"];
  if (state.mode === "error") return ["r Retry | Esc Overview | ? Help | q Quit"];
  if (state.route === "links") return width < 60
    ? ["Space | a Actionable | n Clear | Enter Review", "? Help | q Quit"]
    : width < 80
    ? ["Space Toggle | a Actionable | n Clear | Enter Review", "? Help | q Quit"]
    : ["Space Toggle | a Actionable | n Clear | Enter Review | ? Help | q Quit"];
  if (state.route === "packages") return width < 60
    ? ["Space | Enter Review", "? Help | q Quit"]
    : ["Space Toggle | Enter Review | ? Help | q Quit"];
  return ["r Refresh | ? Help | q Quit"];
}

export function contextualFooterHeight(state: TuiState, width: number): number {
  const lines = contextualFooterLines(state, width);
  if (lines.length === 0) return 0;
  if (width >= 100) return 2;
  return Math.min(2, lines.flatMap((line) => wrapTextWithAnsi(line, Math.max(1, width))).length);
}

export function bodyContentRows(state: TuiState, width: number, height: number): number {
  const header = 1 + workspaceStripHeight(state, width);
  return Math.max(0, height - header - contextualFooterHeight(state, width));
}

export function visiblePagedRows(totalRows: number, bodyRows: number): number {
  if (bodyRows <= 0) return 0;
  return totalRows > bodyRows ? Math.max(0, bodyRows - 1) : bodyRows;
}

export function maximumPageOffset(totalRows: number, bodyRows: number): number {
  return Math.max(0, totalRows - visiblePagedRows(totalRows, bodyRows));
}

export function confirmationLines(state: TuiState, home?: string): string[] {
  if (state.mode !== "confirming" && state.mode !== "setup-confirming") return [];
  if (state.mode === "confirming" && state.route === "packages") {
    const review = state.prepared.review as PackageReviewView;
    return [
      "Packages Confirmation",
      `Exact direct changes: ${review.changes}`,
      `Selected Homebrew: ${review.brewExecutable ? e(home ? formatHumanPath(review.brewExecutable, home) : review.brewExecutable) : "unavailable"}`,
      "Package changes are not rolled back after installation.",
      "[y] Apply   [n/Esc] Return to review",
    ];
  }
  if (state.mode === "setup-confirming" && state.phase === "packages") {
    const review = state.review as PackageReviewView;
    return [
      "Packages Confirmation",
      `Exact direct changes: ${review.changes}`,
      `Selected Homebrew: ${review.brewExecutable ? e(home ? formatHumanPath(review.brewExecutable, home) : review.brewExecutable) : "unavailable"}`,
      "No rollback; links are reviewed separately.",
      "[y] Install packages   [n/Esc] Decline phase",
    ];
  }
  const review = ("prepared" in state ? state.prepared.review : state.review) as LinkReviewView;
  const backups = review.items.filter(({ backup }) => backup !== undefined).length;
  return [
    "Links Confirmation",
    `Exact changes: ${review.changes}`,
    `Backups: ${backups}`,
    "Failure triggers a rollback attempt.",
    "prepared" in state ? "[y] Apply   [n/Esc] Return to review" : "[y] Apply links   [n/Esc] Decline phase",
  ];
}

export function confirmationFits(state: TuiState, width: number, height: number, home?: string): boolean {
  if (!isConfirmation(state) || width < 45) return false;
  const lines = confirmationLines(state, home);
  const innerWidth = compactConfirmationChrome(state, width) ? Math.max(1, width - 2) : Math.max(1, width - 10);
  const required = lines.flatMap((line) => wrapTextWithAnsi(line, innerWidth)).length + 2;
  return required <= bodyContentRows(state, width, height);
}
