import assert from "node:assert/strict";
import test from "node:test";
import { prepareAction, PreparedActionError } from "../src/workflows.js";
import { DotsApplication, packageAvailableCount } from "../src/application.js";
import { DepsService } from "../src/deps.js";
import { DotsService } from "../src/service.js";

test("PreparedAction commits at most once and passes progress options through", async () => {
  const progress: string[] = [];
  let commits = 0;
  const prepared = prepareAction({ changes: 1 }, false, async (options: { onProgress(value: string): void }) => {
    commits += 1;
    options.onProgress("started");
    return { success: true };
  });

  assert.equal(prepared.state, "prepared");
  assert.deepEqual(await prepared.commit({ onProgress: (value) => progress.push(value) }), { success: true });
  assert.equal(prepared.state, "committed");
  assert.deepEqual(progress, ["started"]);
  await assert.rejects(() => prepared.commit({ onProgress: () => undefined }), PreparedActionError);
  assert.equal(commits, 1);
});

test("PreparedAction cancellation and blocking prevent commit", async () => {
  let commits = 0;
  const cancelled = prepareAction({}, false, async () => { commits += 1; });
  cancelled.cancel();
  assert.equal(cancelled.state, "cancelled");
  await assert.rejects(() => cancelled.commit(undefined), /cancelled/);

  const blocked = prepareAction({}, true, async () => { commits += 1; });
  await assert.rejects(() => blocked.commit(undefined), /blocked/);
  assert.equal(blocked.state, "prepared");
  assert.equal(commits, 0);
});

test("simultaneous commits and callback rejection remain one-shot", async () => {
  let release: (() => void) | undefined;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  let calls = 0;
  const simultaneous = prepareAction({}, false, async () => { calls += 1; await pending; return "ok"; });
  const first = simultaneous.commit(undefined);
  await assert.rejects(() => simultaneous.commit(undefined), /committing/);
  release?.();
  assert.equal(await first, "ok");
  assert.equal(calls, 1);

  const rejected = prepareAction({}, false, async () => { throw new Error("callback failed"); });
  await assert.rejects(() => rejected.commit(undefined), /callback failed/);
  assert.equal(rejected.state, "committed");
  await assert.rejects(() => rejected.commit(undefined), /committed/);
});

test("package availability excludes missing and blocked resources", () => {
  assert.equal(packageAvailableCount({
    blocked: true,
    profiles: [{
      id: "tools", description: "Tools",
      summary: { installed: 1, external: 1, missing: 1, blocked: 1 },
      resources: [
        { kind: "formula", name: "brew", description: "Brew", state: "installed-by-selected-brew" },
        { kind: "formula", name: "external", description: "External", state: "available-externally" },
        { kind: "formula", name: "missing", description: "Missing", state: "missing" },
        { kind: "formula", name: "blocked", description: "Blocked", state: "blocked" },
      ],
    }],
  }), 2);
});

test("selected Homebrew rebuilds doctor and package PATH from its canonical prefix", () => {
  const dots = new DotsService({ repo: "/repo", home: "/home", path: "/usr/bin" }, { items: [], dependencies: [] });
  const packages = new DepsService({ path: "/usr/bin", env: { PATH: "/usr/bin" }, selectedBrew: "/old/bin/brew" });
  const selected = new DotsApplication(dots, packages).withSelectedBrew("/custom/prefix/bin/brew");
  assert.equal(selected.dots.paths.path, "/custom/prefix/bin:/custom/prefix/sbin:/usr/bin");
  assert.equal(selected.packages.path, selected.dots.paths.path);
  assert.equal(selected.packages.selectedBrew, "/custom/prefix/bin/brew");
});
