#!/usr/bin/env node
import { realpath } from "node:fs/promises";
import { delimiter, dirname, isAbsolute, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import {
  DotsApplication,
  packageAvailableCount,
  packageStatusItems,
  type DashboardView,
  type LinkReviewView,
  type LinkResultView,
  type PackageReviewView,
} from "./application.js";
import { DepsService } from "./deps.js";
import { DependencySelectorError } from "./deps.js";
import { SelectorError } from "./domain.js";
import { DotsConfigError, DotsService, resolveRuntimePaths } from "./service.js";
import { escapeControlCharacters, renderDependencyInstall, renderDoctor, toJson } from "./reporters.js";
import { doctorExitCode } from "./service.js";
import { runTui } from "./tui.js";
import { runSetup, SetupInteractionError, type SetupResult } from "./setup.js";
import { resolveAbsoluteExecutable } from "./process.js";
import { formatHumanPath, formatHumanText } from "./human-path.js";

type ExitCode = 0 | 1 | 2 | 3;

class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UsageError";
  }
}

interface Options {
  readonly json: boolean;
  readonly verbose: boolean;
  readonly all: boolean;
  readonly allPackages: boolean;
  readonly strict: boolean;
  readonly includeDisabled: boolean;
  readonly yes: boolean;
  readonly dryRun: boolean;
  readonly force: boolean;
  readonly ids: readonly string[];
  readonly brew?: string;
}

interface JsonEnvelope {
  readonly schemaVersion: 1;
  readonly command: string;
  readonly summary: Readonly<Record<string, unknown>>;
  readonly items: readonly unknown[];
}

const rootHelp = `Usage: dots <command> [options]

Commands:
  status [--json] [--verbose]                  Inspect overall readiness
  check [--strict] [--json]                    Check readiness for automation
  links list|status|plan|apply|lock|unlock     Inspect and manage links
  packages profiles|status|plan|apply          Inspect and manage packages
  setup [PROFILE...] [options]                 Bootstrap packages, links, and readiness
  ui [overview|links|packages]                 Open the visual dashboard

Run 'dots <command> --help' for command-specific examples and exit semantics.`;

const help: Readonly<Record<string, string>> = {
  status: `Usage: dots status [--json] [--verbose]\n\nReports readiness. Inspection success exits 0 even when unhealthy.\nExample: dots status --json`,
  check: `Usage: dots check [--strict] [--json]\n\nExits 1 for unhealthy readiness only with --strict; inspection failures exit 1.\nExample: dots check --strict`,
  links: `Usage: dots links <list|status|plan|apply|lock|unlock> [options]\n\nUse 'dots links <subcommand> --help' for details.`,
  "links list": `Usage: dots links list [--include-disabled] [--json]\n\nLists link metadata without inspecting the filesystem.`,
  "links status": `Usage: dots links status [ids...] [--all] [--include-disabled] [--json] [--verbose]\n\nSelectors and --all are mutually exclusive. Exits 0 when inspection succeeds.`,
  "links plan": `Usage: dots links plan <ids...>|--all [--json] [--verbose]\n\nBuilds an exact safe plan. Blocked plans exit 1.\nExample: dots links plan zshrc gitconfig`,
  "links apply": `Usage: dots links apply <ids...>|--all [--yes] [--json] [--verbose]\n\nReviews the exact plan in this process before confirmation. Non-TTY use requires --yes.`,
  "links lock": `Usage: dots links lock [--json]\n\nReports whether the apply lock is clear, active, stale, or has unknown ownership.`,
  "links unlock": `Usage: dots links unlock [--force] [--yes]\n\nRemoves only a proven stale lock. Active locks always refuse. Legacy or unknown locks require --force. Non-TTY use requires --yes.`,
  packages: `Usage: dots packages <profiles|status|plan|apply> [options]\n\nUse 'dots packages <subcommand> --help' for details.`,
  setup: `Usage: dots setup [PROFILE...] [--all-packages] [--brew PATH] [--yes] [--json] [--verbose]\n\nInstalls the selected package profiles, links all enabled configs, then checks fresh readiness. Explicit profiles replace defaults; --all-packages is mutually exclusive with profiles. Package and link changes are confirmed separately. Non-TTY use with changes requires --yes.`,
  "packages profiles": `Usage: dots packages profiles [profile] [--json]\n\nShows profile descriptions and package drill-down metadata.`,
  "packages status": `Usage: dots packages status <profiles...>|--all [--brew PATH] [--json] [--verbose]\n\nUses local brew list/tap queries only. Blocked or failed queries exit 1.`,
  "packages plan": `Usage: dots packages plan <profiles...>|--all [--brew PATH] [--json] [--verbose]\n\nRuns hardened Homebrew dry-run previews. Blocked plans exit 1.`,
  "packages apply": `Usage: dots packages apply <profiles...>|--all [--brew PATH] [--yes] [--json] [--verbose]\n\nReviews and applies an exact plan. Non-TTY use requires --yes.`,
  ui: `Usage: dots ui [overview|links|packages]\n\nRequires an interactive terminal.`,
};

