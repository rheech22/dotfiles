import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, mkdtemp, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import {
  DepsService,
  parseBrewList,
  parseBrewTaps,
  selectDependencyProfiles,
  type DependencyPlan,
} from "../src/deps.js";
import type { DependencyProfile } from "../src/deps-manifest.js";
import { dependencyProfiles, validateDependencyManifest } from "../src/deps-manifest.js";
import { renderDependencyInstall, renderDependencyPlan } from "../src/reporters.js";
import type { ProcessRequest, ProcessResult, ProcessRunner } from "../src/process.js";

const execFileAsync = promisify(execFile);
const brew = "/opt/homebrew/bin/brew";
const safetyVariables = [
  "HOMEBREW_NO_AUTO_UPDATE",
  "HOMEBREW_NO_INSTALL_UPGRADE",
  "HOMEBREW_NO_INSTALL_CLEANUP",
  "HOMEBREW_NO_INSTALLED_DEPENDENTS_CHECK",
  "HOMEBREW_NO_ASK",
] as const;

function exited(
  stdout = "",
  exitCode = 0,
  stderr = "",
  truncation: { readonly stdout?: boolean; readonly stderr?: boolean } = {},
): ProcessResult {
  return {
    kind: "exit",
    exitCode,
    stdout,
    stderr,
    stdoutTruncated: truncation.stdout ?? false,
    stderrTruncated: truncation.stderr ?? false,
  };
}

class FakeRunner implements ProcessRunner {
  readonly requests: ProcessRequest[] = [];

  constructor(private readonly respond: (request: ProcessRequest, index: number) => ProcessResult = () => exited()) {}

  async run(request: ProcessRequest): Promise<ProcessResult> {
    this.requests.push(request);
    return this.respond(request, this.requests.length - 1);
  }
}

function service(
  profiles: readonly DependencyProfile[],
  runner: ProcessRunner,
  options: Partial<ConstructorParameters<typeof DepsService>[0]> = {},
): DepsService {
  return new DepsService({
    profiles,
    runner,
    platform: "linux",
    selectedBrew: brew,
    candidateResolver: async (candidate) => candidate,
    ...options,
  });
}

function isMutation(request: ProcessRequest): boolean {
  return request.argv[0] === "tap" && request.argv.length === 2
    || request.argv[0] === "install" && !request.argv.includes("--dry-run");
}

function assertSafetyEnv(request: ProcessRequest): void {
  for (const variable of safetyVariables) assert.equal(request.env?.[variable], "1", variable);
}

test("manifest validates safe names, platform metadata, and duplicates while allowing cross-profile dedupe", async () => {
  const shared: readonly DependencyProfile[] = [
    { id: "first", resources: [{ kind: "formula", name: "git" }] },
    { id: "second", resources: [{ kind: "formula", name: "git" }, { kind: "tap", name: "owner/repo" }], platforms: ["linux"] },
  ];
  validateDependencyManifest(shared);
  const plan = await service(shared, new FakeRunner(() => exited("git 2.51.0\nowner/repo\n"))).plan([], true);
  assert.equal(plan.items.filter(({ name }) => name === "git").length, 1);
  assert.equal(dependencyProfiles.find(({ id }) => id === "macos")?.platforms?.[0], "darwin");

  assert.throws(() => validateDependencyManifest([{ id: "-bad", resources: [] }]), /Invalid.*profile/i);
  assert.throws(() => validateDependencyManifest([{ id: "ok", resources: [{ kind: "formula", name: "-bad" }] }]), /Invalid formula/i);
  assert.throws(() => validateDependencyManifest([{ id: "ok", resources: [{ kind: "tap", name: "owner" }] }]), /Invalid tap/i);
  assert.throws(() => validateDependencyManifest([{ id: "same", resources: [] }, { id: "same", resources: [] }]), /Duplicate.*profile/i);
  assert.throws(() => validateDependencyManifest([{ id: "same", resources: [], platforms: ["darwin", "darwin"] }]), /Duplicate.*platform/i);
  assert.throws(() => validateDependencyManifest([{
    id: "same",
    resources: [],
    platforms: ["invalid" as NodeJS.Platform],
  }]), /Invalid.*platform/i);
  assert.throws(() => validateDependencyManifest([{
    id: "same",
    resources: [{ kind: "cask", name: "app" }, { kind: "cask", name: "app" }],
  }]), /Duplicate.*resource/i);
});

