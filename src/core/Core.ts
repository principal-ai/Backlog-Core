/**
 * Core - Main entry point for @backlog-md/core
 *
 * Provides a runtime-agnostic API for managing Backlog.md projects
 * by accepting adapter implementations for I/O operations.
 */

import type { FileSystemAdapter } from "@principal-ai/repository-abstraction";
import {
  extractMilestoneIdFromFilename,
  extractTaskIndexFromPath,
  getMilestoneFilename,
  parseMilestoneMarkdown,
  parseTaskMarkdown,
  serializeMilestoneMarkdown,
  serializeTaskMarkdown,
} from "../markdown";
import type {
  BacklogConfig,
  Milestone,
  MilestoneSummary,
  PaginatedResult,
  PaginatedTasksBySource,
  PaginatedTasksByStatus,
  PaginationOptions,
  SourcePaginationOptions,
  Task,
  TaskCreateInput,
  TaskIndexEntry,
  TaskListFilter,
  TaskUpdateInput,
} from "../types";
import { DEFAULT_TASK_STATUSES } from "../types";
import {
  groupTasksByMilestone,
  groupTasksByStatus,
  milestoneKey,
  sortTasks,
  sortTasksBy,
} from "../utils";
import { parseBacklogConfig, serializeBacklogConfig } from "./config-parser";

/**
 * Options for initializing a new Backlog.md project
 */
export interface InitProjectOptions {
  /** Project name (defaults to directory name) */
  projectName?: string;
  /** Initial statuses (defaults to [DEFAULT_TASK_STATUSES.TODO, DEFAULT_TASK_STATUSES.IN_PROGRESS, DEFAULT_TASK_STATUSES.DONE]) */
  statuses?: string[];
  /** Initial labels (defaults to []) */
  labels?: string[];
  /** Default status for new tasks (defaults to first status) */
  defaultStatus?: string;
}

/**
 * Options for creating a Core instance
 */
export interface CoreOptions {
  /** Root directory of the project */
  projectRoot: string;

  /** Adapter implementations for I/O operations */
  adapters: {
    /** FileSystem adapter (required) */
    fs: FileSystemAdapter;
  };
}

/**
 * Input for creating a new milestone
 */
export interface MilestoneCreateInput {
  /** Milestone title (required) */
  title: string;
  /** Optional description */
  description?: string;
}

/**
 * Input for updating an existing milestone
 */
export interface MilestoneUpdateInput {
  /** New title (optional) */
  title?: string;
  /** New description (optional) */
  description?: string;
}

/**
 * Core class for Backlog.md operations
 *
 * @example
 * ```typescript
 * const core = new Core({
 *   projectRoot: '/path/to/project',
 *   adapters: { fs: new NodeFileSystemAdapter() }
 * });
 *
 * await core.initialize();
 * const tasks = core.listTasks();
 * const grouped = core.getTasksByStatus();
 * ```
 */
export class Core {
  private readonly projectRoot: string;
  private readonly fs: FileSystemAdapter;

  private config: BacklogConfig | null = null;
  private tasks: Map<string, Task> = new Map();
  private initialized = false;

  /** Lightweight task index for lazy loading (no file reads) */
  private taskIndex: Map<string, TaskIndexEntry> = new Map();
  private lazyInitialized = false;

  constructor(options: CoreOptions) {
    this.projectRoot = options.projectRoot;
    this.fs = options.adapters.fs;
  }

  /**
   * Check if projectRoot contains a valid Backlog.md project
   */
  async isBacklogProject(): Promise<boolean> {
    const configPath = this.fs.join(this.projectRoot, "backlog", "config.yml");
    return this.fs.exists(configPath);
  }

  /**
   * Initialize a new Backlog.md project in the projectRoot directory
   *
   * Creates the backlog/ directory and config.yml file.
   * Task directories (tasks/, completed/) are created lazily when needed.
   *
   * @param options - Optional configuration for the new project
   * @throws Error if project already exists
   *
   * @example
   * ```typescript
   * const core = new Core({ projectRoot: '/path/to/project', adapters: { fs } });
   *
   * // Initialize with defaults
   * await core.initProject();
   *
   * // Or with custom options
   * await core.initProject({
   *   projectName: 'My Project',
   *   statuses: ['Backlog', 'In Progress', 'Review', 'Done'],
   *   labels: ['bug', 'feature', 'docs']
   * });
   * ```
   */
  async initProject(options: InitProjectOptions = {}): Promise<void> {
    // Check if already a backlog project
    if (await this.isBacklogProject()) {
      throw new Error(
        `Already a Backlog.md project: config.yml exists at ${this.fs.join(this.projectRoot, "backlog", "config.yml")}`
      );
    }

    // Derive project name from directory if not provided
    const dirName = this.projectRoot.split("/").pop() || "Backlog";
    const projectName = options.projectName || dirName;

    // Build config with defaults
    const statuses = options.statuses || [
      DEFAULT_TASK_STATUSES.TODO,
      DEFAULT_TASK_STATUSES.IN_PROGRESS,
      DEFAULT_TASK_STATUSES.DONE,
    ];
    const config: BacklogConfig = {
      projectName,
      statuses,
      labels: options.labels || [],
      milestones: [],
      defaultStatus: options.defaultStatus || statuses[0],
      dateFormat: "YYYY-MM-DD",
    };

    // Create backlog directory
    const backlogDir = this.fs.join(this.projectRoot, "backlog");
    await this.fs.createDir(backlogDir, { recursive: true });

    // Write config.yml
    const configPath = this.fs.join(backlogDir, "config.yml");
    const configContent = serializeBacklogConfig(config);
    await this.fs.writeFile(configPath, configContent);
  }

