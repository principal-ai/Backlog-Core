/**
 * Test adapters for @backlog-md/core
 *
 * Provides in-memory and mock implementations of adapters for testing.
 */

import { InMemoryFileSystemAdapter } from "@principal-ai/repository-abstraction";
import { MockGitAdapter } from "./MockGitAdapter";

// Re-export adapters
export { InMemoryFileSystemAdapter, MockGitAdapter };

// Re-export adapter types for convenience
export type {
  FileSystemAdapter,
  GlobAdapter,
  GlobOptions,
} from "@principal-ai/repository-abstraction";

export type { GitAdapter, GitExecResult } from "../abstractions";

/**
 * Create a complete set of test adapters
 */
export function createTestAdapters() {
  return {
    fs: new InMemoryFileSystemAdapter(),
    git: new MockGitAdapter(),
  };
}
