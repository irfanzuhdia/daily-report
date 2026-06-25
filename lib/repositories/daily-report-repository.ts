import { sql } from '../db';
import type { DailyReport, User, Task } from '../types';
import { unstable_cache, revalidateTag, calcProjectStatus, STATUS } from './shared';
import { UserRepository, getUserLevel } from './user-repository';
import { RoleLevelRepository } from './role-level-repository';
import { isSupervised } from './project-repository';

// ============ CACHING HELPERS ============

const getCachedReports = unstable_cache(
  async (): Promise<DailyReport[]> => {
    const rows = await sql`SELECT * FROM daily_reports WHERE deleted_at IS NULL`;
    return rows as unknown as DailyReport[];
  },
  ['reports-all'],
  { tags: ['reports'], revalidate: 60 }
);

const getCachedReportById = unstable_cache(
  async (reportId: string): Promise<DailyReport | null> => {
    const rows = await sql`SELECT * FROM daily_reports WHERE report_id = ${reportId} AND deleted_at IS NULL LIMIT 1`;
    return (rows[0] as unknown as DailyReport) || null;
  },
  ['report-by-id'],
  { tags: ['reports'], revalidate: 60 }
);

const getCachedReportsByTaskId = unstable_cache(
  async (taskId: string): Promise<DailyReport[]> => {
    const rows = await sql`SELECT * FROM daily_reports WHERE task_id = ${taskId} AND deleted_at IS NULL`;
    return rows as unknown as DailyReport[];
  },
  ['reports-by-task-id'],
  { tags: ['reports'], revalidate: 60 }
);

const getCachedReportsByUserId = unstable_cache(
  async (userId: string): Promise<DailyReport[]> => {
    const rows = await sql`SELECT * FROM daily_reports WHERE user_id = ${userId} AND deleted_at IS NULL`;
    return rows as unknown as DailyReport[];
  },
  ['reports-by-user-id'],
  { tags: ['reports'], revalidate: 60 }
);

const getCachedReportsByDate = unstable_cache(
  async (date: string): Promise<DailyReport[]> => {
    const rows = await sql`SELECT * FROM daily_reports WHERE date = ${date} AND deleted_at IS NULL`;
    return rows as unknown as DailyReport[];
  },
  ['reports-by-date'],
  { tags: ['reports'], revalidate: 60 }
);

const getCachedAllReportsIncludingDeleted = unstable_cache(
  async (): Promise<DailyReport[]> => {
    const rows = await sql`SELECT * FROM daily_reports`;
    return rows as unknown as DailyReport[];
  },
  ['reports-all-incl-deleted'],
  { tags: ['reports'], revalidate: 60 }
);

// ============ DAILY REPORT REPOSITORY ============