  /**
   * Initialize the Core instance
   *
   * Loads configuration and discovers all tasks.
   * Must be called before using other methods.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Load config
    const configPath = this.fs.join(this.projectRoot, "backlog", "config.yml");
    const configExists = await this.fs.exists(configPath);

    if (!configExists) {
      throw new Error(`Not a Backlog.md project: config.yml not found at ${configPath}`);
    }

    const configContent = await this.fs.readFile(configPath);
    this.config = parseBacklogConfig(configContent);

    // Load tasks from tasks/ directory
    const tasksDir = this.fs.join(this.projectRoot, "backlog", "tasks");
    if (await this.fs.exists(tasksDir)) {
      await this.loadTasksFromDirectory(tasksDir, "local");
    }

    // Load tasks from completed/ directory
    const completedDir = this.fs.join(this.projectRoot, "backlog", "completed");
    if (await this.fs.exists(completedDir)) {
      await this.loadTasksFromDirectory(completedDir, "completed");
    }

    this.initialized = true;
  }

  /**
   * Initialize with lazy loading (no file content reads)
   *
   * Only loads config and builds task index from file paths.
   * Task content is loaded on-demand via loadTask().
   * Use this for web/panel contexts where file reads are expensive.
   *
   * @param filePaths - Array of all file paths in the project
   */
  async initializeLazy(filePaths: string[]): Promise<void> {
    if (this.lazyInitialized) return;

    // Load config
    const configPath = this.fs.join(this.projectRoot, "backlog", "config.yml");
    const configExists = await this.fs.exists(configPath);

    if (!configExists) {
      throw new Error(`Not a Backlog.md project: config.yml not found at ${configPath}`);
    }

    const configContent = await this.fs.readFile(configPath);
    this.config = parseBacklogConfig(configContent);

    // Build task index from file paths only (no file reads)
    this.taskIndex.clear();
    for (const filePath of filePaths) {
      if (!filePath.endsWith(".md")) continue;
      // Check for backlog/tasks or backlog/completed (with or without leading slash)
      const isTaskFile =
        filePath.includes("backlog/tasks/") || filePath.includes("backlog\\tasks\\");
      const isCompletedFile =
        filePath.includes("backlog/completed/") || filePath.includes("backlog\\completed\\");
      if (!isTaskFile && !isCompletedFile) continue;
      // Skip config.yml
      if (filePath.endsWith("config.yml")) continue;

      const indexEntry = extractTaskIndexFromPath(filePath);
      this.taskIndex.set(indexEntry.id, indexEntry);
    }

    this.lazyInitialized = true;
  }

  /**
   * Check if lazy initialization is complete
   */
  isLazyInitialized(): boolean {
    return this.lazyInitialized;
  }

  /**
   * Get the task index (lightweight entries)
   */
  getTaskIndex(): Map<string, TaskIndexEntry> {
    if (!this.lazyInitialized) {
      throw new Error("Core not lazy initialized. Call initializeLazy() first.");
    }
    return this.taskIndex;
  }

  /**
   * Load a single task by ID (on-demand loading)
   *
   * @param id - Task ID
   * @returns Task or undefined if not found
   */
  async loadTask(id: string): Promise<Task | undefined> {
    // Return from cache if already loaded
    if (this.tasks.has(id)) {
      return this.tasks.get(id);
    }

    // Get index entry
    const indexEntry = this.taskIndex.get(id);
    if (!indexEntry) {
      return undefined;
    }

    // Load and parse task file
    try {
      const content = await this.fs.readFile(indexEntry.filePath);
      const task = parseTaskMarkdown(content, indexEntry.filePath);
      task.source = indexEntry.source === "completed" ? "completed" : "local";
      this.tasks.set(task.id, task);
      return task;
    } catch (error) {
      console.warn(`Failed to load task ${id} from ${indexEntry.filePath}:`, error);
      return undefined;
    }
  }

  /**
   * Load multiple tasks by ID (on-demand loading)
   *
   * @param ids - Array of task IDs to load
   * @returns Array of loaded tasks (undefined entries filtered out)
   */
  async loadTasks(ids: string[]): Promise<Task[]> {
    const tasks = await Promise.all(ids.map((id) => this.loadTask(id)));
    return tasks.filter((t): t is Task => t !== undefined);
  }

