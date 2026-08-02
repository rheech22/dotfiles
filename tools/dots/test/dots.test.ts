import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import type { ConfigItem, Dependency } from "../src/manifest.js";
import { configItems, dependencies } from "../src/manifest.js";
import type { Manifest, RuntimePaths } from "../src/domain.js";
import { SelectorError } from "../src/domain.js";
import { inspectLink } from "../src/inspect.js";
import { escapeControlCharacters, toJson } from "../src/reporters.js";
import { doctorExitCode, DotsService, nodeSupported } from "../src/service.js";

const execFileAsync = promisify(execFile);

interface Fixture {
  readonly root: string;
  readonly repo: string;
  readonly home: string;
}

async function fixture(t: test.TestContext): Promise<Fixture> {
  const root = await mkdtemp(join(tmpdir(), "dots-test-"));
  const repo = join(root, "repo");
  const home = join(root, "home");
  await Promise.all([mkdir(repo), mkdir(home)]);
  await mkdir(join(repo, ".config"));
  await writeFile(join(repo, "source-dots.sh"), "#!/bin/zsh\n");
  t.after(() => rm(root, { recursive: true, force: true }));
  return { root, repo, home };
}

function item(id: string, enabled?: boolean): ConfigItem {
  const base = { id, source: `source/${id}`, target: `target/${id}`, description: id };
  return enabled === undefined ? base : { ...base, enabled, disabledReason: "legacy exclusion" };
}

async function makeSource(paths: Fixture, config: ConfigItem): Promise<string> {
  const source = join(paths.repo, config.source);
  await mkdir(dirname(source), { recursive: true });
  await writeFile(source, config.id);
  return source;
}

async function makeTargetParent(paths: Fixture, config: ConfigItem): Promise<string> {
  const target = join(paths.home, config.target);
  await mkdir(dirname(target), { recursive: true });
  return target;
}

test("inspects correct absolute and relative links", async (t) => {
  const paths = await fixture(t);
  const absolute = item("absolute");
  const relativeItem = item("relative");
  const absoluteSource = await makeSource(paths, absolute);
  const relativeSource = await makeSource(paths, relativeItem);
  const absoluteTarget = await makeTargetParent(paths, absolute);
  const relativeTarget = await makeTargetParent(paths, relativeItem);
  await symlink(absoluteSource, absoluteTarget);
  await symlink(relative(dirname(relativeTarget), relativeSource), relativeTarget);

  const [absoluteStatus, relativeStatus] = await Promise.all([
    inspectLink(absolute, paths.repo, paths.home),
    inspectLink(relativeItem, paths.repo, paths.home),
  ]);
  assert.equal(absoluteStatus.result.state, "linked");
  assert.equal(relativeStatus.result.state, "linked");
});

test("distinguishes wrong, dangling, and looping links", async (t) => {
  const paths = await fixture(t);
  const wrong = item("wrong");
  const dangling = item("dangling");
  const loop = item("loop");
  await Promise.all([makeSource(paths, wrong), makeSource(paths, dangling), makeSource(paths, loop)]);
  const wrongTarget = await makeTargetParent(paths, wrong);
  const danglingTarget = await makeTargetParent(paths, dangling);
  const loopTarget = await makeTargetParent(paths, loop);
  const other = join(paths.root, "other");
  await writeFile(other, "other");
  await symlink(other, wrongTarget);
  await symlink(join(paths.root, "absent"), danglingTarget);
  await symlink(loopTarget, loopTarget);

  const [wrongStatus, danglingStatus, loopStatus] = await Promise.all([
    inspectLink(wrong, paths.repo, paths.home),
    inspectLink(dangling, paths.repo, paths.home),
    inspectLink(loop, paths.repo, paths.home),
  ]);
  assert.deepEqual(wrongStatus.result, {
    state: "wrong-link",
    detail: { kind: "different", actualPath: await realpath(other) },
  });
  assert.equal(danglingStatus.result.state, "wrong-link");
  assert.equal(danglingStatus.result.state === "wrong-link" && danglingStatus.result.detail.kind, "dangling");
  assert.equal(loopStatus.result.state, "wrong-link");
  assert.equal(loopStatus.result.state === "wrong-link" && loopStatus.result.detail.kind, "loop");
});

