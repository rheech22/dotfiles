# Global Rules

## Language & Communication
- Respond in Korean by default
- Use English for: code identifiers, technical terms
- Keep explanations concise — prefer Why > What

## Code Style
- TypeScript: strict mode, explicit types over `any`
- Prefer editing existing files over creating new ones
- No unnecessary comments — code should be self-explanatory
- Use early returns to reduce nesting

## Git
- Never force push without asking first
- Never skip hooks (--no-verify) unless explicitly asked

## AI Behavior
- Ask before making large structural changes
- Prefer surgical edits over rewrites
- When exploring codebase, use Task/Explore agent — don't read everything eagerly
- Do not add emojis unless explicitly requested
- Always confirm before applying changes to persistent config files (AGENTS.md, opencode.json, etc.)
- Prefer explicit user-triggered actions over automatic/proactive ones
