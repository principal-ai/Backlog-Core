/**
 * @backlog-md/core
 *
 * Runtime-agnostic core package for Backlog.md task management.
 * Provides the core business logic for managing tasks, documents, and decisions
 * using the adapter pattern for I/O operations.
 */

// ============================================================================
// Adapter Abstractions
// ============================================================================

export type {
  FileSystemAdapter,
  FileStats,
  GlobAdapter,
  GlobOptions,
  GitAdapter,
  GitExecResult,
  GitExecOptions,
  GitOperationsInterface,
} from "./abstractions";

// ============================================================================
// Type Definitions
// ============================================================================

export type {
  // Core task types
  Task,
  TaskStatus,
  TaskCreateInput,
  TaskUpdateInput,
  TaskListFilter,
  AcceptanceCriterion,
  AcceptanceCriterionInput,

  // Pagination types
  PaginationOptions,
  PaginatedResult,
  PaginatedTasksByStatus,
  PaginatedTasksBySource,
  TaskIndexEntry,
  SourcePaginationOptions,

  // Document types
  Document,
  Decision,

  // Milestone types
  Milestone,
  MilestoneBucket,
  MilestoneSummary,

  // Search types
  SearchResult,
  SearchResultType,
  SearchOptions,
  SearchFilters,
  SearchMatch,
  SearchPriorityFilter,
  TaskSearchResult,
  DocumentSearchResult,
  DecisionSearchResult,

  // Other types
  Sequence,
  BacklogConfig,
  ParsedMarkdown,
} from "./types";

// Export helper functions
export { isLocalEditableTask } from "./types";

// ============================================================================
// Markdown Parsing & Serialization
// ============================================================================

export {
  parseTaskMarkdown,
  serializeTaskMarkdown,
  extractTaskIndexFromPath,
  getTaskBodyMarkdown,
  // Milestone parsing
  parseMilestoneMarkdown,
  serializeMilestoneMarkdown,
  getMilestoneFilename,
  extractMilestoneIdFromFilename,
  type TaskFrontmatter,
  type TaskBodyMarkdownOptions,
  type MilestoneFrontmatter,
} from "./markdown";

// ============================================================================
// Core API
// ============================================================================

export {
  Core,
  type CoreOptions,
  type InitProjectOptions,
  type MilestoneCreateInput,
  type MilestoneUpdateInput,
} from "./core";
export { parseBacklogConfig, serializeBacklogConfig } from "./core";

// ============================================================================
// Utilities
// ============================================================================

export {
  sortTasks,
  sortTasksByTitle,
  sortTasksBy,
  groupTasksByStatus,
  // Milestone utilities
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
} from "./utils";

// ============================================================================
// Re-exports from repository-abstraction for convenience
// ============================================================================

export { InMemoryFileSystemAdapter } from "@principal-ai/repository-abstraction";
