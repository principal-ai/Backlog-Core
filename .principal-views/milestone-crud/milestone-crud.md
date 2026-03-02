# Milestone CRUD Operations

OpenTelemetry instrumentation for milestone lifecycle operations in Backlog-Core.

## Overview

This storyboard covers all milestone CRUD (Create, Read, Update, Delete) operations. Milestones are groupings of related tasks that represent larger project goals or releases. Each operation is instrumented as a span with events marking key lifecycle points.

## Operations

### Create Milestone (`milestone.create`)

Creates a new milestone in the backlog.

**Span attributes:**
- `input.title` - Milestone title
- `input.hasDescription` - Whether description is provided

**Events:**
- `milestone.create.started` - Creation begins
- `milestone.create.complete` - Milestone created successfully
- `milestone.create.error` - Creation failed

### Update Milestone (`milestone.update`)

Updates an existing milestone's properties.

**Span attributes:**
- `input.milestoneId` - Milestone being updated
- `input.hasTitle` - Whether title is being changed
- `input.hasDescription` - Whether description is being changed

**Events:**
- `milestone.update.started` - Update begins
- `milestone.update.complete` - Milestone updated successfully
- `milestone.update.error` - Update failed

### Delete Milestone (`milestone.delete`)

Permanently deletes a milestone from the backlog.

**Span attributes:**
- `input.milestoneId` - Milestone being deleted

**Events:**
- `milestone.delete.started` - Deletion begins
- `milestone.delete.complete` - Milestone deleted successfully
- `milestone.delete.error` - Deletion failed

## Workflows

- **milestone-create/** - Milestone creation scenarios
- **milestone-update/** - Milestone update scenarios
- **milestone-delete/** - Milestone deletion scenarios

## Source Files

- `src/core/Core.ts` - Main implementation
