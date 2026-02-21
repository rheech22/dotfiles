---
description: Tag workflow (file|audit|refresh)
agent: build
subtask: true
---

Follow @/Users/demian/Library/Mobile Documents/com~apple~CloudDocs/Notes/note/tagging-guide.md.
Use @/Users/demian/Library/Mobile Documents/com~apple~CloudDocs/Notes/note/tag-index.md and @/Users/demian/Library/Mobile Documents/com~apple~CloudDocs/Notes/note/tag-relationships.md as references.

Mode: $1
Raw arguments: $ARGUMENTS

Rules:
- Tags per doc: 1..3
- English only
- kebab-case
- lowercase by default
- keep uppercase only for acronyms (AI, LLM, AWS, DNS, HTTP, HTTPS, API, SQL, SSR, CSR, FSD, CDK, VPC, ENI, EIP, XSS, CSRF, RAG)

Behavior:
1) If mode is `file`:
   - Target file path is `$2`
   - Update only that file's frontmatter `tags`
   - Return old -> new tags

2) If mode is `audit`:
   - Scan `blog/*.md` and `note/*.md` (exclude `index.md`)
   - Report violations only
   - If any additional arg equals `fix`, apply fixes and then report old -> new tags

3) If mode is `refresh`:
   - Rebuild `note/tag-index.md` and `note/tag-relationships.md` from current `blog/` and `note/` docs
   - Keep existing doc style

If mode is missing or invalid, explain valid usage examples:
- `/tag file /abs/path/to/doc.md`
- `/tag audit`
- `/tag audit fix`
- `/tag refresh`
