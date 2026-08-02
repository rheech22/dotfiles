import { wrapTextWithAnsi } from "@earendil-works/pi-tui";
import type { LinkReviewView, PackageReviewView } from "./application.js";
import { escapeControlCharacters } from "./reporters.js";
import { formatHumanPath, formatHumanText } from "./human-path.js";
import type { SetupResult } from "./setup.js";

const e = escapeControlCharacters;
const hp = (value: string, home?: string): string => e(home ? formatHumanPath(value, home) : value);
const ht = (value: string, home?: string): string => e(home ? formatHumanText(value, home) : value);

export function linkReviewLines(review: LinkReviewView, home?: string): string[] {
  const unchanged = review.items.filter(({ action }) => action === "noop").length;
  const relevant = review.items.filter(({ action }) => action !== "noop");
  return [
    `Summary: ${review.changes} changes, ${relevant.filter(({ action }) => action === "blocked").length} blocked, ${unchanged} unchanged`,
    ...relevant.flatMap((item) => [
      `${item.action === "blocked" ? "BLOCKED" : "CHANGE"} ${e(item.description)}: ${item.action}${item.reason ? `; ${ht(item.reason, home)}` : ""}`,
      ...(item.backup ? [`  backup ${hp(item.backup, home)}`] : []),
    ]),
    ...(relevant.length === 0 ? ["OK No link changes required"] : []),
  ];
}

export function packageReviewLines(review: PackageReviewView, details: boolean, home?: string): string[] {
  const unchanged = review.items.filter(({ action }) => action === "noop").length;
  const relevant = review.items.filter(({ action }) => action !== "noop");
  const transitive = [...new Set(review.items.flatMap(({ preview }) => preview ?? []))];
  return [
    `Summary: ${review.changes} direct changes, ${relevant.filter(({ action }) => action === "blocked").length} blocked, ${unchanged} unchanged`,
    `Profiles: ${review.profiles.map(e).join(", ")}`,
    `Homebrew: ${review.brewExecutable ? hp(review.brewExecutable, home) : "unavailable"}`,
    ...relevant.map((item) => `${item.action === "blocked" ? "BLOCKED" : "CHANGE"} ${item.kind}:${e(item.name)} ${item.action}${item.reason ? `; ${ht(item.reason, home)}` : ""}`),
    ...(relevant.length === 0 ? ["OK No package changes required"] : []),
    `Preview: ${transitive.length} lines${details ? "" : " (d details)"}`,
    ...(details ? transitive.map((line) => `  ${ht(line, home)}`) : []),
  ];
}

export function wrapReviewLines(lines: readonly string[], width: number): string[] {
  return lines.flatMap((line) => wrapTextWithAnsi(line, Math.max(1, width)));
}

export function reviewRowCount(
  route: "links" | "packages",
  review: LinkReviewView | PackageReviewView,
  details: boolean,
  width: number,
  setup = false,
  home?: string,
): number {
  const lines = route === "links"
    ? linkReviewLines(review as LinkReviewView, home)
    : packageReviewLines(review as PackageReviewView, details, home);
  const title = setup
    ? `Setup ${route === "packages" ? "1/2 Packages" : "2/2 Links"}`
    : `${route === "links" ? "Links" : "Packages"} Review`;
  return wrapReviewLines([title, ...lines], width).length;
}

