# Feature Parity: Backlog-Core vs Backlog.md

This document tracks which features from [Backlog.md](../../../Backlog.md) are currently implemented in Backlog-Core.

**Last Updated:** 2025-12-27

## Summary

| Category              | Implemented | Total  | Coverage |
| --------------------- | ----------- | ------ | -------- |
| Core Infrastructure   | 6           | 6      | 100%     |
| Task Reading          | 8           | 8      | 100%     |
| Task Writing          | 3           | 6      | 50%      |
| Milestones            | 12          | 12     | 100%     |
| Git Operations        | 0           | 8      | 0%       |
| Search & Query        | 1           | 4      | 25%      |
| Documents & Decisions | 0           | 4      | 0%       |
| Advanced Features     | 0           | 6      | 0%       |
| **Total**             | **30**      | **54** | **56%**  |

---

## Implemented Features

### Core Infrastructure (6/6)

| Feature                             | Status | Notes                                                 |
| ----------------------------------- | ------ | ----------------------------------------------------- |
| Adapter pattern (FileSystemAdapter) | Done   | Uses `@principal-ai/repository-abstraction`           |
| Adapter pattern (GlobAdapter)       | Done   | Interface defined                                     |
| Adapter pattern (GitAdapter)        | Done   | Interface defined in `src/abstractions/GitAdapter.ts` |
| Config parsing (YAML)               | Done   | `parseBacklogConfig()`, `serializeBacklogConfig()`    |
| Project detection                   | Done   | `isBacklogProject()`                                  |
| Project initialization              | Done   | `initProject()` with custom options                   |

### Task Reading (8/8)

| Feature                      | Status | Notes                                                                        |
| ---------------------------- | ------ | ---------------------------------------------------------------------------- |
| Load tasks from `tasks/`     | Done   | `initialize()`                                                               |
| Load tasks from `completed/` | Done   | `initialize()`                                                               |
| Lazy loading (no file reads) | Done   | `initializeLazy()` from file paths                                           |
| On-demand task loading       | Done   | `loadTask()`, `loadTasks()`                                                  |
| Get single task              | Done   | `getTask()`                                                                  |
| List tasks with filters      | Done   | `listTasks()` - status, assignee, priority, labels, parent                   |
| Group by status (kanban)     | Done   | `getTasksByStatus()`                                                         |
| Pagination support           | Done   | `listTasksPaginated()`, `getTasksByStatusPaginated()`, `loadMoreForStatus()` |

### Markdown Parsing (Complete)

| Feature                    | Status | Notes                                                |
| -------------------------- | ------ | ---------------------------------------------------- |
| Parse frontmatter          | Done   | All fields: status, priority, assignee, labels, etc. |
| Parse title (H1)           | Done   | From first `# ` heading                              |
| Parse description          | Done   | Body text extraction                                 |
| Parse acceptance criteria  | Done   | Checkbox items with checked state                    |
| Serialize task to markdown | Done   | `serializeTaskMarkdown()`                            |
| Extract index from path    | Done   | `extractTaskIndexFromPath()` for lazy loading        |
| Get body markdown          | Done   | `getTaskBodyMarkdown()` for viewers                  |

### Sorting & Utilities (Complete)

| Feature                       | Status | Notes                                                   |
| ----------------------------- | ------ | ------------------------------------------------------- |
| Sort by ordinal/priority/date | Done   | `sortTasks()`                                           |
| Sort by specific field        | Done   | `sortTasksBy()` - title, createdDate, priority, ordinal |
| Group by status               | Done   | `groupTasksByStatus()`                                  |

---

## Milestones (12/12) - Complete!

Milestones group tasks into release cycles, sprints, or project phases.

### Milestone Concept

**Two storage mechanisms in Backlog.md:**

1. **Config-based (Legacy):** `config.yml` has `milestones: [...]` array
2. **File-based (Current):** Milestone files in `backlog/milestones/m-*.md`

**Task association:** Tasks have optional `milestone?: string` field in frontmatter.

### Implementation Status

| Feature                            | Status | Notes                                                         |
| ---------------------------------- | ------ | ------------------------------------------------------------- |
| `milestone` field in Task type     | Done   | `src/types/index.ts`                                          |
| `milestones` in BacklogConfig      | Done   | Config array support                                          |
| Parse milestone from frontmatter   | Done   | `src/markdown/index.ts`                                       |
| Serialize milestone to frontmatter | Done   | `serializeTaskMarkdown()`                                     |
| `Milestone` type definition        | Done   | `src/types/index.ts`                                          |
| `MilestoneBucket` type             | Done   | Grouping with progress tracking                               |
| `MilestoneSummary` type            | Done   | Collection of buckets                                         |
| Filter tasks by milestone          | Done   | Added to `TaskListFilter`                                     |
| `getTasksByMilestone()`            | Done   | `Core.getTasksByMilestone()`                                  |
| `buildMilestoneBuckets()` utility  | Done   | `src/utils/milestones.ts`                                     |
| Milestone file loading             | Done   | `listMilestones()`, `loadMilestone()`                         |
| Milestone CRUD                     | Done   | `createMilestone()`, `updateMilestone()`, `deleteMilestone()` |

### Key Types from Backlog.md

```typescript
interface Milestone {
  id: string; // e.g., "m-0"
  title: string; // e.g., "Release 1.0"
  description: string;
  rawContent: string;
}

interface MilestoneBucket {
  key: string; // Normalized key
  label: string; // Display name
  milestone?: string; // Milestone ID
  isNoMilestone: boolean; // "Uncategorized" bucket
  tasks: Task[];
  statusCounts: Record<string, number>;
  total: number;
  doneCount: number;
  progress: number; // 0-100 percentage
}

interface MilestoneSummary {
  milestones: string[];
  buckets: MilestoneBucket[];
}
```