test("reports occupied, missing source, missing target, and disabled", async (t) => {
  const paths = await fixture(t);
  const occupiedFile = item("occupied-file");
  const occupiedDirectory = item("occupied-directory");
  const missingSource = item("missing-source");
  const missingTarget = item("missing-target");
  const disabled = item("disabled", false);
  await Promise.all([
    makeSource(paths, occupiedFile),
    makeSource(paths, occupiedDirectory),
    makeSource(paths, missingTarget),
  ]);
  await writeFile(await makeTargetParent(paths, occupiedFile), "occupied");
  await mkdir(await makeTargetParent(paths, occupiedDirectory));

  const results = await Promise.all([
    occupiedFile, occupiedDirectory, missingSource, missingTarget, disabled,
  ].map((config) => inspectLink(config, paths.repo, paths.home)));
  assert.deepEqual(results.map(({ result }) => result), [
    { state: "occupied", kind: "file" },
    { state: "occupied", kind: "directory" },
    { state: "source-missing" },
    { state: "missing" },
    { state: "disabled", reason: "legacy exclusion" },
  ]);
});

test("selectors honor disabled items and reject unavailable ids", async (t) => {
  const paths = await fixture(t);
  const enabled = item("enabled");
  const disabled = item("disabled", false);
  await makeSource(paths, enabled);
  const service = new DotsService(
    { repo: paths.repo, home: paths.home, path: "" },
    { items: [enabled, disabled], dependencies: [] },
  );

  assert.deepEqual((await service.status()).map(({ id }) => id), ["enabled"]);
  assert.deepEqual((await service.status([], true)).map(({ id }) => id), ["enabled", "disabled"]);
  await assert.rejects(() => service.status(["disabled"]), SelectorError);
  await assert.rejects(() => service.status(["unknown"], true), /unknown/i);
});

test("link selectors dedupe in manifest order and optional sources are implicit only when present", async (t) => {
  const paths = await fixture(t);
  const first = item("first");
  const optional: ConfigItem = { ...item("optional"), optional: true };
  const missing = item("missing");
  await makeSource(paths, first);
  const service = new DotsService(
    { repo: paths.repo, home: paths.home, path: "" },
    { items: [first, optional, missing], dependencies: [] },
  );

  assert.deepEqual((await service.status(["missing", "first", "first"])).map(({ id }) => id), ["first", "missing"]);
  assert.deepEqual((await service.status()).map(({ id }) => id), ["first", "missing"]);
  const explicitOptional = await service.plan(["optional", "optional"], false);
  assert.equal(explicitOptional.items.length, 1);
  assert.equal(explicitOptional.items[0]?.action, "blocked");
  const implicit = await service.plan([], true);
  assert.deepEqual(implicit.items.map(({ id }) => id), ["first", "missing"]);
  assert.equal(implicit.items.find(({ id }) => id === "missing")?.action, "blocked");

  await makeSource(paths, optional);
  assert.deepEqual((await service.status()).map(({ id }) => id), ["first", "optional", "missing"]);
  assert.deepEqual((await service.plan([], true)).items.map(({ id }) => id), ["first", "optional", "missing"]);
});

test("fresh fixtures skip absent machine-local Zsh files without generating username-specific files", async (t) => {
  const paths = await fixture(t);
  const locals = configItems.filter(({ id }) => ["zprofile-local", "zshenv-local", "zshrc-local"].includes(id));
  const service = new DotsService(
    { repo: paths.repo, home: paths.home, path: "" },
    { items: locals, dependencies: [] },
  );
  assert.deepEqual(await service.status(), []);
  const plan = await service.plan([], true);
  assert.deepEqual(plan.items, []);
  assert.equal((await service.apply(plan)).success, true);
  for (const item of locals) {
    await assert.rejects(() => realpath(join(paths.repo, item.source)), /ENOENT/);
    await assert.rejects(() => realpath(join(paths.home, item.target)), /ENOENT/);
  }
});

