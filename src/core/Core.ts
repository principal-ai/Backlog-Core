/**
 * Core - Main entry point for @backlog-md/core
 *
 * Provides a runtime-agnostic API for managing Backlog.md projects
 * by accepting adapter implementations for I/O operations.
 */

import type { FileSystemAdapter } from "@principal-ai/repository-abstraction";
import type { Task, BacklogConfig, TaskListFilter } from "../types";
import { parseBacklogConfig } from "./config-parser";
import { parseTaskMarkdown } from "../markdown";
import { sortTasks, groupTasksByStatus } from "../utils";

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
