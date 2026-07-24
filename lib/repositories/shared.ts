import { sql } from '../db';
import type { Task } from '../types';
import { unstable_cache as nextUnstableCache, revalidateTag as nextRevalidateTag } from 'next/cache';

/* eslint-disable @typescript-eslint/no-explicit-any */
// Custom wrapper to selectively disable caching for projects, tasks, reports, etc.
export function unstable_cache<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  keyParts?: string[],
  options?: {
    revalidate?: number | false;
    tags?: string[];
  }
): T {
  // Only cache users-related data
  if (options?.tags?.includes('users') || keyParts?.some(k => k.includes('user'))) {
    return nextUnstableCache(fn, keyParts, options);
  }
  // Otherwise, return a pass-through function (completely bypass cache)
  return (async (...args: any[]) => fn(...args)) as unknown as T;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function revalidateTag(tag: string) {
  try {
    nextRevalidateTag(tag, 'max');
  } catch {
    // Ignore when called outside Next.js request context
  }
}

// ============ STATUS & PROGRESS CALCULATION HELPERS ============

export const STATUS = {
  NOT_STARTED: 'NS',
  ON_PROGRESS: 'OP',
  DONE: 'D',
  HOLD: 'H',
  CANCEL: 'CC',
} as const;

/**
 * Auto-calculate project status from its tasks' statuses.
 */
export function calcProjectStatus(
  projectId: string,
  tasks: Task[]
): string {
  const projectTasks = tasks.filter((t) => t.project_id === projectId);
  if (projectTasks.length === 0) return STATUS.NOT_STARTED;

  const taskStatuses = projectTasks.map((task) => task.task_status ?? STATUS.NOT_STARTED);

  if (taskStatuses.some((s) => s === STATUS.ON_PROGRESS)) return STATUS.ON_PROGRESS;

  const allDoneOrCancel = taskStatuses.every((s) => s === STATUS.DONE || s === STATUS.CANCEL);
  const hasDone = taskStatuses.some((s) => s === STATUS.DONE);
  if (allDoneOrCancel && hasDone) return STATUS.DONE;

  if (taskStatuses.every((s) => s === STATUS.CANCEL)) return STATUS.CANCEL;

  if (taskStatuses.every((s) => s === STATUS.HOLD)) return STATUS.HOLD;

  if (taskStatuses.every((s) => s === STATUS.NOT_STARTED)) return STATUS.NOT_STARTED;

  return STATUS.ON_PROGRESS;
}
