import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repo = resolve(import.meta.dirname, "../../..");

test("bin/dots emits parseable canonical JSON without touching real HOME", async (t) => {
  const home = await mkdtemp(join(tmpdir(), "dots-bin-home-"));
  t.after(() => rm(home, { recursive: true, force: true }));
  const result = await execFileAsync(join(repo, "bin/dots"), ["status", "--json"], {
    env: { ...process.env, HOME: home, DOTFILES_DIR: repo, NO_COLOR: "1" },
  });
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.schemaVersion, 1);
  assert.equal(parsed.command, "status");
  assert.equal(Array.isArray(parsed.items), true);
  assert.equal(result.stderr, "");
});

test("source-dots rejects being sourced", async () => {
  await assert.rejects(
    () => execFileAsync("zsh", ["-c", `source ${JSON.stringify(join(repo, "source-dots.sh"))}`]),
    (error: unknown) => {
      assert.equal(typeof error, "object");
      assert.notEqual(error, null);
      assert.equal("code" in error && error.code, 1);
      assert.match("stderr" in error && typeof error.stderr === "string" ? error.stderr : "", /do not source/);
      return true;
    },
  );
});

test("Zsh startup remains usable when optional tools, plugins, cargo, and local files are absent", async (t) => {
  const home = await mkdtemp(join(tmpdir(), "dots-zsh-minimal-"));
  t.after(() => rm(home, { recursive: true, force: true }));
  const command = `source ${JSON.stringify(join(repo, ".config/zsh/.zshenv"))}; source ${JSON.stringify(join(repo, ".config/zsh/.zshrc"))}; print ready`;
  const result = await execFileAsync("zsh", ["-f", "-c", command], {
    env: { HOME: home, ZDOTDIR: home, PATH: "/usr/bin:/bin" },
  });
  assert.equal(result.stdout.trim(), "ready");
  assert.equal(result.stderr, "");
});

test("bin/dots resolves the repository when invoked through a symlink", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "dots-bin-link-"));
  const linked = join(root, "dots");
  await symlink(join(repo, "bin/dots"), linked);
  t.after(() => rm(root, { recursive: true, force: true }));
  const result = await execFileAsync(linked, ["--help"], { env: { ...process.env, NO_COLOR: "1" } });
  assert.match(result.stdout, /Usage: dots/);
  assert.equal(result.stderr, "");
});

test("bin/dots resolves multi-hop relative links and rejects cycles and dangling targets", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "dots-bin-chain-"));
  const first = join(root, "first");
  const second = join(root, "second");
  await symlink("second", first);
  await symlink(join(repo, "bin/dots"), second);
  t.after(() => rm(root, { recursive: true, force: true }));
  assert.match((await execFileAsync(first, ["--help"], { env: { ...process.env, NO_COLOR: "1" } })).stdout, /Usage: dots/);

  const cycleA = join(root, "cycle-a");
  const cycleB = join(root, "cycle-b");
  await symlink("cycle-b", cycleA);
  await symlink("cycle-a", cycleB);
  const launcher = join(repo, "bin/dots");
  await assert.rejects(() => execFileAsync("/bin/sh", ["-c", '. "$1"', cycleA, launcher], { timeout: 1000 }), (error: unknown) => {
    assert.match(typeof error === "object" && error !== null && "stderr" in error && typeof error.stderr === "string" ? error.stderr : "", /cycle detected/);
    return true;
  });

  const dangling = join(root, "dangling");
  await symlink("absent", dangling);
  await assert.rejects(() => execFileAsync("/bin/sh", ["-c", '. "$1"', dangling, launcher], { timeout: 1000 }), (error: unknown) => {
    assert.match(typeof error === "object" && error !== null && "stderr" in error && typeof error.stderr === "string" ? error.stderr : "", /does not exist/);
    return true;
  });
});