  /**
   * Get tasks by source (tasks/completed) with pagination
   *
   * This is a lazy-loading alternative to getTasksByStatusPaginated().
   * Groups by directory (tasks/ or completed/) instead of status.
   * Only loads task content for items in the requested page.
   *
   * @param options - Per-source pagination options
   * @returns Paginated tasks grouped by source
   */
  async getTasksBySourcePaginated(
    options?: SourcePaginationOptions
  ): Promise<PaginatedTasksBySource> {
    if (!this.lazyInitialized) {
      throw new Error("Core not lazy initialized. Call initializeLazy() first.");
    }

    const tasksLimit = options?.tasksLimit ?? 10;
    const completedLimit = options?.completedLimit ?? 10;
    const offset = options?.offset ?? 0;
    const tasksSortDirection = options?.tasksSortDirection ?? "asc";
    const completedSortByIdDesc = options?.completedSortByIdDesc ?? true;

    const sources: Array<"tasks" | "completed"> = ["tasks", "completed"];
    const bySource = new Map<string, PaginatedResult<Task>>();

    for (const source of sources) {
      // Get index entries for this source
      let entries = Array.from(this.taskIndex.values()).filter((e) => e.source === source);

      // Per-source limit
      const limit = source === "tasks" ? tasksLimit : completedLimit;

      // Sort by ID (numeric)
      entries = entries.sort((a, b) => {
        const aNum = parseInt(a.id.replace(/\D/g, ""), 10) || 0;
        const bNum = parseInt(b.id.replace(/\D/g, ""), 10) || 0;
        if (source === "completed") {
          // Completed: use completedSortByIdDesc option
          return completedSortByIdDesc ? bNum - aNum : aNum - bNum;
        } else {
          // Tasks: use tasksSortDirection option
          return tasksSortDirection === "desc" ? bNum - aNum : aNum - bNum;
        }
      });

      const total = entries.length;
      const pageEntries = entries.slice(offset, offset + limit);

      // Load only the tasks for this page
      const items = await this.loadTasks(pageEntries.map((e) => e.id));

      bySource.set(source, {
        items,
        total,
        hasMore: offset + limit < total,
        offset,
        limit,
      });
    }

    return {
      bySource,
      sources,
    };
  }

  /**
   * Load more tasks for a specific source (lazy loading)
   *
   * @param source - Source to load more from ("tasks" or "completed")
   * @param currentOffset - Current offset (items already loaded)
   * @param options - Pagination options
   * @returns Paginated result for the source
   */
  async loadMoreForSource(
    source: "tasks" | "completed",
    currentOffset: number,
    options?: {
      limit?: number;
      sortDirection?: "asc" | "desc";
      completedSortByIdDesc?: boolean;
    }
  ): Promise<PaginatedResult<Task>> {
    if (!this.lazyInitialized) {
      throw new Error("Core not lazy initialized. Call initializeLazy() first.");
    }

    const limit = options?.limit ?? 10;
    const sortDirection = options?.sortDirection ?? "asc";
    const completedSortByIdDesc = options?.completedSortByIdDesc ?? true;

    // Get index entries for this source
    let entries = Array.from(this.taskIndex.values()).filter((e) => e.source === source);

    // Sort by ID (numeric)
    entries = entries.sort((a, b) => {
      const aNum = parseInt(a.id.replace(/\D/g, ""), 10) || 0;
      const bNum = parseInt(b.id.replace(/\D/g, ""), 10) || 0;
      if (source === "completed") {
        // Completed: use completedSortByIdDesc option
        return completedSortByIdDesc ? bNum - aNum : aNum - bNum;
      } else {
        // Tasks: use sortDirection option
        return sortDirection === "desc" ? bNum - aNum : aNum - bNum;
      }
    });

    const total = entries.length;
    const pageEntries = entries.slice(currentOffset, currentOffset + limit);

    // Load only the tasks for this page
    const items = await this.loadTasks(pageEntries.map((e) => e.id));

    return {
      items,
      total,
      hasMore: currentOffset + limit < total,
      offset: currentOffset,
      limit,
    };
  }

  /**
   * Get the loaded configuration
   *
   * @throws Error if not initialized
   */
  getConfig(): BacklogConfig {
    this.ensureInitialized();
    return this.safeConfig;
  }

  /**
   * List all tasks, optionally filtered
   *
   * @param filter - Optional filter criteria
   * @returns Sorted array of tasks
   */
  listTasks(filter?: TaskListFilter): Task[] {
    this.ensureInitialized();
    let tasks = Array.from(this.tasks.values());

    if (filter?.status) {
      tasks = tasks.filter((t) => t.status === filter.status);
    }
    if (filter?.assignee) {
      const assignee = filter.assignee;
      tasks = tasks.filter((t) => t.assignee.includes(assignee));
    }
    if (filter?.priority) {
      tasks = tasks.filter((t) => t.priority === filter.priority);
    }
    if (filter?.milestone) {
      const filterKey = milestoneKey(filter.milestone);
      tasks = tasks.filter((t) => milestoneKey(t.milestone) === filterKey);
    }
    if (filter?.labels && filter.labels.length > 0) {
      tasks = tasks.filter((t) => filter.labels?.some((label) => t.labels.includes(label)));
    }
    if (filter?.parentTaskId) {
      tasks = tasks.filter((t) => t.parentTaskId === filter.parentTaskId);
    }

    return sortTasks(tasks);
  }

  /**
   * Get tasks grouped by status
   *
   * This is the primary method for kanban-style displays.
   * Returns a Map with status as key and sorted tasks as value.
   * The Map preserves the order of statuses from config.
   */
  getTasksByStatus(): Map<string, Task[]> {
    this.ensureInitialized();
    const tasks = Array.from(this.tasks.values());
    return groupTasksByStatus(tasks, this.safeConfig.statuses);
  }

