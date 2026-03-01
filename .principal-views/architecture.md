# Core Package Architecture

The `@backlog-md/core` package provides a runtime-agnostic task management system with a clean separation between business logic and I/O operations.

## Design Philosophy

The architecture follows the **Ports and Adapters** (Hexagonal) pattern:
- **Core logic** is pure and testable, with no direct dependencies on filesystem or git
- **Adapters** implement interfaces for different runtimes (Bun, Node.js, in-memory for testing)
- **Dependency injection** allows swapping implementations without changing business logic

## Key Components

### Core API Layer
The entry point for all operations. Accepts adapters via `CoreOptions` and composes internal services.

### Services
- **FileSystem Service**: Task CRUD operations using FileSystemAdapter and GlobAdapter
- **GitOperations Service**: Git commands using GitAdapter
- **ContentStore**: In-memory cache with optional file watching
- **SearchService**: Full-text search over cached tasks

### Adapter Interfaces
Abstract interfaces that decouple core from runtime:
- `FileSystemAdapter`: File I/O operations
- `GlobAdapter`: Pattern matching for file discovery
- `GitAdapter`: Git command execution

### Adapter Implementations
- **Bun Adapters**: Production implementation using Bun APIs
- **Test Adapters**: In-memory implementations for unit testing
- **Node Adapters**: Future Node.js support

## Common Patterns

1. **Create Core instance** with appropriate adapters for your runtime
2. **Initialize** to load configuration and tasks
3. **Query** tasks using filters, pagination, and search
4. **Mutate** tasks through the Core API (creates, updates, moves)

## Error Handling

Operations return typed results and throw descriptive errors when:
- Configuration is invalid or missing
- Task files cannot be parsed
- File system operations fail
