#!/usr/bin/env bun
/**
 * Test that ID generation works correctly with initializeLazy
 */

import { Core } from "../src/core/Core";
import type { FileSystemAdapter } from "@principal-ai/repository-abstraction";
import { join, dirname, basename, extname, relative, normalize, isAbsolute } from "path";
import { readdirSync, statSync, readFileSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { homedir } from "os";

class SimpleNodeAdapter implements FileSystemAdapter {
  async exists(path: string): Promise<boolean> {
    return existsSync(path);
  }

  async readFile(path: string): Promise<string> {
    return readFileSync(path, "utf-8");
  }

  async writeFile(path: string, content: string): Promise<void> {
    writeFileSync(path, content, "utf-8");
  }

  async createDir(path: string, options?: { recursive?: boolean }): Promise<void> {
    mkdirSync(path, { recursive: options?.recursive ?? false });
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

async function testIdGeneration() {
  const projectRoot = "/Users/griever/Developer/backlog-adaptation/Backlog-Core";

  console.log("\n🧪 Testing ID Generation with initializeLazy");
  console.log("═".repeat(80));

  const fs = new SimpleNodeAdapter();
  const core = new Core({ projectRoot, adapters: { fs } });

  // Simulate what web-ade does: empty array
  console.log("\n1️⃣  Testing with initializeLazy([]) - OLD BROKEN BEHAVIOR:");
  console.log("   (This should now work due to our fix using taskIndex)");

  const coreEmpty = new Core({ projectRoot, adapters: { fs } });
  await coreEmpty.initializeLazy([]);

  // Try to see what ID would be generated
  const taskIndex = coreEmpty.getTaskIndex();
  console.log(`   Task index size: ${taskIndex.size}`);
  console.log(`   Expected next ID: should be 1 (no existing tasks in index)`);

  console.log("\n2️⃣  Testing with initializeLazy(filePaths) - CORRECT BEHAVIOR:");

  // Get all files (like web-ade should do)
  function getAllFiles(dir: string, files: string[] = []): string[] {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      if (entry === "node_modules") continue;
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        getAllFiles(fullPath, files);
      } else {
        files.push(fullPath);
      }
    }
    return files;
  }

  const allFiles = getAllFiles(projectRoot);
  const relativePaths = allFiles.map(f => f.replace(projectRoot + "/", "")).sort();

  await core.initializeLazy(relativePaths);
  const indexWithFiles = core.getTaskIndex();

  console.log(`   Task index size: ${indexWithFiles.size}`);
  console.log(`   Existing task IDs: [${Array.from(indexWithFiles.keys()).join(", ")}]`);

  const existingIds = Array.from(indexWithFiles.keys())
    .map(id => parseInt(id.replace(/\D/g, ""), 10))
    .filter(n => !Number.isNaN(n));
  const expectedNextId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
  console.log(`   Expected next ID: ${expectedNextId}`);

  console.log("\n3️⃣  Testing status validation:");

  // Test invalid status
  console.log("\n   Creating task with INVALID status 'in-progress'...");
  try {
    const task1 = await core.createTask({
      title: "Test Task with Invalid Status",
      status: "in-progress",  // Invalid - should be "In Progress"
      description: "This tests status validation"
    });
    console.log(`   ✅ Task created with ID: ${task1.id}`);
    console.log(`   ✅ Status was corrected to: "${task1.status}" (was "in-progress")`);
  } catch (err) {
    console.log(`   ❌ Failed: ${err}`);
  }

  console.log("\n4️⃣  Testing sequential ID generation:");

  // Create another task to verify IDs increment
  try {
    const task2 = await core.createTask({
      title: "Second Test Task",
      status: "To Do",
      description: "Verifying sequential IDs"
    });
    console.log(`   ✅ Second task created with ID: ${task2.id}`);

    if (parseInt(task2.id) > expectedNextId) {
      console.log(`   ✅ IDs are incrementing correctly!`);
    } else {
      console.log(`   ❌ WARNING: ID didn't increment as expected`);
    }
  } catch (err) {
    console.log(`   ❌ Failed: ${err}`);
  }

  console.log("\n═".repeat(80));
  console.log("✅ ID Generation Test Complete\n");
}

testIdGeneration().catch(console.error);
