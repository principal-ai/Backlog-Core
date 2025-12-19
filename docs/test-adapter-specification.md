# Test Adapter Specification

This document defines the functionality that must be testable using the in-memory test adapters. Each capability should be verifiable through simulation without touching the real filesystem or git.

## Overview

The test adapters (`InMemoryFileSystemAdapter`, `InMemoryGlobAdapter`, `MockGitAdapter`) must support simulating all core operations so that unit tests can:

1. Run without filesystem side effects
2. Execute deterministically (no timing dependencies)
3. Verify exact sequences of operations
4. Test error conditions and edge cases
5. Run in parallel without conflicts

---

## 1. Task Management

### 1.1 Task CRUD Operations

| Operation | Description | Adapter Requirements |
|-----------|-------------|---------------------|
| Create task | Generate ID, save markdown file | `writeFile`, `exists`, `createDir` |
| Read task | Load and parse task by ID | `readFile`, `exists` |
| Update task | Modify and save, handle renames | `writeFile`, `rename`, `exists` |
| Delete/Archive task | Move to archive directory | `rename`, `createDir` |
| List tasks | Enumerate tasks in directory | `glob.scan` |

**Test Scenarios:**
- [ ] Create task with auto-generated ID
- [ ] Create task with explicit ID
- [ ] Create sub-task with parent ID (e.g., `42.1`)
- [ ] Update task title (triggers file rename)
- [ ] Update task without title change
- [ ] Archive active task
- [ ] Complete active task
- [ ] List tasks with status filter
- [ ] List tasks with assignee filter
- [ ] List tasks with label filter
- [ ] List tasks with priority filter
- [ ] Handle task not found error
- [ ] Handle concurrent task updates

### 1.2 Task Movement

| Operation | Description | Adapter Requirements |
|-----------|-------------|---------------------|
| Archive task | Move `tasks/` → `archive/tasks/` | `rename`, `createDir` |
| Complete task | Move `tasks/` → `completed/` | `rename`, `createDir` |
| Demote task | Move `tasks/` → `drafts/` | `rename`, `createDir` |
| Promote draft | Move `drafts/` → `tasks/` | `rename`, `createDir` |
| Archive draft | Move `drafts/` → `archive/drafts/` | `rename`, `createDir` |

**Test Scenarios:**
- [ ] Archive task creates archive directory if missing
- [ ] Complete task moves to completed directory
- [ ] Demote task preserves content
- [ ] Promote draft assigns new ID if needed
- [ ] Handle moving non-existent task

### 1.3 Task Ordering (Sequences)

| Operation | Description | Adapter Requirements |
|-----------|-------------|---------------------|
| Reorder task | Update ordinal field | `readFile`, `writeFile` |
| Resolve conflicts | Reassign ordinals on collision | `readFile`, `writeFile` (batch) |
| Move to sequence | Update dependencies | `readFile`, `writeFile` |
| Remove from sequence | Clear dependencies | `readFile`, `writeFile` |

**Test Scenarios:**
- [ ] Reorder task between two others
- [ ] Reorder to beginning of list
- [ ] Reorder to end of list
- [ ] Handle ordinal collision
- [ ] Move task into dependency sequence
- [ ] Remove task from sequence

### 1.4 Acceptance Criteria

| Operation | Description | Adapter Requirements |
|-----------|-------------|---------------------|
| Add criteria | Append to AC list | `readFile`, `writeFile` |
| Remove criteria | Remove by index, reindex | `readFile`, `writeFile` |
| Toggle checked | Update check status | `readFile`, `writeFile` |
| List criteria | Parse from task | `readFile` |

**Test Scenarios:**
- [ ] Add first acceptance criterion
- [ ] Add multiple criteria
- [ ] Remove middle criterion (verify reindexing)
- [ ] Toggle criterion checked state
- [ ] Remove all criteria

---

## 2. Document Management

| Operation | Description | Adapter Requirements |
|-----------|-------------|---------------------|
| Create document | Generate ID, save file | `writeFile`, `exists`, `createDir` |
| Read document | Load by ID | `readFile`, `exists` |
| Update document | Modify content | `writeFile` |
| List documents | Enumerate recursively | `glob.scan` |

