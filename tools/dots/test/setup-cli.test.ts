import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const cli = resolve(import.meta.dirname, "../src/cli.ts");
const repo = resolve(import.meta.dirname, "../../..");

test("setup CLI enforces non-TTY approval, emits one JSON envelope, honors --brew, and reports final status", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "dots-setup-cli-"));
  const home = join(root, "home");
  const bin = join(root, "bin");
  await Promise.all([mkdir(home), mkdir(bin)]);
  const brew = join(bin, "brew");
  const badBrew = join(root, "brew");
  const brewMarker = join(root, "git-installed");
  const script = `#!/bin/sh
if [ "$1" = list ]; then
  [ "\${2:-}" != --formula ] || [ ! -f "$BREW_MARKER" ] || printf 'git 1.0\n'
  exit 0
fi
if [ "$1" = tap ] && [ "$#" = 1 ]; then exit 0; fi
if [ "\${2:-}" = --dry-run ]; then printf 'Would install git\n'; exit 0; fi
if [ "$1" = install ] && [ "\${2:-}" = git ]; then : > "$BREW_MARKER"; exit 0; fi
exit 91
`;
  await writeFile(brew, script);
  await writeFile(badBrew, "#!/bin/sh\nexit 92\n");
  await Promise.all([chmod(brew, 0o755), chmod(badBrew, 0o755)]);
  t.after(() => rm(root, { recursive: true, force: true }));
  const env = {
    ...process.env,
    HOME: home,
    DOTFILES_DIR: repo,
    DOTS_BREW: badBrew,
    BREW_MARKER: brewMarker,
    PATH: process.env.PATH ?? "",
    NO_COLOR: "1",
  };
  delete env.FORCE_COLOR;
  const invoke = (...args: readonly string[]) => execFileAsync(process.execPath, ["--import", "tsx", cli, "setup", "core", "--brew", brew, ...args], { env });

  await assert.rejects(() => invoke("--json"), (error: unknown) => {
    assert.equal(typeof error === "object" && error !== null && "code" in error && error.code, 2);
    assert.equal(typeof error === "object" && error !== null && "stdout" in error && error.stdout, "");
    return true;
  });

  const human = await invoke("--yes");
  assert.match(human.stdout, /Dependency installation succeeded/);
  assert.match(human.stdout, /Link apply: completed/);
  assert.match(human.stdout, /Persist Homebrew selection[\s\S]*export DOTS_BREW='/);

  const completed = await invoke("--yes", "--json").catch((error: unknown) => {
    const output = typeof error === "object" && error !== null && "stdout" in error ? String(error.stdout) : "";
    const parsed = JSON.parse(output) as { items: readonly [{ linkResult?: { items: readonly { outcome: string; error?: string }[] } }] };
    const failed = parsed.items[0].linkResult?.items.find(({ outcome }) => outcome === "failed");
    throw new Error(`setup failed: ${failed?.error ?? output}`);
  });
  const parsed = JSON.parse(completed.stdout) as { schemaVersion: number; command: string; summary: { status: string; errors: number }; items: readonly unknown[] };
  assert.equal(parsed.schemaVersion, 1);
  assert.equal(parsed.command, "setup");
  assert.equal(parsed.summary.status, parsed.summary.errors > 0 ? "failed" : "completed");
  assert.equal(parsed.items.length, 1);
  assert.equal((completed.stdout.match(/"schemaVersion"/g) ?? []).length, 1);
  assert.match(completed.stderr, /== PREFLIGHT ==[\s\S]*== DOCTOR ==/);
  const setupResult = parsed.items[0] as {
    packageReview?: { changes: number };
    linkReview?: { changes: number };
    dashboard?: { dependencies: readonly { id: string; available: boolean }[] };
  };
  assert.equal(setupResult.packageReview?.changes, 0);
  assert.equal(setupResult.linkReview?.changes, 0);
  assert.equal(setupResult.dashboard?.dependencies.find(({ id }) => id === "homebrew")?.available, true);

  await mkdir(join(home, ".dots-apply.lock"));
  const failed = await invoke("--yes", "--json").then(() => undefined, (error: unknown) => error);
  assert.equal(typeof failed === "object" && failed !== null && "code" in failed && failed.code, 1);
  const failedStdout = typeof failed === "object" && failed !== null && "stdout" in failed ? String(failed.stdout) : "";
  assert.equal(JSON.parse(failedStdout).summary.phase, "preflight");
});

test("setup CLI rejects dual package selection and invalid brew usage", async () => {
  await assert.rejects(
    () => execFileAsync(process.execPath, ["--import", "tsx", cli, "setup", "core", "--all-packages"]),
    (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === 2,
  );
  await assert.rejects(
    () => execFileAsync(process.execPath, ["--import", "tsx", cli, "setup", "--brew", "relative"]),
    (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === 2,
  );
});

test("links lock CLI reports and safely unlocks stale and unknown ownership", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "dots-lock-cli-"));
  const home = join(root, "home");
  const lock = join(home, ".dots-apply.lock");
  await mkdir(lock, { recursive: true });
  await writeFile(join(lock, "owner.json"), JSON.stringify({ schemaVersion: 2, version: "dots-lock-v2", pid: 999999, startedAt: new Date().toISOString(), processBirthIdentity: "gone", nonce: "1234567890abcdef" }));
  t.after(() => rm(root, { recursive: true, force: true }));
  const env = { ...process.env, HOME: home, DOTFILES_DIR: repo, NO_COLOR: "1" };
  const invoke = (...args: readonly string[]) => execFileAsync(process.execPath, ["--import", "tsx", cli, "links", ...args], { env });

  const status = JSON.parse((await invoke("lock", "--json")).stdout) as { summary: { state: string } };
  assert.equal(status.summary.state, "stale");
  await assert.rejects(() => invoke("unlock"), (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === 2);
  assert.match((await invoke("unlock", "--yes")).stdout, /Removed stale/);

  await mkdir(lock);
  await assert.rejects(() => invoke("unlock", "--yes"), (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === 2);
  assert.match((await invoke("unlock", "--force", "--yes")).stdout, /Removed unknown/);
});