function envelope(command: string, summary: Readonly<Record<string, unknown>>, items: readonly unknown[]): string {
  const value: JsonEnvelope = { schemaVersion: 1, command, summary, items };
  return `${JSON.stringify(value, null, 2)}\n`;
}

function parseOptions(args: readonly string[], allowed: ReadonlySet<string>, allowIds: boolean): Options {
  const ids: string[] = [];
  let json = false;
  let verbose = false;
  let all = false;
  let allPackages = false;
  let strict = false;
  let includeDisabled = false;
  let yes = false;
  let dryRun = false;
  let force = false;
  let brew: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (arg === "--brew" && allowed.has(arg)) {
      const value = args[++index];
      if (!value || !isAbsolute(value)) throw new UsageError("--brew requires an absolute path");
      brew = value;
      continue;
    }
    if (arg.startsWith("-")) {
      if (!allowed.has(arg)) throw new UsageError(`Unknown option: ${arg}`);
      if (arg === "--json") json = true;
      else if (arg === "--verbose") verbose = true;
      else if (arg === "--all") all = true;
      else if (arg === "--all-packages") allPackages = true;
      else if (arg === "--strict") strict = true;
      else if (arg === "--include-disabled") includeDisabled = true;
      else if (arg === "--yes") yes = true;
      else if (arg === "--dry-run") dryRun = true;
      else if (arg === "--force") force = true;
      continue;
    }
    if (!allowIds) throw new UsageError(`Unexpected argument: ${arg}`);
    ids.push(arg);
  }
  if ((all || allPackages) && ids.length > 0) throw new UsageError("Selectors and --all are mutually exclusive");
  return { json, verbose, all, allPackages, strict, includeDisabled, yes, dryRun, force, ids, ...(brew ? { brew } : {}) };
}

async function application(brew?: string): Promise<DotsApplication> {
  const selectedBrew = brew ?? process.env.DOTS_BREW;
  const canonicalBrew = selectedBrew ? await resolveAbsoluteExecutable(selectedBrew) : undefined;
  if (selectedBrew && !canonicalBrew) throw new DotsConfigError(`Selected Homebrew path is not executable: ${selectedBrew}`);
  const runtime = resolveRuntimePaths();
  const prefix = canonicalBrew && isAbsolute(canonicalBrew) ? dirname(dirname(canonicalBrew)) : undefined;
  const path = prefix
    ? [resolve(prefix, "bin"), resolve(prefix, "sbin"), runtime.path].filter(Boolean).join(delimiter)
    : runtime.path;
  const dots = new DotsService({ ...runtime, path });
  return new DotsApplication(dots, new DepsService({ env: { ...process.env, PATH: path }, ...(canonicalBrew ? { selectedBrew: canonicalBrew } : {}) }));
}

