# Task Lifecycle

Tasks move through distinct locations and statuses as they progress from idea to completion.

## What the Task Lifecycle Solves

- **Work organization**: Separate ideas from active work from completed items
- **Status tracking**: Know what state each task is in
- **History preservation**: Keep completed work for reference

## Task Locations

### Draft (`backlog/drafts/`)
Work-in-progress ideas not yet ready for the backlog:
- Created via `createDraft()`
- Can be promoted to active with `promoteDraft()`
- Can be archived with `archiveDraft()`

### Active (`backlog/tasks/`)
The main backlog containing actionable tasks:
- Created via `createTask()`
- Supports all status values (todo, in-progress, review, etc.)
- Full feature support (milestones, assignees, priorities)
- Can be completed with `completeTask()`
- Can be demoted to draft with `demoteTask()`
- Can be archived with `archiveTask()`

### Completed (`backlog/completed/`)
Successfully finished tasks preserved for history:
- Moved here via `completeTask()`
- Read-only for reference
- Excluded from active queries by default

### Archived (`backlog/archive/`)
Inactive items preserved for reference:
- Contains `archive/tasks/` and `archive/drafts/`
- Excluded from all standard queries
- Useful for cancelled or deferred work

## Status Changes

Within the Active location, tasks can have various statuses:
- **backlog**: Not yet started, waiting in queue
- **todo**: Ready to be worked on
- **in-progress**: Currently being worked on
- **review**: Waiting for review
- **done**: Completed (typically triggers move to Completed location)

Status values are configurable per project in `backlog/config.yml`.

## Common Workflows

1. **Idea capture**: Create draft, refine, promote to active when ready
2. **Standard flow**: Create task, work through statuses, complete
3. **Cleanup**: Archive stale or cancelled tasks