export const DailyReportRepository = {
  async findAll(): Promise<DailyReport[]> {
    return getCachedReports();
  },

  async findById(reportId: string): Promise<DailyReport | null> {
    return getCachedReportById(reportId);
  },

  async findByTaskId(taskId: string): Promise<DailyReport[]> {
    return getCachedReportsByTaskId(taskId);
  },

  async findByUserId(userId: string): Promise<DailyReport[]> {
    return getCachedReportsByUserId(userId);
  },

  async findByDate(date: string): Promise<DailyReport[]> {
    return getCachedReportsByDate(date);
  },

  async create(
    report: {
      task_id: string;
      date: string;
      progress_percentage: string;
      total_hours?: string;
      remarks?: string;
      user_id: string;
    },
    createdBy: string
  ): Promise<DailyReport> {
    const res = await sql`SELECT COALESCE(MAX(NULLIF(regexp_replace(report_id, '\\D', '', 'g'), '')::int), 0) as max_val FROM daily_reports`;
    const nextId = 'R-' + String((res[0].max_val || 0) + 1).padStart(4, '0');
    const now = new Date().toISOString();

    const newReport: DailyReport = {
      report_id: nextId,
      task_id: report.task_id,
      date: report.date,
      progress_percentage: report.progress_percentage,
      total_hours: report.total_hours ?? null,
      remarks: report.remarks ?? null,
      user_id: report.user_id,
      created_by: createdBy,
      created_at: now,
      deleted_by: null,
      deleted_at: null,
    };

    await sql`
      INSERT INTO daily_reports (
        report_id, task_id, date, progress_percentage, total_hours, remarks, user_id,
        created_by, created_at, deleted_by, deleted_at
      ) VALUES (
        ${newReport.report_id}, ${newReport.task_id}, ${newReport.date}, ${newReport.progress_percentage},
        ${newReport.total_hours}, ${newReport.remarks}, ${newReport.user_id},
        ${newReport.created_by}, ${newReport.created_at}, ${newReport.deleted_by}, ${newReport.deleted_at}
      )
    `;

    // Log report submission (decoupled direct SQL insertion into task_logs)
    const logRes = await sql`SELECT COALESCE(MAX(NULLIF(split_part(id, '-', 2), '')::int), 0) as max_val FROM task_logs`;
    const nextLogId = 'tl-' + String((logRes[0].max_val || 0) + 1).padStart(3, '0') + '-' + Math.random().toString(36).substring(2, 7);
    await sql`
      INSERT INTO task_logs (
        id, task_id, task_status_old, task_status_new, created_by, created_at
      ) VALUES (
        ${nextLogId}, ${report.task_id}, 'REPORT_SUBMIT', ${report.progress_percentage},
        ${createdBy}, ${now}
      )
    `;
    revalidateTag('task_log');

    // Auto-update task progress and status from latest report
    await DailyReportRepository._syncTaskFromLatestReport(report.task_id, createdBy);

    revalidateTag('reports');
    revalidateTag('tasks');
    revalidateTag('projects');
    return newReport;
  },

  async update(
    reportId: string,
    updates: Partial<Pick<DailyReport, 'task_id' | 'date' | 'progress_percentage' | 'total_hours' | 'remarks'>>,
    updatedBy: string
  ): Promise<DailyReport | null> {
    const existing = await DailyReportRepository.findById(reportId);
    if (!existing) return null;

    const updated = {
      ...existing,
      ...updates,
    };

    await sql`
      UPDATE daily_reports SET
        task_id = ${updated.task_id},
        date = ${updated.date},
        progress_percentage = ${updated.progress_percentage},
        total_hours = ${updated.total_hours},
        remarks = ${updated.remarks}
      WHERE report_id = ${reportId}
    `;

    // Auto-update task progress and status
    if (existing.task_id) {
      await DailyReportRepository._syncTaskFromLatestReport(existing.task_id, updatedBy);
    }
    if (updated.task_id && updated.task_id !== existing.task_id) {
      await DailyReportRepository._syncTaskFromLatestReport(updated.task_id, updatedBy);
    }

    revalidateTag('reports');
    revalidateTag('tasks');
    revalidateTag('projects');
    return updated;
  },

  async softDelete(reportId: string, deletedBy: string): Promise<boolean> {
    const existing = await DailyReportRepository.findById(reportId);
    if (!existing) return false;

    const now = new Date().toISOString();

    await sql`
      UPDATE daily_reports SET
        deleted_by = ${deletedBy},
        deleted_at = ${now}
      WHERE report_id = ${reportId}
    `;

    // Auto-update task progress and status
    if (existing.task_id) {
      await DailyReportRepository._syncTaskFromLatestReport(existing.task_id, deletedBy);
    }

    revalidateTag('reports');
    revalidateTag('tasks');
    revalidateTag('projects');
    return true;
  },

  /**
   * Sync task progress and status from its latest report.
   */
  async _syncTaskFromLatestReport(taskId: string, updatedBy: string): Promise<void> {
    const taskReports = await DailyReportRepository.findByTaskId(taskId);
    
    let progress = 0;
    let autoStatus: string = STATUS.NOT_STARTED;

    if (taskReports.length > 0) {
      const latest = taskReports.reduce((max, r) => {
        if (!r.date) return max;
        if (!max.date) return r;
        return r.date > max.date ? r : max;
      }, taskReports[0]);

      progress = parseFloat(latest.progress_percentage ?? '0') || 0;

      if (progress >= 100) autoStatus = STATUS.DONE;
      else if (progress > 0) autoStatus = STATUS.ON_PROGRESS;
    }

    await sql`
      UPDATE tasks SET
        task_latest_percentage = ${String(progress)},
        task_status = ${autoStatus},
        updated_by = ${updatedBy},
        updated_at = ${new Date().toISOString()}
      WHERE id = ${taskId}
    `;

    const taskRows = await sql`SELECT * FROM tasks WHERE id = ${taskId} LIMIT 1`;
    const task = taskRows[0] as unknown as Task;
    if (task?.project_id) {
      // Direct SQL query to decouple from TaskRepository and prevent circular dependency
      const allTasks = (await sql`SELECT * FROM tasks WHERE project_id = ${task.project_id} AND deleted_at IS NULL`) as unknown as Task[];
      const newProjStatus = calcProjectStatus(task.project_id, allTasks);
      await sql`
        UPDATE projects SET
          project_status = ${newProjStatus},
          updated_by = ${updatedBy},
          updated_at = ${new Date().toISOString()}
        WHERE project_id = ${task.project_id}
      `;
      revalidateTag('projects');
      revalidateTag('project_log');
    }
  },
};

// ============ ANALYTICS HELPERS ============

