# Core Class Design

## Overview

The `Core` class is the main entry point for @backlog-md/core. It provides a runtime-agnostic API for managing Backlog.md projects by accepting adapter implementations for I/O operations.

## Target Use Case: Web Kanban Panel

The primary driver for this design is the industry-themed kanban panel at `/Users/griever/Developer/web-ade/industry-themed-backlogmd-kanban-panel`.

### Current Panel Architecture

```
PanelContext (provides fileTree + file access)
    ↓
BacklogAdapter (custom implementation - duplicates core logic)
    ↓
KanbanBoard component (renders tasks by status)
```

### Target Architecture

```
PanelContext (provides fileTree + file access)
    ↓
PanelFileSystemAdapter (implements FileSystemAdapter)
    ↓
@backlog-md/core Core class
    ↓
KanbanBoard component (renders tasks by status)
```

## Core Class API

```typescript
import { Core } from "@backlog-md/core";

// Create with adapters
const core = new Core({
  projectRoot: "/path/to/project",
  adapters: {
    fs: new PanelFileSystemAdapter(panelContext),
    glob: new PanelGlobAdapter(panelContext), // optional
  },
});

// Initialize (loads config, discovers structure)
await core.initialize();

// Query operations
const tasks = await core.listTasks();
const tasksByStatus = await core.getTasksByStatus();
const task = await core.getTask("123");
const config = core.getConfig();

// Mutation operations (future)
await core.updateTask("123", { status: "in-progress" });
await core.createTask({ title: "New task", status: "backlog" });
```

## Adapter Requirements

### FileSystemAdapter (required)

The Core class requires a `FileSystemAdapter` to read files and directories:

```typescript
interface FileSystemAdapter {
  exists(path: string): Promise<boolean>;
  readFile(path: string): Promise<string>;
  readDir(path: string): Promise<string[]>;
  isDirectory(path: string): Promise<boolean>;

  // For mutations (optional for read-only use)
  writeFile?(path: string, content: string): Promise<void>;

  // Path utilities
  join(...paths: string[]): string;
  dirname(path: string): string;
  basename(path: string, ext?: string): string;
}
```

### GlobAdapter (optional)

If not provided, Core will use basic directory traversal:

```typescript
interface GlobAdapter {
  scan(pattern: string, options: GlobOptions): Promise<string[]>;
}
```

## Core Class Implementation

### Constructor & Initialization

```typescript
interface CoreOptions {
  projectRoot: string;
  adapters: {
    fs: FileSystemAdapter;
    glob?: GlobAdapter;
  };
}

class Core {
  private config: BacklogConfig | null = null;
  private tasks: Map<string, Task> = new Map();
  private initialized = false;

  constructor(private options: CoreOptions) {}

  async initialize(): Promise<void> {
    // 1. Verify backlog structure exists
    // 2. Load and parse config.yml
    // 3. Discover and load all tasks
  }
}
```

### Directory Structure Detection

Core expects standard Backlog.md structure:

```
{projectRoot}/
├── backlog/
│   ├── config.yml          # Project configuration
│   ├── tasks/              # Active tasks
│   │   ├── 001 - Task one.md
│   │   └── 002 - Task two.md
│   └── completed/          # Archived tasks
│       └── 003 - Done task.md
```

### Operations

#### `isBacklogProject(): Promise<boolean>`

Check if projectRoot contains a valid Backlog.md project.

```typescript
async isBacklogProject(): Promise<boolean> {
  const configPath = this.fs.join(this.projectRoot, 'backlog', 'config.yml');
  return this.fs.exists(configPath);
}
```

#### `initialize(): Promise<void>`

Load configuration and discover all tasks.

```typescript
async initialize(): Promise<void> {
  if (this.initialized) return;

  // Load config
  const configPath = this.fs.join(this.projectRoot, 'backlog', 'config.yml');
  const configContent = await this.fs.readFile(configPath);
  this.config = parseBacklogConfig(configContent);

  // Load tasks from tasks/ directory
  const tasksDir = this.fs.join(this.projectRoot, 'backlog', 'tasks');
  await this.loadTasksFromDirectory(tasksDir, 'local');

  // Load tasks from completed/ directory
  const completedDir = this.fs.join(this.projectRoot, 'backlog', 'completed');
  await this.loadTasksFromDirectory(completedDir, 'completed');

  this.initialized = true;
}
```

#### `getConfig(): BacklogConfig`