function printHelp(key: string): ExitCode {
  const text = help[key];
  if (!text) throw new UsageError(`Unknown command: ${key}`);
  process.stdout.write(`${text}\n`);
  return 0;
}

function dashboardIssues(view: DashboardView): readonly unknown[] {
  return [
    ...view.links.filter(({ state }) => state !== "linked" && state !== "disabled"),
    ...view.dependencies.filter(({ available }) => !available),
    ...(view.node.supported ? [] : [{ type: "node", ...view.node }]),
  ];
}

const humanPath = (value: string, home: string): string => escapeControlCharacters(formatHumanPath(value, home));
const humanText = (value: string, home: string): string => escapeControlCharacters(formatHumanText(value, home));

function renderDashboard(view: DashboardView, verbose: boolean, home: string): string {
  const lines = [`Readiness: ${view.healthy ? "ready" : "needs attention"} (${view.errors} errors, ${view.warnings} warnings)`];
  for (const link of view.links) {
    if (!verbose && (link.state === "linked" || link.state === "disabled")) continue;
    const paths = verbose ? ` source=${humanPath(link.source, home)} target=${humanPath(link.target, home)}` : "";
    lines.push(`${link.state === "linked" ? "OK" : "!!"} ${escapeControlCharacters(link.description)} [${escapeControlCharacters(link.id)}]: ${link.state}${paths}${link.detail ? ` (${humanText(link.detail, home)})` : ""}`);
  }
  for (const dependency of view.dependencies) {
    if (!verbose && dependency.available) continue;
    const path = verbose && dependency.path ? ` at ${humanPath(dependency.path, home)}` : "";
    lines.push(`${dependency.available ? "OK" : "!!"} ${escapeControlCharacters(dependency.description)} [${escapeControlCharacters(dependency.id)}]: ${dependency.available ? "available" : "missing"}${path}`);
  }
  return lines.join("\n");
}

function renderLinkReview(review: LinkReviewView, verbose: boolean, home: string): string {
  const lines = [`Links: ${review.changes} changes, ${review.items.filter(({ action }) => action === "blocked").length} blocked`];
  for (const item of review.items) {
    if (!verbose && item.action === "noop") continue;
    const paths = verbose ? ` source=${humanPath(item.source, home)} target=${humanPath(item.target, home)}${item.backup ? ` backup=${humanPath(item.backup, home)}` : ""}` : "";
    lines.push(`${item.action.toUpperCase()} ${escapeControlCharacters(item.description)} [${escapeControlCharacters(item.id)}]${paths}${item.reason ? `: ${humanText(item.reason, home)}` : ""}`);
  }
  return lines.join("\n");
}

function renderLinkResult(review: LinkReviewView, result: LinkResultView, verbose: boolean, home: string): string {
  const descriptions = new Map(review.items.map((item) => [item.id, item.description]));
  const lines = [`Link apply: ${result.success ? "completed" : "failed"}`];
  for (const item of result.items) {
    if (!verbose && item.outcome === "noop") continue;
    const path = verbose ? ` target=${humanPath(item.target, home)}${item.backup ? ` backup=${humanPath(item.backup, home)}` : ""}` : "";
    lines.push(`${item.outcome.toUpperCase()} ${escapeControlCharacters(descriptions.get(item.id) ?? item.id)} [${escapeControlCharacters(item.id)}]${path}${item.error ? `: ${humanText(item.error, home)}` : ""}`);
  }
  if (result.recoveryRequired) lines.push("Manual recovery is required; rerun with --verbose for paths.");
  if (result.lockCleanupError) lines.push(`Lock cleanup failed${verbose ? `: ${humanText(result.lockCleanupError, home)}` : "."}`);
  return lines.join("\n");
}

