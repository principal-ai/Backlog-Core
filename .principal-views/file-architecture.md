# File Architecture

This document explains the source file organization of `@backlog-md/core` and how each file contributes to the overall architecture.

## Package Entry Point

`src/index.ts` is the main export barrel that re-exports all public APIs:
- `Core` class for runtime instantiation
- Type definitions (`Task`, `BacklogConfig`, etc.)
- Markdown utilities (`parseTaskMarkdown`, `serializeTaskMarkdown`)
- Sorting utilities (`sortTasks`, `groupTasksByStatus`)

## Directory Structure

### `src/core/`
Contains the main `Core` class and configuration parsing:
- `Core.ts`: The primary API class with initialization, querying, and mutation methods
- `config-parser.ts`: YAML configuration parsing using js-yaml

### `src/markdown/`
Pure functions for markdown I/O:
- Parses task markdown files into `Task` objects
- Extracts YAML frontmatter, titles, and acceptance criteria
- Serializes `Task` objects back to markdown format

### `src/types/`
TypeScript definitions for the entire package:
- `Task`, `TaskStatus`, `TaskCreateInput`, `TaskUpdateInput`
- `BacklogConfig`, `PaginationOptions`, `SearchOptions`
- Helper functions like `isLocalEditableTask()`

### `src/utils/`
Pure utility functions:
- `sorting.ts`: Task sorting and grouping utilities

### `src/abstractions/`
Adapter interface definitions:
- Re-exports from `@principal-ai/repository-abstraction`
- Local `GitAdapter` interface

### `src/test-adapters/`
In-memory implementations for testing:
- `MockGitAdapter`: Configurable git operation mocks

## External Dependencies

- `@principal-ai/repository-abstraction`: FileSystemAdapter, GlobAdapter interfaces
- `js-yaml`: YAML parsing for configuration files