test("profile selectors dedupe input, preserve declaration order, and reject errors", () => {
  const profiles: readonly DependencyProfile[] = [{ id: "a", resources: [] }, { id: "b", resources: [] }];
  assert.deepEqual(selectDependencyProfiles(profiles, ["b", "a", "b"], false).map(({ id }) => id), ["a", "b"]);
  assert.throws(() => selectDependencyProfiles(profiles, [], false), /at least one profile/i);
  assert.throws(() => selectDependencyProfiles(profiles, ["a"], true), /combine profiles/i);
  assert.throws(() => selectDependencyProfiles(profiles, ["unknown"], false), /Unknown dependency profile/i);
});

test("tap, formula, and cask parsers use exact names and preserve versions", () => {
  assert.deepEqual([...parseBrewTaps("owner/repo\nowner/repository\n")], ["owner/repo", "owner/repository"]);
  const listed = parseBrewList("git 2.50.0 2.51.0\ngit-delta 0.18.2\nempty\n");
  assert.deepEqual(listed.get("git"), ["2.50.0", "2.51.0"]);
  assert.deepEqual(listed.get("git-delta"), ["0.18.2"]);
  assert.deepEqual(listed.get("empty"), []);
  assert.equal(listed.has("gi"), false);
});

test("cheap status uses only list/tap queries and detects external availability", async () => {
  const profiles: readonly DependencyProfile[] = [{
    id: "tools",
    description: "Tools",
    resources: [
      { kind: "tap", name: "owner/repo", description: "Repository" },
      { kind: "formula", name: "git", description: "Git", runtimeCommand: "git" },
      { kind: "formula", name: "jq", description: "jq", runtimeCommand: "jq" },
      { kind: "cask", name: "app", description: "App", runtimeApp: "/Applications/App.app" },
    ],
  }];
  const runner = new FakeRunner((request) => {
    if (request.argv[0] === "tap") return exited("owner/repo\n");
    if (request.argv.includes("--formula")) return exited("git 2.51.0\n");
    return exited("");
  });
  const deps = service(profiles, runner, {
    path: "/external/bin",
    executableResolver: async (name) => name === "jq" ? "/external/bin/jq" : undefined,
    appResolver: async (path) => path === "/Applications/App.app",
  });
  const report = await deps.status(["tools"]);

  assert.deepEqual(runner.requests.map(({ argv }) => argv), [
    ["tap"],
    ["list", "--formula", "--versions"],
    ["list", "--cask", "--versions"],
  ]);
  assert.equal(runner.requests.some(({ argv }) => argv.includes("--dry-run")), false);
  assert.deepEqual(report.profiles[0]?.resources.map(({ state }) => state), [
    "installed-by-selected-brew", "installed-by-selected-brew", "available-externally", "available-externally",
  ]);
  assert.equal(report.profiles[0]?.summary.external, 2);
});