Return the loaded configuration.

```typescript
getConfig(): BacklogConfig {
  this.ensureInitialized();
  return this.config!;
}
```

#### `listTasks(filter?: TaskListFilter): Task[]`

Return all tasks, optionally filtered.

```typescript
listTasks(filter?: TaskListFilter): Task[] {
  this.ensureInitialized();
  let tasks = Array.from(this.tasks.values());

  if (filter?.status) {
    tasks = tasks.filter(t => t.status === filter.status);
  }
  if (filter?.assignee) {
    tasks = tasks.filter(t => t.assignee.includes(filter.assignee));
  }
  if (filter?.priority) {
    tasks = tasks.filter(t => t.priority === filter.priority);
  }

  return this.sortTasks(tasks);
}
```

#### `getTasksByStatus(): Map<string, Task[]>`

Group tasks by status column (primary use case for kanban).

```typescript
getTasksByStatus(): Map<string, Task[]> {
  this.ensureInitialized();
  const grouped = new Map<string, Task[]>();

  // Initialize with all configured statuses (preserves column order)
  for (const status of this.config!.statuses) {
    grouped.set(status, []);
  }

  // Group tasks
  for (const task of this.tasks.values()) {
    const list = grouped.get(task.status) || [];
    list.push(task);
    grouped.set(task.status, list);
  }

  // Sort tasks within each status
  for (const [status, tasks] of grouped) {
    grouped.set(status, this.sortTasks(tasks));
  }

  return grouped;
}
```

#### `getTask(id: string): Task | undefined`

Get a single task by ID.

```typescript
getTask(id: string): Task | undefined {
  this.ensureInitialized();
  return this.tasks.get(id);
}
```

### Task Sorting

Tasks are sorted by: ordinal → priority → createdDate

```typescript
private sortTasks(tasks: Task[]): Task[] {
  const priorityOrder = { high: 0, medium: 1, low: 2, undefined: 3 };

  return tasks.sort((a, b) => {
    // 1. Ordinal (if set)
    if (a.ordinal !== undefined && b.ordinal !== undefined) {
      return a.ordinal - b.ordinal;
    }
    if (a.ordinal !== undefined) return -1;
    if (b.ordinal !== undefined) return 1;

    // 2. Priority
    const aPri = priorityOrder[a.priority ?? 'undefined'];
    const bPri = priorityOrder[b.priority ?? 'undefined'];
    if (aPri !== bPri) return aPri - bPri;

    // 3. Created date (newest first)
    return b.createdDate.localeCompare(a.createdDate);
  });
}
```

### Config Parsing

Parse `config.yml` content:

```typescript
function parseBacklogConfig(content: string): BacklogConfig {
  const yaml = parseYaml(content);

  return {
    projectName: yaml.project_name || "Backlog",
    statuses: yaml.statuses || ["backlog", "in-progress", "done"],
    labels: yaml.labels || [],
    milestones: yaml.milestones || [],
    defaultStatus: yaml.default_status || "backlog",
    dateFormat: yaml.date_format || "YYYY-MM-DD",
    // ... other fields
  };
}
```

## File Structure for Implementation

```
src/
├── core/
│   ├── Core.ts              # Main Core class
│   ├── index.ts             # Exports
│   └── config-parser.ts     # parseBacklogConfig
├── utils/
│   ├── sorting.ts           # sortTasks
│   ├── task-path.ts         # extractIdFromPath, isTaskFile
│   └── index.ts
└── index.ts                 # Add Core export
```

## Usage Example: Kanban Panel