**Test Scenarios:**
- [ ] Create document with auto-generated ID
- [ ] Create document in subdirectory
- [ ] Update document content
- [ ] List all documents
- [ ] Handle document not found

---

## 3. Decision Management

| Operation | Description | Adapter Requirements |
|-----------|-------------|---------------------|
| Create decision | Generate ID, save file | `writeFile`, `exists`, `createDir` |
| Read decision | Load and parse | `readFile`, `exists` |
| Update decision | Modify from content | `writeFile` |
| List decisions | Enumerate directory | `glob.scan` |

**Test Scenarios:**
- [ ] Create decision with title
- [ ] Parse decision fields (context, decision, consequences)
- [ ] Update decision from raw content
- [ ] List all decisions

---

## 4. Configuration Management

| Operation | Description | Adapter Requirements |
|-----------|-------------|---------------------|
| Load config | Read backlog.json | `readFile`, `exists` |
| Save config | Write backlog.json | `writeFile` |
| Migrate config | Handle legacy formats | `readFile`, `writeFile` |
| User settings | Read/write user prefs | `readFile`, `writeFile`, `homedir` |

**Test Scenarios:**
- [ ] Load valid config
- [ ] Handle missing config (use defaults)
- [ ] Save config changes
- [ ] Migrate v0 config to v1
- [ ] Get global user setting
- [ ] Get project user setting
- [ ] Set user setting

---

## 5. Git Operations

### 5.1 File Staging

| Operation | Description | MockGitAdapter Method |
|-----------|-------------|----------------------|
| Stage file | `git add <file>` | `exec(["add", file])` |
| Stage multiple | `git add <files...>` | `exec(["add", ...files])` |
| Stage directory | `git add <dir>` | `exec(["add", dir])` |
| Stage move | Record move for commit | `exec(["add", ...])` |

**Test Scenarios:**
- [ ] Stage single file
- [ ] Stage multiple files
- [ ] Stage entire backlog directory
- [ ] Verify staged files list

### 5.2 Committing

| Operation | Description | MockGitAdapter Method |
|-----------|-------------|----------------------|
| Commit changes | `git commit -m` | `exec(["commit", "-m", msg])` |
| Task commit | Prefixed message | `exec(["commit", ...])` |
| Validate staged | Check for changes first | `exec(["status", ...])` |

**Test Scenarios:**
- [ ] Commit with message
- [ ] Commit with task ID prefix
- [ ] Reject commit when nothing staged
- [ ] Verify commit message format

### 5.3 Repository Status

| Operation | Description | MockGitAdapter Method |
|-----------|-------------|----------------------|
| Get status | `git status --porcelain` | `exec(["status", "--porcelain"])` |
| Is clean | Check working tree | `exec(["status", ...])` |
| Current branch | `git branch --show-current` | `exec(["branch", "--show-current"])` |
| Last commit | `git log -1 --format=%s` | `exec(["log", ...])` |

**Test Scenarios:**
- [ ] Detect clean working tree
- [ ] Detect uncommitted changes
- [ ] Get current branch name
- [ ] Get last commit message

### 5.4 Branch Operations

| Operation | Description | MockGitAdapter Method |
|-----------|-------------|----------------------|
| List local branches | `git branch` | `exec(["branch"])` |
| List all branches | `git branch -a` | `exec(["branch", "-a"])` |
| List remote branches | `git branch -r` | `exec(["branch", "-r"])` |
| Recent branches | Filter by date | `exec(["branch", ...])` |

**Test Scenarios:**
- [ ] List local branches only
- [ ] List all branches including remotes
- [ ] List branches active in last N days
- [ ] Handle no remotes configured

### 5.5 Cross-Branch Task Loading

| Operation | Description | MockGitAdapter Method |
|-----------|-------------|----------------------|
| List tree files | `git ls-tree` | `exec(["ls-tree", ...])` |
| Show file | `git show ref:path` | `exec(["show", ref:path])` |
| File mod dates | `git log --format` | `exec(["log", ...])` |