test("doctor separates dependencies and computes exit-relevant health", async (t) => {
  const paths = await fixture(t);
  const bin = join(paths.root, "bin");
  await mkdir(bin);
  const executable = join(bin, "required-tool");
  await writeFile(executable, "#!/bin/sh\nexit 0\n");
  await chmod(executable, 0o755);
  const linked = item("linked");
  const source = await makeSource(paths, linked);
  await symlink(source, await makeTargetParent(paths, linked));
  const required: Dependency = { id: "required", command: "required-tool", description: "required", required: true };
  const optional: Dependency = { id: "optional", command: "absent-tool", description: "optional", required: false };
  const manifest: Manifest = { items: [linked], dependencies: [required, optional] };
  const runtime: RuntimePaths = { repo: paths.repo, home: paths.home, path: bin };
  const report = await new DotsService(runtime, manifest, "22.19.0").doctor();

  assert.equal(report.dependencies.required[0]?.available, true);
  assert.equal(report.dependencies.optional[0]?.available, false);
  assert.deepEqual(report.summary, { errors: 0, warnings: 1, healthy: false });

  const errorReport = await new DotsService({ ...runtime, path: "" }, manifest, "22.18.0").doctor();
  assert.equal(errorReport.summary.errors, 2);
  assert.equal(errorReport.node.supported, false);
});

test("JSON serialization is pure and preserves discriminated domain states", () => {
  const value = [{ id: "x", result: { state: "wrong-link", detail: { kind: "dangling", path: "/x" } } }];
  const output = toJson(value);
  assert.equal(output.startsWith("["), true);
  assert.equal(output.endsWith("\n"), true);
  assert.deepEqual(JSON.parse(output), value);
  assert.equal(output.includes("\u001b"), false);
});

test("human output escapes terminal control characters", () => {
  assert.equal(escapeControlCharacters("safe\u001b[31m\nnext"), "safe\\u{1b}[31m\\u{0a}next");
});

