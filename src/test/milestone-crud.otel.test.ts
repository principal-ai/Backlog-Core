/**
 * Integration tests for Milestone CRUD telemetry
 *
 * These tests exercise the milestone CRUD operations and send telemetry
 * to the local OTEL collector for visualization.
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { context, trace, ROOT_CONTEXT, SpanStatusCode } from "@opentelemetry/api";
import { InMemoryFileSystemAdapter } from "@principal-ai/repository-abstraction";
import { Core } from "../core/Core";
import { getTracer } from "../telemetry";
import { setupOTEL, shutdownOTEL } from "./otel-setup";

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
	await fs.createDir("/project/backlog/milestones", { recursive: true });

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
 */
async function withTestTrace<T>(testName: string, fn: () => Promise<T>): Promise<T> {
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
	}
}

describe("Milestone CRUD telemetry", () => {
	beforeAll(async () => {
		await setupOTEL({
			serviceName: "@backlog-md/core-test",
		});
	});

	afterAll(async () => {
		await shutdownOTEL();
	});

	test("createMilestone() emits telemetry", async () => {
		await withTestTrace("test.milestone.create", async () => {
			const core = await createTestCore();

			const milestone = await core.createMilestone({
				title: "Test milestone for telemetry",
				description: "A test milestone",
			});

			expect(milestone.id).toBe("m-0");
			expect(milestone.title).toBe("Test milestone for telemetry");
		});
		console.log("[TEST] createMilestone telemetry sent to collector");
	});

	test("createMilestone() without description emits telemetry", async () => {
		await withTestTrace("test.milestone.create.no-description", async () => {
			const core = await createTestCore();

			const milestone = await core.createMilestone({
				title: "Milestone without description",
			});

			expect(milestone.id).toBe("m-0");
			expect(milestone.description).toBe("Milestone: Milestone without description");
		});
		console.log("[TEST] createMilestone (no description) telemetry sent to collector");
	});

	test("updateMilestone() emits telemetry", async () => {
		await withTestTrace("test.milestone.update", async () => {
			const core = await createTestCore();

			// Create a milestone first
			const milestone = await core.createMilestone({
				title: "Milestone to update",
			});

			// Update the milestone
			const updated = await core.updateMilestone(milestone.id, {
				title: "Updated milestone title",
				description: "Updated description",
			});

			expect(updated).not.toBeNull();
			expect(updated?.title).toBe("Updated milestone title");
			expect(updated?.description).toBe("Updated description");
		});
		console.log("[TEST] updateMilestone telemetry sent to collector");
	});

	test("updateMilestone() with non-existent ID emits telemetry", async () => {
		await withTestTrace("test.milestone.update.not-found", async () => {
			const core = await createTestCore();

			// Try to update a non-existent milestone
			const updated = await core.updateMilestone("m-999", {
				title: "Should not update",
			});

			expect(updated).toBeNull();
		});
		console.log("[TEST] updateMilestone (not found) telemetry sent to collector");
	});

	test("deleteMilestone() emits telemetry", async () => {
		await withTestTrace("test.milestone.delete", async () => {
			const core = await createTestCore();

			// Create a milestone first
			const milestone = await core.createMilestone({
				title: "Milestone to delete",
			});

			// Delete the milestone
			const deleted = await core.deleteMilestone(milestone.id);

			expect(deleted).toBe(true);
		});
		console.log("[TEST] deleteMilestone telemetry sent to collector");
	});

	test("deleteMilestone() with non-existent ID emits telemetry", async () => {
		await withTestTrace("test.milestone.delete.not-found", async () => {
			const core = await createTestCore();

			// Try to delete a non-existent milestone
			const deleted = await core.deleteMilestone("m-999");

			expect(deleted).toBe(false);
		});
		console.log("[TEST] deleteMilestone (not found) telemetry sent to collector");
	});
});
