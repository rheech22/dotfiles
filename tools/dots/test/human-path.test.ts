import assert from "node:assert/strict";
import test from "node:test";
import { formatHumanPath, formatHumanText } from "../src/human-path.js";
import { escapeControlCharacters } from "../src/reporters.js";

const home = "/Users/test User";

test("formats only HOME and paths strictly inside it", () => {
  assert.equal(formatHumanPath(home, home), "~");
  assert.equal(formatHumanPath(`${home}/.config/dots`, home), "~/.config/dots");
  assert.equal(formatHumanPath("/Users/test User2/.config", home), "/Users/test User2/.config");
  assert.equal(formatHumanPath("/Users/other/.config", home), "/Users/other/.config");
  assert.equal(formatHumanPath("not a path", home), "not a path");
  assert.equal(formatHumanPath("/etc", "/"), "~/etc");
});

test("formats bounded HOME occurrences before control escaping", () => {
  const value = `failed at ${home}/.config/a\nnot ${home}2/.config and ${home}`;
  const formatted = formatHumanText(value, home);
  assert.equal(formatted, `failed at ~/.config/a\nnot ${home}2/.config and ~`);
  assert.equal(escapeControlCharacters(formatted), `failed at ~/.config/a\\u{0a}not ${home}2/.config and ~`);
  assert.equal(formatHumanText("failed at /etc; keep https://example.com/x", "/"), "failed at /etc; keep https://example.com/x");
});