test("cheap status preserves external evidence when Homebrew ownership cannot be queried", async () => {
  const profiles: readonly DependencyProfile[] = [{
    id: "tools",
    resources: [{ kind: "formula", name: "git", runtimeCommand: "git" }, { kind: "formula", name: "missing" }],
  }];
  const externalResolver = async (name: string) => name === "git" ? "/usr/bin/git" : undefined;
  const unavailable = new DepsService({ profiles, platform: "linux", executableResolver: externalResolver, candidateResolver: async () => undefined });
  const unavailableStatus = await unavailable.status(["tools"]);
  assert.equal(unavailableStatus.profiles[0]?.resources[0]?.state, "available-externally");
  assert.match(unavailableStatus.profiles[0]?.resources[0]?.reason ?? "", /Homebrew executable/);
  assert.equal(unavailableStatus.profiles[0]?.resources[1]?.state, "blocked");

  const failedQuery = new DepsService({
    profiles,
    runner: new FakeRunner(() => exited("", 1, "query failed")),
    selectedBrew: brew,
    executableResolver: externalResolver,
    candidateResolver: async () => brew,
  });
  const failedStatus = await failedQuery.status(["tools"]);
  assert.equal(failedStatus.profiles[0]?.resources[0]?.state, "available-externally");
  assert.match(failedStatus.profiles[0]?.resources[0]?.reason ?? "", /query failed/);
  assert.equal(failedStatus.profiles[0]?.resources[1]?.state, "blocked");

  const unsafeRunner = new FakeRunner();
  const unsafe = new DepsService({ profiles, runner: unsafeRunner, selectedBrew: brew, env: { HOMEBREW_NO_QUARANTINE: "1" }, executableResolver: externalResolver, candidateResolver: async () => brew });
  const unsafeStatus = await unsafe.status(["tools"]);
  assert.equal(unsafeStatus.profiles[0]?.resources[0]?.state, "available-externally");
  assert.equal(unsafeRunner.requests.length, 0);
  assert.equal((await unsafe.plan(["tools"])).blocked, true);

  const manageable = new DepsService({
    profiles: [{ id: "tools", resources: [{ kind: "formula", name: "git", runtimeCommand: "git" }] }],
    runner: new FakeRunner(() => exited("")),
    selectedBrew: brew,
    executableResolver: externalResolver,
    candidateResolver: async () => brew,
  });
  assert.equal((await manageable.status(["tools"])).profiles[0]?.resources[0]?.state, "available-externally");
  assert.equal((await manageable.plan(["tools"])).items[0]?.action, "install-formula");
});

test("plan order is deterministic with exact queries, dry-runs, argv, and escaped previews", async () => {
  const profiles: readonly DependencyProfile[] = [
    { id: "first", resources: [{ kind: "cask", name: "app" }, { kind: "formula", name: "git" }] },
    { id: "second", resources: [{ kind: "tap", name: "owner/repo" }, { kind: "formula", name: "git" }, { kind: "formula", name: "jq" }] },
  ];
  const runner = new FakeRunner((request) => {
    if (request.argv[0] === "tap") return exited("");
    if (request.argv.includes("--formula")) return exited("git 2.51.0\n");
    if (request.argv.includes("--cask") && request.argv[0] === "list") return exited("app 1.0\n");
    return exited("Would install jq and dependency\nunsafe\u001b[31m");
  });
  const plan = await service(profiles, runner).plan(["second", "first"], false);

  assert.deepEqual(plan.profiles, ["first", "second"]);
  assert.deepEqual(plan.items.map(({ kind, name, action, command, argv }) => ({ kind, name, action, command, argv })), [
    { kind: "tap", name: "owner/repo", action: "tap", command: brew, argv: ["tap", "owner/repo"] },
    { kind: "formula", name: "git", action: "noop", command: brew, argv: ["install", "git"] },
    { kind: "formula", name: "jq", action: "install-formula", command: brew, argv: ["install", "jq"] },
    { kind: "cask", name: "app", action: "noop", command: brew, argv: ["install", "--cask", "app"] },
  ]);
  assert.deepEqual(runner.requests.map(({ argv }) => argv), [
    ["tap"],
    ["list", "--formula", "--versions"],
    ["list", "--cask", "--versions"],
    ["install", "--dry-run", "jq"],
  ]);
  assert.deepEqual(plan.items[2]?.preview, ["Would install jq and dependency", "unsafe\\u{1b}[31m"]);
  assert.match(renderDependencyPlan(plan), /Would install jq and dependency/);
  assert.equal(Object.isFrozen(plan), true);
  assert.equal(Object.isFrozen(plan.items[2]?.preview), true);
});

