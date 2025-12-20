/**
 * Backlog.md Config Parser
 *
 * Parses config.yml using a line-by-line approach matching the official Backlog.md
 * implementation. This is more reliable than a generic YAML parser for this format.
 */

import type { BacklogConfig } from "../types";

const DEFAULT_STATUSES = ["To Do", "In Progress", "Done"];

/**
 * Parse Backlog.md config.yml content
 */
export function parseBacklogConfig(content: string): BacklogConfig {
  const config: Partial<BacklogConfig> = {};
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const colonIndex = trimmed.indexOf(":");
    if (colonIndex === -1) continue;

    const key = trimmed.substring(0, colonIndex).trim();
    const value = trimmed.substring(colonIndex + 1).trim();

    switch (key) {
      case "project_name":
        config.projectName = value.replace(/['"]/g, "");
        break;
      case "default_assignee":
        config.defaultAssignee = value.replace(/['"]/g, "");
        break;
      case "default_reporter":
        config.defaultReporter = value.replace(/['"]/g, "");
        break;
      case "default_status":
        config.defaultStatus = value.replace(/['"]/g, "");
        break;
      case "statuses":
      case "labels":
      case "milestones":
        if (value.startsWith("[") && value.endsWith("]")) {
          const arrayContent = value.slice(1, -1);
          config[key] = arrayContent
            .split(",")
            .map((item) => item.trim().replace(/['"]/g, ""))
            .filter(Boolean);
        }
        break;
      case "date_format":
        config.dateFormat = value.replace(/['"]/g, "");
        break;
      case "max_column_width":
        config.maxColumnWidth = parseInt(value, 10);
        break;
      case "task_resolution_strategy":
        config.taskResolutionStrategy = value.replace(/['"]/g, "") as
          | "most_recent"
          | "most_progressed";
        break;
      case "default_editor":
        config.defaultEditor = value.replace(/["']/g, "");
        break;
      case "auto_open_browser":
        config.autoOpenBrowser = value.toLowerCase() === "true";
        break;
      case "default_port":
        config.defaultPort = parseInt(value, 10);
        break;
      case "remote_operations":
        config.remoteOperations = value.toLowerCase() === "true";
        break;
      case "auto_commit":
        config.autoCommit = value.toLowerCase() === "true";
        break;
      case "zero_padded_ids":
        config.zeroPaddedIds = parseInt(value, 10);
        break;
      case "timezone_preference":
        config.timezonePreference = value.replace(/['"]/g, "");
        break;
      case "include_date_time_in_dates":
        config.includeDateTimeInDates = value.toLowerCase() === "true";
        break;
      case "bypass_git_hooks":
        config.bypassGitHooks = value.toLowerCase() === "true";
        break;
      case "check_active_branches":
        config.checkActiveBranches = value.toLowerCase() === "true";
        break;
      case "active_branch_days":
        config.activeBranchDays = parseInt(value, 10);
        break;
    }
  }

  // Apply defaults
  return {
    projectName: config.projectName || "Backlog",
    statuses: config.statuses || [...DEFAULT_STATUSES],
    labels: config.labels || [],
    milestones: config.milestones || [],
    defaultStatus: config.defaultStatus || DEFAULT_STATUSES[0],
    dateFormat: config.dateFormat || "YYYY-MM-DD",
    defaultAssignee: config.defaultAssignee,
    defaultReporter: config.defaultReporter,
    maxColumnWidth: config.maxColumnWidth,
    taskResolutionStrategy: config.taskResolutionStrategy,
    defaultEditor: config.defaultEditor,
    autoOpenBrowser: config.autoOpenBrowser,
    defaultPort: config.defaultPort,
    remoteOperations: config.remoteOperations,
    autoCommit: config.autoCommit,
    zeroPaddedIds: config.zeroPaddedIds,
    timezonePreference: config.timezonePreference,
    includeDateTimeInDates: config.includeDateTimeInDates,
    bypassGitHooks: config.bypassGitHooks,
    checkActiveBranches: config.checkActiveBranches,
    activeBranchDays: config.activeBranchDays,
  };
}

/**
 * Serialize BacklogConfig to config.yml format
 */
export function serializeBacklogConfig(config: BacklogConfig): string {
  const lines: string[] = [];

  lines.push(`project_name: "${config.projectName}"`);

  if (config.defaultStatus) {
    lines.push(`default_status: "${config.defaultStatus}"`);
  }

  lines.push(`statuses: [${config.statuses.map((s) => `"${s}"`).join(", ")}]`);
  lines.push(`labels: [${(config.labels || []).map((l) => `"${l}"`).join(", ")}]`);
  lines.push(`milestones: [${(config.milestones || []).map((m) => `"${m}"`).join(", ")}]`);

  if (config.dateFormat) {
    lines.push(`date_format: "${config.dateFormat}"`);
  }

  if (config.defaultAssignee) {
    lines.push(`default_assignee: "${config.defaultAssignee}"`);
  }

  if (config.defaultReporter) {
    lines.push(`default_reporter: "${config.defaultReporter}"`);
  }

  if (config.defaultEditor) {
    lines.push(`default_editor: "${config.defaultEditor}"`);
  }

  if (typeof config.autoCommit === "boolean") {
    lines.push(`auto_commit: ${config.autoCommit}`);
  }

  if (typeof config.zeroPaddedIds === "number") {
    lines.push(`zero_padded_ids: ${config.zeroPaddedIds}`);
  }

  if (typeof config.autoOpenBrowser === "boolean") {
    lines.push(`auto_open_browser: ${config.autoOpenBrowser}`);
  }

  if (typeof config.defaultPort === "number") {
    lines.push(`default_port: ${config.defaultPort}`);
  }

  if (typeof config.remoteOperations === "boolean") {
    lines.push(`remote_operations: ${config.remoteOperations}`);
  }

  if (typeof config.bypassGitHooks === "boolean") {
    lines.push(`bypass_git_hooks: ${config.bypassGitHooks}`);
  }

  if (typeof config.checkActiveBranches === "boolean") {
    lines.push(`check_active_branches: ${config.checkActiveBranches}`);
  }

  if (typeof config.activeBranchDays === "number") {
    lines.push(`active_branch_days: ${config.activeBranchDays}`);
  }

  return `${lines.join("\n")}\n`;
}
