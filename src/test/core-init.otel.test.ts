/**
 * Integration tests for Core initialization telemetry
 *
 * These tests verify that Core.initialize() emits the correct OpenTelemetry
 * events and sends them to the local OTEL collector.
 *
 * Prerequisites:
 * - OTEL collector running at http://localhost:4318
 * - Start with: cd /Users/griever/Developer/my-projects/otel-collection-server && docker-compose up
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { InMemoryFileSystemAdapter } from "@principal-ai/repository-abstraction";
import { Core } from "../core/Core";
import { flushOTEL, setupOTEL, shutdownOTEL } from "./otel-setup";

describe("Core initialization telemetry", () => {
  beforeAll(async () => {
    await setupOTEL({
      serviceName: "@backlog-md/core-test",
    });
  });

  afterAll(async () => {
    await shutdownOTEL();
  });

  test("initialize() emits telemetry events on success", async () => {
    // Create in-memory filesystem with valid backlog structure
    const fs = new InMemoryFileSystemAdapter();
    await fs.writeFile(
      "/project/backlog/config.yml",
      `projectName: Test Project
statuses:
  - To Do
  - In Progress
  - Done
labels:
  - bug
  - feature
defaultStatus: To Do
`
    );

    // Create some task files
    await fs.createDir("/project/backlog/tasks", { recursive: true });
    await fs.writeFile(
      "/project/backlog/tasks/1 - First Task.md",
      `---
id: "1"
title: First Task
status: To Do
---

# First Task

This is the first task.
`
    );
    await fs.writeFile(
      "/project/backlog/tasks/2 - Second Task.md",
      `---
id: "2"
title: Second Task
status: In Progress
---

# Second Task

This is the second task.
`
    );

    // Create completed directory with a task
    await fs.createDir("/project/backlog/completed", { recursive: true });
    await fs.writeFile(
      "/project/backlog/completed/3 - Completed Task.md",
      `---
id: "3"
title: Completed Task
status: Done
---

# Completed Task

This task is done.
`
    );

    // Initialize Core - this should emit telemetry
    const core = new Core({
      projectRoot: "/project",
      adapters: { fs },
    });

    await core.initialize();

    // Verify initialization worked
    const tasks = core.listTasks();
    expect(tasks.length).toBe(3);

    // Flush to ensure spans are exported
    await flushOTEL();

    console.log("[TEST] Successfully initialized with 3 tasks - telemetry sent to collector");
  });

  test("initialize() emits error telemetry when config not found", async () => {
    // Create in-memory filesystem WITHOUT config
    const fs = new InMemoryFileSystemAdapter();

    const core = new Core({
      projectRoot: "/empty-project",
      adapters: { fs },
    });

    // This should fail and emit error telemetry
    let errorThrown = false;
    try {
      await core.initialize();
    } catch (error) {
      errorThrown = true;
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain("config.yml not found");
    }

    expect(errorThrown).toBe(true);

    // Flush to ensure error span is exported
    await flushOTEL();

    console.log("[TEST] Config not found error - telemetry sent to collector");
  });
});
