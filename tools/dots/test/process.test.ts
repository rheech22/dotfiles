import assert from "node:assert/strict";
import test from "node:test";
import { spawnProcessRunner } from "../src/process.js";

const neverClosing = ["-e", "setInterval(() => {}, 1000)"] as const;

test("process runner aborts a live child promptly with a distinct result", async () => {
  const controller = new AbortController();
  const task = spawnProcessRunner.run({ executable: process.execPath, argv: neverClosing, signal: controller.signal });
  controller.abort();
  const result = await task;
  assert.equal(result.kind, "aborted");
});

test("process runner times out a live child with a clear result", async () => {
  const result = await spawnProcessRunner.run({ executable: process.execPath, argv: neverClosing, timeoutMs: 20 });
  assert.equal(result.kind, "timeout");
  if (result.kind === "timeout") assert.equal(result.timeoutMs, 20);
});

test("process runner abort terminates descendants that inherit output pipes", async () => {
  const controller = new AbortController();
  const script = [
    "const { spawn } = require('node:child_process')",
    "spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: ['ignore', 'inherit', 'inherit'] })",
    "setInterval(() => {}, 1000)",
  ].join(";");
  const pending = spawnProcessRunner.run({
    executable: process.execPath,
    argv: ["-e", script],
    signal: controller.signal,
    timeoutMs: 5_000,
  });
  await new Promise((resolve) => setTimeout(resolve, 20));
  controller.abort();
  const result = await pending;
  assert.equal(result.kind, "aborted");
});

test("process runner kills a SIGTERM-ignoring descendant after its leader exits", async () => {
  const controller = new AbortController();
  const descendant = "process.on('SIGTERM', () => {}); process.stdout.write('ready\\n'); setInterval(() => {}, 1000)";
  const script = [
    "const { spawn } = require('node:child_process')",
    `spawn(process.execPath, ['-e', ${JSON.stringify(descendant)}], { stdio: ['ignore', 'inherit', 'inherit'] })`,
    "setInterval(() => {}, 1000)",
  ].join(";");
  const pending = spawnProcessRunner.run({
    executable: process.execPath,
    argv: ["-e", script],
    signal: controller.signal,
    timeoutMs: 5_000,
  });
  await new Promise((resolve) => setTimeout(resolve, 100));
  controller.abort();
  const result = await pending;
  assert.equal(result.kind, "aborted");
});