function renderPackageReview(review: PackageReviewView, verbose: boolean, home: string): string {
  const lines = [
    `Packages: ${review.changes} changes, ${review.items.filter(({ action }) => action === "blocked").length} blocked`,
    `Homebrew: ${review.brewExecutable ? humanPath(review.brewExecutable, home) : "unavailable"}`,
  ];
  for (const item of review.items) {
    if (!verbose && item.action === "noop") continue;
    lines.push(`${item.action.toUpperCase()} ${escapeControlCharacters(item.description)} [${item.kind}:${escapeControlCharacters(item.name)}]${item.reason ? `: ${humanText(item.reason, home)}` : ""}`);
    if (verbose) lines.push(...(item.preview ?? []).map((line) => `  ${humanText(line, home)}`));
  }
  return lines.join("\n");
}

async function confirmApply(label = "Apply this plan?"): Promise<boolean> {
  const prompt = createInterface({ input: process.stdin, output: process.stderr });
  try {
    return (await prompt.question(`${label} [y/N] `)).trim().toLowerCase() === "y";
  } finally {
    prompt.close();
  }
}

function setupExitCode(result: SetupResult): ExitCode {
  return result.status === "failed" || result.status === "partial" ? 1 : 0;
}

function shellSingleQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

function shellHumanPath(value: string, home: string): string {
  const formatted = formatHumanPath(value, home);
  if (formatted === "~") return "~";
  if (formatted.startsWith("~/")) return `~/${shellSingleQuote(formatted.slice(2))}`;
  return shellSingleQuote(formatted);
}

async function runCanonicalSetup(args: readonly string[]): Promise<ExitCode> {
  const options = parseOptions(args, new Set(["--all-packages", "--brew", "--yes", "--json", "--verbose"]), true);
  const interactive = process.stdin.isTTY === true && process.stderr.isTTY === true;
  const app = await application(options.brew);
  const home = app.dots.paths.home;
  const approve = async (label: string): Promise<boolean> => {
    if (options.yes) return true;
    if (!interactive) throw new SetupInteractionError("dots setup requires --yes outside an interactive terminal when changes are planned");
    return confirmApply(label);
  };
  const result = await runSetup(app, { profiles: options.ids, allPackages: options.allPackages }, {
    onPhaseChange: (phase) => { process.stderr.write(`== ${phase.toUpperCase()} ==\n`); },
    reviewPackages: async (review) => {
      if (!options.json) process.stdout.write(`${renderPackageReview(review, options.verbose, home)}\n`);
      return approve("Apply package changes?");
    },
    reviewLinks: async (review) => {
      if (!options.json) process.stdout.write(`${renderLinkReview(review, options.verbose, home)}\n`);
      return approve("Apply link changes?");
    },
    onPackageProgress: ({ kind, name }) => {
      process.stderr.write(`Installing ${escapeControlCharacters(kind)}:${escapeControlCharacters(name)}...\n`);
    },
  });
  if (options.json) {
    process.stdout.write(envelope("setup", {
      status: result.status,
      phase: result.phase,
      warnings: result.summary.warnings,
      errors: result.summary.errors,
    }, [result]));
  } else {
    if (result.packageReview && result.packageReview.changes === 0) process.stdout.write(`${renderPackageReview(result.packageReview, options.verbose, home)}\n`);
    if (result.packageResult && (result.packageReview?.changes !== 0 || !result.packageResult.success)) process.stdout.write(`${renderDependencyInstall(result.packageResult, home)}\n`);
    if (result.linkReview && result.linkReview.changes === 0) process.stdout.write(`${renderLinkReview(result.linkReview, options.verbose, home)}\n`);
    if (result.linkResult && (result.linkReview?.changes !== 0 || !result.linkResult.success)) process.stdout.write(`${renderLinkResult(result.linkReview!, result.linkResult, options.verbose, home)}\n`);
    if (result.dashboard) process.stdout.write(`${renderDashboard(result.dashboard, options.verbose, home)}\n`);
    else if (result.summary.message) process.stdout.write(`${result.status === "cancelled" ? "Cancelled" : result.status === "partial" ? "Partial" : "Failed"} in ${result.phase}: ${humanText(result.summary.message, home)}\n`);
    else if (result.status === "cancelled") process.stdout.write("Cancelled.\n");
    const usedBrew = result.packageReview?.brewExecutable;
    if (usedBrew && process.env.DOTS_BREW !== usedBrew) {
      process.stdout.write(`Persist Homebrew selection in ~/.config/zsh/.zshenv.local:\nexport DOTS_BREW=${shellHumanPath(usedBrew, home)}\n`);
    }
  }
  return setupExitCode(result);
}

