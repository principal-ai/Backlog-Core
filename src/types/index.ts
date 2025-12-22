/**
 * Type definitions for @backlog-md/core
 * These types match the Backlog.md codebase exactly for compatibility
 */

export type TaskStatus = string;

// Structured Acceptance Criterion (domain-level)
export interface AcceptanceCriterion {
  index: number; // 1-based
  text: string;
  checked: boolean;
}

export interface AcceptanceCriterionInput {
  text: string;
  checked?: boolean;
}

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  assignee: string[];
  reporter?: string;
  createdDate: string;
  updatedDate?: string;
  labels: string[];
  milestone?: string;
  dependencies: string[];
  readonly rawContent?: string; // Raw markdown content without frontmatter (read-only: do not modify directly)
  description?: string;
  implementationPlan?: string;
  implementationNotes?: string;
  /** Structured acceptance criteria parsed from body (checked state + text + index) */
  acceptanceCriteriaItems?: AcceptanceCriterion[];
  parentTaskId?: string;
  subtasks?: string[];
  priority?: "high" | "medium" | "low";
  branch?: string;
  ordinal?: number;
  filePath?: string;
  // Metadata fields
  lastModified?: Date;
  source?: "local" | "remote" | "completed" | "local-branch";
  /** Optional per-task callback command to run on status change (overrides global config) */
  onStatusChange?: string;
}

/**
 * Check if a task is locally editable (not from a remote or other local branch)
 */
export function isLocalEditableTask(task: Task): boolean {
  return task.source === undefined || task.source === "local" || task.source === "completed";
}

export interface TaskCreateInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: "high" | "medium" | "low";
  labels?: string[];
  assignee?: string[];
  dependencies?: string[];
  parentTaskId?: string;
  implementationPlan?: string;
  implementationNotes?: string;
  acceptanceCriteria?: AcceptanceCriterionInput[];
  rawContent?: string;
}

export interface TaskUpdateInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: "high" | "medium" | "low";
  labels?: string[];
  addLabels?: string[];
  removeLabels?: string[];
  assignee?: string[];
  ordinal?: number;
  dependencies?: string[];
  addDependencies?: string[];
  removeDependencies?: string[];
  implementationPlan?: string;
  appendImplementationPlan?: string[];
  clearImplementationPlan?: boolean;
  implementationNotes?: string;
  appendImplementationNotes?: string[];
  clearImplementationNotes?: boolean;
  acceptanceCriteria?: AcceptanceCriterionInput[];
  addAcceptanceCriteria?: Array<AcceptanceCriterionInput | string>;
  removeAcceptanceCriteria?: number[];
  checkAcceptanceCriteria?: number[];
  uncheckAcceptanceCriteria?: number[];
  rawContent?: string;
}

/** Pagination options for task listing */
export interface PaginationOptions {
  /** Number of items per page (default: 10) */
  limit?: number;
  /** Page offset (0-based, default: 0) */
  offset?: number;
  /** Sort field (default: 'title') */
  sortBy?: "title" | "createdDate" | "priority" | "ordinal";
  /** Sort direction (default: 'asc') */
  sortDirection?: "asc" | "desc";
}

/** Paginated result wrapper */
export interface PaginatedResult<T> {
  /** Items for current page */
  items: T[];
  /** Total count of items (before pagination) */
  total: number;
  /** Whether more items exist */
  hasMore: boolean;
  /** Current offset */
  offset: number;
  /** Current limit */
  limit: number;
}

/** Paginated tasks grouped by status */
export interface PaginatedTasksByStatus {
  /** Map of status -> paginated tasks */
  byStatus: Map<string, PaginatedResult<Task>>;
  /** Configured statuses (for column order) */
  statuses: string[];
}

/**
 * Lightweight task index entry for lazy loading.
 * Extracted from filename/path only - no file reads required.
 */
export interface TaskIndexEntry {
  /** Task ID extracted from filename */
  id: string;
  /** Full file path */
  filePath: string;
  /** Title extracted from filename */
  title: string;
  /** Source directory name: "tasks" or "completed" */
  source: "tasks" | "completed";
}

/** Paginated tasks grouped by source (Active/Completed) */
export interface PaginatedTasksBySource {
  /** Map of source -> paginated tasks */
  bySource: Map<string, PaginatedResult<Task>>;
  /** Available sources in display order */
  sources: string[];
}

