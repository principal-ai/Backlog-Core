#!/usr/bin/env bun
/**
 * Diagnose kanban panel display issues
 * Checks for status mismatches and grouping problems
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

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  try {
    const files = readdirSync(dirPath);
    files.forEach((file) => {
      const fullPath = join(dirPath, file);
      try {
        if (file === "node_modules") return;
        if (statSync(fullPath).isDirectory()) {
          arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
        } else {
          arrayOfFiles.push(fullPath);
        }
      } catch (err) {
        // Skip
      }
    });
    return arrayOfFiles;
  } catch (err) {
    return arrayOfFiles;
  }
}

const projectRoot = process.argv[2] || process.cwd();

async function diagnoseKanbanIssues() {
  try {
    const fs = new SimpleNodeAdapter();
    const core = new Core({
      projectRoot,
      adapters: { fs },
    });

    console.log("\n🔍 KANBAN PANEL DIAGNOSTIC");
    console.log("═".repeat(80));
    console.log(`Project: ${projectRoot}\n`);

    const isBacklog = await core.isBacklogProject();
    if (!isBacklog) {
      console.log("❌ Not a Backlog.md project");
      return;
    }

    // Get all files and sort them alphabetically (like the panel does)
    const allFiles = getAllFiles(projectRoot);
    const relativePaths = allFiles.map((f) => f.replace(projectRoot + "/", "")).sort();

    await core.initializeLazy(relativePaths);

    // Load all tasks
    const result = await core.loadMoreForSource("tasks", 0, {
      limit: 100,
      sortDirection: "asc",
    });

    console.log(`✅ Total tasks loaded: ${result.items.length}\n`);

    // Get config
    const configPath = join(projectRoot, "backlog", "config.yml");
    const configContent = readFileSync(configPath, "utf-8");
    const statusMatch = configContent.match(/statuses:\s*\[(.*?)\]/);
    const configuredStatuses = statusMatch
      ? statusMatch[1].split(",").map((s) => s.trim().replace(/['"]/g, ""))
      : [];

    console.log("📋 Configured statuses in config.yml:");
    configuredStatuses.forEach((s, idx) => {
      console.log(`   ${idx + 1}. "${s}"`);
    });
    console.log();

    // Group tasks by status
    const tasksByStatus = new Map<string, typeof result.items>();
    const unmatchedStatuses = new Set<string>();

    for (const task of result.items) {
      const status = task.status || "undefined";
      if (!tasksByStatus.has(status)) {
        tasksByStatus.set(status, []);
      }
      tasksByStatus.get(status)!.push(task);

      // Check if status matches config
      if (!configuredStatuses.includes(status)) {
        unmatchedStatuses.add(status);
      }
    }

    console.log("═".repeat(80));
    console.log("📊 TASKS GROUPED BY STATUS (as kanban panel would see them)");
    console.log("═".repeat(80));

    for (const [status, tasks] of tasksByStatus.entries()) {
      const isConfigured = configuredStatuses.includes(status);
      const statusIcon = isConfigured ? "✅" : "❌";

      console.log(`\n${statusIcon} Status: "${status}" (${tasks.length} task${tasks.length === 1 ? "" : "s"})`);
      if (!isConfigured) {
        console.log(`   ⚠️  WARNING: This status is NOT in config.yml!`);
        console.log(`   ⚠️  Tasks with this status may not appear in kanban columns!`);
      }

      tasks.forEach((task, idx) => {
        console.log(`   ${idx + 1}. [${task.id}] ${task.title}`);
        console.log(`      File: ${task.filePath}`);
      });
    }

    // Show unmatched status warning
    if (unmatchedStatuses.size > 0) {
      console.log("\n═".repeat(80));
      console.log("🚨 CRITICAL ISSUE: STATUS MISMATCH DETECTED!");
      console.log("═".repeat(80));
      console.log("\nThe following task statuses do NOT match your config.yml:\n");

      for (const status of unmatchedStatuses) {
        const tasks = tasksByStatus.get(status)!;
        console.log(`❌ "${status}" (${tasks.length} task${tasks.length === 1 ? "" : "s"})`);
        console.log(`   These tasks will NOT show up in the kanban panel!\n`);

        // Try to find similar configured status
        const similar = configuredStatuses.find((cs) =>
          cs.toLowerCase().replace(/[\s-_]/g, "") === status.toLowerCase().replace(/[\s-_]/g, "")
        );

        if (similar) {
          console.log(`   💡 Did you mean: "${similar}"?`);
          console.log(`   📝 FIX: Change status from "${status}" to "${similar}" in these files:`);
          tasks.forEach((t) => {
            console.log(`      - ${t.filePath}`);
          });
          console.log();
        }
      }
    }

    // Show summary by configured status (what user sees in panel)
    console.log("\n═".repeat(80));
    console.log("👁️  WHAT YOU SEE IN THE KANBAN PANEL");
    console.log("═".repeat(80));

    let visibleTasks = 0;
    for (const status of configuredStatuses) {
      const tasks = tasksByStatus.get(status) || [];
      visibleTasks += tasks.length;
      console.log(`\n📌 "${status}" column: ${tasks.length} task${tasks.length === 1 ? "" : "s"}`);
      if (tasks.length > 0) {
        tasks.forEach((t, idx) => {
          console.log(`   ${idx + 1}. [${t.id}] ${t.title}`);
        });
      } else {
        console.log(`   (empty)`);
      }
    }

    console.log(`\n═`.repeat(80));
    console.log(`📊 SUMMARY:`);
    console.log(`   Total tasks in files: ${result.items.length}`);
    console.log(`   Visible in kanban: ${visibleTasks}`);
    console.log(`   Hidden (wrong status): ${result.items.length - visibleTasks}`);
    console.log(`═`.repeat(80));

  } catch (error) {
    console.error("❌ Error:", error);
  }
}

diagnoseKanbanIssues();
