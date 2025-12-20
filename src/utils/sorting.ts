/**
 * Task sorting utilities
 */

import type { Task } from "../types";

const PRIORITY_ORDER: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

/**
 * Sort tasks by: ordinal → priority → createdDate
 *
 * - Tasks with ordinal are sorted first by ordinal
 * - Then by priority (high → medium → low)
 * - Finally by createdDate (newest first)
 */
export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    // 1. Ordinal (if both have it)
    if (a.ordinal !== undefined && b.ordinal !== undefined) {
      return a.ordinal - b.ordinal;
    }
    // Tasks with ordinal come before tasks without
    if (a.ordinal !== undefined) return -1;
    if (b.ordinal !== undefined) return 1;

    // 2. Priority (high → medium → low → undefined)
    const aPri = a.priority ? PRIORITY_ORDER[a.priority] : 3;
    const bPri = b.priority ? PRIORITY_ORDER[b.priority] : 3;
    if (aPri !== bPri) return aPri - bPri;

    // 3. Created date (newest first)
    return b.createdDate.localeCompare(a.createdDate);
  });
}

/**
 * Group tasks by status
 *
 * @param tasks - Tasks to group
 * @param statuses - Ordered list of statuses (for column ordering)
 * @returns Map with status as key and sorted tasks as value
 */
export function groupTasksByStatus(
  tasks: Task[],
  statuses: string[]
): Map<string, Task[]> {
  const grouped = new Map<string, Task[]>();

  // Initialize with all configured statuses (preserves column order)
  for (const status of statuses) {
    grouped.set(status, []);
  }

  // Group tasks
  for (const task of tasks) {
    const list = grouped.get(task.status);
    if (list) {
      list.push(task);
    } else {
      // Task has a status not in the config - add it anyway
      grouped.set(task.status, [task]);
    }
  }

  // Sort tasks within each status
  for (const [status, statusTasks] of grouped) {
    grouped.set(status, sortTasks(statusTasks));
  }

  return grouped;
}
