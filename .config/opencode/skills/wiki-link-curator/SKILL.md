---
name: wiki-link-curator
description: Use when connecting markdown wiki documents under blog/ and zt/literature/ by adding high-confidence wikilinks, related-document sections, and validating broken internal links.
---

# Wiki Link Curator

Use this skill to improve internal links in the markdown wiki without adding noisy graph edges.

## Scope

- Primary folders: `blog/`, `zt/literature/`
- Link format: Obsidian-style wikilinks
- Goal: improve navigation and conceptual continuity between existing documents
- Default stance: high precision over high recall

## Strategy

1. Inventory existing markdown files and titles in `blog/` and `zt/literature/`.
2. Find explicit unlinked mentions of existing documents.
3. Convert explicit mentions into inline wikilinks at the mention site.
4. Find strong related-document candidates that are not directly mentioned.
5. Add strong inferred links under `## 관련 문서` with a short reason.
6. Validate that every added wikilink resolves to an existing `.md` file.

## Link Types

- Explicit mention: the target document's title, alias, or core concept appears in the source document.
- Strong inferred relation: the documents answer adjacent questions, explain prerequisite/background concepts, show follow-up work, or form a clear series.
- Weak relation: broad theme overlap only. Do not edit for these; report as candidates if useful.

## Editing Rules

- Prefer high-confidence links only.
- Do not add links inside code blocks.
- Do not rewrite quoted source text or generated examples just to add links.
- Do not add backlinks mechanically; one directional link is enough when only one direction has context.
- Do not add weak thematic links just to increase graph density.
- Do not add duplicate links to the same target repeatedly in a short section.
- If unsure, report the candidate instead of editing.
- Preserve existing document tone, headings, and structure.
- Keep changes surgical.

## Inline Link Rules

Use inline links when the document already mentions the concept directly.

Examples:

```md
[[git-worktree|Git Worktree]] 조합을 통한 병렬 작업
[[xss|XSS]]와의 차이
[[soviet-great-famine|1932-1933년 대기근]]
```

Avoid turning every repeated occurrence into a link. Link the first meaningful occurrence or the most useful occurrence in context.

## Related Documents Rules

Use `## 관련 문서` when the target is useful but not naturally mentioned in the body.

```md
## 관련 문서
- [[target-slug|Title]]: why this document is useful here
```

- Add this section near the end of the document.
- If `## 출처` or `# 참고` exists, place `## 관련 문서` before it.
- Keep the list focused, usually 3-7 items at most.
- Every item should include a concise reason after `:`.

## Link Style

- From `blog/` to `zt/literature/`: `[[../zt/literature/slug|Label]]`
- From `zt/literature/` to `blog/`: `[[../../blog/slug|Label]]`
- Within `zt/literature/`: `[[slug|Label]]`
- Within `blog/`: `[[slug|Label]]`

Prefer labels that match the surrounding sentence naturally. Do not include `.md` in wikilink targets unless the vault convention explicitly requires it.

## Candidate Discovery

Prioritize these signals:

- Exact title or alias mentions outside wikilinks
- Shared proper nouns, tools, events, or project names
- Series relationships between blog posts
- Prerequisite/background concepts already documented in literature notes
- Follow-up posts or summaries of the same event
- Security pairs such as `XSS` and `CSRF`
- Cause/effect clusters in history notes
- Tooling clusters such as `CodeCompanion`, `Claude Code`, `Git Worktree`, `Vercel`

When searching, ignore:

- Markdown code fences
- Existing wikilinks
- External links unless their surrounding prose names an internal document concept
- Index files unless the task explicitly asks to update indexes

## Verification

After edits, verify the modified files:

1. Every wikilink target resolves to an existing `.md` file.
2. No `## 관련 문서` section was inserted mid-essay by mistake.
3. No duplicated headings such as repeated `## 출처` were introduced.
4. No links were added inside code blocks or quoted generated examples.
5. Exact title mentions outside wikilinks are either intentionally left alone or linked.

Use a small script if needed to resolve wikilinks relative to each modified file and by same-directory slug.

## Reporting

In the final response, summarize:

- Files changed
- Link categories applied: inline links, related-document sections, broken-link fixes
- Verification result, especially broken wikilink count

Do not paste every changed line unless the user asks for a detailed diff.
