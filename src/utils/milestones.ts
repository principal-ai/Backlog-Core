/**
 * Milestone utilities for @backlog-md/core
 *
 * Functions for grouping tasks by milestone and calculating progress.
 */

import type { Milestone, MilestoneBucket, MilestoneSummary, Task } from "../types";

/** Key used for tasks without a milestone */
const NO_MILESTONE_KEY = "__none";

/**
 * Normalize a milestone name by trimming whitespace
 */
export function normalizeMilestoneName(name: string): string {
  return name.trim();
}

/**
 * Get a lowercase key for milestone comparison
 */
export function milestoneKey(name?: string | null): string {
  return normalizeMilestoneName(name ?? "").toLowerCase();
}

/**
 * Check if a status represents a "done" state
 */
export function isDoneStatus(status?: string | null): boolean {
  const normalized = (status ?? "").toLowerCase();
  return normalized.includes("done") || normalized.includes("complete");
}

/**
 * Get the display label for a milestone
 * Uses the milestone entity title if available, otherwise returns the ID
 */
export function getMilestoneLabel(
  milestoneId: string | undefined,
  milestoneEntities: Milestone[]
): string {
  if (!milestoneId) {
    return "Tasks without milestone";
  }
  const entity = milestoneEntities.find((m) => milestoneKey(m.id) === milestoneKey(milestoneId));
  return entity?.title || milestoneId;
}

/**
 * Collect all unique milestone IDs from tasks and milestone entities
 */
export function collectMilestoneIds(tasks: Task[], milestoneEntities: Milestone[]): string[] {
  const merged: string[] = [];
  const seen = new Set<string>();

  const addMilestone = (value: string) => {
    const normalized = normalizeMilestoneName(value);
    if (!normalized) return;
    const key = milestoneKey(normalized);
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(normalized);
  };

  // Add milestone entities first (they have priority for ordering)
  for (const entity of milestoneEntities) {
    addMilestone(entity.id);
  }

  // Then add any milestones from tasks that aren't in entities
  for (const task of tasks) {
    addMilestone(task.milestone ?? "");
  }

  return merged;
}

/**
 * Collect milestones from tasks and config (legacy support)
 */
export function collectMilestones(tasks: Task[], configMilestones: string[]): string[] {
  const merged: string[] = [];
  const seen = new Set<string>();

  const addMilestone = (value: string) => {
    const normalized = normalizeMilestoneName(value);
    if (!normalized) return;
    const key = milestoneKey(normalized);
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(normalized);
  };

  for (const m of configMilestones) {
    addMilestone(m);
  }
  for (const task of tasks) {
    addMilestone(task.milestone ?? "");
  }

  return merged;
}

/**
 * Create a milestone bucket for a given milestone
 */
function createBucket(
  milestoneId: string | undefined,
  tasks: Task[],
  statuses: string[],
  milestoneEntities: Milestone[],
  isNoMilestone: boolean
): MilestoneBucket {
  const bucketMilestoneKey = milestoneKey(milestoneId);
  const bucketTasks = tasks.filter((task) => {
    const taskMilestoneKey = milestoneKey(task.milestone);
    return bucketMilestoneKey ? taskMilestoneKey === bucketMilestoneKey : !taskMilestoneKey;
  });

  const counts: Record<string, number> = {};
  for (const status of statuses) {
    counts[status] = 0;
  }
  for (const task of bucketTasks) {
    const status = task.status ?? "";
    counts[status] = (counts[status] ?? 0) + 1;
  }

  const doneCount = bucketTasks.filter((t) => isDoneStatus(t.status)).length;
  const progress = bucketTasks.length > 0 ? Math.round((doneCount / bucketTasks.length) * 100) : 0;

  const key = bucketMilestoneKey ? bucketMilestoneKey : NO_MILESTONE_KEY;
  const label = getMilestoneLabel(milestoneId, milestoneEntities);

  return {
    key,
    label,
    milestone: milestoneId,
    isNoMilestone,
    tasks: bucketTasks,
    statusCounts: counts,
    total: bucketTasks.length,
    doneCount,
    progress,
  };
}

/**
 * Build milestone buckets from tasks and milestone entities
 *
 * @param tasks - All tasks to group
 * @param milestoneEntities - Milestone entities (for titles)
 * @param statuses - Configured statuses (for status counts)
 * @returns Array of milestone buckets
 */
export function buildMilestoneBuckets(
  tasks: Task[],
  milestoneEntities: Milestone[],
  statuses: string[]
): MilestoneBucket[] {
  const allMilestoneIds = collectMilestoneIds(tasks, milestoneEntities);

  const buckets: MilestoneBucket[] = [
    // "No milestone" bucket first
    createBucket(undefined, tasks, statuses, milestoneEntities, true),
    // Then each milestone bucket
    ...allMilestoneIds.map((m) => createBucket(m, tasks, statuses, milestoneEntities, false)),
  ];

  return buckets;
}

/**
 * Build milestone buckets using config milestone strings (legacy support)
 *
 * @deprecated Use buildMilestoneBuckets with Milestone entities instead
 */
export function buildMilestoneBucketsFromConfig(
  tasks: Task[],
  configMilestones: string[],
  statuses: string[]
): MilestoneBucket[] {
  // Convert config milestone strings to minimal Milestone entities
  const milestoneEntities: Milestone[] = configMilestones.map((id) => ({
    id,
    title: id,
    description: "",
    rawContent: "",
    tasks: [],
  }));

  return buildMilestoneBuckets(tasks, milestoneEntities, statuses);
}

/**
 * Build a complete milestone summary
 *
 * @param tasks - All tasks
 * @param milestoneEntities - Milestone entities
 * @param statuses - Configured statuses
 * @returns MilestoneSummary with milestones and buckets
 */
export function buildMilestoneSummary(
  tasks: Task[],
  milestoneEntities: Milestone[],
  statuses: string[]
): MilestoneSummary {
  const milestones = collectMilestoneIds(tasks, milestoneEntities);
  const buckets = buildMilestoneBuckets(tasks, milestoneEntities, statuses);

  return {
    milestones,
    buckets,
  };
}

/**
 * Group tasks by milestone (simple version using config milestones)
 *
 * @param tasks - Tasks to group
 * @param configMilestones - Milestones from config
 * @param statuses - Configured statuses
 * @returns MilestoneSummary
 */
export function groupTasksByMilestone(
  tasks: Task[],
  configMilestones: string[],
  statuses: string[]
): MilestoneSummary {
  const milestones = collectMilestones(tasks, configMilestones);
  const buckets = buildMilestoneBucketsFromConfig(tasks, configMilestones, statuses);

  return {
    milestones,
    buckets,
  };
}
