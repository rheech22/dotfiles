import type { ApplyResult, DependencyStatus, DoctorReport, LinkPlan, LinkStatus, LinkState } from "./domain.js";
import type { DependencyInstallResult, DependencyPlan } from "./deps.js";
import { formatHumanPath, formatHumanText } from "./human-path.js";

export function escapeControlCharacters(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f-\u009f]/g, (character) =>
    `\\u{${character.codePointAt(0)?.toString(16).padStart(2, "0") ?? "00"}}`
  );
}

const path = (value: string, home?: string): string => home ? formatHumanPath(value, home) : value;
const text = (value: string, home?: string): string => home ? formatHumanText(value, home) : value;
const safePath = (value: string, home?: string): string => escapeControlCharacters(path(value, home));
const safeText = (value: string, home?: string): string => escapeControlCharacters(text(value, home));

function linkDetail(result: LinkState, home?: string): string {
  switch (result.state) {
    case "linked": return "linked";
    case "missing": return "missing";
    case "source-missing": return "source missing";
    case "disabled": return `disabled: ${safeText(result.reason, home)}`;
    case "occupied": return `occupied ${result.kind}`;
    case "wrong-link": {
      if (result.detail.kind === "different") return `wrong link -> ${safePath(result.detail.actualPath, home)}`;
      if (result.detail.kind === "error") return `wrong link (${safeText(result.detail.message, home)})`;
      return `wrong link (${result.detail.kind}: ${safePath(result.detail.path, home)})`;
    }
  }
}

export function renderStatus(statuses: readonly LinkStatus[], color = false, home?: string): string {
  return statuses.map((status) => {
    const healthy = status.result.state === "linked" || status.result.state === "disabled";
    const marker = healthy ? "OK" : "!!";
    const line = `${marker} ${escapeControlCharacters(status.id)}: ${linkDetail(status.result, home)}`;
    if (!color) return line;
    return `${healthy ? "\u001b[32m" : "\u001b[33m"}${line}\u001b[0m`;
  }).join("\n");
}

function renderDependencies(label: string, statuses: readonly DependencyStatus[], home?: string): string[] {
  return [label, ...statuses.map((dependency) =>
    `${dependency.available ? "OK" : "!!"} ${escapeControlCharacters(dependency.id)}: ${
      dependency.available && dependency.path ? safePath(dependency.path, home) : "not found"
    }`
  )];
}

export function renderDoctor(report: DoctorReport, home?: string): string {
  const lines = [
    `Node: ${report.node.actual} (required >=${report.node.required}) ${report.node.supported ? "OK" : "UNSUPPORTED"}`,
    "Links:",
    renderStatus(report.links, false, home),
    ...renderDependencies("Required dependencies:", report.dependencies.required, home),
    ...renderDependencies("Optional dependencies:", report.dependencies.optional, home),
    `Summary: ${report.summary.errors} errors, ${report.summary.warnings} warnings`,
  ];
  return lines.filter((line) => line.length > 0).join("\n");
}

export function toJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function renderPlan(plan: LinkPlan, home?: string): string {
  return plan.items.map((item) => {
    const paths = [`source=${safePath(item.source, home)}`, `target=${safePath(item.target, home)}`];
    if (item.backup) paths.push(`backup=${safePath(item.backup, home)}`);
    if (item.reason) paths.push(`reason=${safeText(item.reason, home)}`);
    return `${item.action.toUpperCase()} ${escapeControlCharacters(item.id)} ${paths.join(" ")}`;
  }).join("\n");
}

export function renderApply(result: ApplyResult, home?: string): string {
  const lines = result.items.map((item) => {
    const suffix = item.error ? `: ${safeText(item.error, home)}` : "";
    const backup = item.backup ? ` backup=${safePath(item.backup, home)}` : "";
    return `${item.outcome.toUpperCase()} ${escapeControlCharacters(item.id)} target=${safePath(item.target, home)}${backup}${suffix}`;
  });
  if (result.lockCleanupError && result.items.every(({ outcome }) => outcome === "applied" || outcome === "noop")) {
    lines.push("Apply completed, but the transaction lock could not be removed.");
  } else {
    lines.push(result.success ? "Apply succeeded." : `Apply failed${result.rolledBack ? "; rollback attempted" : ""}.`);
  }
  lines.push(...result.rollbackErrors.map((error) => `ROLLBACK ERROR: ${safeText(error, home)}`));
  if (result.recoveryRequired) lines.push("WARNING: manual recovery is required; inspect the reported target and backup paths.");
  if (result.lockCleanupError) lines.push(`LOCK CLEANUP ERROR: ${safeText(result.lockCleanupError, home)}`);
  if (result.createdParentsMayRemain) lines.push("WARNING: newly created empty parent directories may remain.");
  return lines.join("\n");
}

export function renderDependencyPlan(plan: DependencyPlan, home?: string): string {
  if (plan.items.length === 0) return "No dependencies selected.";
  return plan.items.flatMap((item) => {
    const command = [safePath(item.command, home), ...item.argv.map((value) => safeText(value, home))].join(" ");
    const versions = item.versions?.length ? ` versions=${item.versions.map(escapeControlCharacters).join(",")}` : "";
    const reason = item.reason ? ` reason=${safeText(item.reason, home)}` : "";
    const line = `${item.action.toUpperCase()} ${escapeControlCharacters(item.kind)}:${escapeControlCharacters(item.name)} command=${command}${versions}${reason}`;
    return [line, ...(item.preview ?? []).map((preview) => `  ${safeText(preview, home)}`)];
  }).join("\n");
}

export function renderDependencyInstall(result: DependencyInstallResult, home?: string): string {
  const lines = result.items.map((item) => {
    const error = item.error ? `: ${safeText(item.error, home)}` : "";
    const warning = item.outputTruncated ? " (warning: output exceeded the capture limit)" : "";
    const becameNoop = item.outcome === "noop" && item.action !== "noop"
      ? ` (already installed; reviewed ${escapeControlCharacters(item.action)})`
      : "";
    return `${item.outcome.toUpperCase()} ${escapeControlCharacters(item.kind)}:${escapeControlCharacters(item.name)}${becameNoop}${warning}${error}`;
  });
  lines.push(result.success ? "Dependency installation succeeded." : "Dependency installation failed.");
  return lines.join("\n");
}