function requireSelection(options: Options, label: string): void {
  if (options.ids.length === 0 && !options.all) throw new UsageError(`${label} requires at least one selector or --all`);
}

async function runReadiness(command: "status" | "check", args: readonly string[]): Promise<ExitCode> {
  const allowed = command === "status" ? new Set(["--json", "--verbose"]) : new Set(["--json", "--strict"]);
  const options = parseOptions(args, allowed, false);
  const app = await application();
  const view = await app.dashboard();
  if (options.json) process.stdout.write(envelope(command, { healthy: view.healthy, errors: view.errors, warnings: view.warnings }, dashboardIssues(view)));
  else process.stdout.write(`${renderDashboard(view, options.verbose, app.dots.paths.home)}\n`);
  return command === "check" && options.strict && !view.healthy ? 1 : 0;
}

async function runLinks(subcommand: string | undefined, args: readonly string[]): Promise<ExitCode> {
  if (!subcommand || !["list", "status", "plan", "apply", "lock", "unlock"].includes(subcommand)) {
    throw new UsageError(subcommand ? `Unknown links command: ${subcommand}` : "links requires list, status, plan, apply, lock, or unlock");
  }
  const key = `links ${subcommand}`;
  if (args.includes("--help") || args.includes("-h")) return printHelp(key);
  if (subcommand === "lock") {
    const options = parseOptions(args, new Set(["--json"]), false);
    const app = await application();
    const lock = await app.dots.inspectLock();
    if (options.json) process.stdout.write(envelope(key, { state: lock.state }, [lock]));
    else process.stdout.write(`Apply lock: ${lock.state}${lock.metadata ? ` (pid ${lock.metadata.pid}, started ${lock.metadata.startedAt})` : ""}${lock.reason ? `: ${humanText(lock.reason, app.dots.paths.home)}` : ""}\n`);
    return 0;
  }
  if (subcommand === "unlock") {
    const options = parseOptions(args, new Set(["--force", "--yes"]), false);
    const app = await application();
    const lock = await app.dots.inspectLock();
    if (lock.state === "clear") {
      process.stdout.write("Apply lock is already clear.\n");
      return 0;
    }
    if (lock.state === "active") {
      process.stderr.write(`dots: active apply lock owned by pid ${lock.metadata?.pid ?? "unknown"}; refusing to remove it\n`);
      return 1;
    }
    if (lock.state === "unknown" && !options.force) throw new UsageError("unknown apply lock requires --force");
    if (!options.yes && (!process.stdin.isTTY || !process.stderr.isTTY)) throw new UsageError("links unlock requires --yes outside an interactive terminal");
    if (!options.yes && !await confirmApply(`Remove ${lock.state} apply lock at ${humanPath(lock.path, app.dots.paths.home)}?`)) {
      process.stdout.write("Cancelled.\n");
      return 0;
    }
    await app.dots.unlockLock(lock, options.force);
    process.stdout.write(`Removed ${lock.state} apply lock.\n`);
    return 0;
  }
  if (subcommand === "list") {
    const options = parseOptions(args, new Set(["--json", "--include-disabled"]), false);
    const items = (await application()).linksList(options.includeDisabled);
    if (options.json) process.stdout.write(envelope(key, { total: items.length }, items));
    else process.stdout.write(`${items.map((item) => `${item.enabled ? "  " : "--"} ${escapeControlCharacters(item.description)} [${escapeControlCharacters(item.id)}]`).join("\n")}\n`);
    return 0;
  }
  const allowed = new Set(["--json", "--verbose", "--all", ...(subcommand === "status" ? ["--include-disabled"] : []), ...(subcommand === "apply" ? ["--yes"] : [])]);
  const options = parseOptions(args, allowed, true);
  if (subcommand !== "status") requireSelection(options, `links ${subcommand}`);
  const app = await application();
  const home = app.dots.paths.home;
  if (subcommand === "status") {
    const items = await app.linksStatus(options.ids, options.all, options.includeDisabled);
    const issues = items.filter(({ state }) => state !== "linked" && state !== "disabled");
    if (options.json) process.stdout.write(envelope(key, { total: items.length, issues: issues.length }, items));
    else {
      const shown = options.verbose ? items : issues;
      process.stdout.write(`Links: ${items.length - issues.length}/${items.length} ready\n${shown.map((item) => `${item.state === "linked" ? "OK" : "!!"} ${escapeControlCharacters(item.description)} [${escapeControlCharacters(item.id)}]: ${item.state}${item.detail ? ` (${humanText(item.detail, home)})` : ""}${options.verbose ? ` source=${humanPath(item.source, home)} target=${humanPath(item.target, home)}` : ""}`).join("\n")}\n`);
    }
    return 0;
  }
  const prepared = await app.prepareLinks(options.ids, options.all);
  if (subcommand === "plan") {
    if (options.json) process.stdout.write(envelope(key, { blocked: prepared.blocked, changes: prepared.review.changes }, prepared.review.items));
    else process.stdout.write(`${renderLinkReview(prepared.review, options.verbose, home)}\n`);
    prepared.cancel();
    return prepared.blocked ? 1 : 0;
  }
  if (!options.json) process.stdout.write(`${renderLinkReview(prepared.review, options.verbose, home)}\n`);
  if (prepared.blocked) {
    if (options.json) process.stdout.write(envelope(key, { blocked: true, changes: prepared.review.changes }, prepared.review.items));
    prepared.cancel();
    return 1;
  }
  if (options.json && !options.yes && prepared.review.changes > 0) throw new UsageError("links apply --json requires --yes");
  if (!options.yes && prepared.review.changes > 0 && (!process.stdin.isTTY || !process.stderr.isTTY)) throw new UsageError("links apply requires --yes outside an interactive terminal");
  if (!options.yes && prepared.review.changes > 0 && !await confirmApply()) {
    prepared.cancel();
    process.stdout.write("Cancelled.\n");
    return 0;
  }
  const result = await prepared.commit();
  if (options.json) process.stdout.write(envelope(key, { success: result.success, reviewedChanges: prepared.review.changes }, [{ review: prepared.review, result }]));
  else process.stdout.write(`${renderLinkResult(prepared.review, result, options.verbose, home)}\n`);
  return result.success ? 0 : 1;
}

