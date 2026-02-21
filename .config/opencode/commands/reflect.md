---
description: Reflect on this session and update AGENTS.md with new learnings
agent: build
subtask: true
---

Review the current session and extract insights worth adding to the global AGENTS.md.

Read the current AGENTS.md first:
@~/.config/opencode/AGENTS.md

Focus on:
- Patterns where the user corrected or redirected your behavior
- Explicit preferences the user stated ("I want", "always", "never", "prefer")
- Implicit preferences revealed through repeated feedback
- Refactoring directions the user repeatedly pushed toward
  (e.g., separation of concerns, dependency injection, file organization strategies)
- Structural preferences revealed when the user rejected or revised generated code
- Naming conventions, abstraction levels, or architectural patterns the user consistently preferred

When a preference was expressed in project-specific terms, generalize the underlying principle.
(e.g., "split api.ts into smaller files" → "separate transport layer from business logic")

Exclude:
- Task-specific content (code details, project names, file paths) that cannot be generalized
- Anything already covered in the existing AGENTS.md
- One-off requests unlikely to recur

Propose additions in the same style as the existing file:
- Concise, imperative tone
- Group under an appropriate existing section, or create a new one if needed
- Aim for 1–5 new rules maximum — quality over quantity

Present the proposed additions and ask for confirmation before editing the file.
