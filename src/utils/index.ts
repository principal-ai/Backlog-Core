/**
 * Utility functions for @backlog-md/core
 */

export {
  sortTasks,
  sortTasksByTitle,
  sortTasksBy,
  groupTasksByStatus,
} from "./sorting";

export {
  normalizeMilestoneName,
  milestoneKey,
  isDoneStatus,
  getMilestoneLabel,
  collectMilestoneIds,
  collectMilestones,
  buildMilestoneBuckets,
  buildMilestoneBucketsFromConfig,
  buildMilestoneSummary,
  groupTasksByMilestone,
} from "./milestones";