  /**
   * Get tasks grouped by milestone
   *
   * Returns a MilestoneSummary with:
   * - milestones: List of milestone IDs in display order
   * - buckets: Array of MilestoneBucket with tasks, progress, status counts
   *
   * The first bucket is always "Tasks without milestone".
   * Each bucket includes progress percentage based on done status.
   *
   * @example
   * ```typescript
   * const summary = core.getTasksByMilestone();
   * for (const bucket of summary.buckets) {
   *   console.log(`${bucket.label}: ${bucket.progress}% complete`);
   *   console.log(`  ${bucket.doneCount}/${bucket.total} tasks done`);
   * }
   * ```
   */
  getTasksByMilestone(): MilestoneSummary {
    this.ensureInitialized();
    const tasks = Array.from(this.tasks.values());
    return groupTasksByMilestone(tasks, this.safeConfig.milestones, this.safeConfig.statuses);
  }

  // =========================================================================
  // Milestone CRUD Operations
  // =========================================================================

  /**
   * Get the milestones directory path
   */
  private getMilestonesDir(): string {
    return this.fs.join(this.projectRoot, "backlog", "milestones");
  }

  /**
   * List all milestones from the milestones directory
   *
   * @returns Array of Milestone objects sorted by ID
   */
  async listMilestones(): Promise<Milestone[]> {
    const milestonesDir = this.getMilestonesDir();

    // Check if directory exists
    if (!(await this.fs.exists(milestonesDir))) {
      return [];
    }

    const entries = await this.fs.readDir(milestonesDir);
    const milestones: Milestone[] = [];

    for (const entry of entries) {
      // Skip non-milestone files
      if (!entry.endsWith(".md")) continue;
      if (entry.toLowerCase() === "readme.md") continue;

      const milestoneId = extractMilestoneIdFromFilename(entry);
      if (!milestoneId) continue;

      const filepath = this.fs.join(milestonesDir, entry);

      // Skip directories
      if (await this.fs.isDirectory(filepath)) continue;

      try {
        const content = await this.fs.readFile(filepath);
        milestones.push(parseMilestoneMarkdown(content));
      } catch (error) {
        console.warn(`Failed to parse milestone file ${filepath}:`, error);
      }
    }

    // Sort by ID for consistent ordering
    return milestones.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  }

  /**
   * Load a single milestone by ID
   *
   * @param id - Milestone ID (e.g., "m-0")
   * @returns Milestone or null if not found
   */
  async loadMilestone(id: string): Promise<Milestone | null> {
    const milestonesDir = this.getMilestonesDir();

    if (!(await this.fs.exists(milestonesDir))) {
      return null;
    }

    const entries = await this.fs.readDir(milestonesDir);

    // Find file matching the ID
    const milestoneFile = entries.find((entry) => {
      const fileId = extractMilestoneIdFromFilename(entry);
      return fileId === id;
    });

    if (!milestoneFile) {
      return null;
    }

    const filepath = this.fs.join(milestonesDir, milestoneFile);

    try {
      const content = await this.fs.readFile(filepath);
      return parseMilestoneMarkdown(content);
    } catch {
      return null;
    }
  }

  /**
   * Create a new milestone
   *
   * @param input - Milestone creation input
   * @returns Created milestone
   */
  async createMilestone(input: MilestoneCreateInput): Promise<Milestone> {
    const milestonesDir = this.getMilestonesDir();

    // Ensure milestones directory exists
    await this.fs.createDir(milestonesDir, { recursive: true });

    // Find next available milestone ID
    const entries = await this.fs.readDir(milestonesDir).catch(() => []);
    const existingIds = entries
      .map((f) => {
        const match = f.match(/^m-(\d+)/);
        return match?.[1] ? parseInt(match[1], 10) : -1;
      })
      .filter((id) => id >= 0);

    const nextId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 0;
    const id = `m-${nextId}`;

    const description = input.description || `Milestone: ${input.title}`;

    // Create a temporary milestone to generate content
    const tempMilestone: Milestone = {
      id,
      title: input.title,
      description,
      rawContent: "",
      tasks: [],
    };

    // Generate content
    const content = serializeMilestoneMarkdown(tempMilestone);

    // Create the final milestone with correct rawContent
    const milestone: Milestone = {
      id,
      title: input.title,
      description,
      rawContent: content,
      tasks: [],
    };

    // Write file
    const filename = getMilestoneFilename(id, input.title);
    const filepath = this.fs.join(milestonesDir, filename);
    await this.fs.writeFile(filepath, content);

    return milestone;
  }

  /**
   * Update an existing milestone
   *
   * @param id - Milestone ID to update
   * @param input - Fields to update
   * @returns Updated milestone or null if not found
   */
  async updateMilestone(id: string, input: MilestoneUpdateInput): Promise<Milestone | null> {
    const existing = await this.loadMilestone(id);
    if (!existing) {
      return null;
    }

    const milestonesDir = this.getMilestonesDir();
    const entries = await this.fs.readDir(milestonesDir);

    // Find the current file
    const currentFile = entries.find((entry) => {
      const fileId = extractMilestoneIdFromFilename(entry);
      return fileId === id;
    });

    if (!currentFile) {
      return null;
    }

    // Build updated values
    const newTitle = input.title ?? existing.title;
    const newDescription = input.description ?? existing.description;

    // Create a temporary milestone to generate content
    const tempMilestone: Milestone = {
      id: existing.id,
      title: newTitle,
      description: newDescription,
      rawContent: "",
      tasks: existing.tasks,
    };

    // Generate new content
    const content = serializeMilestoneMarkdown(tempMilestone);

    // Create the final updated milestone
    const updated: Milestone = {
      id: existing.id,
      title: newTitle,
      description: newDescription,
      rawContent: content,
      tasks: existing.tasks,
    };

    // Delete old file
    const oldPath = this.fs.join(milestonesDir, currentFile);
    await this.fs.deleteFile(oldPath);

    // Write new file (with potentially new filename if title changed)
    const newFilename = getMilestoneFilename(id, updated.title);
    const newPath = this.fs.join(milestonesDir, newFilename);
    await this.fs.writeFile(newPath, content);

    return updated;
  }

