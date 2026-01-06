#!/usr/bin/env bun
/**
 * Test script to actually load tasks using Core and see what happens
 */

import { Core } from "../src/core/Core";
import type { FileSystemAdapter } from "@principal-ai/repository-abstraction";
import { join, dirname, basename, extname, relative, normalize, isAbsolute } from "path";
import { readdirSync, statSync, readFileSync, existsSync } from "fs";
import { homedir } from "os";

// Simple Node.js FileSystemAdapter implementation
class SimpleNodeAdapter implements FileSystemAdapter {
  async exists(path: string): Promise<boolean> {
    return existsSync(path);
  }

  async readFile(path: string): Promise<string> {
    return readFileSync(path, "utf-8");
  }

  async writeFile(path: string, content: string): Promise<void> {
    throw new Error("Write not implemented in test adapter");
  }

  async createDir(path: string): Promise<void> {
    throw new Error("CreateDir not implemented in test adapter");
  }

  async readDir(path: string): Promise<string[]> {
    return readdirSync(path);
  }

  async isDirectory(path: string): Promise<boolean> {
    return statSync(path).isDirectory();
  }

  async stat(path: string): Promise<{ size: number; mtimeMs: number }> {
    const stats = statSync(path);
    return { size: stats.size, mtimeMs: stats.mtimeMs };
  }

  join(...paths: string[]): string {
    return join(...paths);
  }

  dirname(path: string): string {
    return dirname(path);
  }

  basename(path: string, ext?: string): string {
    return basename(path, ext);
  }

  extname(path: string): string {
    return extname(path);
  }

  relative(from: string, to: string): string {
    return relative(from, to);
  }

  normalize(path: string): string {
    return normalize(path);
  }

  isAbsolute(path: string): boolean {
    return isAbsolute(path);
  }

  homedir(): string {
    return homedir();
  }
}

const projectRoot = process.argv[2] || process.cwd();

console.log(`\n🧪 Testing Core task loading in: ${projectRoot}\n`);

// Get all files recursively
function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  try {
    const files = readdirSync(dirPath);
    files.forEach((file) => {
      const fullPath = join(dirPath, file);
      try {
        if (file === "node_modules") return; // Skip node_modules
        if (statSync(fullPath).isDirectory()) {
          arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
        } else {
          arrayOfFiles.push(fullPath);
        }
      } catch (err) {
        // Skip files we can't access
      }
    });
    return arrayOfFiles;
  } catch (err) {
    return arrayOfFiles;
  }
}

async function testCoreLoading() {
  try {
    // Create Core instance
    const fs = new SimpleNodeAdapter();
    const core = new Core({
      projectRoot,
      adapters: { fs },
    });

    console.log("✅ Core instance created");

    // Check if it's a Backlog project
    const isBacklog = await core.isBacklogProject();
    console.log(`✅ Is Backlog project: ${isBacklog}`);

    if (!isBacklog) {
      console.log("❌ Not a Backlog.md project - exiting");
      return;
    }

    // Get all file paths
    const allFiles = getAllFiles(projectRoot);
    const relativePaths = allFiles.map((f) => f.replace(projectRoot + "/", ""));

    console.log(`📁 Total files found: ${allFiles.length}`);

    const taskFiles = relativePaths.filter((f) => f.includes("backlog/tasks/") && f.endsWith(".md"));
    console.log(`📄 Task files found: ${taskFiles.length}`);
    console.log("\nTask files in processing order:");
    taskFiles.forEach((f, idx) => {
      console.log(`  ${idx + 1}. ${f}`);
    });
    console.log();

    // Test with sorted paths (alphabetically)
    const sortedPaths = [...relativePaths].sort();
    const sortedTaskFiles = sortedPaths.filter((f) => f.includes("backlog/tasks/") && f.endsWith(".md"));
    console.log("Task files if sorted alphabetically:");
    sortedTaskFiles.forEach((f, idx) => {
      console.log(`  ${idx + 1}. ${f}`);
    });
    console.log();

    // Initialize lazily with SORTED paths (like the panel might do)
    await core.initializeLazy(sortedPaths);
    console.log("✅ Core initialized lazily (with sorted paths)\n");

    // Get task index
    const taskIndex = core.getTaskIndex();
    console.log("═".repeat(80));
    console.log(`📊 TASK INDEX: ${taskIndex.size} unique task(s) loaded`);
    console.log("═".repeat(80));

    if (taskIndex.size === 0) {
      console.log("❌ No tasks in index!");
      return;
    }

    console.log("\nTasks in index (Map entries):\n");
    let idx = 1;
    for (const [id, entry] of taskIndex.entries()) {
      console.log(`${idx}. ID: "${id}"`);
      console.log(`   Title: "${entry.title}"`);
      console.log(`   File: ${entry.filePath}`);
      console.log(`   Source: ${entry.source}`);
      console.log();
      idx++;
    }

    // Try loading tasks with pagination
    console.log("═".repeat(80));
    console.log("🔄 Testing loadMoreForSource('tasks', 0)");
    console.log("═".repeat(80));

    const result = await core.loadMoreForSource("tasks", 0, {
      limit: 20,
      sortDirection: "asc",
    });

    console.log(`\n📦 Paginated result:`);
    console.log(`   Items: ${result.items.length}`);
    console.log(`   Total: ${result.total}`);
    console.log(`   Has more: ${result.hasMore}`);

    if (result.items.length > 0) {
      console.log("\n✅ Loaded tasks:\n");
      result.items.forEach((task, i) => {
        console.log(`${i + 1}. [${task.id}] ${task.title}`);
        console.log(`   Status: ${task.status}`);
        console.log(`   File: ${task.filePath}`);
        console.log();
      });
    } else {
      console.log("\n❌ No tasks loaded from loadMoreForSource!");
    }
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

testCoreLoading();