async function runPackages(subcommand: string | undefined, args: readonly string[]): Promise<ExitCode> {
  if (!subcommand || !["profiles", "status", "plan", "apply"].includes(subcommand)) {
    throw new UsageError(subcommand ? `Unknown packages command: ${subcommand}` : "packages requires profiles, status, plan, or apply");
  }
  const key = `packages ${subcommand}`;
  if (args.includes("--help") || args.includes("-h")) return printHelp(key);
  if (subcommand === "profiles") {
    const options = parseOptions(args, new Set(["--json"]), true);
    if (options.ids.length > 1) throw new UsageError("packages profiles accepts at most one profile");
    const items = (await application()).packageProfiles(options.ids[0]);
    if (options.json) process.stdout.write(envelope(key, { total: items.length }, items));
    else process.stdout.write(`${items.flatMap((profile) => [`${profile.supported ? "  " : "!!"} ${profile.description} [${profile.id}]`, ...profile.resources.map((resource) => `    ${resource.description} [${resource.kind}:${resource.name}]`)]).join("\n")}\n`);
    return 0;
  }
  const allowed = new Set(["--json", "--verbose", "--all", "--brew", ...(subcommand === "apply" ? ["--yes"] : [])]);
  const options = parseOptions(args, allowed, true);
  requireSelection(options, `packages ${subcommand}`);
  const app = await application(options.brew);
  const home = app.dots.paths.home;
  if (subcommand === "status") {
    const view = await app.packageStatus(options.ids, options.all);
    const items = packageStatusItems(view);
    const missing = items.filter(({ state }) => state === "missing").length;
    if (options.json) process.stdout.write(envelope(key, { blocked: view.blocked, missing, profiles: view.profiles.length }, view.profiles));
    else {
      const available = packageAvailableCount(view);
      process.stdout.write(`Packages: ${available}/${items.length} available${view.blocked ? ", inspection blocked" : ""}${view.brewExecutable ? ` via ${humanPath(view.brewExecutable, home)}` : ""}\n`);
      for (const profile of view.profiles) {
        process.stdout.write(`${profile.description} [${profile.id}]: ${profile.summary.installed} brew, ${profile.summary.external} external, ${profile.summary.missing} missing, ${profile.summary.blocked} blocked\n`);
        for (const item of profile.resources) {
          if (!options.verbose && item.state !== "missing" && item.state !== "blocked") continue;
          process.stdout.write(`  ${item.state} ${escapeControlCharacters(item.description)} [${item.kind}:${escapeControlCharacters(item.name)}]${item.evidence ? ` at ${humanPath(item.evidence, home)}` : ""}${item.reason ? `: ${humanText(item.reason, home)}` : ""}\n`);
        }
      }
    }
    return view.blocked ? 1 : 0;
  }
  const prepared = await app.preparePackages(options.ids, options.all);
  if (subcommand === "plan") {
    if (options.json) process.stdout.write(envelope(key, { blocked: prepared.blocked, changes: prepared.review.changes }, prepared.review.items));
    else process.stdout.write(`${renderPackageReview(prepared.review, options.verbose, home)}\n`);
    prepared.cancel();
    return prepared.blocked ? 1 : 0;
  }
  if (!options.json) process.stdout.write(`${renderPackageReview(prepared.review, options.verbose, home)}\n`);
  if (prepared.blocked) {
    if (options.json) process.stdout.write(envelope(key, { blocked: true, changes: prepared.review.changes }, prepared.review.items));
    prepared.cancel();
    return 1;
  }
  if (options.json && !options.yes && prepared.review.changes > 0) throw new UsageError("packages apply --json requires --yes");
  if (!options.yes && prepared.review.changes > 0 && (!process.stdin.isTTY || !process.stderr.isTTY)) throw new UsageError("packages apply requires --yes outside an interactive terminal");
  if (!options.yes && prepared.review.changes > 0 && !await confirmApply()) {
    prepared.cancel();
    process.stdout.write("Cancelled.\n");
    return 0;
  }
  const result = await prepared.commit(options.json ? {} : {
    onProgress: ({ kind, name }) => { process.stderr.write(`Installing ${escapeControlCharacters(kind)}:${escapeControlCharacters(name)}...\n`); },
  });
  if (options.json) process.stdout.write(envelope(key, { success: result.success, reviewedChanges: prepared.review.changes }, [{ review: prepared.review, result }]));
  else process.stdout.write(`${renderDependencyInstall(result, home)}\n`);
  return result.success ? 0 : 1;
}

