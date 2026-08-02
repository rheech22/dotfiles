import { isAbsolute, normalize, relative, resolve, sep } from "node:path";

function canonicalHome(home: string): string {
  return resolve(home);
}

export function formatHumanPath(value: string, home: string): string {
  if (!isAbsolute(value)) return value;
  const canonicalValue = normalize(value);
  const canonical = canonicalHome(home);
  if (canonicalValue === canonical) return "~";
  const within = relative(canonical, canonicalValue);
  if (!within || within === ".." || within.startsWith(`..${sep}`) || isAbsolute(within)) return value;
  return `~${sep}${within}`;
}

export function formatHumanText(value: string, home: string): string {
  const canonical = canonicalHome(home);
  if (canonical === sep) return value;

  let result = "";
  let cursor = 0;
  while (cursor < value.length) {
    const index = value.indexOf(canonical, cursor);
    if (index < 0) return result + value.slice(cursor);
    const before = index === 0 ? "" : value[index - 1]!;
    const after = value[index + canonical.length] ?? "";
    const startsAtBoundary = index === 0 || !/[A-Za-z0-9._~\\/]/.test(before);
    const endsAtBoundary = after === "" || after === "/" || after === "\\";
    result += value.slice(cursor, index);
    if (startsAtBoundary && endsAtBoundary) {
      result += "~";
      cursor = index + canonical.length;
    } else {
      result += canonical;
      cursor = index + canonical.length;
    }
  }
  return result;
}