test("dry-run safety env is complete and nonzero or truncated preflight blocks without mutation", async () => {
  const profiles: readonly DependencyProfile[] = [{
    id: "apps",
    resources: [{ kind: "formula", name: "bad" }, { kind: "cask", name: "large" }],
  }];
  const runner = new FakeRunner((request) => {
    if (request.argv.includes("bad")) return exited("", 7, "not available");
    if (request.argv.includes("large")) return exited("preview", 0, "", { stdout: true });
    return exited();
  });
  const deps = service(profiles, runner, { env: { FORCE_COLOR: "3" } });
  const plan = await deps.plan(["apps"]);
  const dryRuns = runner.requests.filter(({ argv }) => argv.includes("--dry-run"));

  assert.deepEqual(dryRuns.map(({ argv }) => argv), [
    ["install", "--dry-run", "bad"],
    ["install", "--dry-run", "--cask", "large"],
  ]);
  dryRuns.forEach(assertSafetyEnv);
  assert.equal(dryRuns.every(({ env }) => env?.FORCE_COLOR === "3"), true);
  assert.deepEqual(plan.items.map(({ action }) => action), ["blocked", "blocked"]);
  assert.match(plan.items[0]?.reason ?? "", /dry-run exited 7/);
  assert.match(plan.items[1]?.reason ?? "", /capture limit/);
  assert.equal((await deps.install(plan)).success, false);
  assert.equal(runner.requests.some(isMutation), false);
});

test("missing brew and failed list queries block affected resources without mutation", async () => {
  const profiles: readonly DependencyProfile[] = [{ id: "core", resources: [{ kind: "formula", name: "git" }] }];
  const missingRunner = new FakeRunner();
  const missingService = new DepsService({
    profiles,
    runner: missingRunner,
    platform: "linux",
    executableResolver: async () => undefined,
    candidateResolver: async () => undefined,
  });
  const missing = await missingService.plan(["core"]);
  assert.equal(missing.items[0]?.action, "blocked");
  assert.equal(missingRunner.requests.length, 0);
  assert.equal((await missingService.install(missing)).success, false);

  const failedRunner = new FakeRunner(() => exited("", 1, "query failed"));
  const failed = await service(profiles, failedRunner).plan(["core"]);
  assert.equal(failed.items[0]?.action, "blocked");
  assert.equal(failedRunner.requests.some(({ argv }) => argv.includes("--dry-run")), false);
});

test("install revalidates then uses only exact allowlisted mutations with all safety env variables", async () => {
  const profiles: readonly DependencyProfile[] = [{
    id: "all",
    resources: [
      { kind: "tap", name: "owner/repo" },
      { kind: "formula", name: "git" },
      { kind: "cask", name: "app" },
    ],
  }];
  const runner = new FakeRunner();
  const deps = service(profiles, runner, { env: { PATH: "/bin", FORCE_COLOR: "3" } });
  const plan = await deps.plan(["all"]);
  const result = await deps.install(plan);
  const mutations = runner.requests.filter(isMutation);

  assert.equal(result.success, true);
  assert.deepEqual(mutations.map(({ executable, argv }) => ({ executable, argv })), [
    { executable: brew, argv: ["tap", "owner/repo"] },
    { executable: brew, argv: ["install", "git"] },
    { executable: brew, argv: ["install", "--cask", "app"] },
  ]);
  mutations.forEach(assertSafetyEnv);
  assert.equal(mutations.every(({ timeoutMs }) => timeoutMs === 0), true);
  assert.equal(mutations.every(({ env }) => env?.FORCE_COLOR === "3"), true);
  assert.equal(runner.requests.some(({ argv }) => argv.some((arg) => /update|upgrade|cleanup|uninstall|untap|bundle/.test(arg))), false);
});

