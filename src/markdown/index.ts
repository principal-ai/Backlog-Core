/**
 * Markdown parsing and serialization for @backlog-md/core
 *
 * This module handles conversion between markdown files and Task objects.
 */

import type { AcceptanceCriterion, Milestone, Task, TaskIndexEntry } from "../types";

/**
 * Parsed frontmatter from a task markdown file
 */
export interface TaskFrontmatter {
  status?: string;
  priority?: "high" | "medium" | "low";
  assignee?: string[];
  reporter?: string;
  labels?: string[];
  milestone?: string;
  dependencies?: string[];
  parentTaskId?: string;
  subtasks?: string[];
  branch?: string;
  ordinal?: number;
  createdDate?: string;
  updatedDate?: string;
}

/**
 * Parse task markdown content into a Task object
 *
 * @param content - Raw markdown content
 * @param filePath - Path to the file (for extracting ID from filename)
 * @returns Parsed task object
 */
export function parseTaskMarkdown(content: string, filePath: string): Task {
  const { frontmatter, title, rawContent, acceptanceCriteria, description } =
    parseMarkdownContent(content);
  const id = extractIdFromPath(filePath);

  return {
    id,
    title: title || `Task ${id}`,
    status: frontmatter.status || "backlog",
    priority: frontmatter.priority,
    assignee: frontmatter.assignee || [],
    reporter: frontmatter.reporter,
    createdDate: frontmatter.createdDate || new Date().toISOString().split("T")[0],
    updatedDate: frontmatter.updatedDate,
    labels: frontmatter.labels || [],
    milestone: frontmatter.milestone,
    dependencies: frontmatter.dependencies || [],
    parentTaskId: frontmatter.parentTaskId,
    subtasks: frontmatter.subtasks,
    branch: frontmatter.branch,
    ordinal: frontmatter.ordinal,
    rawContent,
    description,
    acceptanceCriteriaItems: acceptanceCriteria,
    filePath,
  };
}

/**
 * Serialize a Task object to markdown content
 *
 * @param task - Task to serialize
 * @returns Markdown string
 */
export function serializeTaskMarkdown(task: Task): string {
  const lines: string[] = [];

  // Frontmatter
  lines.push("---");
  lines.push(`status: ${task.status}`);

  if (task.priority) {
    lines.push(`priority: ${task.priority}`);
  }

  if (task.assignee && task.assignee.length > 0) {
    lines.push(`assignee: [${task.assignee.join(", ")}]`);
  }

  if (task.reporter) {
    lines.push(`reporter: ${task.reporter}`);
  }

  if (task.labels && task.labels.length > 0) {
    lines.push(`labels: [${task.labels.join(", ")}]`);
  }

  if (task.milestone) {
    lines.push(`milestone: ${task.milestone}`);
  }

  if (task.dependencies && task.dependencies.length > 0) {
    lines.push(`dependencies: [${task.dependencies.join(", ")}]`);
  }

  if (task.parentTaskId) {
    lines.push(`parentTaskId: ${task.parentTaskId}`);
  }

  if (task.subtasks && task.subtasks.length > 0) {
    lines.push(`subtasks: [${task.subtasks.join(", ")}]`);
  }

  if (task.branch) {
    lines.push(`branch: ${task.branch}`);
  }

  if (task.ordinal !== undefined) {
    lines.push(`ordinal: ${task.ordinal}`);
  }

  if (task.createdDate) {
    lines.push(`createdDate: ${task.createdDate}`);
  }

  if (task.updatedDate) {
    lines.push(`updatedDate: ${task.updatedDate}`);
  }

  lines.push("---");
  lines.push("");

  // Title
  lines.push(`# ${task.title}`);
  lines.push("");

  // Description/Body
  if (task.description) {
    lines.push(task.description);
    lines.push("");
  }

  // Acceptance Criteria
  if (task.acceptanceCriteriaItems && task.acceptanceCriteriaItems.length > 0) {
    lines.push("## Acceptance Criteria");
    lines.push("");
    for (const criterion of task.acceptanceCriteriaItems) {
      const checkbox = criterion.checked ? "[x]" : "[ ]";
      lines.push(`- ${checkbox} ${criterion.text}`);
    }
    lines.push("");
  }

  // Implementation Plan
  if (task.implementationPlan) {
    lines.push("## Implementation Plan");
    lines.push("");
    lines.push(task.implementationPlan);
    lines.push("");
  }

  // Implementation Notes
  if (task.implementationNotes) {
    lines.push("## Implementation Notes");
    lines.push("");
    lines.push(task.implementationNotes);
    lines.push("");
  }

  return lines.join("\n");
}

// --- Internal helpers ---