export function operationResultLines(route: "links" | "packages", value: unknown, home?: string): string[] {
  const result = value as { success?: boolean; rolledBack?: boolean; rollbackErrors?: readonly string[]; recoveryRequired?: boolean; lockCleanupError?: string; items?: readonly { outcome?: string; target?: string; backup?: string; error?: string }[] };
  return [
    `${result.success ? "OK" : "BLOCKED"} ${route === "links" ? "Link" : "Package"} operation ${result.success ? "completed" : "failed"}`,
    ...(result.rolledBack ? ["WARN Changes were rolled back"] : []),
    ...(result.recoveryRequired ? ["BLOCKED Manual recovery required"] : []),
    ...(result.rollbackErrors ?? []).map((error) => `BLOCKED Rollback: ${ht(error, home)}`),
    ...(result.lockCleanupError ? [`WARN Lock cleanup: ${ht(result.lockCleanupError, home)}`] : []),
    ...(!result.success && (result.items ?? []).some(({ outcome }) => outcome === "installed") ? ["WARN Partial package installation"] : []),
    ...(result.items ?? []).filter(({ outcome }) => outcome !== "noop" && outcome !== "not-started").map((item) => `${e(item.outcome?.toUpperCase() ?? "")}${item.target ? ` ${hp(item.target, home)}` : ""}${item.backup ? ` backup ${hp(item.backup, home)}` : ""}${item.error ? ` ${ht(item.error, home)}` : ""}`),
  ];
}

export function setupResultLines(result: SetupResult, selectedBrew?: string, home?: string): string[] {
  const installed = result.packageResult?.items.filter(({ outcome }) => outcome === "installed") ?? [];
  const applied = result.linkResult?.items.filter(({ outcome }) => outcome === "applied") ?? [];
  const links = result.linkResult;
  const resourceLabel = result.status === "completed" ? "INSTALLED" : "RETAINED";
  const linkLabel = result.status === "completed" ? "APPLIED" : "RETAINED";
  const title = result.status === "completed"
    ? result.summary.warnings > 0 ? "OK Setup completed with warnings" : "OK Setup completed"
    : result.status === "cancelled" ? "WARN Setup cancelled before mutation"
    : result.status === "partial" ? "BLOCKED Setup partial; retained changes require attention"
    : result.phase === "packages" ? "BLOCKED Setup failed during packages" : "BLOCKED Setup failed";
  const packageSummary = result.packageResult
    ? `Packages: ${installed.length} installed, ${result.packageResult.items.filter(({ outcome }) => outcome === "failed").length} failed`
    : "Packages: not applied";
  const linkSummary = links
    ? `Links: ${applied.length} applied${links.rolledBack ? ", failed and rolled back" : links.success ? "" : ", failed"}`
    : installed.length > 0 ? "Links: not applied; package changes are retained" : "Links: not applied";
  const lockRecovery = result.summary.message?.includes("Apply lock is stale")
    ? ["Recovery inspect: dots links lock", "Recovery remove stale lock: dots links unlock"]
    : result.summary.message?.includes("Apply lock is active") ? ["Recovery inspect after the active process exits: dots links lock"]
    : result.summary.message?.includes("ownership is unknown") ? ["Recovery inspect: dots links lock", "Recovery force unlock only after inspection: dots links unlock --force"]
    : [];
  return [
    title,
    `Phase: ${result.phase}`,
    ...(result.summary.message ? [`${result.status === "completed" ? "WARN" : "BLOCKED"} ${ht(result.summary.message, home)}`] : []),
    ...lockRecovery,
    packageSummary,
    linkSummary,
    ...(links?.recoveryRequired ? ["BLOCKED RECOVERY required; inspect retained targets and backups before retrying"] : []),
    ...(links?.rollbackErrors ?? []).map((value) => `BLOCKED Rollback: ${ht(value, home)}`),
    ...(links?.lockCleanupError ? [`WARN Lock cleanup: ${ht(links.lockCleanupError, home)}`] : []),
    ...installed.map(({ kind, name }) => `${resourceLabel} package ${kind}:${e(name)}`),
    ...applied.map(({ target, backup }) => `${linkLabel} link ${hp(target, home)}${backup ? ` backup ${hp(backup, home)}` : ""}`),
    ...(result.dashboard ? [`Final readiness: ${result.dashboard.healthy ? "ready" : `${result.dashboard.errors} errors, ${result.dashboard.warnings} warnings`}`] : []),
    ...(selectedBrew && result.packageReview && selectedBrew !== process.env.DOTS_BREW ? [`Hint: persist with export DOTS_BREW=${hp(selectedBrew, home)} in ~/.config/zsh/.zshenv.local`] : []),
  ];
}