test("install fails fast, reports partial progress, and never rolls back", async () => {
  const profiles: readonly DependencyProfile[] = [{
    id: "core",
    resources: [
      { kind: "formula", name: "first" },
      { kind: "formula", name: "second" },
      { kind: "formula", name: "third" },
    ],
  }];
  const runner = new FakeRunner((request) =>
    request.argv.at(-1) === "second" && !request.argv.includes("--dry-run") ? exited("", 9, "failure") : exited()
  );
  const deps = service(profiles, runner);
  const result = await deps.install(await deps.plan(["core"]));
  const mutations = runner.requests.filter(isMutation);

  assert.deepEqual(result.items.map(({ outcome }) => outcome), ["installed", "failed", "not-started"]);
  assert.deepEqual(mutations.map(({ argv }) => argv), [["install", "first"], ["install", "second"]]);
  assert.equal(runner.requests.some(({ argv }) => argv.includes("uninstall")), false);
});

test("fresh revalidation rejects missing-to-installed and noop-to-missing transitions before mutation", async () => {
  const profiles: readonly DependencyProfile[] = [{
    id: "core",
    resources: [{ kind: "formula", name: "first" }, { kind: "formula", name: "second" }],
  }];
  let state = "first 1.0\n";
  const runner = new FakeRunner((request) => request.argv.includes("--formula") ? exited(state) : exited());
  const deps = service(profiles, runner);
  const plan = await deps.plan(["core"]);
  state = "second 1.0\n";
  const result = await deps.install(plan);

  assert.equal(result.success, false);
  assert.match(result.items.find(({ outcome }) => outcome === "failed")?.error ?? "", /stale/);
  assert.equal(runner.requests.some(isMutation), false);
});

test("fresh revalidation rejects a changed canonical brew path", async () => {
  const profiles: readonly DependencyProfile[] = [{ id: "core", resources: [{ kind: "formula", name: "git" }] }];
  const runner = new FakeRunner();
  let canonical = brew;
  const deps = service(profiles, runner, { candidateResolver: async () => canonical });
  const plan = await deps.plan(["core"]);
  canonical = "/usr/local/bin/brew";
  const result = await deps.install(plan);
  assert.equal(result.success, false);
  assert.match(result.items[0]?.error ?? "", /stale/);
  assert.equal(runner.requests.some(isMutation), false);
});

test("plan provenance rejects forged manifest-valid packages before any execution", async () => {
  const profiles: readonly DependencyProfile[] = [{ id: "core", resources: [{ kind: "formula", name: "git" }] }];
  const runner = new FakeRunner();
  const deps = service(profiles, runner);
  const forged: DependencyPlan = {
    profiles: ["core"],
    brewExecutable: brew,
    items: [{ kind: "formula", name: "wget", action: "install-formula", command: brew, argv: ["install", "wget"] }],
    blocked: false,
    changes: 1,
  };
  const result = await deps.install(forged);
  assert.equal(result.success, false);
  assert.match(result.items[0]?.error ?? "", /not created by this service/);
  assert.equal(runner.requests.length, 0);
});

test("dual Homebrew prefixes block while explicit selection records its canonical executable", async () => {
  const profiles: readonly DependencyProfile[] = [{ id: "core", resources: [{ kind: "formula", name: "git" }] }];
  const dualRunner = new FakeRunner();
  const candidates = new Map([
    ["/opt/homebrew/bin/brew", "/opt/homebrew/Library/Homebrew/brew.sh"],
    ["/usr/local/bin/brew", "/usr/local/Homebrew/Library/Homebrew/brew.sh"],
  ]);
  const dual = new DepsService({
    profiles,
    runner: dualRunner,
    platform: "darwin",
    executableResolver: async () => brew,
    candidateResolver: async (candidate) => candidates.get(candidate),
  });
  const blocked = await dual.plan(["core"]);
  assert.equal(blocked.items[0]?.action, "blocked");
  assert.match(blocked.items[0]?.reason ?? "", /Multiple Homebrew installations/);
  assert.equal(dualRunner.requests.length, 0);

  const explicit = new DepsService({
    profiles,
    runner: new FakeRunner(() => exited("git 1.0\n")),
    platform: "darwin",
    selectedBrew: "/opt/homebrew/bin/brew",
    candidateResolver: async (candidate) => candidates.get(candidate),
  });
  assert.equal((await explicit.plan(["core"])).brewExecutable, "/opt/homebrew/Library/Homebrew/brew.sh");
});