function parseMarkdownContent(content: string): {
  frontmatter: TaskFrontmatter;
  title: string;
  rawContent: string;
  description: string;
  acceptanceCriteria: AcceptanceCriterion[];
} {
  let frontmatter: TaskFrontmatter = {};
  let remaining = content;

  // Extract frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (frontmatterMatch) {
    frontmatter = parseFrontmatter(frontmatterMatch[1]);
    remaining = content.slice(frontmatterMatch[0].length);
  }

  // Extract title (first h1)
  let title = "";
  const titleMatch = remaining.match(/^#\s+(.+)$/m);
  if (titleMatch) {
    title = titleMatch[1].trim();
  }

  // Extract acceptance criteria
  const acceptanceCriteria = parseAcceptanceCriteria(remaining);

  // Raw content is everything after frontmatter
  const rawContent = remaining.trim();

  // Description is the body text between title and first section
  const description = extractDescription(remaining, title);

  return { frontmatter, title, rawContent, description, acceptanceCriteria };
}

function parseFrontmatter(raw: string): TaskFrontmatter {
  const result: TaskFrontmatter = {};

  for (const line of raw.split("\n")) {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (!match) continue;

    const [, key, value] = match;

    switch (key) {
      case "status":
        result.status = value.trim();
        break;
      case "priority":
        result.priority = value.trim() as "high" | "medium" | "low";
        break;
      case "ordinal":
        result.ordinal = parseInt(value.trim(), 10);
        break;
      case "reporter":
      case "milestone":
      case "parentTaskId":
      case "branch":
      case "createdDate":
      case "updatedDate":
        result[key] = value.trim();
        break;
      case "assignee":
      case "labels":
      case "dependencies":
      case "subtasks":
        result[key] = parseArrayValue(value);
        break;
    }
  }

  return result;
}