const getCachedTaskTotalHours = unstable_cache(
  async (taskId: string): Promise<number> => {
    const reports = await DailyReportRepository.findByTaskId(taskId);
    return reports.reduce((sum, r) => {
      const h = parseFloat(r.total_hours ?? '0');
      return sum + (isNaN(h) ? 0 : h);
    }, 0);
  },
  ['task-total-hours'],
  { tags: ['reports'], revalidate: 60 }
);

export async function getTaskTotalHours(taskId: string): Promise<number> {
  return getCachedTaskTotalHours(taskId);
}

const getCachedProjectTotalHours = unstable_cache(
  async (projectId: string): Promise<number> => {
    const rows = await sql`
      SELECT COALESCE(SUM(r.total_hours::numeric), 0)::float as total
      FROM daily_reports r
      JOIN tasks t ON r.task_id = t.id
      WHERE t.project_id = ${projectId}
        AND r.deleted_at IS NULL
        AND t.deleted_at IS NULL
    `;
    return rows[0]?.total || 0;
  },
  ['project-total-hours'],
  { tags: ['reports', 'tasks'] }
);

export async function getProjectTotalHours(projectId: string): Promise<number> {
  return getCachedProjectTotalHours(projectId);
}

const getCachedContributionData = unstable_cache(
  async (optionsSerialized: string): Promise<Record<string, number>> => {
    const options = JSON.parse(optionsSerialized) as {
      userId?: string;
      projectId?: string;
      taskId?: string;
      startDate?: string;
      endDate?: string;
    };

    const userId = options?.userId || null;
    const projectId = options?.projectId || null;
    const taskId = options?.taskId || null;
    const startDate = options?.startDate || null;
    const endDate = options?.endDate || null;

    const rows = await sql`
      SELECT r.date, COALESCE(SUM(r.total_hours::numeric), 0)::float as hours
      FROM daily_reports r
      LEFT JOIN tasks t ON r.task_id = t.id
      WHERE r.deleted_at IS NULL
        AND (${userId}::text IS NULL OR r.user_id = ${userId})
        AND (${projectId}::text IS NULL OR t.project_id = ${projectId})
        AND (${taskId}::text IS NULL OR r.task_id = ${taskId})
        AND (${startDate}::text IS NULL OR r.date >= ${startDate})
        AND (${endDate}::text IS NULL OR r.date <= ${endDate})
      GROUP BY r.date
    `;

    const data: Record<string, number> = {};
    for (const row of rows) {
      if (row.date) {
        data[row.date] = row.hours;
      }
    }
    return data;
  },
  ['contribution-data'],
  { tags: ['reports', 'tasks'] }
);

export async function getContributionData(options?: {
  userId?: string;
  projectId?: string;
  taskId?: string;
  startDate?: string;
  endDate?: string;
}): Promise<Record<string, number>> {
  return getCachedContributionData(JSON.stringify(options ?? {}));
}

const getCachedCategoryContribution = unstable_cache(
  async (optionsSerialized: string): Promise<{ category: string | null; hours: number }[]> => {
    const options = JSON.parse(optionsSerialized) as {
      userId?: string;
      projectId?: string;
      startDate?: string;
      endDate?: string;
    };

    const userId = options?.userId || null;
    const projectId = options?.projectId || null;
    const startDate = options?.startDate || null;
    const endDate = options?.endDate || null;

    const rows = await sql`
      SELECT p.category, COALESCE(SUM(r.total_hours::numeric), 0)::float as hours
      FROM daily_reports r
      JOIN tasks t ON r.task_id = t.id
      JOIN projects p ON t.project_id = p.project_id
      WHERE r.deleted_at IS NULL
        AND t.deleted_at IS NULL
        AND p.deleted_at IS NULL
        AND (${userId}::text IS NULL OR r.user_id = ${userId})
        AND (${projectId}::text IS NULL OR t.project_id = ${projectId})
        AND (${startDate}::text IS NULL OR r.date >= ${startDate})
        AND (${endDate}::text IS NULL OR r.date <= ${endDate})
      GROUP BY p.category
    `;

    return rows.map((r) => ({
      category: r.category as string | null,
      hours: r.hours as number,
    }));
  },
  ['category-contribution-data'],
  { tags: ['reports', 'tasks', 'projects'] }
);

export async function getCategoryContributionData(options?: {
  userId?: string;
  projectId?: string;
  startDate?: string;
  endDate?: string;
}): Promise<{ category: string | null; hours: number }[]> {
  return getCachedCategoryContribution(JSON.stringify(options ?? {}));
}

