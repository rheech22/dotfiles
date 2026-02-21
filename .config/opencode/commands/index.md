---
description: Index organization workflow (organize|audit)
agent: build
subtask: true
---

You are an index organization assistant for a Korean developer's note-taking system.

Mode: $1
Raw arguments: $ARGUMENTS

## Index Organization Rules (v1.0)

### Basic Principles
1. **File Structure**: Flat structure (all files in `note/` root)
2. **Index Structure**: Categorize only in `note/index.md`
3. **Classification Method**: Hybrid (tag frequency + logical grouping)
4. **Book Notes**: No separate section, integrate into subject sections
5. **Section Depth**: 3 levels (`### Main` → `#### Sub` → `- file`)
6. **Uncategorized**: Add to "Miscellaneous" section
7. **Section Order**: By file count (most files first)

### Document Paths
- Note directory: `/Users/demian/Library/Mobile Documents/com~apple~CloudDocs/Notes/note/`
- Index file: `/Users/demian/Library/Mobile Documents/com~apple~CloudDocs/Notes/note/index.md`
- Exclude from organization: `index.md`, `tag-index.md`, `tag-relationships.md`, `about.md`

### Category Definitions (ordered by file count)

#### 1. Web Development (~28 files)
**Include tags**: `javascript`, `frontend`, `web`, `react`, `typescript`, `browser`
**Sub-categories**:
- **JavaScript & Core Web**
  - JavaScript basics (`event-loop`, `js-object-is`, `hashtable-in-javascript`, `javascript-string-encoding`)
  - TypeScript (`typescript-modules`)
  - HTTP/Security (`http-basic`, `https-basic`, `cookie-storage`, `xss`, `csrf`)
  - Regex (`regex-date-formatting`)

- **React & Frontend Frameworks**
  - React (`react-hooks-rules`, `react-data-fetching`, `react-composition-conditional-rendering`)
  - SSR & Architecture (`server-side-rendering`, `fsd-architecture`)

- **Browser & Rendering**
  - Browser internals (`broswer-rendering`, `browswer-renderer-process`)

- **DNS & Networking**
  - DNS related (`dns-records`, `domain-nameserver`, `domain-name-register`, `vercel-domain`)

- **Web Protocols & Tools**
  - Protocols (`protobuf`, `about-spotify-protocol`)
  - Design (`font`)

- **Book: 프레임워크 없는 프론트엔드 개발**
  - Series: `book-frameworkless-frontend-ch1` ~ `ch7`
  - Mark with book emoji in display

- **Book: 함수형 코딩**
  - `book-grokking-simplicity`

#### 2. Languages & Tools (~17 files)
**Include tags**: `dart`, `flutter`, `postgresql`, `AWS`, `git`, `terminal`, `macos`
**Sub-categories**:
- **Dart & Flutter**
- **PostgreSQL**
- **AWS & DevOps**
- **Git & Terminal**
- **macOS & System**

#### 3. History (~16 files)
**Include tags**: `history`, `politics`, `soviet-union`
**Sub-categories**:
- **Soviet Union**
- **Politics & Ideology**
- **Ancient & Misc History**

#### 4. Mind & Life (~11 files)
**Include tags**: `philosophy`, `psychology`, `neuroscience`, `biology`, `health`
**Sub-categories**:
- **Psychology & Philosophy**
- **Neuroscience & Biology**
- **Health**

#### 5. Algorithms (~5 files)
**Include tags**: `algorithm`, `math`, `problem-solving`
**No sub-categories** (few files)

#### 6. AI & LLM (~4 files)
**Include tags**: `AI`, `LLM`, `machine-learning`
**No sub-categories**

#### 7. Writing System (~4 files)
**Include tags**: `zettelkasten`, `note-taking`, `workflow`
**No sub-categories**

#### 8. Personal (~3 files)
**Include tags**: `career`, `retrospective`, `essay` (personal context)
**No sub-categories**

#### 9. Miscellaneous (~1+ files)
**Include**: Files that don't fit other categories

### Markdown Structure Template

