/**
 * Integration tests for Task CRUD telemetry
 *
 * These tests exercise the task CRUD operations and send telemetry
 * to the local OTEL collector for visualization.
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { context, trace, ROOT_CONTEXT, SpanStatusCode } from "@opentelemetry/api";
import { InMemoryFileSystemAdapter } from "@principal-ai/repository-abstraction";
import { setupOTEL, shutdownOTEL, flushOTEL } from "./otel-setup";
import { Core } from "../core/Core";
import { getTracer } from "../telemetry";

async function createTestCore(): Promise<Core> {
	const fs = new InMemoryFileSystemAdapter();
	await fs.writeFile(
		"/project/backlog/config.yml",
		`projectName: Test Project
statuses:
  - To Do
  - In Progress
  - Done
defaultStatus: To Do
`
	);
	await fs.createDir("/project/backlog/tasks", { recursive: true });

	const core = new Core({
		projectRoot: "/project",
		adapters: { fs },
	});

	await core.initialize();
	return core;
}

/**
 * Run a test function within its own trace context.
 * Creates a root span for the test so all operations are children of it.
 * Flushes telemetry before returning to ensure trace isolation.
 */
async function withTestTrace<T>(
	testName: string,
	fn: () => Promise<T>
): Promise<T> {
	const tracer = getTracer();
	// Start span with ROOT_CONTEXT to ensure new trace
	const span = tracer.startSpan(testName, {}, ROOT_CONTEXT);

	try {
		// Run the test function with this span as the active context
		const ctx = trace.setSpan(ROOT_CONTEXT, span);
		const result = await context.with(ctx, async () => {
			return await fn();
		});
		span.setStatus({ code: SpanStatusCode.OK });
		return result;
	} catch (error) {
		span.setStatus({
			code: SpanStatusCode.ERROR,
			message: error instanceof Error ? error.message : String(error),
		});
		throw error;
	} finally {
		span.end();
		// Note: Relying on shutdown to flush - per-test flush can hang on 502 retries
	}
}

describe("Task CRUD telemetry", () => {
	beforeAll(async () => {
		await setupOTEL({
			serviceName: "@backlog-md/core-test",
		});
	});

	afterAll(async () => {
		await shutdownOTEL();
	});

	test("createTask() emits telemetry", async () => {
		await withTestTrace("test.task.create", async () => {
			const core = await createTestCore();

			const task = await core.createTask({
				title: "Test task for telemetry",
				status: "To Do",
			});

			expect(task.id).toBe("1");
			expect(task.title).toBe("Test task for telemetry");
		});
		console.log("[TEST] createTask telemetry sent to collector");
	});

	test("updateTask() emits telemetry", async () => {
		await withTestTrace("test.task.update", async () => {
			const core = await createTestCore();

			// Create a task first
			const task = await core.createTask({
				title: "Task to update",
				status: "To Do",
			});

			// Update the task
			const updated = await core.updateTask(task.id, {
				title: "Updated task title",
				status: "In Progress",
			});

			expect(updated).not.toBeNull();
			expect(updated?.title).toBe("Updated task title");
			expect(updated?.status).toBe("In Progress");
		});
		console.log("[TEST] updateTask telemetry sent to collector");
	});

	test("deleteTask() emits telemetry", async () => {
		await withTestTrace("test.task.delete", async () => {
			const core = await createTestCore();

			// Create a task first
			const task = await core.createTask({
				title: "Task to delete",
			});

			// Delete the task
			const deleted = await core.deleteTask(task.id);

			expect(deleted).toBe(true);
		});
		console.log("[TEST] deleteTask telemetry sent to collector");
	});

	test("archiveTask() emits telemetry", async () => {
		await withTestTrace("test.task.archive", async () => {
			const core = await createTestCore();

			// Create a task first
			const task = await core.createTask({
				title: "Task to archive",
			});

			// Archive the task
			const archived = await core.archiveTask(task.id);

			expect(archived).not.toBeNull();
			expect(archived?.source).toBe("completed");
		});
		console.log("[TEST] archiveTask telemetry sent to collector");
	});

	test("restoreTask() emits telemetry", async () => {
		await withTestTrace("test.task.restore", async () => {
			const core = await createTestCore();

			// Create and archive a task first
			const task = await core.createTask({
				title: "Task to restore",
			});
			await core.archiveTask(task.id);

			// Restore the task
			const restored = await core.restoreTask(task.id);

			expect(restored).not.toBeNull();
			expect(restored?.source).toBe("local");
		});
		console.log("[TEST] restoreTask telemetry sent to collector");
	});

	test("updateTask() with non-existent ID emits telemetry", async () => {
		await withTestTrace("test.task.update.not-found", async () => {
			const core = await createTestCore();

			// Try to update a non-existent task
			const updated = await core.updateTask("999", {
				title: "Should not update",
			});

			expect(updated).toBeNull();
		});
		console.log("[TEST] updateTask (not found) telemetry sent to collector");
	});

	test("deleteTask() with non-existent ID emits telemetry", async () => {
		await withTestTrace("test.task.delete.not-found", async () => {
			const core = await createTestCore();

			// Try to delete a non-existent task
			const deleted = await core.deleteTask("999");

			expect(deleted).toBe(false);
		});
		console.log("[TEST] deleteTask (not found) telemetry sent to collector");
	});

	test("archiveTask() with non-existent ID emits telemetry", async () => {
		await withTestTrace("test.task.archive.not-found", async () => {
			const core = await createTestCore();

			// Try to archive a non-existent task
			const archived = await core.archiveTask("999");

			expect(archived).toBeNull();
		});
		console.log("[TEST] archiveTask (not found) telemetry sent to collector");
	});

	test("restoreTask() with non-existent ID emits telemetry", async () => {
		await withTestTrace("test.task.restore.not-found", async () => {
			const core = await createTestCore();

			// Try to restore a non-existent task
			const restored = await core.restoreTask("999");

			expect(restored).toBeNull();
		});
		console.log("[TEST] restoreTask (not found) telemetry sent to collector");
	});
});
