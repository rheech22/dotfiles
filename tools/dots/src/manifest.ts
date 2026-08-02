export interface ConfigItem {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly description: string;
  readonly groups?: readonly string[];
  readonly enabled?: boolean;
  readonly optional?: boolean;
  readonly disabledReason?: string;
}

export const configItems: readonly ConfigItem[] = [
  {
    id: "dots",
    source: "bin/dots",
    target: ".local/bin/dots",
    description: "Dots command-line entrypoint",
  },
  {
    id: "zshrc",
    source: ".config/zsh/.zshrc",
    target: ".zshrc",
    description: "Zsh RC file",
    groups: ["zsh"],
  },
  {
    id: "zshenv",
    source: ".config/zsh/.zshenv",
    target: ".zshenv",
    description: "Zsh environment variables",
    groups: ["zsh"],
  },
  {
    id: "zprofile",
    source: ".config/zsh/.zprofile",
    target: ".zprofile",
    description: "Zsh profile",
    groups: ["zsh"],
  },
  {
    id: "gitconfig",
    source: ".config/git/.gitconfig",
    target: ".gitconfig",
    description: "Git configuration",
    groups: ["git"],
  },
  {
    id: "starship",
    source: ".config/starship/themes/vague.toml",
    target: ".config/starship.toml",
    description: "Starship prompt",
  },
  {
    id: "nvim",
    source: ".config/nvim",
    target: ".config/nvim",
    description: "Neovim configuration",
  },
  {
    id: "herdr",
    source: ".config/herdr/config.toml",
    target: ".config/herdr/config.toml",
    description: "Herdr configuration",
  },
  {
    id: "hunk",
    source: ".config/hunk/config.toml",
    target: ".config/hunk/config.toml",
    description: "Hunk diff viewer",
  },
  {
    id: "claude-settings",
    source: ".claude/settings.json",
    target: ".claude/settings.json",
    description: "Claude Code global settings",
    groups: ["claude"],
  },
  {
    id: "claude-instructions",
    source: ".claude/CLAUDE.md",
    target: ".claude/CLAUDE.md",
    description: "Claude Code global instructions",
    groups: ["claude"],
  },
  {
    id: "claude-statusline",
    source: ".claude/statusline-command.sh",
    target: ".claude/statusline-command.sh",
    description: "Claude Code status line",
    groups: ["claude"],
  },
  {
    id: "claude-hooks",
    source: ".claude/hooks",
    target: ".claude/hooks",
    description: "Claude Code global hooks",
    groups: ["claude"],
  },
  {
    id: "opencode",
    source: ".config/opencode",
    target: ".config/opencode",
    description: "OpenCode AI assistant",
  },
  {
    id: "wezterm",
    source: ".config/wezterm",
    target: ".config/wezterm",
    description: "WezTerm terminal",
  },
  {
    id: "yazi",
    source: ".config/yazi",
    target: ".config/yazi",
    description: "Yazi file manager",
  },
  {
    id: "lazygit",
    source: ".config/lazygit",
    target: ".config/lazygit",
    description: "Lazygit configuration",
    enabled: false,
    disabledReason: "Excluded by the legacy linker",
  },
  {
    id: "ripgrep",
    source: ".config/ripgrep",
    target: ".config/ripgrep",
    description: "Ripgrep configuration",
  },
  {
    id: "whisper-voice",
    source: ".config/whisper-voice",
    target: ".config/whisper-voice",
    description: "Whisper Voice routing",
  },
  {
    id: "hammerspoon",
    source: ".hammerspoon",
    target: ".hammerspoon",
    description: "Hammerspoon automation",
  },
];

export interface Dependency {
  readonly id: string;
  readonly command: string;
  readonly description: string;
  readonly required: boolean;
}

export const dependencies: readonly Dependency[] = [
  { id: "git", command: "git", description: "Repository management", required: true },
  { id: "homebrew", command: "brew", description: "Package management", required: true },
  { id: "node", command: "node", description: "Dots runtime", required: true },
  { id: "pnpm", command: "pnpm", description: "Dots package installation", required: true },
  { id: "fzf", command: "fzf", description: "Shell fuzzy finder", required: true },
  { id: "starship", command: "starship", description: "Shell prompt", required: true },
  { id: "zoxide", command: "zoxide", description: "Directory navigation", required: true },
  { id: "eza", command: "eza", description: "Directory listing", required: true },
  { id: "ripgrep", command: "rg", description: "Text search", required: true },
  { id: "fd", command: "fd", description: "File search", required: true },
  { id: "git-delta", command: "delta", description: "Git pager", required: true },
  { id: "gh", command: "gh", description: "GitHub CLI", required: false },
  { id: "lazygit", command: "lazygit", description: "Git TUI", required: false },
  { id: "hunk", command: "hunk", description: "Diff review TUI", required: false },
  { id: "herdr", command: "herdr", description: "Agent terminal", required: false },
  { id: "nvim", command: "nvim", description: "Text editor", required: false },
  { id: "yazi", command: "yazi", description: "File manager", required: false },
  { id: "opencode", command: "opencode", description: "AI coding agent", required: false },
];