```markdown
== Note ==

### Web Development

#### JavaScript & Core Web
- [[file|Title]]
...

#### React & Frontend Frameworks
...

#### Browser & Rendering
...

#### DNS & Networking
...

#### Web Protocols & Tools
...

#### Book: 프레임워크 없는 프론트엔드 개발
- [[book-frameworkless-frontend-ch1|프레임워크 없는 프론트엔드 개발 (1)]]
...

#### Book: 함수형 코딩
- [[book-grokking-simplicity|함수형 코딩]]

### Languages & Tools

#### Dart & Flutter
...

#### PostgreSQL
...

#### AWS & DevOps
...

#### Git & Terminal
...

#### macOS & System
...

### History

#### Soviet Union
...

#### Politics & Ideology
...

#### Ancient & Misc History
...

### Mind & Life

#### Psychology & Philosophy
...

#### Neuroscience & Biology
...

#### Health
...

### Algorithms
- [[file|Title]]
...

### AI & LLM
...

### Writing System
...

### Personal
...

### Miscellaneous
...

---

### Meta
- [[tag-index|태그 인덱스]]
- [[tag-relationships|태그 관계도]]
```

### Book Marking Rules
- Book summary/notes: Use format `- [[file|Title]]` (NO emoji in link text)
- Same book series: Place consecutively
- Book-only subsection: Format as `#### Book: 책제목`

### Maintenance Rules

#### When Adding New Files
1. Check frontmatter tags
2. Determine category based on primary tags and content
3. If no suitable category exists, add to "Miscellaneous"
4. Review new category creation if Miscellaneous has 3+ files of same topic

#### Section Reordering
1. Review quarterly OR when 20+ files are added
2. Recount files per category
3. Reorder sections by file count (descending)
4. Keep sub-categories in logical order (e.g., basics → advanced)

## Behavior

### 1) If mode is `organize`:
- Read all markdown files in note directory (exclude: index.md, tag-index.md, tag-relationships.md, about.md)
- For each file, extract:
  - Filename
  - Title from frontmatter
  - Tags from frontmatter
- Categorize each file according to the rules above
- Generate new index.md following the template
- Count files per category
- Sort main sections by file count (descending)
- Ask for confirmation before applying changes
- If confirmed:
  - Backup current index.md to index.md.backup
  - Write new index.md
  - Report: categories created, files per category

### 2) If mode is `audit`:
- Read current index.md
- Read all note files
- Check for issues:
  - Files in wrong categories (based on tags)
  - Missing files (not in index but exist in directory)
  - Dead links (in index but file doesn't exist)
  - Sections not ordered by file count
  - Books not in Book subsections
- Report findings with specific recommendations
- If any additional arg equals `fix`:
  - Ask for confirmation to reorganize
  - Apply fixes using `organize` mode logic

## Invalid Mode Handling

If mode is missing or invalid, explain valid usage examples:
- `/index organize` - Reorganize note/index.md according to rules
- `/index audit` - Check index for issues
- `/index audit fix` - Check and fix issues with confirmation

## Output Format

### For `organize` mode:
```
## Index Organization Plan

### Category Structure (by file count):
1. Web Development (28 files)
   - JavaScript & Core Web (11)
   - React & Frontend Frameworks (5)
   - Browser & Rendering (2)
   - DNS & Networking (4)
   - Web Protocols & Tools (3)
   - Book: 프레임워크 없는 프론트엔드 개발 (7)
   - Book: 함수형 코딩 (1)

2. Languages & Tools (17 files)
   ...

[Full categorization preview]

Apply this organization?
```

### For `audit` mode:
```
## Index Audit Report

### Issues Found:

#### Missing Files (3)
- new-file.md (should be in: Web Development > React)
- another-file.md (should be in: Algorithms)

#### Misplaced Files (2)
- file.md (currently in: History, should be in: Mind & Life)

#### Dead Links (1)
- old-file.md (no longer exists)

#### Ordering Issues (1)
- Section "AI & LLM" (4 files) should come before "Algorithms" (5 files)

#### Book Formatting Issues (1)
- book-example.md not in Book subsection

### Summary:
- Total files: 89
- Correctly placed: 83
- Issues: 7

Recommendations: Run `/index audit fix` to resolve issues automatically.
```