function parseArrayValue(value: string): string[] {
  // Handle [item1, item2] or item1, item2
  const cleaned = value.replace(/^\[|\]$/g, "").trim();
  if (!cleaned) return [];
  return cleaned
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseAcceptanceCriteria(content: string): AcceptanceCriterion[] {
  const criteria: AcceptanceCriterion[] = [];

  // Look for AC section or just checkbox items
  const checkboxPattern = /^-\s*\[([ xX])\]\s*(.+)$/gm;
  const matches = content.matchAll(checkboxPattern);
  let index = 1; // 1-based index as per AcceptanceCriterion

  for (const match of matches) {
    criteria.push({
      index: index++,
      checked: match[1].toLowerCase() === "x",
      text: match[2].trim(),
    });
  }

  return criteria;
}

function extractDescription(content: string, title: string): string {
  let body = content;

  // Remove title line
  if (title) {
    body = body.replace(new RegExp(`^#\\s+${escapeRegex(title)}\\s*$`, "m"), "");
  }

  // Remove known sections
  body = body.replace(/^##\s+Acceptance Criteria[\s\S]*?(?=^##|$)/m, "");
  body = body.replace(/^##\s+Implementation Plan[\s\S]*?(?=^##|$)/m, "");
  body = body.replace(/^##\s+Implementation Notes[\s\S]*?(?=^##|$)/m, "");

  return body.trim();
}

function extractIdFromPath(filePath: string): string {
  // Extract from pattern: task-{id} - {title}.md or {id} - {title}.md
  const filename = filePath.split("/").pop() || "";
  const match = filename.match(/^(?:task-)?(\d+(?:\.\d+)?)\s*-/);
  if (match) {
    return match[1];
  }

  // Fallback: use filename without extension
  return filename.replace(/\.md$/, "");
}

/**
 * Extract title from filename
 * Pattern: "task-001 - My Task Title.md" -> "My Task Title"
 * Pattern: "001 - My Task Title.md" -> "My Task Title"
 * Fallback: filename without extension
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
 * Returns "tasks" or "completed" based on path
 */
function extractSourceFromPath(filePath: string): "tasks" | "completed" {
  if (filePath.includes("/completed/") || filePath.includes("\\completed\\")) {
    return "completed";
  }
  return "tasks";
}

/**
 * Extract task index entry from file path only (no file read required)
 *
 * @param filePath - Path to the task file
 * @returns TaskIndexEntry with id, title, filePath, and source
 */
export function extractTaskIndexFromPath(filePath: string): TaskIndexEntry {
  return {
    id: extractIdFromPath(filePath),
    filePath,
    title: extractTitleFromPath(filePath),
    source: extractSourceFromPath(filePath),
  };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ============================================================================
// Milestone Parsing & Serialization
// ============================================================================

/**
 * Parsed frontmatter from a milestone markdown file
 */
export interface MilestoneFrontmatter {
  id?: string;
  title?: string;
  tasks?: string[];
}

/**
 * Extract a section from markdown content by heading
 */
function extractSection(content: string, sectionTitle: string): string | undefined {
  // Normalize to LF for reliable matching across platforms
  const src = content.replace(/\r\n/g, "\n");
  const regex = new RegExp(`## ${sectionTitle}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`, "i");
  const match = src.match(regex);
  return match?.[1]?.trim();
}

/**
 * Parse milestone frontmatter from raw YAML
 */
function parseMilestoneFrontmatter(raw: string): MilestoneFrontmatter {
  const result: MilestoneFrontmatter = {};

  for (const line of raw.split("\n")) {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (!match) continue;

    const [, key, value] = match;
    let cleanValue = value.trim();

    // Remove surrounding quotes if present
    if (
      (cleanValue.startsWith('"') && cleanValue.endsWith('"')) ||
      (cleanValue.startsWith("'") && cleanValue.endsWith("'"))
    ) {
      cleanValue = cleanValue.slice(1, -1);
    }

    switch (key) {
      case "id":
      case "title":
        result[key] = cleanValue;
        break;
      case "tasks":
        // Parse [id1, id2, id3] format
        if (cleanValue.startsWith("[") && cleanValue.endsWith("]")) {
          result.tasks = cleanValue
            .slice(1, -1)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        }
        break;
    }
  }

  return result;
}

/**
 * Parse milestone markdown content into a Milestone object
 *
 * @param content - Raw markdown content
 * @returns Parsed milestone object
 */
export function parseMilestoneMarkdown(content: string): Milestone {
  let frontmatter: MilestoneFrontmatter = {};
  let remaining = content;

  // Extract frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (frontmatterMatch) {
    frontmatter = parseMilestoneFrontmatter(frontmatterMatch[1]);
    remaining = content.slice(frontmatterMatch[0].length);
  }

  const rawContent = remaining.trim();
  const description = extractSection(rawContent, "Description") || "";

  return {
    id: frontmatter.id || "",
    title: frontmatter.title || "",
    description,
    rawContent,
    tasks: frontmatter.tasks || [],
  };
}

/**
 * Serialize a Milestone object to markdown content
 *
 * @param milestone - Milestone to serialize
 * @returns Markdown string
 */
export function serializeMilestoneMarkdown(milestone: Milestone): string {
  const lines: string[] = [];

  // Frontmatter
  lines.push("---");
  lines.push(`id: ${milestone.id}`);
  // Escape quotes in title
  const escapedTitle = milestone.title.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  lines.push(`title: "${escapedTitle}"`);
  // Tasks array
  lines.push(`tasks: [${milestone.tasks.join(", ")}]`);
  lines.push("---");
  lines.push("");

  // Description section
  lines.push("## Description");
  lines.push("");
  lines.push(milestone.description || `Milestone: ${milestone.title}`);
  lines.push("");

  return lines.join("\n");
}

/**
 * Generate a safe filename for a milestone
 *
 * @param id - Milestone ID (e.g., "m-0")
 * @param title - Milestone title
 * @returns Safe filename (e.g., "m-0 - release-1.0.md")
 */
export function getMilestoneFilename(id: string, title: string): string {
  const safeTitle = title
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 50);
  return `${id} - ${safeTitle}.md`;
}

/**
 * Extract milestone ID from filename
 *
 * @param filename - Filename (e.g., "m-0 - release-1.0.md")
 * @returns Milestone ID or null if not a valid milestone file
 */
export function extractMilestoneIdFromFilename(filename: string): string | null {
  const match = filename.match(/^(m-\d+)/);
  return match ? match[1] : null;
}

/**
 * Options for getTaskBodyMarkdown
 */
export interface TaskBodyMarkdownOptions {
  /** Include the h1 title in the output (default: false) */
  includeTitle?: boolean;
}

/**
 * Extract the markdown body from a Task object for rendering in a viewer.
 *
 * This returns the markdown content without frontmatter, suitable for
 * passing to a markdown renderer like DocumentView.
 *
 * @param task - Task object with rawContent or parsed fields
 * @param options - Options for body extraction
 * @returns Markdown string for the body content
 */
export function getTaskBodyMarkdown(task: Task, options: TaskBodyMarkdownOptions = {}): string {
  const { includeTitle = false } = options;

  // If we have rawContent, use it (stripping title if needed)
  if (task.rawContent) {
    let body = task.rawContent;

    if (!includeTitle && task.title) {
      // Remove the h1 title line
      body = body.replace(new RegExp(`^#\\s+${escapeRegex(task.title)}\\s*\\n?`, "m"), "");
    }

    return body.trim();
  }

  // Reconstruct from parsed fields if no rawContent
  const sections: string[] = [];

  if (includeTitle && task.title) {
    sections.push(`# ${task.title}`);
    sections.push("");
  }

  if (task.description) {
    sections.push(task.description);
    sections.push("");
  }

  if (task.acceptanceCriteriaItems && task.acceptanceCriteriaItems.length > 0) {
    sections.push("## Acceptance Criteria");
    sections.push("");
    for (const criterion of task.acceptanceCriteriaItems) {
      const checkbox = criterion.checked ? "[x]" : "[ ]";
      sections.push(`- ${checkbox} ${criterion.text}`);
    }
    sections.push("");
  }

  if (task.implementationPlan) {
    sections.push("## Implementation Plan");
    sections.push("");
    sections.push(task.implementationPlan);
    sections.push("");
  }

  if (task.implementationNotes) {
    sections.push("## Implementation Notes");
    sections.push("");
    sections.push(task.implementationNotes);
    sections.push("");
  }

  return sections.join("\n").trim();
}