function deprecation(alias: string, replacement: string): void {
  process.stderr.write(`dots: warning: '${alias}' is deprecated; use '${replacement}'\n`);
}

async function runLegacy(command: string, rest: readonly string[]): Promise<ExitCode | undefined> {
  if (command === "doctor") {
    deprecation("doctor", "check");
    if (rest.includes("--help") || rest.includes("-h")) return printHelp("check");
    const options = parseOptions(rest, new Set(["--json", "--all"]), false);
    const app = await application();
    const report = await app.dots.doctor(options.all);
    process.stdout.write(options.json ? toJson(report) : `${renderDoctor(report, app.dots.paths.home)}\n`);
    return doctorExitCode(report.summary);
  }
  if (command === "plan") {
    deprecation("plan", "links plan");
    return runLinks("plan", rest);
  }
  if (command === "link") {
    deprecation("link", "links apply");
    if (rest.includes("--dry-run")) return runLinks("plan", rest.filter((arg) => arg !== "--dry-run"));
    return runLinks("apply", rest);
  }
  if (command === "deps") {
    deprecation("deps", "packages");
    if (rest[0] === "--help" || rest[0] === "-h") return printHelp("packages");
    const mapped = rest[0] === "check" ? "status" : rest[0] === "install" && rest.includes("--dry-run")
      ? "plan" : rest[0] === "install" ? "apply" : rest[0];
    return runPackages(mapped, rest.slice(1).filter((arg) => arg !== "--dry-run"));
  }
  if (command === "tui") {
    deprecation("tui", "ui");
    if (rest[0] === "--help" || rest[0] === "-h") return printHelp("ui");
    return runUi(rest);
  }
  return undefined;
}