test("invalid selected brew and darwin-only profiles block without process execution", async () => {
  const core: readonly DependencyProfile[] = [{ id: "core", resources: [{ kind: "formula", name: "git" }] }];
  for (const selectedBrew of ["relative/brew", "/tmp/not-brew", "/missing/brew"]) {
    const runner = new FakeRunner();
    const deps = new DepsService({
      profiles: core,
      runner,
      platform: "linux",
      selectedBrew,
      candidateResolver: async () => undefined,
    });
    assert.equal((await deps.plan(["core"])).blocked, true);
    assert.equal(runner.requests.length, 0);
  }

  const runner = new FakeRunner();
  const macos = service(dependencyProfiles, runner, { platform: "linux" });
  const plan = await macos.plan(["macos"]);
  assert.equal(plan.items.every(({ action }) => action === "blocked"), true);
  assert.match(plan.items[0]?.reason ?? "", /not supported on linux/);
  assert.equal(runner.requests.length, 0);
});

test("successful truncated install is a warning and progress fires only for actual mutations", async () => {
  const profiles: readonly DependencyProfile[] = [{
    id: "core",
    resources: [{ kind: "formula", name: "git" }, { kind: "formula", name: "jq" }],
  }];
  const runner = new FakeRunner((request) => {
    if (request.argv.includes("--formula")) return exited("git 1.0\n");
    if (isMutation(request)) return exited("large", 0, "", { stdout: true });
    return exited("Would install jq\n");
  });
  const deps = service(profiles, runner);
  const progress: string[] = [];
  const result = await deps.install(await deps.plan(["core"]), {
    onProgress: ({ kind, name }) => { progress.push(`${kind}:${name}`); },
  });

  assert.equal(result.success, true);
  assert.deepEqual(progress, ["formula:jq"]);
  assert.equal(result.items[1]?.outputTruncated, true);
  assert.equal(result.items[1]?.outcome, "installed");
});

test("clean plans return success only after fresh revalidation and without progress", async () => {
  const profiles: readonly DependencyProfile[] = [{ id: "core", resources: [{ kind: "formula", name: "git" }] }];
  const runner = new FakeRunner(() => exited("git 2.51.0\n"));
  const deps = service(profiles, runner);
  const plan = await deps.plan(["core"]);
  let progress = 0;
  assert.equal((await deps.install(plan, { onProgress: () => { progress += 1; } })).success, true);
  assert.equal(progress, 0);
  assert.deepEqual(runner.requests.map(({ argv }) => argv), [
    ["list", "--formula", "--versions"],
    ["list", "--formula", "--versions"],
  ]);
});

test("clean reviewed noop becoming missing fails fresh validation", async () => {
  const profiles: readonly DependencyProfile[] = [{ id: "core", resources: [{ kind: "formula", name: "git" }] }];
  let installed = true;
  const runner = new FakeRunner((request) => {
    if (request.argv.includes("--formula")) return exited(installed ? "git 2.51.0\n" : "");
    return exited("Would install git\n");
  });
  const deps = service(profiles, runner);
  const plan = await deps.plan(["core"]);
  installed = false;
  const result = await deps.install(plan);

  assert.equal(result.success, false);
  assert.match(result.items[0]?.error ?? "", /stale/);
  assert.equal(runner.requests.some(isMutation), false);
});

test("darwin blocks a custom PATH Homebrew coexisting with a standard prefix", async () => {
  const profiles: readonly DependencyProfile[] = [{ id: "core", resources: [{ kind: "formula", name: "git" }] }];
  const runner = new FakeRunner();
  const deps = new DepsService({
    profiles,
    runner,
    platform: "darwin",
    candidateResolver: async (candidate) => candidate === "/opt/homebrew/bin/brew"
      ? "/opt/homebrew/Library/Homebrew/brew.sh"
      : undefined,
    executableResolver: async () => "/nix/store/custom-homebrew/bin/brew",
  });
  const plan = await deps.plan(["core"]);

  assert.equal(plan.blocked, true);
  assert.match(plan.items[0]?.reason ?? "", /Multiple Homebrew installations/);
  assert.match(plan.items[0]?.reason ?? "", /nix\/store\/custom-homebrew/);
  assert.equal(runner.requests.length, 0);
});