test("CLI emits pure JSON and rejects TUI without a TTY", async (t) => {
  const paths = await fixture(t);
  const cli = join(import.meta.dirname, "../src/cli.ts");
  const env = { ...process.env, HOME: paths.home, DOTFILES_DIR: paths.repo, NO_COLOR: "1" };
  delete env.FORCE_COLOR;
  const jsonResult = await execFileAsync(process.execPath, ["--import", "tsx", cli, "status", "--json"], { env });
  assert.equal(jsonResult.stderr, "");
  const parsed = JSON.parse(jsonResult.stdout);
  assert.equal(parsed.schemaVersion, 1);
  assert.equal(parsed.command, "status");
  assert.equal(Array.isArray(parsed.items), true);
  assert.equal(jsonResult.stdout.includes("\u001b"), false);
  const humanResult = await execFileAsync(process.execPath, ["--import", "tsx", cli, "status", "--verbose"], { env });
  assert.match(humanResult.stdout, /target=~\//);
  assert.doesNotMatch(humanResult.stdout, new RegExp(paths.home.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  const absoluteTarget = (parsed.items as readonly { target?: string }[]).find(({ target }) => target)?.target;
  assert.equal(absoluteTarget?.startsWith(paths.home), true);

  await assert.rejects(
    () => execFileAsync(process.execPath, ["--import", "tsx", cli, "tui"], { env }),
    (error: unknown) => {
      assert.equal(typeof error, "object");
      assert.notEqual(error, null);
      assert.equal("code" in error && error.code, 1);
      assert.match("stderr" in error && typeof error.stderr === "string" ? error.stderr : "", /interactive terminal/);
      return true;
    },
  );
});

test("CLI exposes usage without requiring runtime paths", async () => {
  const cli = join(import.meta.dirname, "../src/cli.ts");
  const result = await execFileAsync(process.execPath, ["--import", "tsx", cli, "--help"], {
    env: { PATH: process.env.PATH },
  });
  assert.match(result.stdout, /Usage: dots/);
  assert.match(result.stdout, /status \[--json\]/);
  assert.equal(result.stderr, "");
});

test("subcommands expose specific help and legacy doctor exit codes remain stable", async () => {
  const cli = join(import.meta.dirname, "../src/cli.ts");
  const result = await execFileAsync(process.execPath, ["--import", "tsx", cli, "status", "--help"], {
    env: { PATH: process.env.PATH },
  });
  assert.match(result.stdout, /Usage: dots status/);
  assert.equal(doctorExitCode({ errors: 0, warnings: 0, healthy: true }), 0);
  assert.equal(doctorExitCode({ errors: 1, warnings: 0, healthy: false }), 1);
  assert.equal(doctorExitCode({ errors: 0, warnings: 1, healthy: false }), 3);
});

test("legacy alias help resolves before canonical help dispatch", async () => {
  const cli = join(import.meta.dirname, "../src/cli.ts");
  for (const [alias, expected] of [["doctor", "dots check"], ["plan", "dots links plan"], ["link", "dots links apply"], ["deps", "dots packages"], ["tui", "dots ui"]] as const) {
    const result = await execFileAsync(process.execPath, ["--import", "tsx", cli, alias, "--help"], { env: { PATH: process.env.PATH } });
    assert.match(result.stdout, new RegExp(`Usage: ${expected.replaceAll(" ", "\\s")}`));
    assert.equal((result.stderr.match(/deprecated/g) ?? []).length, 1);
  }
});

test("Node version boundary is enforced", () => {
  assert.equal(nodeSupported("22.18.9"), false);
  assert.equal(nodeSupported("22.19.0"), true);
  assert.equal(nodeSupported("23.0.0"), true);
  assert.equal(nodeSupported("22.19"), false);
  assert.equal(nodeSupported("22.19.0-rc.1"), false);
});

test("canonical CLI enforces readiness exits, selectors, contextual help, and alias warnings", async (t) => {
  const paths = await fixture(t);
  const cli = join(import.meta.dirname, "../src/cli.ts");
  const env = { ...process.env, HOME: paths.home, DOTFILES_DIR: paths.repo, NO_COLOR: "1" };
  delete env.FORCE_COLOR;
  const invoke = (...args: readonly string[]) => execFileAsync(process.execPath, ["--import", "tsx", cli, ...args], { env });

  const status = await invoke("status", "--json");
  assert.equal(JSON.parse(status.stdout).schemaVersion, 1);
  const check = await invoke("check", "--json");
  assert.equal(JSON.parse(check.stdout).summary.healthy, false);
  await assert.rejects(() => invoke("check", "--strict", "--json"), (error: unknown) =>
    typeof error === "object" && error !== null && "code" in error && error.code === 1
  );
  await assert.rejects(() => invoke("links", "status", "zshrc", "--all"), (error: unknown) =>
    typeof error === "object" && error !== null && "code" in error && error.code === 2
  );
  const linksHelp = await invoke("links", "plan", "--help");
  assert.match(linksHelp.stdout, /^Usage: dots links plan/);
  await assert.rejects(() => invoke("unknown", "--help"), (error: unknown) => {
    assert.equal(typeof error, "object");
    assert.notEqual(error, null);
    assert.equal("code" in error && error.code, 2);
    assert.doesNotMatch("stdout" in error && typeof error.stdout === "string" ? error.stdout : "", /Usage: dots status/);
    return true;
  });

  const legacy = await invoke("doctor", "--json").then((result) => result, (error: unknown) => error);
  assert.equal(typeof legacy, "object");
  assert.notEqual(legacy, null);
  const legacyStderr = "stderr" in legacy && typeof legacy.stderr === "string" ? legacy.stderr : "";
  const legacyStdout = "stdout" in legacy && typeof legacy.stdout === "string" ? legacy.stdout : "";
  assert.equal((legacyStderr.match(/deprecated/g) ?? []).length, 1);
  assert.equal(typeof JSON.parse(legacyStdout).summary.healthy, "boolean");

  const allEnabled = JSON.parse((await invoke("links", "status", "--all", "--json")).stdout).items as readonly { id: string }[];
  assert.equal(allEnabled.some(({ id }) => id === "lazygit"), false);
  const allIncludingDisabled = JSON.parse((await invoke("links", "status", "--all", "--include-disabled", "--json")).stdout).items as readonly { id: string }[];
  assert.equal(allIncludingDisabled.some(({ id }) => id === "lazygit"), true);
  const implicitIncludingDisabled = JSON.parse((await invoke("links", "status", "--include-disabled", "--json")).stdout).items as readonly { id: string }[];
  assert.equal(implicitIncludingDisabled.some(({ id }) => id === "lazygit"), true);
  await assert.rejects(() => invoke("links", "status", "lazygit", "--json"), (error: unknown) =>
    typeof error === "object" && error !== null && "code" in error && error.code === 2
  );
  const explicitDisabled = JSON.parse((await invoke("links", "status", "lazygit", "--include-disabled", "--json")).stdout).items as readonly { id: string }[];
  assert.deepEqual(explicitDisabled.map(({ id }) => id), ["lazygit"]);

  const allPlan = await invoke("links", "plan", "--all", "--json").then((result) => result, (error: unknown) => error);
  assert.equal(typeof allPlan, "object");
  assert.notEqual(allPlan, null);
  const allPlanStdout = "stdout" in allPlan && typeof allPlan.stdout === "string" ? allPlan.stdout : "";
  const allPlanItems = JSON.parse(allPlanStdout).items as readonly { id: string }[];
  assert.equal(allPlanItems.some(({ id }) => id === "gitconfig-local"), false);
});

test("deprecated doctor preserves report output and actual 0/1/3 exits", async (t) => {
  const paths = await fixture(t);
  const bin = join(paths.root, "bin");
  await mkdir(bin);
  for (const dependency of dependencies) {
    const executable = join(bin, dependency.command);
    await writeFile(executable, "#!/bin/sh\nexit 0\n");
    await chmod(executable, 0o755);
  }
  const enabled = configItems.filter(({ enabled }) => enabled !== false);
  for (const config of enabled) await makeSource(paths, config);
  const cli = join(import.meta.dirname, "../src/cli.ts");
  const env = { ...process.env, HOME: paths.home, DOTFILES_DIR: paths.repo, PATH: bin, NO_COLOR: "1" };
  const invoke = (...args: readonly string[]) => execFileAsync(process.execPath, ["--import", "tsx", cli, "doctor", ...args], { env });

  const warning = await invoke("--json").then(() => undefined, (error: unknown) => error);
  assert.equal(typeof warning === "object" && warning !== null && "code" in warning && warning.code, 3);
  const warningStdout = typeof warning === "object" && warning !== null && "stdout" in warning && typeof warning.stdout === "string" ? warning.stdout : "";
  assert.equal(JSON.parse(warningStdout).summary.warnings > 0, true);

  for (const config of enabled) {
    const source = join(paths.repo, config.source);
    const target = await makeTargetParent(paths, config);
    await symlink(source, target);
  }
  const healthy = await invoke();
  assert.match(healthy.stdout, /^Node:/);
  assert.match(healthy.stdout, /Summary: 0 errors, 0 warnings/);

  await rm(join(paths.repo, enabled[0]!.source));
  const failed = await invoke().then(() => undefined, (error: unknown) => error);
  assert.equal(typeof failed === "object" && failed !== null && "code" in failed && failed.code, 1);
});

test("blocked canonical apply returns 1 without requiring confirmation", async (t) => {
  const paths = await fixture(t);
  const cli = join(import.meta.dirname, "../src/cli.ts");
  const env = { ...process.env, HOME: paths.home, DOTFILES_DIR: paths.repo, NO_COLOR: "1" };
  const result = await execFileAsync(process.execPath, ["--import", "tsx", cli, "links", "apply", "zshrc", "--json"], { env })
    .then(() => undefined, (error: unknown) => error);
  assert.equal(typeof result, "object");
  assert.notEqual(result, null);
  assert.equal("code" in result && result.code, 1);
  const parsed = JSON.parse("stdout" in result && typeof result.stdout === "string" ? result.stdout : "");
  assert.equal(parsed.summary.blocked, true);
  assert.equal("stderr" in result && result.stderr, "");
});
