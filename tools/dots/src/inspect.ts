import { access, lstat, readlink, realpath, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { delimiter, dirname, isAbsolute, normalize, resolve } from "node:path";
import type { ConfigItem, Dependency } from "./manifest.js";
import type { DependencyStatus, LinkState, LinkStatus } from "./domain.js";

function errorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
  return typeof error.code === "string" ? error.code : undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function inspectSymlink(target: string, source: string): Promise<LinkState> {
  const seen = new Set<string>();
  let current = target;

  while (true) {
    current = normalize(current);
    if (seen.has(current)) return { state: "wrong-link", detail: { kind: "loop", path: current } };
    seen.add(current);

    let info;
    try {
      info = await lstat(current);
    } catch (error: unknown) {
      if (errorCode(error) === "ENOENT") {
        return { state: "wrong-link", detail: { kind: "dangling", path: current } };
      }
      return { state: "wrong-link", detail: { kind: "error", message: errorMessage(error) } };
    }

    if (!info.isSymbolicLink()) break;
    try {
      const link = await readlink(current);
      current = isAbsolute(link) ? link : resolve(dirname(current), link);
    } catch (error: unknown) {
      return { state: "wrong-link", detail: { kind: "error", message: errorMessage(error) } };
    }
  }

  try {
    const [actualPath, expectedPath] = await Promise.all([realpath(current), realpath(source)]);
    if (actualPath === expectedPath) return { state: "linked" };
    return { state: "wrong-link", detail: { kind: "different", actualPath } };
  } catch (error: unknown) {
    return { state: "wrong-link", detail: { kind: "error", message: errorMessage(error) } };
  }
}

export async function inspectLink(item: ConfigItem, repo: string, home: string): Promise<LinkStatus> {
  const source = resolve(repo, item.source);
  const target = resolve(home, item.target);
  let result: LinkState;

  if (item.enabled === false) {
    result = { state: "disabled", reason: item.disabledReason ?? "Disabled in manifest" };
  } else {
    try {
      await stat(source);
    } catch (error: unknown) {
      if (errorCode(error) === "ENOENT" || errorCode(error) === "ELOOP") {
        result = { state: "source-missing" };
      } else {
        result = { state: "wrong-link", detail: { kind: "error", message: errorMessage(error) } };
      }
      return { id: item.id, description: item.description, source, target, result };
    }

    try {
      const targetInfo = await lstat(target);
      if (targetInfo.isSymbolicLink()) {
        result = await inspectSymlink(target, source);
      } else if (targetInfo.isFile()) {
        result = { state: "occupied", kind: "file" };
      } else if (targetInfo.isDirectory()) {
        result = { state: "occupied", kind: "directory" };
      } else {
        result = { state: "occupied", kind: "other" };
      }
    } catch (error: unknown) {
      result = errorCode(error) === "ENOENT"
        ? { state: "missing" }
        : { state: "wrong-link", detail: { kind: "error", message: errorMessage(error) } };
    }
  }

  return { id: item.id, description: item.description, source, target, result };
}

export async function findExecutable(command: string, pathValue: string): Promise<string | undefined> {
  for (const entry of pathValue.split(delimiter)) {
    const candidate = resolve(entry || ".", command);
    try {
      const info = await stat(candidate);
      if (!info.isFile()) continue;
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Continue through PATH entries.
    }
  }
  return undefined;
}

export async function inspectDependency(dependency: Dependency, pathValue: string): Promise<DependencyStatus> {
  const executable = await findExecutable(dependency.command, pathValue);
  const base = {
    id: dependency.id,
    command: dependency.command,
    description: dependency.description,
    required: dependency.required,
    available: executable !== undefined,
  };
  return executable === undefined ? base : { ...base, path: executable };
}
