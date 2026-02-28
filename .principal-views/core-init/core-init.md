# Core Initialization

The Core initialization workflow is the entry point for using Backlog-Core. It loads the project configuration and discovers all tasks from the filesystem.

## Purpose

Core initialization prepares the library for use by:
- Loading and parsing `backlog/config.yml`
- Discovering task files in `backlog/tasks/` and `backlog/completed/` directories
- Building an in-memory cache of tasks for fast access

## Initialization Modes

### Full Initialization (`initialize()`)

Loads all task files into memory immediately. Best for:
- CLI applications that need all tasks
- Batch operations
- Environments where file reads are cheap

### Lazy Initialization (`initializeLazy()`)

Only builds a task index from file paths without reading file contents. Best for:
- Web/panel contexts where file reads are expensive
- Large projects with many tasks
- Scenarios where only a subset of tasks will be accessed

## Workflow

1. **Started**: Initialization begins with project root path
2. **Config Loaded**: `config.yml` is read and parsed
3. **Tasks Loaded**: Task files are discovered from both `tasks/` and `completed/` directories
4. **Complete**: All tasks are cached and Core is ready for use

## Error Scenarios

- **Config Not Found**: No `backlog/config.yml` exists at the project root
- **Invalid Config**: Config file exists but cannot be parsed
- **Task Parse Error**: Individual task files fail to parse (logged as warnings, doesn't fail initialization)

## Usage

```typescript
import { Core } from '@backlog-md/core';

const core = new Core({
  projectRoot: '/path/to/project',
  adapters: { fs: new NodeFileSystemAdapter() }
});

// Full initialization
await core.initialize();

// Or lazy initialization
await core.initializeLazy(filePaths);
```
