# @backlog-md/core

Runtime-agnostic core package for Backlog.md task management.

## Status

**Planning Phase** - This repository contains design documentation and architecture diagrams for extracting the core functionality from [Backlog.md](https://github.com/yourusername/Backlog.md) into a standalone package.

## Goals

1. **Runtime Independence** - Core logic works in Bun, Node.js, or browser environments
2. **Adapter Pattern** - All I/O operations abstracted via injectable adapters
3. **Testability** - Full test coverage using in-memory adapters
4. **Reusability** - Use Backlog.md's task management as a library

## Documentation

| Document | Description |
|----------|-------------|
| [Core Package Extraction Design](docs/doc-003%20-%20Core-Package-Extraction-Design.md) | Architecture and migration plan |
| [Test Adapter Specification](docs/test-adapter-specification.md) | Functionality requirements for test adapters |

## Architecture Diagrams

Located in `.principal-views/`:

- **architecture.canvas** - Core package internal structure
- **package-boundaries.canvas** - What goes in core vs CLI
- **extraction-checklist.canvas** - Migration review items

View with [Principal View CLI](https://github.com/principal-ai/principal-view-cli):

```bash
npx @principal-ai/principal-view-cli validate .principal-views/*.canvas
```

## Adapter Interfaces

The core package will expose these adapter interfaces:

```typescript
// FileSystemAdapter - file operations
interface FileSystemAdapter {
  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>
  exists(path: string): Promise<boolean>
  createDir(path: string, options?: { recursive?: boolean }): Promise<void>
  deleteFile(path: string): Promise<void>
  rename(from: string, to: string): Promise<void>
  // ...
}

// GlobAdapter - pattern matching
interface GlobAdapter {
  scan(pattern: string, options?: { cwd?: string }): AsyncIterable<string>
}

// GitAdapter - git operations
interface GitAdapter {
  exec(args: string[], options?: { cwd?: string }): Promise<ExecResult>
  isGitRepository(root: string): Promise<boolean>
  initRepository(root: string): Promise<void>
}
```

## Usage (Planned)

```typescript
import { Core } from "@backlog-md/core";
import { bunAdapters } from "@backlog-md/bun-adapters";

const core = new Core("/path/to/project", {
  adapters: bunAdapters,
});

// Create a task
const task = await core.createTaskFromData({
  title: "Implement feature",
  status: "todo",
  priority: "high",
});

// Query tasks
const tasks = await core.queryTasks({
  filters: { status: "in-progress" },
});

// Full-text search
const searchService = await core.getSearchService();
const results = await searchService.search({ query: "authentication" });
```

## Testing (Planned)

```typescript
import { Core } from "@backlog-md/core";
import { createTestAdapters } from "@backlog-md/core/test-adapters";

const adapters = createTestAdapters();
adapters.fs.seedFiles({
  "/project/backlog.json": '{"projectName": "Test"}',
});
adapters.git.mockBranch("main");

const core = new Core("/project", { adapters });

// Tests run in-memory, no filesystem access
const task = await core.createTaskFromData({ title: "Test", status: "todo" });
expect(task.id).toBe("1");
```

## License

MIT
