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
  FileStats,
  FileSystemAdapter,
  GitAdapter,
  GitExecOptions,
  GitExecResult,
  GitOperationsInterface,
  GlobAdapter,
  GlobOptions,
} from "./abstractions";

// ============================================================================
// Type Definitions
// ============================================================================

export type {
  AcceptanceCriterion,
  AcceptanceCriterionInput,
  BacklogConfig,
  Decision,
  DecisionSearchResult,
  // Document types
  Document,
  DocumentSearchResult,
  // Milestone types
  Milestone,
  MilestoneBucket,
  MilestoneSummary,
  PaginatedResult,
  PaginatedTasksBySource,
  PaginatedTasksByStatus,
  // Pagination types
  PaginationOptions,
  ParsedMarkdown,
  SearchFilters,
  SearchMatch,
  SearchOptions,
  SearchPriorityFilter,
  // Search types
  SearchResult,
  SearchResultType,
  // Other types
  Sequence,
  SourcePaginationOptions,
  // Core task types
  Task,
  TaskCreateInput,
  TaskIndexEntry,
  TaskListFilter,
  TaskSearchResult,
  TaskStatus,
  TaskUpdateInput,
} from "./types";

// Export helper functions
export { isLocalEditableTask } from "./types";

// ============================================================================
// Markdown Parsing & Serialization
// ============================================================================

export {
  extractMilestoneIdFromFilename,
  extractTaskIndexFromPath,
  getMilestoneFilename,
  getTaskBodyMarkdown,
  type MilestoneFrontmatter,
  // Milestone parsing
  parseMilestoneMarkdown,
  parseTaskMarkdown,
  serializeMilestoneMarkdown,
  serializeTaskMarkdown,
  type TaskBodyMarkdownOptions,
  type TaskFrontmatter,
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
  parseBacklogConfig,
  serializeBacklogConfig,
} from "./core";

// ============================================================================
// Utilities
// ============================================================================

export {
  buildMilestoneBuckets,
  buildMilestoneBucketsFromConfig,
  buildMilestoneSummary,
  collectMilestoneIds,
  collectMilestones,
  getMilestoneLabel,
  groupTasksByMilestone,
  groupTasksByStatus,
  isDoneStatus,
  milestoneKey,
  // Milestone utilities
  normalizeMilestoneName,
  sortTasks,
  sortTasksBy,
  sortTasksByTitle,
} from "./utils";

// ============================================================================
// Re-exports from repository-abstraction for convenience
// ============================================================================

export { InMemoryFileSystemAdapter } from "@principal-ai/repository-abstraction";
