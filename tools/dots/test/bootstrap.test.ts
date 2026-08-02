import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, realpath, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const sourceBootstrap = resolve(import.meta.dirname, "../../../bootstrap.sh");

interface Fixture {
  readonly root: string;
  readonly repo: string;
  readonly bin: string;
  readonly bootstrap: string;
  readonly brew: string;
  readonly log: string;
  readonly env: NodeJS.ProcessEnv;
}

async function executable(path: string, body: string): Promise<void> {
  await writeFile(path, `#!/bin/sh\nset -eu\n${body}\n`);
  await chmod(path, 0o755);
}

async function fixture(t: test.TestContext, withRuntime = true): Promise<Fixture> {
  const root = await mkdtemp(join(tmpdir(), "dots bootstrap "));
  const repo = join(root, "repo with spaces");
  const prefix = join(root, "brew prefix");
  const bin = join(root, "fake bin");
  const nodeBin = join(root, "fnm node", "bin");
  const fnmPrefix = join(prefix, "opt", "fnm");
  const log = join(root, "calls.log");
  await Promise.all([
    mkdir(join(repo, "bin"), { recursive: true }), mkdir(join(prefix, "bin"), { recursive: true }),
    mkdir(join(fnmPrefix, "bin"), { recursive: true }), mkdir(bin), mkdir(nodeBin, { recursive: true }),
  ]);
  const brew = join(prefix, "bin", "brew");
  const marker = join(root, "fnm-installed");
  await executable(brew, `
printf 'brew:%s\\n' "$*" >> "$BOOTSTRAP_LOG"
case "\${1:-}" in
  --version) printf 'Homebrew 4.0.0\\n' ;;
  --prefix) if [ "\${2:-}" = fnm ]; then printf '%s\\n' "$FNM_PREFIX"; else printf '%s\\n' "$BREW_PREFIX"; fi ;;
  list) [ "\${2:-}" != --versions ] || [ "\${3:-}" != fnm ] || { [ ! -f "$FNM_MARKER" ] || printf 'fnm 1.0\\n'; } ;;
  install) [ "\${2:-}" != fnm ] || : > "$FNM_MARKER" ;;
esac`);
  await executable(join(fnmPrefix, "bin", "fnm"), `
printf 'fnm:%s\\n' "$*" >> "$BOOTSTRAP_LOG"
if [ "\${1:-}" = env ]; then printf "export PATH='%s':\\$PATH\\n" "$FNM_NODE_BIN"; fi`);
  await executable(join(nodeBin, "node"), "[ \"${1:-}\" != --version ] || { printf 'v24.2.0\\n'; exit 0; }\nexit 0");
  const corepack = join(nodeBin, "corepack");
  const corepackTemplate = join(root, "corepack-template");
  const corepackBody = `
printf 'corepack:%s\\n' "$*" >> "$BOOTSTRAP_LOG"
if [ "\${1:-}" = pnpm ] && [ "\${2:-}" = --version ]; then printf '10.19.0\\n'; fi
case "$*" in 'pnpm install --frozen-lockfile') exit "\${FAKE_INSTALL_EXIT:-0}" ;; 'pnpm build') exit "\${FAKE_BUILD_EXIT:-0}" ;; esac
exit "\${FAKE_COREPACK_EXIT:-0}"`;
  await executable(corepackTemplate, corepackBody);
  await executable(corepack, corepackBody);
  await executable(join(nodeBin, "npm"), `printf 'npm:%s\\n' "$*" >> "$BOOTSTRAP_LOG"\ncp ${JSON.stringify(corepackTemplate)} ${JSON.stringify(corepack)}`);
  if (withRuntime) {
    await executable(join(bin, "node"), "[ \"${1:-}\" != --version ] || { printf 'v24.1.0\\n'; exit 0; }");
    await executable(join(bin, "corepack"), `exec ${JSON.stringify(join(nodeBin, "corepack"))} "$@"`);
  }
  await executable(join(repo, "bin", "dots"), "printf 'dots-env:<%s>\\n' \"${DOTS_BREW:-}\" >> \"$BOOTSTRAP_LOG\"\nfor arg in \"$@\"; do printf 'dots-arg:<%s>\\n' \"$arg\" >> \"$BOOTSTRAP_LOG\"; done");
  await writeFile(join(repo, ".node-version"), "24\n");
  let script = await readFile(sourceBootstrap, "utf8");
  script = script
    .replaceAll("/opt/homebrew/bin/brew", join(root, "absent-opt", "brew"))
    .replaceAll("/usr/local/bin/brew", join(root, "absent-local", "brew"))
    .replaceAll("/bin/bash", JSON.stringify(join(bin, "fixture-bash")))
    .replaceAll('[ -t 0 ] && [ -t 2 ]', '[ "${FIXTURE_TTY:-0}" = 1 ]');
  const bootstrap = join(repo, "bootstrap.sh");
  await writeFile(bootstrap, script);
  await chmod(bootstrap, 0o755);
  t.after(() => rm(root, { recursive: true, force: true }));
  return {
    root, repo, bin, bootstrap, brew, log,
    env: {
      PATH: `${bin}:/usr/bin:/bin`, HOME: join(root, "home"), BOOTSTRAP_LOG: log,
      BREW_PREFIX: prefix, FNM_PREFIX: fnmPrefix, FNM_MARKER: marker, FNM_NODE_BIN: nodeBin,
    },
  };
}