test("unsafe inherited Homebrew environment blocks without exposing values or executing", async () => {
  const profiles: readonly DependencyProfile[] = [{ id: "core", resources: [{ kind: "formula", name: "git" }] }];
  const runner = new FakeRunner();
  const deps = service(profiles, runner, {
    env: {
      HOMEBREW_CASK_OPTS: "--no-quarantine-secret",
      HOMEBREW_API_DOMAIN: "https://secret.invalid",
      HOMEBREW_NO_AUTO_UPDATE: "unsafe-inherited-but-overridden",
    },
  });
  const plan = await deps.plan(["core"]);
  const reason = plan.items[0]?.reason ?? "";

  assert.equal(plan.blocked, true);
  assert.match(reason, /HOMEBREW_CASK_OPTS/);
  assert.match(reason, /HOMEBREW_API_DOMAIN/);
  assert.doesNotMatch(reason, /no-quarantine-secret|secret\.invalid|unsafe-inherited-but-overridden/);
  assert.doesNotMatch(reason, /HOMEBREW_NO_AUTO_UPDATE/);
  assert.equal(runner.requests.length, 0);
});

test("per-item state drift makes a later reviewed install a clear noop without progress", async () => {
  const profiles: readonly DependencyProfile[] = [{
    id: "core",
    resources: [{ kind: "formula", name: "first" }, { kind: "formula", name: "second" }],
  }];
  let secondInstalled = false;
  const runner = new FakeRunner((request) => {
    if (request.argv.includes("--formula")) return exited(secondInstalled ? "second 1.0\n" : "");
    if (request.argv.includes("--dry-run")) return exited(`Would install ${request.argv.at(-1)}\n`);
    if (request.argv.at(-1) === "first") secondInstalled = true;
    return exited();
  });
  const deps = service(profiles, runner);
  const progress: string[] = [];
  const result = await deps.install(await deps.plan(["core"]), {
    onProgress: ({ name }) => { progress.push(name); },
  });
  const mutations = runner.requests.filter(isMutation);

  assert.equal(result.success, true);
  assert.deepEqual(result.items.map(({ action, outcome }) => ({ action, outcome })), [
    { action: "install-formula", outcome: "installed" },
    { action: "install-formula", outcome: "noop" },
  ]);
  assert.deepEqual(progress, ["first"]);
  assert.deepEqual(mutations.map(({ argv }) => argv), [["install", "first"]]);
  assert.match(renderDependencyInstall(result), /already installed; reviewed install-formula/);
});

test("per-item dry-run preview drift fails before that mutation", async () => {
  const profiles: readonly DependencyProfile[] = [{ id: "core", resources: [{ kind: "formula", name: "git" }] }];
  let dryRuns = 0;
  const runner = new FakeRunner((request) => {
    if (request.argv.includes("--dry-run")) {
      dryRuns += 1;
      return exited(dryRuns < 3 ? "Would install dependency-a\n" : "Would install dependency-b\n");
    }
    return exited();
  });
  const deps = service(profiles, runner);
  let progress = 0;
  const result = await deps.install(await deps.plan(["core"]), {
    onProgress: () => { progress += 1; },
  });

  assert.equal(result.success, false);
  assert.match(result.items[0]?.error ?? "", /preview changed/);
  assert.equal(progress, 0);
  assert.equal(runner.requests.some(isMutation), false);
});

