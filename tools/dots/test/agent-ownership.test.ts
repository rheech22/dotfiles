import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { configItems, dependencies } from "../src/manifest.js";
import { DotsService } from "../src/service.js";

const repo = resolve(import.meta.dirname, "../../..");

test("applying dotfiles preserves harness-owned files and does not restore OpenCode", async (t) => {
  const home = await mkdtemp(join(tmpdir(), "dots-agent-ownership-"));
  t.after(() => rm(home, { recursive: true, force: true }));
  const protectedFiles = [
    ".claude/settings.json", ".claude/CLAUDE.md", ".claude/skills/example/SKILL.md",
    ".codex/AGENTS.md", ".codex/hooks.json", ".agents/skills/example/SKILL.md",
    ".local/state/harness/claude-settings.json",
  ];
  for (const rel of protectedFiles) {
    await mkdir(dirname(join(home, rel)), { recursive: true });
    await writeFile(join(home, rel), `harness-owned: ${rel}\n`);
  }
  assert.deepEqual(configItems.filter(({ target }) => /^\.(claude|codex|agents)(\/|$)|^\.config\/opencode(\/|$)/.test(target)), []);
  assert.equal(dependencies.some(({ id }) => id === "opencode"), false);
  const service = new DotsService({ repo, home, path: process.env.PATH ?? "" });
  const plan = await service.plan([], true);
  assert.deepEqual(plan.items.filter(({ action }) => action === "blocked"), []);
  assert.equal(plan.items.some(({ id }) => id === "gitconfig"), true);
  assert.equal(plan.items.some(({ id }) => id === "zshrc"), true);
  const result = await service.apply(plan);
  assert.equal(result.success, true);
  for (const rel of protectedFiles) assert.equal(await readFile(join(home, rel), "utf8"), `harness-owned: ${rel}\n`);
  const repeated = await service.plan([], true);
  assert.deepEqual(repeated.items.map(({ id }) => id), plan.items.map(({ id }) => id));
  assert.equal(repeated.items.every(({ action }) => action === "noop"), true);
});
