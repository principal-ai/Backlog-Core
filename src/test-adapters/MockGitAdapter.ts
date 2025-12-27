/**
 * Mock Git adapter for testing
 *
 * Provides a configurable mock implementation of GitAdapter
 * that records command history and allows setting up responses.
 */

import type { GitAdapter, GitExecOptions, GitExecResult } from "../abstractions";

interface MockConfig {
  currentBranch: string;
  isClean: boolean;
  isRepository: boolean;
  branches: string[];
  remoteBranches: string[];
  remotes: string[];
  trees: Map<string, Map<string, string>>; // ref -> path -> content
}

interface CommandHistoryEntry {
  args: string[];
  options?: GitExecOptions;
  timestamp: Date;
}

export class MockGitAdapter implements GitAdapter {
  readonly projectRoot: string;

  private config: MockConfig = {
    currentBranch: "main",
    isClean: true,
    isRepository: true,
    branches: ["main"],
    remoteBranches: [],
    remotes: ["origin"],
    trees: new Map(),
  };

  private commandHistory: CommandHistoryEntry[] = [];
  private mockResponses: Map<string, GitExecResult | Error> = new Map();

  constructor(projectRoot: string = "/mock/project") {
    this.projectRoot = projectRoot;
  }

  // --- GitAdapter implementation ---

  async exec(args: string[], options?: GitExecOptions): Promise<GitExecResult> {
    this.commandHistory.push({
      args,
      options,
      timestamp: new Date(),
    });

    // Check for mock response
    const key = args.join(" ");
    const mockResponse = this.mockResponses.get(key);
    if (mockResponse) {
      if (mockResponse instanceof Error) {
        throw mockResponse;
      }
      return mockResponse;
    }

    // Default behavior based on command
    return this.handleCommand(args);
  }

  async isGitRepository(_path: string): Promise<boolean> {
    return this.config.isRepository;
  }

  async initRepository(_path: string): Promise<void> {
    this.config.isRepository = true;
    this.config.branches = ["main"];
    this.config.currentBranch = "main";
  }

  // --- Test configuration methods ---

  /**
   * Set the current branch
   */
  mockBranch(name: string): this {
    this.config.currentBranch = name;
    if (!this.config.branches.includes(name)) {
      this.config.branches.push(name);
    }
    return this;
  }

  /**
   * Set available branches
   */
  mockBranches(local: string[], remote: string[] = []): this {
    this.config.branches = local;
    this.config.remoteBranches = remote;
    return this;
  }

  /**
   * Set available remotes
   */
  mockRemotes(remotes: string[]): this {
    this.config.remotes = remotes;
    return this;
  }

  /**
   * Set whether the repository is clean
   */
  mockClean(isClean: boolean): this {
    this.config.isClean = isClean;
    return this;
  }

  /**
   * Set whether the path is a git repository
   */
  mockIsRepository(isRepo: boolean): this {
    this.config.isRepository = isRepo;
    return this;
  }

  /**
   * Mock file tree for a specific ref
   */
  mockTree(ref: string, files: Record<string, string>): this {
    this.config.trees.set(ref, new Map(Object.entries(files)));
    return this;
  }

  /**
   * Set a mock response for a specific command
   */
  mockResponse(args: string[], response: GitExecResult | Error): this {
    this.mockResponses.set(args.join(" "), response);
    return this;
  }

  // --- Assertion helpers ---

  /**
   * Get command history
   */
  getCommandHistory(): CommandHistoryEntry[] {
    return [...this.commandHistory];
  }

  /**
   * Assert a command was called
   */
  assertCommandCalled(args: string[]): void {
    const key = args.join(" ");
    const found = this.commandHistory.some((entry) => entry.args.join(" ") === key);
    if (!found) {
      throw new Error(
        `Expected command "${key}" to be called, but it was not.\n` +
          `Commands called: ${this.commandHistory.map((e) => e.args.join(" ")).join(", ")}`
      );
    }
  }

  /**
   * Assert a command was called a specific number of times
   */
  assertCommandCalledTimes(args: string[], times: number): void {
    const key = args.join(" ");
    const count = this.commandHistory.filter((entry) => entry.args.join(" ") === key).length;
    if (count !== times) {
      throw new Error(
        `Expected command "${key}" to be called ${times} times, but it was called ${count} times.`
      );
    }
  }

  /**
   * Clear command history
   */
  clearHistory(): this {
    this.commandHistory = [];
    return this;
  }

  /**
   * Reset all mock state
   */
  reset(): this {
    this.config = {
      currentBranch: "main",
      isClean: true,
      isRepository: true,
      branches: ["main"],
      remoteBranches: [],
      remotes: ["origin"],
      trees: new Map(),
    };
    this.commandHistory = [];
    this.mockResponses.clear();
    return this;
  }

  // --- Private helpers ---

  private handleCommand(args: string[]): GitExecResult {
    const [command, ...rest] = args;

    switch (command) {
      case "status":
        return {
          stdout: this.config.isClean ? "" : "M  some-file.md\n",
          stderr: "",
          exitCode: 0,
        };

      case "branch":
        if (rest.includes("--show-current")) {
          return { stdout: this.config.currentBranch, stderr: "", exitCode: 0 };
        }
        if (rest.includes("-r")) {
          return { stdout: this.config.remoteBranches.join("\n"), stderr: "", exitCode: 0 };
        }
        if (rest.includes("-a")) {
          return {
            stdout: [...this.config.branches, ...this.config.remoteBranches].join("\n"),
            stderr: "",
            exitCode: 0,
          };
        }
        return { stdout: this.config.branches.join("\n"), stderr: "", exitCode: 0 };

      case "remote":
        return { stdout: this.config.remotes.join("\n"), stderr: "", exitCode: 0 };

      case "rev-parse":
        if (rest.includes("--is-inside-work-tree")) {
          return {
            stdout: this.config.isRepository ? "true" : "",
            stderr: this.config.isRepository ? "" : "fatal: not a git repository",
            exitCode: this.config.isRepository ? 0 : 128,
          };
        }
        return { stdout: "", stderr: "", exitCode: 0 };

      default:
        return { stdout: "", stderr: "", exitCode: 0 };
    }
  }
}