test("CLI fake brew enforces policies, safety env, progress silence for JSON, and --brew precedence", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "dots-deps-cli-"));
  const bin = join(root, "bin");
  const other = join(root, "other");
  const log = join(root, "brew.log");
  await Promise.all([mkdir(bin), mkdir(other)]);
  const executable = join(bin, "brew");
  const fallback = join(other, "brew");
  const script = `#!/bin/sh
if [ "$1" = "list" ]; then
  if [ -n "$BREW_INSTALLED" ]; then printf '%s 1.0\\n' "$BREW_INSTALLED"; fi
  exit 0
fi
if [ "$1" = "tap" ] && [ "$#" = "1" ]; then exit 0; fi
if [ "$2" = "--dry-run" ]; then
  printf 'Would install dependency-a and %s\\n' "$3"
  printf 'dry:%s|%s|%s|%s|%s\\n' "$HOMEBREW_NO_AUTO_UPDATE" "$HOMEBREW_NO_INSTALL_UPGRADE" "$HOMEBREW_NO_INSTALL_CLEANUP" "$HOMEBREW_NO_INSTALLED_DEPENDENTS_CHECK" "$HOMEBREW_NO_ASK" >> "$BREW_LOG"
  exit 0
fi
printf 'install:%s|%s|%s|%s|%s|%s\\n' "$*" "$HOMEBREW_NO_AUTO_UPDATE" "$HOMEBREW_NO_INSTALL_UPGRADE" "$HOMEBREW_NO_INSTALL_CLEANUP" "$HOMEBREW_NO_INSTALLED_DEPENDENTS_CHECK" "$HOMEBREW_NO_ASK" >> "$BREW_LOG"
`;
  await Promise.all([writeFile(executable, script), writeFile(fallback, script)]);
  await Promise.all([chmod(executable, 0o755), chmod(fallback, 0o755)]);
  t.after(() => rm(root, { recursive: true, force: true }));
  const cli = join(import.meta.dirname, "../src/cli.ts");
  const env = {
    ...process.env,
    PATH: `${bin}${delimiter}${process.env.PATH ?? ""}`,
    DOTS_BREW: fallback,
    BREW_LOG: log,
    NO_COLOR: "1",
  };
  delete env.FORCE_COLOR;
  const invoke = (...args: readonly string[]) => execFileAsync(process.execPath, ["--import", "tsx", cli, "deps", ...args], { env });

  await assert.rejects(() => invoke("install", "core"), (error: unknown) =>
    typeof error === "object" && error !== null && "code" in error && error.code === 2
  );
  await assert.rejects(() => invoke("install", "core", "--json"), (error: unknown) =>
    typeof error === "object" && error !== null && "code" in error && error.code === 2
  );
  await assert.rejects(() => invoke("plan", "core", "--brew", "relative/brew"), (error: unknown) =>
    typeof error === "object" && error !== null && "code" in error && error.code === 2
  );

  const planned = await invoke("plan", "core", "--brew", executable, "--json");
  const parsedPlanEnvelope = JSON.parse(planned.stdout) as { readonly summary: { readonly blocked: boolean }; readonly items: DependencyPlan["items"] };
  const canonicalExecutable = await realpath(executable);
  assert.equal(parsedPlanEnvelope.summary.blocked, false);
  assert.match(parsedPlanEnvelope.items[0]?.preview?.join(" ") ?? "", /dependency-a/);

  const beforeInstall = await readFile(log, "utf8");
  assert.equal(beforeInstall.split("\n").filter(Boolean).every((line) => line === "dry:1|1|1|1|1"), true);
  const jsonInstall = await invoke("install", "core", "--brew", executable, "--yes", "--json");
  assert.equal(JSON.parse(jsonInstall.stdout).summary.success, true);
  assert.doesNotMatch(jsonInstall.stderr, /Installing/);

  const humanInstall = await invoke("install", "core", "--brew", executable, "--yes");
  assert.match(humanInstall.stderr, /Installing formula:git/);
  const lines = (await readFile(log, "utf8")).split("\n").filter(Boolean);
  assert.equal(lines.some((line) => line === "install:install git|1|1|1|1|1"), true);

  const clean = await execFileAsync(process.execPath, ["--import", "tsx", cli, "deps", "install", "core"], {
    env: { ...env, BREW_INSTALLED: "git" },
  });
  assert.match(clean.stdout, /Dependency installation succeeded/);
});