const invoke = (value: Fixture, args: readonly string[], env: NodeJS.ProcessEnv = {}) =>
  execFileAsync(value.bootstrap, [...args], { env: { ...value.env, ...env } });
const calls = (value: Fixture) => readFile(value.log, "utf8").catch(() => "");

test("bootstrap dry-run is non-mutating and symlink guards remain safe", async (t) => {
  const value = await fixture(t);
  const fixtureHome = await realpath(value.root);
  const linked = join(value.repo, "bootstrap-link");
  await symlink("bootstrap.sh", linked);
  const result = await execFileAsync(linked, ["--dry-run", "--brew", value.brew], { env: { ...value.env, HOME: fixtureHome } });
  assert.match(result.stdout, /^1\. Homebrew:/);
  assert.match(result.stdout, /~\/repo with spaces/);
  assert.doesNotMatch(result.stdout, new RegExp(fixtureHome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.equal(await calls(value), "");

  await assert.rejects(
    () => execFileAsync(value.bootstrap, ["--unknown"], { env: { ...value.env, HOME: fixtureHome } }),
    (error: unknown) => {
      const stderr = typeof error === "object" && error !== null && "stderr" in error ? String(error.stderr) : "";
      assert.match(stderr, /safe rerun: "\$HOME"\/'repo with spaces\/bootstrap\.sh'/);
      assert.doesNotMatch(stderr, new RegExp(fixtureHome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      return true;
    },
  );

  await assert.rejects(
    () => execFileAsync(value.bootstrap, ["--brew", join(fixtureHome, "missing", "brew")], { env: { ...value.env, HOME: fixtureHome } }),
    (error: unknown) => {
      const stderr = typeof error === "object" && error !== null && "stderr" in error ? String(error.stderr) : "";
      assert.match(stderr, /Homebrew executable is invalid: ~\/missing\/brew/);
      assert.doesNotMatch(stderr, new RegExp(fixtureHome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      return true;
    },
  );

  await assert.rejects(
    () => execFileAsync(value.bootstrap, ["bad\u001b]8;;https://example.com\u0007"], { env: { ...value.env, HOME: fixtureHome } }),
    (error: unknown) => {
      const stderr = typeof error === "object" && error !== null && "stderr" in error ? String(error.stderr) : "";
      assert.match(stderr, /arguments must not contain control characters/);
      assert.doesNotMatch(stderr, /\u001b|https:\/\/example\.com/);
      return true;
    },
  );

  const cycleA = join(value.repo, "cycle-a");
  const cycleB = join(value.repo, "cycle-b");
  await symlink("cycle-b", cycleA);
  await symlink("cycle-a", cycleB);
  await assert.rejects(() => execFileAsync("/bin/sh", ["-c", '. "$1"', cycleA, value.bootstrap], { env: value.env }), /cycle detected/);
});

test("bootstrap full no-toolchain transition uses brew fnm, fnm Node, Corepack pnpm, then setup", async (t) => {
  const value = await fixture(t, false);
  await invoke(value, ["--yes", "--brew", value.brew, "runtime", "core"]);
  const output = await calls(value);
  assert.match(output, /brew:list --versions fnm[\s\S]*brew:install fnm[\s\S]*brew:list --versions fnm/);
  assert.match(output, /brew:--prefix fnm[\s\S]*fnm:env --shell bash[\s\S]*fnm:install 24[\s\S]*fnm:use 24[\s\S]*fnm:default 24/);
  assert.match(output, /corepack:install --global pnpm@10\.19\.0/);
  assert.match(output, /corepack:pnpm --version[\s\S]*corepack:pnpm install --frozen-lockfile[\s\S]*corepack:pnpm build/);
  assert.match(output, /dots-env:<\/private\/.*\/brew prefix\/bin\/brew>/);
  assert.match(output, /dots-arg:<runtime>\ndots-arg:<core>/);
});

test("valid consistent runtime is retained and selected brew precedence is exact", async (t) => {
  const value = await fixture(t);
  await invoke(value, ["--yes", "--brew", value.brew, "core"], { DOTS_BREW: join(value.root, "bad", "brew") });
  const output = await calls(value);
  assert.doesNotMatch(output, /fnm:/);
  assert.match(output, /corepack:pnpm build/);
  assert.match(output, /dots-arg:<--brew>\ndots-arg:<\/private\/.*\/brew prefix\/bin\/brew>/);
});

test("missing fnm-managed Corepack installs only pinned corepack 0.35.0", async (t) => {
  const value = await fixture(t, false);
  await unlink(join(value.env.FNM_NODE_BIN!, "corepack"));
  await invoke(value, ["--yes", "--brew", value.brew, "core"]);
  assert.match(await calls(value), /npm:install --global corepack@0\.35\.0/);
});

test("pinned installer chooses interactive vs noninteractive execution and never executes mutable HEAD", async (t) => {
  for (const [label, tty, expected] of [["interactive", "1", "unset"], ["noninteractive", "0", "1"]] as const) {
    await t.test(label, async (child) => {
      const value = await fixture(child);
      await executable(join(value.bin, "curl"), "printf 'curl:%s\\n' \"$*\" >> \"$BOOTSTRAP_LOG\"\nout=\"\"; while [ \"$#\" -gt 0 ]; do [ \"$1\" != -o ] || { shift; out=$1; }; shift; done; printf '#!/bin/sh\\n' > \"$out\"");
      await executable(join(value.bin, "shasum"), "printf '8ff338091a5e10bb5fc040b38316648110f42feff057ecf9feaab51fd0a13ef9  %s\\n' \"$3\"");
      await executable(join(value.bin, "fixture-bash"), "printf 'installer:%s\\n' \"${NONINTERACTIVE:-unset}\" >> \"$BOOTSTRAP_LOG\"\nexit 7");
      await executable(join(value.bin, "uname"), "printf 'Darwin\\n'");
      await executable(join(value.bin, "sudo"), "printf 'sudo:%s\\n' \"$*\" >> \"$BOOTSTRAP_LOG\"");
      await assert.rejects(() => invoke(value, ["--install-homebrew", "--yes"], { PATH: `${value.bin}:/usr/bin:/bin`, FIXTURE_TTY: tty }));
      const output = await calls(value);
      assert.match(output, /curl:-fsSL https:\/\/raw\.githubusercontent\.com\/Homebrew\/install\/39a0c068274254a7658fd9761d59bce9d0e2151f\/install\.sh -o/);
      assert.match(output, new RegExp(`installer:${expected}`));
      if (tty === "0") assert.match(output, /sudo:-n true/);
      assert.doesNotMatch(output, /HEAD/);
    });
  }
});

test("runtime, Corepack, install, and build failures stop setup", async (t) => {
  for (const [label, env] of [["corepack", { FAKE_COREPACK_EXIT: "7" }], ["install", { FAKE_INSTALL_EXIT: "8" }], ["build", { FAKE_BUILD_EXIT: "9" }]] as const) {
    await t.test(label, async (child) => {
      const value = await fixture(child);
      await assert.rejects(() => invoke(value, ["--yes", "--brew", value.brew, "core"], env));
      assert.doesNotMatch(await calls(value), /dots-arg:/);
    });
  }
});

test("bootstrap has no production test switches and rejects unsafe usage before mutation", async (t) => {
  const value = await fixture(t);
  assert.doesNotMatch(await readFile(sourceBootstrap, "utf8"), /DOTS_BOOTSTRAP_TEST_/);
  await assert.rejects(() => invoke(value, ["core", "--all-packages"]), (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === 2);
  await assert.rejects(() => invoke(value, ["bad;name"]));
  assert.equal(await calls(value), "");
});

test("pinned installer rejects inherited Homebrew execution overrides before download", async (t) => {
  const value = await fixture(t);
  await executable(join(value.bin, "curl"), "printf 'curl-called\\n' >> \"$BOOTSTRAP_LOG\"");
  await assert.rejects(() => invoke(value, ["--install-homebrew", "--yes"], {
    PATH: `${value.bin}:/usr/bin:/bin`, HOMEBREW_BREW_GIT_REMOTE: "https://example.invalid/repo",
  }));
  assert.doesNotMatch(await calls(value), /curl-called|installer:/);
});