const getCachedContributionSummary = unstable_cache(
  async (optionsSerialized: string) => {
    const options = JSON.parse(optionsSerialized) as {
      userId?: string;
      projectId?: string;
      taskId?: string;
      startDate?: string;
      endDate?: string;
    };
    const data = await getContributionData(options);
    const entries = Object.entries(data);
    const totalHours = entries.reduce((sum, [, h]) => sum + h, 0);
    const totalReports = entries.length;
    const avgHoursPerDay = totalReports > 0 ? totalHours / totalReports : 0;

    let mostActiveUser = '—';
    let mostActiveUserHours = 0;
    if (!options?.userId) {
      const activeUserRows = await sql`
        SELECT user_id, COALESCE(SUM(total_hours::numeric), 0)::float as hours
        FROM daily_reports
        WHERE deleted_at IS NULL
        GROUP BY user_id
        ORDER BY hours DESC
        LIMIT 1
      `;
      if (activeUserRows.length > 0) {
        mostActiveUser = activeUserRows[0].user_id;
        mostActiveUserHours = activeUserRows[0].hours;
      }
    } else {
      mostActiveUser = options.userId;
      mostActiveUserHours = totalHours;
    }

    let mostActiveProject = '—';
    let mostActiveProjectHours = 0;
    if (!options?.projectId) {
      const activeProjRows = await sql`
        SELECT p.project_name, p.project_id, COALESCE(SUM(r.total_hours::numeric), 0)::float as hours
        FROM daily_reports r
        JOIN tasks t ON r.task_id = t.id
        JOIN projects p ON t.project_id = p.project_id
        WHERE r.deleted_at IS NULL AND t.deleted_at IS NULL AND p.deleted_at IS NULL
        GROUP BY p.project_id, p.project_name
        ORDER BY hours DESC
        LIMIT 1
      `;
      if (activeProjRows.length > 0) {
        mostActiveProject = activeProjRows[0].project_name || activeProjRows[0].project_id;
        mostActiveProjectHours = activeProjRows[0].hours;
      }
    } else {
      const proj = (await sql`SELECT project_name FROM projects WHERE project_id = ${options.projectId} AND deleted_at IS NULL LIMIT 1`) as any[];
      mostActiveProject = proj.length > 0 ? proj[0].project_name || options.projectId : options.projectId;
      mostActiveProjectHours = totalHours;
    }

    return {
      totalHours,
      totalReports,
      avgHoursPerDay: Math.round(avgHoursPerDay * 10) / 10,
      mostActiveUser,
      mostActiveUserHours: Math.round(mostActiveUserHours * 10) / 10,
      mostActiveProject,
      mostActiveProjectHours: Math.round(mostActiveProjectHours * 10) / 10,
    };
  },
  ['contribution-summary'],
  { tags: ['reports', 'tasks', 'projects'] }
);

export async function getContributionSummary(options?: {
  userId?: string;
  projectId?: string;
  taskId?: string;
  startDate?: string;
  endDate?: string;
}) {
  return getCachedContributionSummary(JSON.stringify(options ?? {}));
}

// ============ USER-SCOPED FILTERING HELPERS ============

export async function filterReportsByUser(
  reports: DailyReport[],
  userId: string
): Promise<DailyReport[]> {
  if (!userId) return reports;
  const user = await UserRepository.findById(userId);
  if (!user) return [];

  const level = await getUserLevel(user.user_occupation);
  if (level >= 6) return reports;

  const allUsers = await UserRepository.findAll();
  const userMap = new Map(allUsers.map((u) => [u.user_id, u]));

  const roles = await RoleLevelRepository.findAll();
  const roleLevelMap = new Map<string, number>();
  for (const r of roles) {
    roleLevelMap.set(r.role_name.toLowerCase(), r.level);
  }

  return reports.filter((r) => {
    if (r.user_id === userId || r.created_by === userId) return true;

    // Check if creator/reporter is supervised
    if (r.user_id) {
      const creatorUser = userMap.get(r.user_id);
      if (creatorUser && isSupervised(user, level, creatorUser, roleLevelMap)) return true;
    }
    if (r.created_by && r.created_by !== r.user_id) {
      const creatorUser = userMap.get(r.created_by);
      if (creatorUser && isSupervised(user, level, creatorUser, roleLevelMap)) return true;
    }

    return false;
  });
}

export async function findAllReportsIncludingDeleted(): Promise<DailyReport[]> {
  return getCachedAllReportsIncludingDeleted();
}

/** Restore a soft-deleted report */
export async function restoreReport(reportId: string): Promise<boolean> {
  await sql`
    UPDATE daily_reports SET
      deleted_by = NULL,
      deleted_at = NULL
    WHERE report_id = ${reportId}
  `;

  revalidateTag('reports');
  revalidateTag('tasks');
  revalidateTag('projects');
  return true;
}