/** Per-source pagination options for lazy loading */
export interface SourcePaginationOptions {
  /** Limit for active tasks (default: 10) */
  tasksLimit?: number;
  /** Limit for completed tasks (default: 10) */
  completedLimit?: number;
  /** Page offset (0-based, default: 0) */
  offset?: number;
  /** Sort direction for active tasks (default: 'asc' by title) */
  tasksSortDirection?: "asc" | "desc";
  /** Sort completed by ID descending for most recent (default: true) */
  completedSortByIdDesc?: boolean;
}

export interface TaskListFilter {
  status?: string;
  assignee?: string;
  priority?: "high" | "medium" | "low";
  parentTaskId?: string;
  labels?: string[];
  /** Pagination options */
  pagination?: PaginationOptions;
}

export interface Decision {
  id: string;
  title: string;
  date: string;
  status: "proposed" | "accepted" | "rejected" | "superseded";
  context: string;
  decision: string;
  consequences: string;
  alternatives?: string;
  readonly rawContent: string; // Raw markdown content without frontmatter
}

export interface Document {
  id: string;
  title: string;
  type: "readme" | "guide" | "specification" | "other";
  createdDate: string;
  updatedDate?: string;
  rawContent: string; // Raw markdown content without frontmatter
  tags?: string[];
  // Web UI specific fields
  name?: string;
  path?: string;
  lastModified?: string;
}

export type SearchResultType = "task" | "document" | "decision";

export type SearchPriorityFilter = "high" | "medium" | "low";

export interface SearchMatch {
  key?: string;
  indices: Array<[number, number]>;
  value?: unknown;
}

export interface SearchFilters {
  status?: string | string[];
  priority?: SearchPriorityFilter | SearchPriorityFilter[];
  assignee?: string | string[];
  labels?: string | string[];
}

export interface SearchOptions {
  query?: string;
  limit?: number;
  types?: SearchResultType[];
  filters?: SearchFilters;
}

export interface TaskSearchResult {
  type: "task";
  score: number | null;
  task: Task;
  matches?: SearchMatch[];
}

export interface DocumentSearchResult {
  type: "document";
  score: number | null;
  document: Document;
  matches?: SearchMatch[];
}

export interface DecisionSearchResult {
  type: "decision";
  score: number | null;
  decision: Decision;
  matches?: SearchMatch[];
}

export type SearchResult = TaskSearchResult | DocumentSearchResult | DecisionSearchResult;

export interface Sequence {
  /** 1-based sequence index */
  index: number;
  /** Tasks that can be executed in parallel within this sequence */
  tasks: Task[];
}

export interface BacklogConfig {
  projectName: string;
  defaultAssignee?: string;
  defaultReporter?: string;
  statuses: string[];
  labels: string[];
  milestones: string[];
  defaultStatus?: string;
  dateFormat: string;
  maxColumnWidth?: number;
  taskResolutionStrategy?: "most_recent" | "most_progressed";
  defaultEditor?: string;
  autoOpenBrowser?: boolean;
  defaultPort?: number;
  remoteOperations?: boolean;
  autoCommit?: boolean;
  zeroPaddedIds?: number;
  timezonePreference?: string; // e.g., 'UTC', 'America/New_York', or 'local'
  includeDateTimeInDates?: boolean; // Whether to include time in new dates
  bypassGitHooks?: boolean;
  checkActiveBranches?: boolean; // Check task states across active branches (default: true)
  activeBranchDays?: number; // How many days a branch is considered active (default: 30)
  /** Global callback command to run on any task status change. Supports $TASK_ID, $OLD_STATUS, $NEW_STATUS, $TASK_TITLE variables. */
  onStatusChange?: string;
  mcp?: {
    http?: {
      host?: string;
      port?: number;
      auth?: {
        type?: "bearer" | "basic" | "none";
        token?: string;
        username?: string;
        password?: string;
      };
      cors?: {
        origin?: string | string[];
        credentials?: boolean;
      };
      enableDnsRebindingProtection?: boolean;
      allowedHosts?: string[];
      allowedOrigins?: string[];
    };
  };
}

export interface ParsedMarkdown {
  frontmatter: Record<string, unknown>;
  content: string;
}