async function runUi(args: readonly string[]): Promise<ExitCode> {
  const view = args[0] ?? "overview";
  if (args.length > 1 || !["overview", "links", "packages"].includes(view)) throw new UsageError(`Unknown UI view: ${view}`);
  const app = await application();
  return runTui(app, view as "overview" | "links" | "packages") as Promise<ExitCode>;
}

export async function main(args: readonly string[] = process.argv.slice(2)): Promise<number> {
  if (args.length === 0) return process.stdin.isTTY && process.stdout.isTTY ? runUi([]) : runReadiness("status", []);
  const command = args[0]!;
  const rest = args.slice(1);
  if (command === "help" || command === "--help" || command === "-h") {
    process.stdout.write(`${rootHelp}\n`);
    return 0;
  }
  const legacy = await runLegacy(command, rest);
  if (legacy !== undefined) return legacy;
  if (rest[0] === "--help" || rest[0] === "-h") {
    if (!["status", "check", "links", "packages", "setup", "ui"].includes(command)) throw new UsageError(`Unknown command: ${command}`);
    return printHelp(command);
  }
  if (command === "status" || command === "check") return runReadiness(command, rest);
  if (command === "links") return runLinks(rest[0], rest.slice(1));
  if (command === "packages") return runPackages(rest[0], rest.slice(1));
  if (command === "setup") return runCanonicalSetup(rest);
  if (command === "ui") return runUi(rest);
  throw new UsageError(`Unknown command: ${command}`);
}

const entryPath = process.argv[1];
const isMain = entryPath !== undefined
  && await realpath(entryPath).catch(() => resolve(entryPath)) === fileURLToPath(import.meta.url);

if (isMain) {
  main().then((code) => {
    process.exitCode = code;
  }).catch((error: unknown) => {
    const raw = error instanceof Error ? error.message : String(error);
    const home = process.env.HOME ? resolve(process.env.HOME) : undefined;
    process.stderr.write(`dots: ${escapeControlCharacters(home ? formatHumanText(raw, home) : raw)}\n`);
    process.exitCode = error instanceof UsageError || error instanceof DotsConfigError
      || error instanceof SelectorError || error instanceof DependencySelectorError || error instanceof SetupInteractionError ? 2 : 1;
  });
}
