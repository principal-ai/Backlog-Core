# Task Lifecycle

This document describes the complete lifecycle of a task in Backlog.md, including all states, transitions, and the operations that trigger them.

## Overview

Tasks flow through a defined lifecycle from creation to completion or archival. The system supports:

- **Statuses** - User-configurable workflow states (e.g., todo, in-progress, done)
- **Locations** - Physical directories that represent lifecycle stages
- **Transitions** - Operations that move tasks between states/locations

## Task Locations

Tasks exist in one of four directory locations:

| Location | Directory | Purpose |
|----------|-----------|---------|
| **Drafts** | `backlog/drafts/` | Work-in-progress tasks not yet ready for the backlog |
| **Active** | `backlog/tasks/` | Tasks that are part of the active backlog |
| **Completed** | `backlog/completed/` | Successfully finished tasks |
| **Archived** | `backlog/archive/tasks/` | Inactive tasks preserved for reference |

Additionally, drafts can be archived:
| Location | Directory | Purpose |
|----------|-----------|---------|
| **Archived Drafts** | `backlog/archive/drafts/` | Abandoned or deferred draft ideas |

## Task Statuses

Statuses are configurable per-project in `backlog.json`. Default statuses:

```json
{
  "statuses": ["backlog", "todo", "in-progress", "done"]
}
```

Statuses are independent of locations - a task in `tasks/` can have any status. However, certain transitions may automatically update status.

## Lifecycle States

### 1. Draft State

**Location:** `backlog/drafts/`

A draft is an incomplete task idea. Drafts:
- Are not visible in the main task list by default
- Do not require a full task structure
- Can be promoted to active tasks when ready
- Can be archived if abandoned

**Entry points:**
- `createDraft()` - Create new draft directly

**Exit points:**
- `promoteDraft()` → Active (moves to `tasks/`)
- `archiveDraft()` → Archived Draft (moves to `archive/drafts/`)

---

### 2. Active State

**Location:** `backlog/tasks/`

Active tasks are the main backlog. They:
- Appear in task lists and boards
- Can have any configured status
- Support full task features (dependencies, AC, ordering)
- Can be completed or archived

**Entry points:**
- `createTask()` / `createTaskFromData()` - Create new active task
- `promoteDraft()` - Promote from draft

**Exit points:**
- `completeTask()` → Completed (moves to `completed/`)
- `archiveTask()` → Archived (moves to `archive/tasks/`)
- `demoteTask()` → Draft (moves to `drafts/`)

**Internal transitions:**
- Status changes via `updateTask()` (e.g., todo → in-progress → done)
- Status callbacks can trigger on specific transitions

---

### 3. Completed State

**Location:** `backlog/completed/`

Completed tasks represent finished work. They:
- Are preserved for reference and history
- Can be queried separately from active tasks
- May be auto-archived after a configurable period

**Entry points:**
- `completeTask()` - Complete an active task

**Exit points:**
- Manual move back to `tasks/` (via file operations)
- Future: `archiveCompleted()` for bulk archival

---

### 4. Archived State

**Location:** `backlog/archive/tasks/` or `backlog/archive/drafts/`

Archived items are preserved but inactive. They:
- Are excluded from normal task queries
- Maintain full history and content
- Can be restored if needed

**Entry points:**
- `archiveTask()` - Archive an active task
- `archiveDraft()` - Archive a draft

**Exit points:**
- Manual restoration (via file operations)
- Future: `restoreTask()` / `restoreDraft()`

---

## State Transitions

### Valid Transitions

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   ┌──────────┐                                              │
│   │  CREATE  │                                              │
│   └────┬─────┘                                              │
│        │                                                    │
│        ▼                                                    │
│   ┌──────────┐  promoteDraft()   ┌──────────┐              │
│   │  DRAFT   │ ─────────────────▶│  ACTIVE  │              │
│   └────┬─────┘                   └────┬─────┘              │
│        │                              │                     │
│        │ archiveDraft()               │ demoteTask()        │
│        │                              │                     │
│        │         ┌────────────────────┘                     │
│        │         │                                          │
│        │         │  completeTask()    ┌───────────┐         │
│        │         │ ──────────────────▶│ COMPLETED │         │
│        │         │                    └───────────┘         │
│        │         │                                          │
│        │         │  archiveTask()                           │
│        ▼         ▼                                          │
│   ┌──────────────────┐                                      │
│   │     ARCHIVED     │                                      │
│   │  (tasks/drafts)  │                                      │
│   └──────────────────┘                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Transition Methods

| Method | From | To | Description |
|--------|------|-----|-------------|
| `createTask()` | - | Active | Create new active task |
| `createDraft()` | - | Draft | Create new draft |
| `promoteDraft()` | Draft | Active | Move draft to active backlog |
| `demoteTask()` | Active | Draft | Move active task back to drafts |
| `completeTask()` | Active | Completed | Mark task as finished |
| `archiveTask()` | Active | Archived | Archive without completing |
| `archiveDraft()` | Draft | Archived | Archive draft idea |

### Status Transitions (within Active)

Status changes happen within the Active state and are controlled by:

1. **Direct update:** `updateTask({ status: "new-status" })`
2. **Workflow rules:** Configured in `backlog.json`
3. **Status callbacks:** `onStatusChange` hooks

Example status flow:
```
backlog → todo → in-progress → review → done
```

---

## Status Callbacks

Tasks can define status change callbacks in the config:

```json
{
  "onStatusChange": {
    "done": "echo 'Task completed: ${TASK_ID}'"
  }
}
```

These execute when a task transitions to the specified status.

---

## Cross-Branch Lifecycle

Tasks can exist on multiple git branches with different states:

1. **Local branch:** Task created/modified on feature branch
2. **Remote branch:** Task synced from remote
3. **Merge resolution:** Most recent modification wins

The `loadTasks()` method merges tasks from:
- Current working directory
- Other local branches
- Remote branches (if `remoteOperations` enabled)

---

## Bulk Operations

### Completing Multiple Tasks

```typescript
await core.updateTasksBulk(
  tasks.map(t => ({ ...t, status: "done" })),
  "Complete sprint tasks"
);
```

### Archiving Old Completed Tasks

```typescript
const oldTasks = await core.getDoneTasksByAge(30); // Older than 30 days
for (const task of oldTasks) {
  await core.archiveTask(task.id);
}
```

---

## File Naming Convention

Task files follow this pattern:
```
task-{id} - {sanitized-title}.md
```

Examples:
- `task-1 - Setup-project-structure.md`
- `task-42.1 - Implement-sub-feature.md`

When a task is moved between locations, the file is renamed/moved but the ID remains constant.

---

## Lifecycle Events (Future)

Planned event hooks for lifecycle transitions:

| Event | Trigger |
|-------|---------|
| `task:created` | New task created |
| `task:updated` | Task content modified |
| `task:status-changed` | Status field changed |
| `task:promoted` | Draft → Active |
| `task:demoted` | Active → Draft |
| `task:completed` | Active → Completed |
| `task:archived` | Any → Archived |
| `task:restored` | Archived → Active/Draft |

---

## Testing Lifecycle

All lifecycle transitions should be testable with the in-memory adapters:

```typescript
// Test promotion flow
adapters.fs.seedFiles({
  "/project/backlog/drafts/task-1 - Draft-idea.md": "# Draft\n...",
});

await core.promoteDraft("1");

expect(adapters.fs.getFiles()["/project/backlog/tasks/task-1 - Draft-idea.md"]).toBeDefined();
expect(adapters.fs.getFiles()["/project/backlog/drafts/task-1 - Draft-idea.md"]).toBeUndefined();
```