**Test Scenarios:**
- [ ] Load task from other local branch
- [ ] Load task from remote branch
- [ ] Merge task from multiple branches (most recent wins)
- [ ] Handle task exists only on remote
- [ ] Handle conflicting task versions

### 5.6 Remote Operations

| Operation | Description | MockGitAdapter Method |
|-----------|-------------|----------------------|
| Fetch | `git fetch` | `exec(["fetch", ...])` |
| Has remote | `git remote` | `exec(["remote"])` |
| Check remote exists | `git remote get-url` | `exec(["remote", "get-url", name])` |

**Test Scenarios:**
- [ ] Fetch updates from remote
- [ ] Skip fetch when no remotes
- [ ] Handle network error with retry
- [ ] Detect remote existence

---

## 6. Content Store (In-Memory Cache)

| Operation | Description | Dependencies |
|-----------|-------------|--------------|
| Initialize | Load all content | FileSystem ops |
| Subscribe | Listen for changes | Event emitter |
| Get tasks | Query with filters | In-memory filter |
| Upsert task | Update cache | Direct mutation |
| File watching | React to changes | Adapter events (optional) |

**Test Scenarios:**
- [ ] Initialize store loads all content
- [ ] Query tasks by status
- [ ] Query tasks by multiple filters
- [ ] Subscriber receives updates on save
- [ ] Upsert updates existing task
- [ ] Upsert adds new task
- [ ] Dispose cleans up resources

---

## 7. Search Service

| Operation | Description | Dependencies |
|-----------|-------------|--------------|
| Full-text search | Fuzzy match | ContentStore data |
| Type filter | Task/doc/decision | In-memory filter |
| Status filter | By task status | In-memory filter |
| Combined search | Query + filters | Both |

**Test Scenarios:**
- [ ] Search by title keyword
- [ ] Search with fuzzy matching (typos)
- [ ] Filter search by type
- [ ] Filter search by status
- [ ] Combined query + status filter
- [ ] Search returns relevance scores
- [ ] Empty query returns filtered results

---

## 8. Edge Cases & Error Handling

### 8.1 Filesystem Errors

**Test Scenarios:**
- [ ] Handle file not found gracefully
- [ ] Handle permission denied
- [ ] Handle directory not exists
- [ ] Handle disk full (write failure)
- [ ] Handle corrupt JSON config
- [ ] Handle invalid markdown structure

### 8.2 Git Errors

**Test Scenarios:**
- [ ] Handle not a git repository
- [ ] Handle git command failure
- [ ] Handle network timeout on fetch
- [ ] Handle merge conflict detection
- [ ] Retry transient failures with backoff

### 8.3 Concurrency

**Test Scenarios:**
- [ ] Concurrent task updates (last write wins)
- [ ] Concurrent ID generation (no duplicates)
- [ ] File watcher debouncing
- [ ] Store subscription during mutation

---

## 9. Adapter Interface Requirements

### 9.1 InMemoryFileSystemAdapter

```typescript
interface InMemoryFileSystemAdapter {
  // Core operations
  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>
  exists(path: string): Promise<boolean>
  createDir(path: string, options?: { recursive?: boolean }): Promise<void>
  deleteFile(path: string): Promise<void>
  rename(from: string, to: string): Promise<void>
  stat(path: string): Promise<{ isFile: boolean; isDirectory: boolean; mtime: Date }>

  // Path utilities
  dirname(path: string): string
  join(...paths: string[]): string
  homedir(): string

  // Test utilities
  seedFiles(files: Record<string, string>): void
  getFiles(): Record<string, string>
  clear(): void
}
```

### 9.2 InMemoryGlobAdapter

```typescript
interface InMemoryGlobAdapter {
  // Core operation
  scan(pattern: string, options?: { cwd?: string }): AsyncIterable<string>

  // Test utilities
  setFileSystem(fs: InMemoryFileSystemAdapter): void
}
```