  /**
   * Delete a milestone
   *
   * @param id - Milestone ID to delete
   * @returns true if deleted, false if not found
   */
  async deleteMilestone(id: string): Promise<boolean> {
    const milestonesDir = this.getMilestonesDir();

    if (!(await this.fs.exists(milestonesDir))) {
      return false;
    }

    const entries = await this.fs.readDir(milestonesDir);

    // Find file matching the ID
    const milestoneFile = entries.find((entry) => {
      const fileId = extractMilestoneIdFromFilename(entry);
      return fileId === id;
    });

    if (!milestoneFile) {
      return false;
    }

    const filepath = this.fs.join(milestonesDir, milestoneFile);

    try {
      await this.fs.deleteFile(filepath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get a single task by ID
   *
   * @param id - Task ID
   * @returns Task or undefined if not found
   */
  getTask(id: string): Task | undefined {
    this.ensureInitialized();
    return this.tasks.get(id);
  }

  /**
   * List tasks with pagination
   *
   * @param filter - Filter and pagination options
   * @returns Paginated result with tasks
   */
  listTasksPaginated(filter?: TaskListFilter): PaginatedResult<Task> {
    this.ensureInitialized();

    // Apply filters
    let tasks = this.applyFilters(Array.from(this.tasks.values()), filter);

    // Sort
    const pagination = filter?.pagination ?? {};
    const sortBy = pagination.sortBy ?? "title";
    const sortDirection = pagination.sortDirection ?? "asc";

    tasks = sortTasksBy(tasks, sortBy, sortDirection);

    // Paginate
    const limit = pagination.limit ?? 10;
    const offset = pagination.offset ?? 0;
    const total = tasks.length;
    const items = tasks.slice(offset, offset + limit);

    return {
      items,
      total,
      hasMore: offset + limit < total,
      offset,
      limit,
    };
  }

  /**
   * Get tasks by status with pagination per column
   *
   * @param pagination - Pagination options (applied per status)
   * @returns Paginated tasks grouped by status
   */
  getTasksByStatusPaginated(pagination?: PaginationOptions): PaginatedTasksByStatus {
    this.ensureInitialized();

    const limit = pagination?.limit ?? 10;
    const offset = pagination?.offset ?? 0;
    const sortBy = pagination?.sortBy ?? "title";
    const sortDirection = pagination?.sortDirection ?? "asc";

    const byStatus = new Map<string, PaginatedResult<Task>>();

    // Group all tasks by status first (without sorting)
    const allGrouped = new Map<string, Task[]>();
    for (const status of this.safeConfig.statuses) {
      allGrouped.set(status, []);
    }
    for (const task of this.tasks.values()) {
      const list = allGrouped.get(task.status);
      if (list) {
        list.push(task);
      } else {
        allGrouped.set(task.status, [task]);
      }
    }

    // Paginate each status column
    for (const status of this.safeConfig.statuses) {
      let tasks = allGrouped.get(status) ?? [];
      tasks = sortTasksBy(tasks, sortBy, sortDirection);

      const total = tasks.length;
      const items = tasks.slice(offset, offset + limit);

      byStatus.set(status, {
        items,
        total,
        hasMore: offset + limit < total,
        offset,
        limit,
      });
    }

    return {
      byStatus,
      statuses: this.safeConfig.statuses,
    };
  }

  /**
   * Load more tasks for a specific status
   *
   * @param status - Status column to load more from
   * @param currentOffset - Current offset (items already loaded)
   * @param pagination - Pagination options (limit, sortBy, sortDirection)
   * @returns Paginated result for the status
   */
  loadMoreForStatus(
    status: string,
    currentOffset: number,
    pagination?: Omit<PaginationOptions, "offset">
  ): PaginatedResult<Task> {
    this.ensureInitialized();

    const limit = pagination?.limit ?? 10;
    const sortBy = pagination?.sortBy ?? "title";
    const sortDirection = pagination?.sortDirection ?? "asc";

    let tasks = Array.from(this.tasks.values()).filter((t) => t.status === status);
    tasks = sortTasksBy(tasks, sortBy, sortDirection);

    const total = tasks.length;
    const items = tasks.slice(currentOffset, currentOffset + limit);

    return {
      items,
      total,
      hasMore: currentOffset + limit < total,
      offset: currentOffset,
      limit,
    };
  }

  /**
   * Reload all tasks from disk
   *
   * Useful after external changes to task files.
   */
  async reload(): Promise<void> {
    this.tasks.clear();
    this.initialized = false;
    await this.initialize();
  }

  // --- Private methods ---

  private ensureInitialized(): void {
    if ((!this.initialized && !this.lazyInitialized) || !this.config) {
      throw new Error("Core not initialized. Call initialize() or initializeLazy() first.");
    }
  }

  /**
   * Get config with type safety (use after ensureInitialized)
   */
  private get safeConfig(): BacklogConfig {
    return this.config as BacklogConfig;
  }

  private applyFilters(tasks: Task[], filter?: TaskListFilter): Task[] {
    if (!filter) return tasks;

    let result = tasks;

    if (filter.status) {
      result = result.filter((t) => t.status === filter.status);
    }
    if (filter.assignee) {
      const assignee = filter.assignee;
      result = result.filter((t) => t.assignee.includes(assignee));
    }
    if (filter.priority) {
      result = result.filter((t) => t.priority === filter.priority);
    }
    if (filter.milestone) {
      const filterKey = milestoneKey(filter.milestone);
      result = result.filter((t) => milestoneKey(t.milestone) === filterKey);
    }
    if (filter.labels && filter.labels.length > 0) {
      result = result.filter((t) => filter.labels?.some((label) => t.labels.includes(label)));
    }
    if (filter.parentTaskId) {
      result = result.filter((t) => t.parentTaskId === filter.parentTaskId);
    }

    return result;
  }

  private async loadTasksFromDirectory(dir: string, source: "local" | "completed"): Promise<void> {
    const entries = await this.fs.readDir(dir);

    for (const entry of entries) {
      const fullPath = this.fs.join(dir, entry);

      // Skip directories
      if (await this.fs.isDirectory(fullPath)) {
        continue;
      }

      // Only process markdown files
      if (!entry.endsWith(".md")) {
        continue;
      }

      try {
        const content = await this.fs.readFile(fullPath);
        const task = parseTaskMarkdown(content, fullPath);

        // Set source based on directory
        task.source = source;

        this.tasks.set(task.id, task);
      } catch (error) {
        // Log but don't fail on individual task parse errors
        console.warn(`Failed to parse task file ${fullPath}:`, error);
      }
    }
  }

  // =========================================================================
  // Milestone-Task Sync Helpers
  // =========================================================================

  /**
   * Add a task ID to a milestone's tasks array
   *
   * @param taskId - Task ID to add
   * @param milestoneId - Milestone ID to update
   */
  private async addTaskToMilestone(taskId: string, milestoneId: string): Promise<void> {
    const milestone = await this.loadMilestone(milestoneId);
    if (!milestone) {
      console.warn(`Milestone ${milestoneId} not found when adding task ${taskId}`);
      return;
    }

    // Check if task already in milestone
    if (milestone.tasks.includes(taskId)) {
      return;
    }

    // Update milestone with new task
    const updatedMilestone: Milestone = {
      ...milestone,
      tasks: [...milestone.tasks, taskId],
    };

    await this.writeMilestoneFile(updatedMilestone);
  }

  /**
   * Remove a task ID from a milestone's tasks array
   *
   * @param taskId - Task ID to remove
   * @param milestoneId - Milestone ID to update
   */
  private async removeTaskFromMilestone(taskId: string, milestoneId: string): Promise<void> {
    const milestone = await this.loadMilestone(milestoneId);
    if (!milestone) {
      return;
    }

    // Check if task is in milestone
    if (!milestone.tasks.includes(taskId)) {
      return;
    }

    // Update milestone without the task
    const updatedMilestone: Milestone = {
      ...milestone,
      tasks: milestone.tasks.filter((id) => id !== taskId),
    };

    await this.writeMilestoneFile(updatedMilestone);
  }

  /**
   * Write a milestone to disk
   */
  private async writeMilestoneFile(milestone: Milestone): Promise<void> {
    const milestonesDir = this.getMilestonesDir();
    const entries = await this.fs.readDir(milestonesDir).catch(() => []);

    // Find and delete the current file
    const currentFile = entries.find((entry) => {
      const fileId = extractMilestoneIdFromFilename(entry);
      return fileId === milestone.id;
    });

    if (currentFile) {
      const oldPath = this.fs.join(milestonesDir, currentFile);
      await this.fs.deleteFile(oldPath).catch(() => {});
    }

    // Write new file
    const content = serializeMilestoneMarkdown(milestone);
    const filename = getMilestoneFilename(milestone.id, milestone.title);
    const filepath = this.fs.join(milestonesDir, filename);
    await this.fs.writeFile(filepath, content);
  }

  /**
   * Get the tasks directory path
   */
  private getTasksDir(): string {
    return this.fs.join(this.projectRoot, "backlog", "tasks");
  }

  /**
   * Get the completed directory path
   */
  private getCompletedDir(): string {
    return this.fs.join(this.projectRoot, "backlog", "completed");
  }

  // =========================================================================
  // Task CRUD Operations
  // =========================================================================

  /**
   * Create a new task
   *
   * @param input - Task creation input
   * @returns Created task
   */
  async createTask(input: TaskCreateInput): Promise<Task> {
    this.ensureInitialized();

    const tasksDir = this.getTasksDir();

    // Ensure tasks directory exists
    await this.fs.createDir(tasksDir, { recursive: true });

    // Generate next task ID
    // Use taskIndex as source of truth (works for both lazy and full initialization)
    const existingIds = Array.from(
      this.lazyInitialized ? this.taskIndex.keys() : this.tasks.keys()
    )
      .map((id) => parseInt(id.replace(/\D/g, ""), 10))
      .filter((n) => !Number.isNaN(n));
    const nextId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
    const taskId = String(nextId);

    // Validate and normalize status
    const configStatuses = this.config?.statuses || [
      DEFAULT_TASK_STATUSES.TODO,
      DEFAULT_TASK_STATUSES.IN_PROGRESS,
      DEFAULT_TASK_STATUSES.DONE,
    ];
    let status = input.status || this.config?.defaultStatus || DEFAULT_TASK_STATUSES.TODO;

    // Validate status against configured statuses
    if (!configStatuses.includes(status)) {
      console.warn(
        `Warning: Status "${status}" is not in configured statuses [${configStatuses.join(", ")}]. ` +
        `Using default status "${this.config?.defaultStatus || DEFAULT_TASK_STATUSES.TODO}" instead.`
      );
      status = this.config?.defaultStatus || DEFAULT_TASK_STATUSES.TODO;
    }

    // Build task object
    const now = new Date().toISOString().split("T")[0];
    const task: Task = {
      id: taskId,
      title: input.title,
      status,
      priority: input.priority,
      assignee: input.assignee || [],
      createdDate: now,
      labels: input.labels || [],
      milestone: input.milestone,
      dependencies: input.dependencies || [],
      references: input.references || [],
      parentTaskId: input.parentTaskId,
      description: input.description,
      implementationPlan: input.implementationPlan,
      implementationNotes: input.implementationNotes,
      acceptanceCriteriaItems: input.acceptanceCriteria?.map((ac, i) => ({
        index: i + 1,
        text: ac.text,
        checked: ac.checked || false,
      })),
      rawContent: input.rawContent,
      source: "local",
    };

    // Serialize and write file
    const content = serializeTaskMarkdown(task);
    const safeTitle = input.title
      .replace(/[<>:"/\\|?*]/g, "")
      .replace(/\s+/g, " ")
      .slice(0, 50);
    const filename = `${taskId} - ${safeTitle}.md`;
    const filepath = this.fs.join(tasksDir, filename);
    await this.fs.writeFile(filepath, content);

    // Update in-memory cache
    task.filePath = filepath;
    this.tasks.set(taskId, task);

    // Also update taskIndex if in lazy mode
    if (this.lazyInitialized) {
      const relativePath = filepath.replace(this.projectRoot + "/", "");
      this.taskIndex.set(taskId, {
        id: taskId,
        filePath: relativePath,
        title: task.title,
        source: "tasks",
      });
    }

    // Sync milestone if specified
    if (input.milestone) {
      await this.addTaskToMilestone(taskId, input.milestone);
    }

    return task;
  }

  /**
   * Update an existing task
   *
   * @param id - Task ID to update
   * @param input - Fields to update
   * @returns Updated task or null if not found
   */
  async updateTask(id: string, input: TaskUpdateInput): Promise<Task | null> {
    this.ensureInitialized();

    const existing = this.tasks.get(id);
    if (!existing) {
      return null;
    }

    const oldMilestone = existing.milestone;
    const newMilestone =
      input.milestone === null
        ? undefined
        : input.milestone !== undefined
          ? input.milestone
          : oldMilestone;

    // Build updated task
    const now = new Date().toISOString().split("T")[0];
    const updated: Task = {
      ...existing,
      title: input.title ?? existing.title,
      status: input.status ?? existing.status,
      priority: input.priority ?? existing.priority,
      milestone: newMilestone,
      updatedDate: now,
      description: input.description ?? existing.description,
      implementationPlan: input.clearImplementationPlan
        ? undefined
        : (input.implementationPlan ?? existing.implementationPlan),
      implementationNotes: input.clearImplementationNotes
        ? undefined
        : (input.implementationNotes ?? existing.implementationNotes),
      ordinal: input.ordinal ?? existing.ordinal,
      dependencies: input.dependencies ?? existing.dependencies,
      references: input.references ?? existing.references ?? [],
    };

    // Handle label operations
    if (input.labels) {
      updated.labels = input.labels;
    } else {
      if (input.addLabels) {
        updated.labels = [...new Set([...updated.labels, ...input.addLabels])];
      }
      if (input.removeLabels) {
        updated.labels = updated.labels.filter((l) => !input.removeLabels?.includes(l));
      }
    }

    // Handle assignee
    if (input.assignee) {
      updated.assignee = input.assignee;
    }

    // Handle dependency operations
    if (input.addDependencies) {
      updated.dependencies = [...new Set([...updated.dependencies, ...input.addDependencies])];
    }
    if (input.removeDependencies) {
      updated.dependencies = updated.dependencies.filter(
        (d) => !input.removeDependencies?.includes(d)
      );
    }

    // Handle references operations
    if (input.addReferences) {
      updated.references = [...new Set([...(updated.references || []), ...input.addReferences])];
    }
    if (input.removeReferences) {
      updated.references = (updated.references || []).filter(
        (r) => !input.removeReferences?.includes(r)
      );
    }

    // Handle acceptance criteria
    if (input.acceptanceCriteria) {
      updated.acceptanceCriteriaItems = input.acceptanceCriteria.map((ac, i) => ({
        index: i + 1,
        text: ac.text,
        checked: ac.checked || false,
      }));
    }

    // Serialize and write file
    const content = serializeTaskMarkdown(updated);

    // Delete old file if exists
    if (existing.filePath) {
      await this.fs.deleteFile(existing.filePath).catch(() => {});
    }

    // Write new file
    const tasksDir = this.getTasksDir();
    const safeTitle = updated.title
      .replace(/[<>:"/\\|?*]/g, "")
      .replace(/\s+/g, " ")
      .slice(0, 50);
    const filename = `${id} - ${safeTitle}.md`;
    const filepath = this.fs.join(tasksDir, filename);
    await this.fs.writeFile(filepath, content);

    // Update in-memory cache
    updated.filePath = filepath;
    this.tasks.set(id, updated);

    // Handle milestone sync
    const milestoneChanged = milestoneKey(oldMilestone) !== milestoneKey(newMilestone);
    if (milestoneChanged) {
      // Remove from old milestone
      if (oldMilestone) {
        await this.removeTaskFromMilestone(id, oldMilestone);
      }
      // Add to new milestone
      if (newMilestone) {
        await this.addTaskToMilestone(id, newMilestone);
      }
    }

    return updated;
  }

  /**
   * Delete a task
   *
   * @param id - Task ID to delete
   * @returns true if deleted, false if not found
   */
  async deleteTask(id: string): Promise<boolean> {
    this.ensureInitialized();

    const task = this.tasks.get(id);
    if (!task) {
      return false;
    }

    // Remove from milestone if assigned
    if (task.milestone) {
      await this.removeTaskFromMilestone(id, task.milestone);
    }

    // Delete file
    if (task.filePath) {
      try {
        await this.fs.deleteFile(task.filePath);
      } catch {
        // File may already be deleted
      }
    }

    // Remove from in-memory cache
    this.tasks.delete(id);

    return true;
  }

  /**
   * Archive a task (move from tasks/ to completed/)
   *
   * @param id - Task ID to archive
   * @returns Archived task or null if not found or already archived
   */
  async archiveTask(id: string): Promise<Task | null> {
    this.ensureInitialized();

    const task = this.tasks.get(id);
    if (!task) {
      return null;
    }

    // Check if already in completed
    if (task.source === "completed") {
      return null;
    }

    const completedDir = this.getCompletedDir();

    // Ensure completed directory exists
    await this.fs.createDir(completedDir, { recursive: true });

    // Build new filepath in completed/
    const safeTitle = task.title
      .replace(/[<>:"/\\|?*]/g, "")
      .replace(/\s+/g, " ")
      .slice(0, 50);
    const filename = `${id} - ${safeTitle}.md`;
    const newFilepath = this.fs.join(completedDir, filename);

    // Delete old file
    if (task.filePath) {
      try {
        await this.fs.deleteFile(task.filePath);
      } catch {
        // File may not exist
      }
    }

    // Update task
    const archived: Task = {
      ...task,
      source: "completed",
      filePath: newFilepath,
    };

    // Write to new location
    const content = serializeTaskMarkdown(archived);
    await this.fs.writeFile(newFilepath, content);

    // Update in-memory cache
    this.tasks.set(id, archived);

    // Update task index if lazy initialized
    if (this.lazyInitialized) {
      const entry = this.taskIndex.get(id);
      if (entry) {
        entry.source = "completed";
        entry.filePath = newFilepath;
      }
    }

    return archived;
  }

  /**
   * Restore a task (move from completed/ to tasks/)
   *
   * @param id - Task ID to restore
   * @returns Restored task or null if not found or not archived
   */
  async restoreTask(id: string): Promise<Task | null> {
    this.ensureInitialized();

    const task = this.tasks.get(id);
    if (!task) {
      return null;
    }

    // Check if in completed
    if (task.source !== "completed") {
      return null;
    }

    const tasksDir = this.getTasksDir();

    // Ensure tasks directory exists
    await this.fs.createDir(tasksDir, { recursive: true });

    // Build new filepath in tasks/
    const safeTitle = task.title
      .replace(/[<>:"/\\|?*]/g, "")
      .replace(/\s+/g, " ")
      .slice(0, 50);
    const filename = `${id} - ${safeTitle}.md`;
    const newFilepath = this.fs.join(tasksDir, filename);

    // Delete old file
    if (task.filePath) {
      try {
        await this.fs.deleteFile(task.filePath);
      } catch {
        // File may not exist
      }
    }

    // Update task
    const restored: Task = {
      ...task,
      source: "local",
      filePath: newFilepath,
    };

    // Write to new location
    const content = serializeTaskMarkdown(restored);
    await this.fs.writeFile(newFilepath, content);

    // Update in-memory cache
    this.tasks.set(id, restored);

    // Update task index if lazy initialized
    if (this.lazyInitialized) {
      const entry = this.taskIndex.get(id);
      if (entry) {
        entry.source = "tasks";
        entry.filePath = newFilepath;
      }
    }

    return restored;
  }

  /**
   * Load specific tasks by their IDs (for lazy loading milestone tasks)
   *
   * @param ids - Array of task IDs to load
   * @returns Array of loaded tasks (missing tasks excluded)
   */
  async loadTasksByIds(ids: string[]): Promise<Task[]> {
    // If fully initialized, return from cache
    if (this.initialized) {
      return ids.map((id) => this.tasks.get(id)).filter((t): t is Task => t !== undefined);
    }

    // If lazy initialized, load on demand
    if (this.lazyInitialized) {
      return this.loadTasks(ids);
    }

    throw new Error("Core not initialized. Call initialize() or initializeLazy() first.");
  }
}
