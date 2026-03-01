---
id: TASK-1.3
title: Port Draft support (BACK-373) to Backlog-Core
status: To Do
assignee: []
created_date: '2026-01-23 18:13'
labels:
  - drafts
  - types
milestone: Upstream Sync v1.35.3
dependencies: []
parent_task_id: TASK-1
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add Draft entity type support to Backlog-Core:

1. Update EntityType enum in src/types/index.ts
2. Add draft-specific logic to core modules
3. Update ID generation for draft entities
4. Ensure draft/task relationships work correctly
5. Add tests for draft functionality

This is a new entity type alongside tasks, documents, and decisions.
<!-- SECTION:DESCRIPTION:END -->
