/**
 * Core - Main entry point for @backlog-md/core
 *
 * Provides a runtime-agnostic API for managing Backlog.md projects
 * by accepting adapter implementations for I/O operations.
 */

import type { FileSystemAdapter } from "@principal-ai/repository-abstraction";
import type {
  Task,
  BacklogConfig,
  TaskListFilter,
  PaginationOptions,
  PaginatedResult,
  PaginatedTasksByStatus,
} from "../types";
import { parseBacklogConfig, serializeBacklogConfig } from "./config-parser";
import { parseTaskMarkdown } from "../markdown";
import { sortTasks, sortTasksBy, groupTasksByStatus } from "../utils";

/**
 * Options for initializing a new Backlog.md project
 */
export interface InitProjectOptions {
  /** Project name (defaults to directory name) */
  projectName?: string;
  /** Initial statuses (defaults to ["To Do", "In Progress", "Done"]) */
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
    const statuses = options.statuses || ["To Do", "In Progress", "Done"];
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
      throw new Error(
        `Not a Backlog.md project: config.yml not found at ${configPath}`
      );
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
   * Get the loaded configuration
   *
   * @throws Error if not initialized
   */
  getConfig(): BacklogConfig {
    this.ensureInitialized();
    return this.config!;
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
      tasks = tasks.filter((t) => t.assignee.includes(filter.assignee!));
    }
    if (filter?.priority) {
      tasks = tasks.filter((t) => t.priority === filter.priority);
    }
    if (filter?.labels && filter.labels.length > 0) {
      tasks = tasks.filter((t) =>
        filter.labels!.some((label) => t.labels.includes(label))
      );
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
    return groupTasksByStatus(tasks, this.config!.statuses);
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
  getTasksByStatusPaginated(
    pagination?: PaginationOptions
  ): PaginatedTasksByStatus {
    this.ensureInitialized();

    const limit = pagination?.limit ?? 10;
    const offset = pagination?.offset ?? 0;
    const sortBy = pagination?.sortBy ?? "title";
    const sortDirection = pagination?.sortDirection ?? "asc";

    const byStatus = new Map<string, PaginatedResult<Task>>();

    // Group all tasks by status first (without sorting)
    const allGrouped = new Map<string, Task[]>();
    for (const status of this.config!.statuses) {
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
    for (const status of this.config!.statuses) {
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
      statuses: this.config!.statuses,
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

    let tasks = Array.from(this.tasks.values()).filter(
      (t) => t.status === status
    );
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
    if (!this.initialized) {
      throw new Error("Core not initialized. Call initialize() first.");
    }
  }

  private applyFilters(tasks: Task[], filter?: TaskListFilter): Task[] {
    if (!filter) return tasks;

    let result = tasks;

    if (filter.status) {
      result = result.filter((t) => t.status === filter.status);
    }
    if (filter.assignee) {
      result = result.filter((t) => t.assignee.includes(filter.assignee!));
    }
    if (filter.priority) {
      result = result.filter((t) => t.priority === filter.priority);
    }
    if (filter.labels && filter.labels.length > 0) {
      result = result.filter((t) =>
        filter.labels!.some((label) => t.labels.includes(label))
      );
    }
    if (filter.parentTaskId) {
      result = result.filter((t) => t.parentTaskId === filter.parentTaskId);
    }

    return result;
  }

  private async loadTasksFromDirectory(
    dir: string,
    source: "local" | "completed"
  ): Promise<void> {
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
}
