export type DependencyResourceKind = "tap" | "formula" | "cask";

export interface DependencyResource {
  readonly kind: DependencyResourceKind;
  readonly name: string;
  readonly description?: string;
  readonly runtimeCommand?: string;
  readonly runtimeApp?: string;
}

export interface DependencyProfile {
  readonly id: string;
  readonly description?: string;
  readonly resources: readonly DependencyResource[];
  readonly platforms?: readonly NodeJS.Platform[];
}

const descriptions: Readonly<Record<string, string>> = {
  git: "Git version control", zsh: "Z shell", fzf: "Fuzzy finder", starship: "Shell prompt",
  zoxide: "Directory jumper", eza: "Modern directory listing", "zsh-vi-mode": "Vi editing for Zsh",
  "zsh-syntax-highlighting": "Zsh command highlighting", "wezterm@nightly": "WezTerm nightly terminal",
  gh: "GitHub CLI", "git-delta": "Git diff pager", lazygit: "Git terminal UI", hunk: "Diff review UI",
  just: "Command runner", "tree-sitter-cli": "Tree-sitter CLI", prettierd: "Prettier daemon",
  stylua: "Lua formatter", eslint_d: "ESLint daemon", pngpaste: "Clipboard image utility",
  yazi: "Terminal file manager", fd: "File finder", ripgrep: "Text search", ffmpeg: "Media toolkit",
  sevenzip: "Archive utility", jq: "JSON processor", poppler: "PDF utilities", resvg: "SVG renderer",
  imagemagick: "Image toolkit", exiftool: "Media metadata utility", mpv: "Media player",
  "media-info": "Media metadata inspector", "claude-code": "Claude coding agent",
  hammerspoon: "macOS automation", "google-chrome": "Google Chrome browser", figma: "Figma design app",
  fnm: "Node.js version manager",
};

const commands: Readonly<Record<string, string>> = {
  ...Object.fromEntries(
    Object.keys(descriptions).map((name) => [name, name]),
  ),
  "tree-sitter-cli": "tree-sitter", "git-delta": "delta", "media-info": "mediainfo",
  "claude-code": "claude", "google-chrome": "google-chrome", ripgrep: "rg", sevenzip: "7zz",
};

const apps: Readonly<Record<string, string>> = {
  "wezterm@nightly": "/Applications/WezTerm.app", hammerspoon: "/Applications/Hammerspoon.app",
  "google-chrome": "/Applications/Google Chrome.app", figma: "/Applications/Figma.app",
};

const resources = (kind: DependencyResourceKind, names: readonly string[]): readonly DependencyResource[] =>
  names.map((name) => ({
    kind,
    name,
    description: descriptions[name] ?? name,
    ...(kind !== "tap" && commands[name] ? { runtimeCommand: commands[name] } : {}),
    ...(apps[name] ? { runtimeApp: apps[name] } : {}),
  }));
const formulae = (...names: readonly string[]): readonly DependencyResource[] => resources("formula", names);
const casks = (...names: readonly string[]): readonly DependencyResource[] => resources("cask", names);

export const dependencyProfiles: readonly DependencyProfile[] = [
  { id: "core", description: "Core command-line tools", resources: formulae("git") },
  {
    id: "terminal",
    description: "Interactive shell and terminal tools",
    resources: [
      ...formulae("zsh", "fzf", "starship", "zoxide", "eza", "zsh-vi-mode", "zsh-syntax-highlighting"),
      ...casks("wezterm@nightly"),
    ],
  },
  {
    id: "developer",
    description: "Development and source-control tools",
    resources: formulae("gh", "git-delta", "lazygit", "hunk", "just", "tree-sitter-cli", "prettierd", "stylua", "eslint_d", "pngpaste"),
  },
  { id: "yazi", description: "Yazi and search tools", resources: formulae("yazi", "fd", "ripgrep") },
  {
    id: "yazi-preview",
    description: "Rich preview support for Yazi",
    resources: formulae("ffmpeg", "sevenzip", "jq", "poppler", "resvg", "imagemagick", "exiftool", "mpv", "media-info"),
  },
  { id: "ai", description: "AI coding tools", resources: casks("claude-code") },
  { id: "macos", description: "macOS desktop applications", resources: casks("hammerspoon", "google-chrome", "figma"), platforms: ["darwin"] },
  { id: "runtime", description: "Language runtime management", resources: formulae("fnm") },
];

export const defaultDependencyProfileIds = ["core", "terminal", "developer", "yazi", "runtime"] as const;

const PROFILE_TOKEN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const RESOURCE_TOKEN = /^[A-Za-z0-9][A-Za-z0-9+@._-]*$/;
const TAP_TOKEN = /^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/;
const PLATFORMS = new Set<NodeJS.Platform>([
  "aix", "android", "darwin", "freebsd", "haiku", "linux", "openbsd", "sunos", "win32", "cygwin", "netbsd",
]);

export function validateDependencyManifest(profiles: readonly DependencyProfile[]): void {
  const profileIds = new Set<string>();
  const resourceMetadata = new Map<string, DependencyResource>();
  for (const profile of profiles) {
    if (!PROFILE_TOKEN.test(profile.id)) throw new Error(`Invalid dependency profile id: ${profile.id}`);
    if (profileIds.has(profile.id)) throw new Error(`Duplicate dependency profile id: ${profile.id}`);
    profileIds.add(profile.id);
    if (profile.platforms && new Set(profile.platforms).size !== profile.platforms.length) {
      throw new Error(`Duplicate dependency platform in ${profile.id}`);
    }
    if (profile.platforms?.some((platform) => !PLATFORMS.has(platform))) {
      throw new Error(`Invalid dependency platform in ${profile.id}`);
    }
    const inProfile = new Set<string>();
    for (const resource of profile.resources) {
      const valid = resource.kind === "tap" ? TAP_TOKEN.test(resource.name) : RESOURCE_TOKEN.test(resource.name);
      if (!valid || resource.name.startsWith("-")) {
        throw new Error(`Invalid ${resource.kind} resource name: ${resource.name}`);
      }
      const key = `${resource.kind}:${resource.name}`;
      if (resource.runtimeCommand && !RESOURCE_TOKEN.test(resource.runtimeCommand)) {
        throw new Error(`Invalid runtime command for ${key}: ${resource.runtimeCommand}`);
      }
      if (resource.runtimeApp && !resource.runtimeApp.startsWith("/")) {
        throw new Error(`Runtime app path must be absolute for ${key}`);
      }
      if (inProfile.has(key)) throw new Error(`Duplicate dependency resource in ${profile.id}: ${key}`);
      inProfile.add(key);
      const existing = resourceMetadata.get(key);
      if (existing && (existing.description !== resource.description
        || existing.runtimeCommand !== resource.runtimeCommand || existing.runtimeApp !== resource.runtimeApp)) {
        throw new Error(`Conflicting dependency resource metadata: ${key}`);
      }
      resourceMetadata.set(key, resource);
    }
  }
}

validateDependencyManifest(dependencyProfiles);

const dependencyProfileIds = new Set(dependencyProfiles.map(({ id }) => id));
for (const id of defaultDependencyProfileIds) {
  if (!dependencyProfileIds.has(id)) throw new Error(`Unknown default dependency profile id: ${id}`);
}