### 9.3 MockGitAdapter

```typescript
interface MockGitAdapter {
  // Core operation
  exec(args: string[], options?: { cwd?: string }): Promise<{ stdout: string; stderr: string; exitCode: number }>
  isGitRepository(root: string): Promise<boolean>
  initRepository(root: string): Promise<void>

  // Test configuration
  mockResponse(command: string[], response: string | Error): void
  mockBranch(name: string): void
  mockRemote(name: string, url: string): void
  mockStatus(files: Array<{ path: string; status: string }>): void
  mockTree(ref: string, files: Record<string, string>): void

  // Assertions
  getCommandHistory(): Array<{ args: string[]; cwd?: string }>
  assertCommandCalled(args: string[]): void
  assertCommandCalledTimes(args: string[], times: number): void
  clearHistory(): void
}
```

---

## 10. Test Organization

### Unit Tests (use test adapters)

```
tests/
├── core/
│   ├── task-crud.test.ts
│   ├── task-movement.test.ts
│   ├── task-ordering.test.ts
│   ├── acceptance-criteria.test.ts
│   ├── documents.test.ts
│   ├── decisions.test.ts
│   └── config.test.ts
├── git/
│   ├── staging.test.ts
│   ├── committing.test.ts
│   ├── branches.test.ts
│   └── cross-branch.test.ts
├── store/
│   ├── content-store.test.ts
│   └── search-service.test.ts
└── adapters/
    ├── memory-fs.test.ts
    ├── memory-glob.test.ts
    └── mock-git.test.ts
```

### Integration Tests (use real filesystem/git)

```
tests/integration/
├── full-workflow.test.ts
├── git-operations.test.ts
└── file-watching.test.ts
```

---

## 11. Example Test Pattern

```typescript
import { describe, test, expect, beforeEach } from "bun:test";
import { Core } from "@backlog-md/core";
import { createTestAdapters } from "@backlog-md/core/test-adapters";

describe("Task CRUD", () => {
  let core: Core;
  let adapters: ReturnType<typeof createTestAdapters>;

  beforeEach(() => {
    adapters = createTestAdapters();

    // Seed initial state
    adapters.fs.seedFiles({
      "/project/backlog.json": JSON.stringify({ projectName: "Test" }),
      "/project/backlog/tasks/readme.md": "# Tasks",
    });

    // Configure git mock
    adapters.git.mockBranch("main");
    adapters.git.mockStatus([]);

    core = new Core("/project", { adapters });
  });

  test("creates task with auto-generated ID", async () => {
    const task = await core.createTaskFromData({
      title: "Test Task",
      status: "todo",
    });

    expect(task.id).toBe("1");
    expect(adapters.fs.getFiles()["/project/backlog/tasks/task-1 - Test-Task.md"]).toBeDefined();
  });

  test("updates task title triggers rename", async () => {
    // Create initial task
    await core.createTaskFromData({ id: "1", title: "Original", status: "todo" });

    // Update title
    await core.updateTask({ id: "1", title: "Updated", status: "todo" });

    // Verify rename
    expect(adapters.fs.getFiles()["/project/backlog/tasks/task-1 - Original.md"]).toBeUndefined();
    expect(adapters.fs.getFiles()["/project/backlog/tasks/task-1 - Updated.md"]).toBeDefined();
  });

  test("git staging on task creation", async () => {
    await core.createTaskFromData({ title: "Test", status: "todo" }, true);

    adapters.git.assertCommandCalled(["add", expect.stringContaining("task-1")]);
    adapters.git.assertCommandCalled(["commit", "-m", expect.stringContaining("TASK-1")]);
  });
});
```

---

## 12. Success Criteria

The test adapter implementation is complete when:

1. **All scenarios above pass** with test adapters
2. **No filesystem access** during unit tests
3. **No git subprocess calls** during unit tests
4. **Tests run in < 5 seconds** for full suite
5. **Tests are deterministic** (same result every run)
6. **Parallel execution** works without conflicts
7. **Error injection** works for all failure scenarios
8. **Command history** captures all git operations
