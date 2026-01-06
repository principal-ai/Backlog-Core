#!/usr/bin/env bun
/**
 * Diagnostic tool for debugging task loading issues in Backlog Core
 *
 * This script helps identify why tasks aren't showing up in the kanban panel by:
 * 1. Scanning the directory for task files
 * 2. Testing if they match expected naming patterns
 * 3. Simulating Core's initializeLazy logic
 * 4. Showing which tasks would be indexed and which would be skipped
 *
 * Usage:
 *   bun scripts/diagnose-tasks.ts <project-directory>
 *
 * Example:
 *   bun scripts/diagnose-tasks.ts /Users/griever/Developer/web-ade/web-ade
 */

import { readdirSync, statSync, readFileSync } from "fs";
import { join, relative } from "path";

interface DiagnosticResult {
  totalFiles: number;
  validTasks: Array<{
    filePath: string;
    id: string;
    title: string;
    source: "tasks" | "completed";
  }>;
  skippedFiles: Array<{
    filePath: string;
    reason: string;
  }>;
}

/**
 * Extract ID from file path (mimics Core's logic)
 */
function extractIdFromPath(filePath: string): string {
  const filename = filePath.split("/").pop() || "";
  // Match: optional "task-", id (number or decimal), " - "
  const match = filename.match(/^(?:task-)?(\d+(?:\.\d+)?)\s*-/);
  if (match) {
    return match[1];
  }
  // Fallback: use filename without extension
  return filename.replace(/\.md$/, "");
}

/**
 * Extract title from filename (mimics Core's logic)
 */
function extractTitleFromPath(filePath: string): string {
  const filename = filePath.split("/").pop() || "";
  // Match: optional "task-", id, " - ", then capture title
  const match = filename.match(/^(?:task-)?\d+(?:\.\d+)?\s*-\s*(.+)\.md$/);
  if (match) {
    return match[1].trim();
  }
  // Fallback: filename without extension
  return filename.replace(/\.md$/, "");
}

/**
 * Extract source directory from file path
 */
function extractSourceFromPath(filePath: string): "tasks" | "completed" {
  if (filePath.includes("/completed/") || filePath.includes("\\completed\\")) {
    return "completed";
  }
  return "tasks";
}

/**
 * Recursively find all files in a directory
 */