---

## Not Yet Implemented

### Task Writing (3/6)

| Feature          | Status      | Priority | Notes                                      |
| ---------------- | ----------- | -------- | ------------------------------------------ |
| Create task      | Done        | -        | `createTask()` with milestone sync         |
| Update task      | Done        | -        | `updateTask()` with bidirectional sync     |
| Delete task      | Done        | -        | `deleteTask()` with milestone sync         |
| Archive task     | Not Started | Medium   | Move to `completed/`                       |
| Restore task     | Not Started | Medium   | Move from `completed/`                     |
| Rename task file | Not Started | Low      | Title change = file rename                 |

### Git Operations (0/8)

| Feature                    | Status      | Priority | Notes                                  |
| -------------------------- | ----------- | -------- | -------------------------------------- |
| Check if git repo          | Not Started | High     | `isGitRepository()` - interface exists |
| Initialize git repo        | Not Started | Medium   | `initRepository()` - interface exists  |
| Auto-commit on task change | Not Started | Medium   | Requires `GitOperationsInterface` impl |
| Stage files                | Not Started | Medium   | `addFile()`, `stageBacklogDirectory()` |
| Get current branch         | Not Started | Low      | `getCurrentBranch()`                   |
| List branches              | Not Started | Low      | For cross-branch tasks                 |
| Fetch remote               | Not Started | Low      | `fetch()`                              |
| Show file from branch      | Not Started | Low      | `showFile()` for remote tasks          |

### Search & Query (1/4)

| Feature                     | Status      | Priority | Notes                         |
| --------------------------- | ----------- | -------- | ----------------------------- |
| Filter by multiple criteria | Done        | -        | Implemented in `listTasks()`  |
| Full-text search            | Not Started | **High** | SearchService with Fuse.js    |
| Search across task content  | Not Started | High     | Title, description, AC, notes |
| Search documents/decisions  | Not Started | Low      | Multi-type search             |

### Documents & Decisions (0/4)

| Feature                    | Status      | Priority | Notes                         |
| -------------------------- | ----------- | -------- | ----------------------------- |
| Load documents             | Not Started | Medium   | From `backlog/docs/`          |
| Load decisions             | Not Started | Medium   | From `backlog/decisions/`     |
| Parse decision frontmatter | Not Started | Low      | Status, context, consequences |
| Create/update documents    | Not Started | Low      | Write support                 |

### Advanced Features (0/6)

| Feature                   | Status      | Priority | Notes                   |
| ------------------------- | ----------- | -------- | ----------------------- |
| Subtask management        | Not Started | Medium   | Create, link, unlink    |
| Dependency management     | Not Started | Medium   | Add/remove dependencies |
| Sequence calculation      | Not Started | Low      | Task execution order    |
| Ordinal reordering        | Not Started | Low      | Drag-drop support       |
| Cross-branch task loading | Not Started | Low      | Remote task visibility  |
| File watchers             | Not Started | Low      | Live updates            |

---

## Type Definitions Status

All core types are defined and exported:

| Type                  | Status |
| --------------------- | ------ |
| `Task`                | Done   |
| `TaskCreateInput`     | Done   |
| `TaskUpdateInput`     | Done   |
| `TaskListFilter`      | Done   |
| `AcceptanceCriterion` | Done   |
| `PaginationOptions`   | Done   |
| `PaginatedResult<T>`  | Done   |
| `BacklogConfig`       | Done   |
| `Document`            | Done   |
| `Decision`            | Done   |
| `SearchResult`        | Done   |
| `Sequence`            | Done   |
| `Milestone`           | Done   |
| `MilestoneBucket`     | Done   |
| `MilestoneSummary`    | Done   |

---

## Recommended Next Steps

Based on current implementation and common use cases:

### Phase 1: Write Operations (Core CRUD) ✅ Complete

1. ~~`createTask()` - Create new tasks~~ Done
2. ~~`updateTask()` - Modify existing tasks~~ Done
3. ~~`deleteTask()` - Delete tasks~~ Done

### Phase 2: Search

4. `SearchService` - Full-text search with Fuse.js
5. Integrate search with existing filters

### Phase 3: Lifecycle Operations

6. `archiveTask()` - Move to completed
7. `restoreTask()` - Move from completed

### Phase 4: Git Integration

8. Implement `GitOperations` class using `GitAdapter`
9. Auto-commit support

---

## Feature Mapping from Backlog.md Tasks

Key completed tasks in Backlog.md that should map to Core:

| Backlog.md Task                     | Core Equivalent                          | Status          |
| ----------------------------------- | ---------------------------------------- | --------------- |
| task-2 (Core Logic Library)         | This package                             | In Progress     |
| task-3 (Init Command)               | `initProject()`                          | Done            |
| task-4 (Task Management)            | `createTask()`, `updateTask()`, `deleteTask()` | Done      |
| task-52 (Filter by status/assignee) | `listTasks()`                            | Done            |
| task-82 (Plain view for agents)     | `getTaskBodyMarkdown()`                  | Done            |
| task-95 (Priority field)            | Priority in types/parsing                | Done            |
| task-89 (Dependency parameter)      | Types defined                            | Not Implemented |
| task-112 (Tab switching)            | Pagination for lazy loading              | Done            |
