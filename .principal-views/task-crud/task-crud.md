# Task CRUD Operations

OpenTelemetry instrumentation for task lifecycle operations in Backlog-Core.

## Overview

This storyboard covers all task CRUD (Create, Read, Update, Delete) operations plus archive/restore functionality. Each operation is instrumented as a span with events marking key lifecycle points.

## Operations

### Create Task (`task.create`)

Creates a new task in the backlog.

**Span attributes:**
- `input.title` - Task title
- `input.status` - Initial status (optional)
- `input.milestoneId` - Associated milestone (optional)

**Events:**
- `task.create.started` - Creation begins
- `task.create.complete` - Task created successfully
- `task.create.error` - Creation failed

### Update Task (`task.update`)

Updates an existing task's properties.

**Span attributes:**
- `input.taskId` - Task being updated
- `input.hasTitle` - Whether title is being changed
- `input.hasStatus` - Whether status is being changed
- `input.hasMilestone` - Whether milestone assignment is changing

**Events:**
- `task.update.started` - Update begins
- `task.update.complete` - Task updated successfully
- `task.update.error` - Update failed

### Delete Task (`task.delete`)

Permanently deletes a task from the backlog.

**Span attributes:**
- `input.taskId` - Task being deleted

**Events:**
- `task.delete.started` - Deletion begins
- `task.delete.complete` - Task deleted successfully
- `task.delete.error` - Deletion failed

### Archive Task (`task.archive`)

Moves a task from active (`backlog/tasks/`) to completed (`backlog/completed/`).

**Span attributes:**
- `input.taskId` - Task being archived

**Events:**
- `task.archive.started` - Archive begins
- `task.archive.complete` - Task archived successfully
- `task.archive.error` - Archive failed

### Restore Task (`task.restore`)

Moves a task from completed back to active.

**Span attributes:**
- `input.taskId` - Task being restored

**Events:**
- `task.restore.started` - Restore begins
- `task.restore.complete` - Task restored successfully
- `task.restore.error` - Restore failed

## Workflows

- **task-create/** - Task creation scenarios
- **task-update/** - Task update scenarios
- **task-delete/** - Task deletion scenarios
- **task-archive/** - Task archive/restore scenarios

## Source Files

- `src/core/Core.ts` - Main implementation