function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  try {
    const files = readdirSync(dirPath);

    files.forEach((file) => {
      const fullPath = join(dirPath, file);
      try {
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
    console.error(`Error reading directory ${dirPath}:`, err);
    return arrayOfFiles;
  }
}

/**
 * Diagnose task loading issues
 */
function diagnoseTasks(projectRoot: string): DiagnosticResult {
  const result: DiagnosticResult = {
    totalFiles: 0,
    validTasks: [],
    skippedFiles: [],
  };

  console.log(`\n🔍 Scanning project: ${projectRoot}\n`);

  // Get all files in the project
  const allFiles = getAllFiles(projectRoot);
  const relativePaths = allFiles.map((f) => relative(projectRoot, f));

  result.totalFiles = allFiles.length;
  console.log(`📁 Total files found: ${result.totalFiles}\n`);

  // Filter and analyze task files (mimics Core's initializeLazy logic)
  for (const filePath of relativePaths) {
    // Skip non-markdown files
    if (!filePath.endsWith(".md")) {
      continue;
    }

    // Skip node_modules
    if (filePath.includes("node_modules")) {
      continue;
    }

    // Check for backlog/tasks or backlog/completed
    const isTaskFile =
      filePath.includes("backlog/tasks/") || filePath.includes("backlog\\tasks\\");
    const isCompletedFile =
      filePath.includes("backlog/completed/") || filePath.includes("backlog\\completed\\");

    if (!isTaskFile && !isCompletedFile) {
      if (filePath.includes("backlog/")) {
        result.skippedFiles.push({
          filePath,
          reason: "Not in tasks/ or completed/ directory",
        });
      }
      continue;
    }

    // Skip config.yml
    if (filePath.endsWith("config.yml")) {
      result.skippedFiles.push({
        filePath,
        reason: "Config file (not a task)",
      });
      continue;
    }

    // Extract task info
    const id = extractIdFromPath(filePath);
    const title = extractTitleFromPath(filePath);
    const source = extractSourceFromPath(filePath);

    result.validTasks.push({
      filePath,
      id,
      title,
      source,
    });
  }

  return result;
}

/**
 * Print diagnostic results
 */
function printResults(result: DiagnosticResult): void {
  console.log("═".repeat(80));
  console.log("📊 DIAGNOSTIC RESULTS");
  console.log("═".repeat(80));

  // Detect duplicate IDs
  const idMap = new Map<string, typeof result.validTasks>();
  for (const task of result.validTasks) {
    if (!idMap.has(task.id)) {
      idMap.set(task.id, []);
    }
    idMap.get(task.id)!.push(task);
  }

  const duplicateIds = Array.from(idMap.entries()).filter(([_, tasks]) => tasks.length > 1);
  const hasUniqueTasks = idMap.size;

  // Show duplicate ID warning FIRST (critical issue)
  if (duplicateIds.length > 0) {
    console.log("\n🚨 CRITICAL ISSUE: DUPLICATE TASK IDs DETECTED!");
    console.log("═".repeat(80));
    console.log("\n⚠️  Core uses a Map with task ID as the key. When multiple tasks have the");
    console.log("   same ID, only the LAST one processed will be stored. This is why you're");
    console.log("   only seeing 1 task in the kanban panel!\n");

    for (const [id, tasks] of duplicateIds) {
      console.log(`\n❌ ID "${id}" is used by ${tasks.length} tasks:`);
      tasks.forEach((task, idx) => {
        const status = idx === tasks.length - 1 ? "✅ WILL SHOW" : "❌ HIDDEN";
        console.log(`   ${status} - ${task.filePath}`);
        console.log(`            Title: "${task.title}"`);
      });
    }

    console.log("\n📝 FIX: Rename files to have unique IDs:");
    console.log("   Example: 1 - Task.md, 2 - Task.md, 3 - Task.md");
    console.log("   Or use: 1 - Task.md, 1.1 - Task.md, 1.2 - Task.md");
    console.log("\n═".repeat(80));
  }

  console.log(`\n✅ Task files found: ${result.validTasks.length}`);
  console.log(`✅ Unique task IDs: ${hasUniqueTasks}`);

  if (duplicateIds.length > 0) {
    console.log(`❌ Tasks that will actually load: ${hasUniqueTasks} (due to duplicates)`);
  }

  if (result.validTasks.length > 0) {
    console.log("\nAll task files found:\n");
    const bySource = {
      tasks: result.validTasks.filter((t) => t.source === "tasks"),
      completed: result.validTasks.filter((t) => t.source === "completed"),
    };

    if (bySource.tasks.length > 0) {
      console.log(`  📋 Active Tasks (${bySource.tasks.length} files):`);
      bySource.tasks.forEach((task, idx) => {
        const duplicates = idMap.get(task.id)!;
        const isDuplicate = duplicates.length > 1;
        const willShow = !isDuplicate || duplicates[duplicates.length - 1] === task;
        const status = willShow ? "✅" : "❌";

        console.log(`    ${status} ${idx + 1}. [${task.id}] ${task.title}`);
        console.log(`       📄 ${task.filePath}`);
        if (!willShow) {
          console.log(`       ⚠️  Will be hidden due to duplicate ID`);
        }
      });
      console.log();
    }

    if (bySource.completed.length > 0) {
      console.log(`  ✔️  Completed Tasks (${bySource.completed.length} files):`);
      bySource.completed.forEach((task, idx) => {
        const duplicates = idMap.get(task.id)!;
        const isDuplicate = duplicates.length > 1;
        const willShow = !isDuplicate || duplicates[duplicates.length - 1] === task;
        const status = willShow ? "✅" : "❌";

        console.log(`    ${status} ${idx + 1}. [${task.id}] ${task.title}`);
        console.log(`       📄 ${task.filePath}`);
        if (!willShow) {
          console.log(`       ⚠️  Will be hidden due to duplicate ID`);
        }
      });
      console.log();
    }
  }

  if (result.skippedFiles.length > 0) {
    console.log(`\n❌ Skipped files: ${result.skippedFiles.length}`);
    console.log("\nFiles that will NOT show up (and why):\n");
    result.skippedFiles.forEach((skip, idx) => {
      console.log(`  ${idx + 1}. ${skip.filePath}`);
      console.log(`     ⚠️  Reason: ${skip.reason}`);
    });
    console.log();
  }

  console.log("═".repeat(80));
  console.log("\n💡 TROUBLESHOOTING TIPS:\n");
  console.log("1. Task files must be in backlog/tasks/ or backlog/completed/");
  console.log("2. Files should follow naming pattern: 'task-001 - Title.md' or '001 - Title.md'");
  console.log("3. Ensure file paths use forward slashes (/) not backslashes (\\) on Unix");
  console.log("4. Check that files are .md extension (not .markdown or .txt)");
  console.log("5. Verify backlog/config.yml exists");
  console.log("\n═".repeat(80));
}

/**
 * Validate file naming patterns
 */
function validateFileNames(projectRoot: string): void {
  console.log("\n🔤 FILE NAMING PATTERN VALIDATION\n");
  console.log("═".repeat(80));

  const backlogTasksDir = join(projectRoot, "backlog", "tasks");
  const backlogCompletedDir = join(projectRoot, "backlog", "completed");

  const patterns = {
    valid: /^(?:task-)?(\d+(?:\.\d+)?)\s*-\s*(.+)\.md$/,
    taskPrefix: /^task-\d+(?:\.\d+)?\s*-\s*.+\.md$/,
    simpleId: /^\d+(?:\.\d+)?\s*-\s*.+\.md$/,
  };

  for (const dir of [backlogTasksDir, backlogCompletedDir]) {
    try {
      const files = readdirSync(dir);
      const mdFiles = files.filter((f) => f.endsWith(".md"));

      console.log(`\n📁 ${relative(projectRoot, dir)}/`);
      console.log(`   Found ${mdFiles.length} markdown file(s)\n`);

      mdFiles.forEach((file) => {
        const matchesValid = patterns.valid.test(file);
        const matchesTaskPrefix = patterns.taskPrefix.test(file);
        const matchesSimpleId = patterns.simpleId.test(file);

        const status = matchesValid ? "✅" : "❌";
        console.log(`   ${status} ${file}`);

        if (!matchesValid) {
          console.log(`      ⚠️  Does not match expected pattern`);
          console.log(`      Expected: 'task-001 - Title.md' or '001 - Title.md'`);
        } else {
          const id = extractIdFromPath(file);
          const title = extractTitleFromPath(file);
          console.log(`      ID: ${id}`);
          console.log(`      Title: ${title}`);
        }
        console.log();
      });
    } catch (err) {
      console.log(`   ⚠️  Directory not found or inaccessible`);
    }
  }

  console.log("═".repeat(80));
}

/**
 * Check for common issues
 */
function checkCommonIssues(projectRoot: string): void {
  console.log("\n🔍 CHECKING FOR COMMON ISSUES\n");
  console.log("═".repeat(80));

  const issues: string[] = [];

  // Check if backlog directory exists
  try {
    statSync(join(projectRoot, "backlog"));
    console.log("✅ backlog/ directory exists");
  } catch {
    issues.push("❌ backlog/ directory not found");
  }

  // Check if backlog/config.yml exists
  try {
    statSync(join(projectRoot, "backlog", "config.yml"));
    console.log("✅ backlog/config.yml exists");
  } catch {
    issues.push("❌ backlog/config.yml not found (required for Core initialization)");
  }

  // Check if backlog/tasks directory exists
  try {
    statSync(join(projectRoot, "backlog", "tasks"));
    console.log("✅ backlog/tasks/ directory exists");
  } catch {
    issues.push("⚠️  backlog/tasks/ directory not found");
  }

  // Check if backlog/completed directory exists
  try {
    statSync(join(projectRoot, "backlog", "completed"));
    console.log("✅ backlog/completed/ directory exists");
  } catch {
    console.log("ℹ️  backlog/completed/ directory not found (optional)");
  }

  if (issues.length > 0) {
    console.log("\n⚠️  ISSUES FOUND:\n");
    issues.forEach((issue) => console.log(`   ${issue}`));
  }

  console.log("\n═".repeat(80));
}

// Main execution
const projectRoot = process.argv[2];

if (!projectRoot) {
  console.error("❌ Error: Please provide a project directory");
  console.log("\nUsage:");
  console.log("  bun scripts/diagnose-tasks.ts <project-directory>");
  console.log("\nExample:");
  console.log("  bun scripts/diagnose-tasks.ts /Users/griever/Developer/web-ade/web-ade");
  process.exit(1);
}

try {
  // Check if directory exists
  statSync(projectRoot);

  // Run diagnostics
  checkCommonIssues(projectRoot);
  validateFileNames(projectRoot);
  const result = diagnoseTasks(projectRoot);
  printResults(result);

  // Exit with error code if no valid tasks found
  if (result.validTasks.length === 0) {
    console.log("\n❌ No valid tasks found! See troubleshooting tips above.\n");
    process.exit(1);
  } else {
    console.log(`\n✅ Diagnostic complete! Found ${result.validTasks.length} valid task(s).\n`);
    process.exit(0);
  }
} catch (err) {
  console.error(`\n❌ Error: Directory not found: ${projectRoot}\n`);
  process.exit(1);
}
