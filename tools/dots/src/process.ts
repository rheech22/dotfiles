import { constants } from "node:fs";
import { access, realpath, stat } from "node:fs/promises";
import { delimiter, isAbsolute, join } from "node:path";
import { spawn, type ChildProcessByStdio } from "node:child_process";
import type { Readable } from "node:stream";

const MAX_CAPTURE_BYTES = 2 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 120_000;
const KILL_GRACE_MS = 1_000;

export interface ProcessRequest {
  readonly executable: string;
  readonly argv: readonly string[];
  readonly env?: NodeJS.ProcessEnv;
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
}

export type ProcessResult =
  | {
    readonly kind: "exit";
    readonly exitCode: number;
    readonly stdout: string;
    readonly stderr: string;
    readonly stdoutTruncated: boolean;
    readonly stderrTruncated: boolean;
  }
  | { readonly kind: "spawn-error"; readonly error: string; readonly code?: string }
  | { readonly kind: "aborted"; readonly error: string }
  | { readonly kind: "timeout"; readonly error: string; readonly timeoutMs: number };

export interface ProcessRunner {
  run(request: ProcessRequest): Promise<ProcessResult>;
}

function capture(chunks: Buffer[], chunk: Buffer, size: number): { size: number; truncated: boolean } {
  if (size >= MAX_CAPTURE_BYTES) return { size, truncated: true };
  const remaining = MAX_CAPTURE_BYTES - size;
  chunks.push(chunk.subarray(0, remaining));
  return { size: size + Math.min(chunk.length, remaining), truncated: chunk.length > remaining };
}

export const spawnProcessRunner: ProcessRunner = {
  run: (request) => new Promise((resolve) => {
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let stdoutSize = 0;
    let stderrSize = 0;
    let stdoutTruncated = false;
    let stderrTruncated = false;
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    let terminationResult: Extract<ProcessResult, { kind: "aborted" | "timeout" }> | undefined;
    let child: ChildProcessByStdio<null, Readable, Readable>;
    const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const processGroup = process.platform !== "win32";
    const finish = (result: ProcessResult): void => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      request.signal?.removeEventListener("abort", abort);
      resolve(result);
    };
    const terminate = (result: Extract<ProcessResult, { kind: "aborted" | "timeout" }>): void => {
      if (terminationResult || settled) return;
      terminationResult = result;
      if (timer) clearTimeout(timer);
       try {
         if (processGroup && child.pid) process.kill(-child.pid, "SIGTERM");
         else if (!child.killed) child.kill("SIGTERM");
       } catch {
         if (!child.killed) child.kill("SIGTERM");
       }
       killTimer = setTimeout(() => {
         try {
           if (processGroup && child.pid) {
             // Descendants may keep inherited pipes open after the group leader exits.
             process.kill(-child.pid, "SIGKILL");
           } else if (child.exitCode === null && child.signalCode === null) {
             child.kill("SIGKILL");
           }
         } catch {
           if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
         }
       }, KILL_GRACE_MS);
      killTimer.unref?.();
    };
    const abort = (): void => {
      terminate({ kind: "aborted", error: "Process execution was aborted" });
    };
    if (request.signal?.aborted) {
      finish({ kind: "aborted", error: "Process execution was aborted" });
      return;
    }
    try {
      child = spawn(request.executable, [...request.argv], {
       shell: false,
        detached: processGroup,
        env: request.env,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error: unknown) {
      const spawnError = error as NodeJS.ErrnoException;
      finish({
        kind: "spawn-error",
        error: spawnError instanceof Error ? spawnError.message : String(spawnError),
        ...(spawnError.code ? { code: spawnError.code } : {}),
      });
      return;
    }
    request.signal?.addEventListener("abort", abort, { once: true });
    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        terminate({ kind: "timeout", error: `Process timed out after ${timeoutMs}ms`, timeoutMs });
      }, timeoutMs);
      timer.unref?.();
    }
    child.stdout.on("data", (value: Buffer) => {
      const next = capture(stdout, value, stdoutSize);
      stdoutSize = next.size;
      stdoutTruncated ||= next.truncated;
    });
    child.stderr.on("data", (value: Buffer) => {
      const next = capture(stderr, value, stderrSize);
      stderrSize = next.size;
      stderrTruncated ||= next.truncated;
    });
    child.on("error", (error: NodeJS.ErrnoException) => {
      finish(terminationResult ?? { kind: "spawn-error", error: error.message, ...(error.code ? { code: error.code } : {}) });
    });
    child.on("close", (exitCode) => {
      if (terminationResult) return finish(terminationResult);
      finish({
        kind: "exit",
        exitCode: exitCode ?? 1,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
        stdoutTruncated,
        stderrTruncated,
      });
    });
  }),
};

export async function resolveExecutable(name: string, path: string): Promise<string | undefined> {
  if (name.includes("/") || isAbsolute(name)) return undefined;
  for (const directory of path.split(delimiter)) {
    if (!directory) continue;
    const candidate = join(directory, name);
    try {
      await access(candidate, constants.X_OK);
      const canonical = await realpath(candidate);
      if ((await stat(canonical)).isFile()) return canonical;
    } catch {
      // Continue searching PATH.
    }
  }
  return undefined;
}

export async function resolveAbsoluteExecutable(candidate: string): Promise<string | undefined> {
  if (!isAbsolute(candidate)) return undefined;
  try {
    await access(candidate, constants.X_OK);
    const canonical = await realpath(candidate);
    return (await stat(canonical)).isFile() ? canonical : undefined;
  } catch {
    return undefined;
  }
}
