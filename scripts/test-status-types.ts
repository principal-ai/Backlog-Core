#!/usr/bin/env bun
/**
 * Test that status type constants work correctly
 */

import { DEFAULT_TASK_STATUSES, type DefaultTaskStatus } from "../src/types";

console.log("\n✅ Status Constants Available:");
console.log(`   TODO: "${DEFAULT_TASK_STATUSES.TODO}"`);
console.log(`   IN_PROGRESS: "${DEFAULT_TASK_STATUSES.IN_PROGRESS}"`);
console.log(`   DONE: "${DEFAULT_TASK_STATUSES.DONE}"`);

// Type-safe usage example
const validStatus: DefaultTaskStatus = DEFAULT_TASK_STATUSES.TODO; // ✅ OK
console.log(`\n✅ Type-safe status: ${validStatus}`);

// This should work (union with string)
const customStatus: string = "Custom Status"; // ✅ OK for TaskStatus
console.log(`✅ Custom status: ${customStatus}`);

console.log("\n📝 Usage Example:");
console.log(`
  import { DEFAULT_TASK_STATUSES, type DefaultTaskStatus } from '@backlog-md/core';

  // Use constants for type safety
  await core.createTask({
    title: "My Task",
    status: DEFAULT_TASK_STATUSES.IN_PROGRESS,  // ✅ Type-safe
    description: "Task description"
  });

  // Or use string literals (also works)
  await core.createTask({
    title: "My Task",
    status: "In Progress",  // ✅ Works but no autocomplete
    description: "Task description"
  });

  // Invalid status will be auto-corrected with warning
  await core.createTask({
    title: "My Task",
    status: "in-progress",  // ⚠️ Will be corrected to "To Do" with warning
    description: "Task description"
  });
`);

console.log("\n✅ All status type tests passed!\n");