```typescript
// In the kanban panel

import { Core, type Task, type BacklogConfig } from "@backlog-md/core";
import type { FileSystemAdapter } from "@backlog-md/core/abstractions";

// Implement adapter for PanelContext
class PanelFileSystemAdapter implements FileSystemAdapter {
  constructor(
    private fileTree: FileTreeNode[],
    private openFile: (path: string) => Promise<string>
  ) {}

  async exists(path: string): Promise<boolean> {
    return this.findNode(path) !== undefined;
  }

  async readFile(path: string): Promise<string> {
    return this.openFile(path);
  }

  async readDir(path: string): Promise<string[]> {
    const node = this.findNode(path);
    if (!node?.children) return [];
    return node.children.map((c) => c.name);
  }

  async isDirectory(path: string): Promise<boolean> {
    const node = this.findNode(path);
    return node?.type === "directory";
  }

  join(...paths: string[]): string {
    return paths.join("/").replace(/\/+/g, "/");
  }

  dirname(path: string): string {
    return path.split("/").slice(0, -1).join("/");
  }

  basename(path: string, ext?: string): string {
    const base = path.split("/").pop() || "";
    if (ext && base.endsWith(ext)) {
      return base.slice(0, -ext.length);
    }
    return base;
  }

  private findNode(path: string): FileTreeNode | undefined {
    // Implementation to find node in fileTree
  }
}

// In the kanban hook
function useKanbanData() {
  const { fileTree, actions } = usePanelContext();
  const [tasksByStatus, setTasksByStatus] = useState<Map<string, Task[]>>();
  const [config, setConfig] = useState<BacklogConfig>();

  useEffect(() => {
    const fs = new PanelFileSystemAdapter(fileTree, actions.openFile);
    const core = new Core({ projectRoot: "/", adapters: { fs } });

    core.initialize().then(() => {
      setConfig(core.getConfig());
      setTasksByStatus(core.getTasksByStatus());
    });
  }, [fileTree]);

  return { tasksByStatus, config };
}
```

## Future Extensions

### Mutation Operations

```typescript
// Update a task
await core.updateTask("123", { status: "done" });

// Create a new task
const task = await core.createTask({
  title: "New feature",
  status: "backlog",
});

// Archive a task
await core.archiveTask("123");
```

### Event System

```typescript
core.on("taskUpdated", (task: Task) => {
  // React to changes
});
```

### Search

```typescript
const results = await core.search("authentication");
```

## Dependencies

The Core class uses:

- `parseTaskMarkdown` from `@backlog-md/core/markdown`
- Types from `@backlog-md/core/types`
- `yaml` npm package (^2.8.1) for task frontmatter parsing

## YAML Parsing Strategy

Based on analysis of the kanban panel implementation, we use two different parsing approaches:

### Config Parsing (`config.yml`)

Uses a **custom line-by-line parser** copied from the official Backlog.md project. This is simpler and more reliable for the config format:

```typescript
// No YAML library needed - simple key: value parsing
function parseBacklogConfig(content: string): BacklogConfig {
  const config: Partial<BacklogConfig> = {};
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const colonIndex = trimmed.indexOf(":");
    if (colonIndex === -1) continue;

    const key = trimmed.substring(0, colonIndex).trim();
    const value = trimmed.substring(colonIndex + 1).trim();

    switch (key) {
      case "project_name":
        config.projectName = value.replace(/['"]/g, "");
        break;
      case "statuses":
      case "labels":
      case "milestones":
        // Parse [item1, item2] format
        if (value.startsWith("[") && value.endsWith("]")) {
          config[key] = value
            .slice(1, -1)
            .split(",")
            .map((item) => item.trim().replace(/['"]/g, ""))
            .filter(Boolean);
        }
        break;
      // ... other fields
    }
  }

  return config as BacklogConfig;
}
```

### Task Frontmatter Parsing

Uses the **`yaml` npm package** for proper YAML parsing of task frontmatter:

```typescript
import YAML from "yaml";

function parseTaskFrontmatter(content: string): TaskFrontmatter {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) throw new Error("Missing frontmatter");

  return YAML.parse(match[1]) as TaskFrontmatter;
}
```

This approach is copied from the kanban panel at:

- `src/adapters/backlog-config-parser.ts` - Config parsing (line-by-line)
- `src/adapters/backlog-parser.ts` - Task parsing (yaml library)

## Reference Implementation

The kanban panel (`/Users/griever/Developer/web-ade/industry-themed-backlogmd-kanban-panel`) contains working implementations of:

| Function                      | Source File                | Notes                           |
| ----------------------------- | -------------------------- | ------------------------------- |
| `parseBacklogConfig()`        | `backlog-config-parser.ts` | Copied from official Backlog.md |
| `parseTaskFile()`             | `backlog-parser.ts`        | Uses `yaml` package             |
| `sortTasks()`                 | `backlog-parser.ts`        | ordinal → priority → date       |
| `extractAcceptanceCriteria()` | `backlog-parser.ts`        | Parses checkbox items           |

These will be consolidated into @backlog-md/core.

## Open Questions

1. **Caching**: Should Core cache parsed tasks, or re-parse on each call?
2. **Reactivity**: Should Core support watching for file changes?
3. **Partial Initialization**: Should Core work if only some directories exist?
