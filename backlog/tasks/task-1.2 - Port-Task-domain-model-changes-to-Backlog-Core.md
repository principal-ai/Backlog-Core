---
id: TASK-1.2
title: Port Task domain model changes to Backlog-Core
status: To Do
assignee: []
created_date: '2026-01-23 18:13'
labels:
  - domain-model
  - types
milestone: Upstream Sync v1.35.3
dependencies: []
parent_task_id: TASK-1
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Port the following new Task fields and related logic to Backlog-Core:

1. **finalSummary** (BACK-367) - Task completion notes field
2. **references** (BACK-356) - References field
3. **documentation** (BACK-353) - Documentation field
4. **subtaskSummaries** (BACK-352) - Subtask list in plain output
5. **definitionOfDoneItems** (BACK-354) - Project DoD defaults

Update:
- src/types/index.ts - Task interface
- src/markdown/parser.ts - Parse new fields
- src/markdown/serializer.ts - Serialize new fields
- src/markdown/section-titles.ts - Section handling
- src/utils/task-builders.ts - Task construction
<!-- SECTION:DESCRIPTION:END -->
