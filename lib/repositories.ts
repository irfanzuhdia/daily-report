import {
  readSheet,
  appendRow,
  updateRow,
  findRowByColumn,
  getRowByColumn,
  getRowsByColumn,
  getHeaders,
} from './sheets';
import type {
  User,
  Project,
  ProjectTeam,
  Task,
  TaskTeam,
  DailyReport,
  Status,
  ProjectLog,
  TaskLog,
} from './types';

// ============ STATUS & PROGRESS CALCULATION HELPERS ============

/** Status codes from the spreadsheet */
const STATUS = {
  NOT_STARTED: 'NS',
  ON_PROGRESS: 'OP',
  DONE: 'D',
  HOLD: 'H',
  CANCEL: 'CC',
} as const;

/**
 * Calculate task progress from its latest report.
 * Returns progress_percentage from the report with the latest date.
 */
function calcTaskProgress(taskId: string, reports: DailyReport[]): number {
  const taskReports = reports.filter((r) => r.task_id === taskId);
  if (taskReports.length === 0) return 0;

  const latest = taskReports.reduce((max, r) => {
    if (!r.date) return max;
    if (!max.date) return r;
    return r.date > max.date ? r : max;
  }, taskReports[0]);

  return parseFloat(latest.progress_percentage ?? '0') || 0;
}

/**
 * Calculate project progress as average of all task progresses.
 */
function calcProjectProgress(
  projectId: string,
  tasks: Task[],
  reports: DailyReport[]
): number {
  const projectTasks = tasks.filter((t) => t.project_id === projectId);
  if (projectTasks.length === 0) return 0;

  const total = projectTasks.reduce((sum, task) => {
    return sum + calcTaskProgress(task.id, reports);
  }, 0);

  return Math.round(total / projectTasks.length);
}

/**
 * Auto-calculate project status from its tasks' statuses.
 */
function calcProjectStatus(
  projectId: string,
  tasks: Task[]
): string {
  const projectTasks = tasks.filter((t) => t.project_id === projectId);
  if (projectTasks.length === 0) return STATUS.NOT_STARTED;

  const taskStatuses = projectTasks.map((task) => task.task_status ?? STATUS.NOT_STARTED);

  // On Progress: if at least one task is On Progress
  if (taskStatuses.some((s) => s === STATUS.ON_PROGRESS)) return STATUS.ON_PROGRESS;

  // Done: all tasks are Done or Cancel, and at least one is Done
  const allDoneOrCancel = taskStatuses.every((s) => s === STATUS.DONE || s === STATUS.CANCEL);
  const hasDone = taskStatuses.some((s) => s === STATUS.DONE);
  if (allDoneOrCancel && hasDone) return STATUS.DONE;

  // Cancel: all tasks are Cancel
  if (taskStatuses.every((s) => s === STATUS.CANCEL)) return STATUS.CANCEL;

  // Hold: all tasks are Hold
  if (taskStatuses.every((s) => s === STATUS.HOLD)) return STATUS.HOLD;

  // Not Started: all tasks are Not Started
  if (taskStatuses.every((s) => s === STATUS.NOT_STARTED)) return STATUS.NOT_STARTED;

  // Mixed statuses — default to On Progress
  return STATUS.ON_PROGRESS;
}

/** Convert a domain object to a string array matching the given headers. */
function toValues(obj: Record<string, unknown>, headers: string[]): string[] {
  return headers.map((h) => {
    const v = obj[h];
    return v == null ? '' : String(v);
  });
}

function rowToUser(row: Record<string, string>): User {
  return {
    user_id: row.user_id ?? '',
    user_email: row.user_email ?? '',
    user_name: row.user_name ?? null,
    user_occupation: row.user_occupation ?? null,
    user_division: row.user_division ?? null,
    user_departement: row.user_departement ?? null,
    created_by: row.created_by ?? null,
    created_at: row.created_at ?? null,
    updated_by: row.updated_by ?? null,
    updated_at: row.updated_at ?? null,
    deleted_by: row.deleted_by ?? null,
    deleted_at: row.deleted_at ?? null,
  };
}

function rowToProject(row: Record<string, string>): Project {
  return {
    project_id: row.project_id ?? '',
    project_name: row.project_name ?? null,
    project_description: row.project_description ?? null,
    project_start_date_plan: row.project_start_date_plan ?? null,
    project_end_date_plan: row.project_end_date_plan ?? null,
    project_status: row.project_status ?? null,
    project_file: row.project_file ?? null,
    created_by: row.created_by ?? null,
    created_at: row.created_at ?? null,
    updated_by: row.updated_by ?? null,
    updated_at: row.updated_at ?? null,
    deleted_by: row.deleted_by ?? null,
    deleted_at: row.deleted_at ?? null,
  };
}

function rowToTask(row: Record<string, string>): Task {
  return {
    id: row.id ?? '',
    project_id: row.project_id ?? '',
    task_description: row.task_description ?? null,
    task_status: row.task_status ?? null,
    task_latest_percentage: row.task_latest_percentage ?? null,
    created_by: row.created_by ?? null,
    created_at: row.created_at ?? null,
    updated_by: row.updated_by ?? null,
    updated_at: row.updated_at ?? null,
    deleted_by: row.deleted_by ?? null,
    deleted_at: row.deleted_at ?? null,
  };
}

function rowToDailyReport(row: Record<string, string>): DailyReport {
  return {
    report_id: row.report_id ?? '',
    task_id: row.task_id ?? '',
    date: row.date ?? null,
    progress_percentage: row.progress_percentage ?? null,
    total_hours: row.total_hours ?? null,
    remarks: row.remarks ?? null,
    user_id: row.user_id ?? null,
    created_by: row.created_by ?? null,
    created_at: row.created_at ?? null,
    deleted_by: row.deleted_by ?? null,
    deleted_at: row.deleted_at ?? null,
  };
}

function rowToStatus(row: Record<string, string>): Status {
  return { id: row.id ?? '', name: row.name ?? '' };
}

function rowToProjectTeam(row: Record<string, string>): ProjectTeam {
  return {
    id: row.id ?? '',
    project_id: row.project_id ?? '',
    user_id: row.user_id ?? '',
    created_by: row.created_by ?? null,
    created_at: row.created_at ?? null,
    updated_by: row.updated_by ?? null,
    updated_at: row.updated_at ?? null,
    deleted_by: row.deleted_by ?? null,
    deleted_at: row.deleted_at ?? null,
  };
}

function rowToTaskTeam(row: Record<string, string>): TaskTeam {
  return {
    id: row.id ?? '',
    task_id: row.task_id ?? '',
    user_id: row.user_id ?? '',
    created_by: row.created_by ?? null,
    created_at: row.created_at ?? null,
    updated_by: row.updated_by ?? null,
    updated_at: row.updated_at ?? null,
    deleted_by: row.deleted_by ?? null,
    deleted_at: row.deleted_at ?? null,
  };
}

function rowToProjectLog(row: Record<string, string>): ProjectLog {
  return {
    id: row.id ?? '',
    project_id: row.project_id ?? '',
    project_status_old: row.project_status_old ?? null,
    project_status_new: row.project_status_new ?? null,
    created_by: row.created_by ?? null,
    created_at: row.created_at ?? null,
  };
}

function rowToTaskLog(row: Record<string, string>): TaskLog {
  return {
    id: row.id ?? '',
    task_id: row.task_id ?? '',
    task_status_old: row.task_status_old ?? null,
    task_status_new: row.task_status_new ?? null,
    created_by: row.created_by ?? null,
    created_at: row.created_at ?? null,
  };
}

// ============ USER REPOSITORY ============

export const UserRepository = {
  async findAll(): Promise<User[]> {
    const rows = await readSheet('user');
    return rows.map(rowToUser).filter((u) => !u.deleted_at);
  },

  async findByEmail(email: string): Promise<User | null> {
    const row = await getRowByColumn('user', 'user_email', email);
    if (!row) return null;
    const user = rowToUser(row);
    return user.deleted_at ? null : user;
  },

  async findById(userId: string): Promise<User | null> {
    const row = await getRowByColumn('user', 'user_id', userId);
    if (!row) return null;
    const user = rowToUser(row);
    return user.deleted_at ? null : user;
  },

  async create(
    user: Omit<User, 'user_id' | 'created_at'>,
    createdBy: string
  ): Promise<User> {
    const headers = await getHeaders('user');
    const now = new Date().toISOString();
    const existing = await readSheet('user');
    const userId = `u-${String(existing.length + 1).padStart(3, '0')}`;

    const newUser: User = {
      ...user,
      user_id: userId,
      created_by: createdBy,
      created_at: now,
    };

    await appendRow('user', toValues(newUser as unknown as Record<string, unknown>, headers));
    return newUser;
  },
};

// ============ PROJECT REPOSITORY ============

export const ProjectRepository = {
  async findAll(): Promise<Project[]> {
    const rows = await readSheet('project');
    return rows.map(rowToProject).filter((p) => !p.deleted_at);
  },

  async findById(projectId: string): Promise<Project | null> {
    const row = await getRowByColumn('project', 'project_id', projectId);
    if (!row) return null;
    const project = rowToProject(row);
    return project.deleted_at ? null : project;
  },

  async create(
    project: {
      project_name: string;
      project_description?: string;
      project_start_date_plan?: string;
      project_end_date_plan?: string;
      project_status?: string;
    },
    createdBy: string
  ): Promise<Project> {
    const headers = await getHeaders('project');
    const now = new Date().toISOString();
    const existing = await readSheet('project');
    const projectId = `p-${String(existing.length + 1).padStart(3, '0')}`;

    const newProject: Project = {
      project_id: projectId,
      project_name: project.project_name,
      project_description: project.project_description ?? null,
      project_start_date_plan: project.project_start_date_plan ?? null,
      project_end_date_plan: project.project_end_date_plan ?? null,
      project_status: STATUS.NOT_STARTED,
      project_file: null,
      created_by: createdBy,
      created_at: now,
      updated_by: null,
      updated_at: null,
      deleted_by: null,
      deleted_at: null,
    };

    await appendRow('project', toValues(newProject as unknown as Record<string, unknown>, headers));
    return newProject;
  },

  async update(
    projectId: string,
    updates: Partial<
      Pick<
        Project,
        | 'project_name'
        | 'project_description'
        | 'project_start_date_plan'
        | 'project_end_date_plan'
        | 'project_status'
        | 'project_file'
      >
    >,
    updatedBy: string
  ): Promise<Project | null> {
    const rowNum = await findRowByColumn('project', 'project_id', projectId);
    if (rowNum === -1) return null;

    const headers = await getHeaders('project');
    const existing = await getRowByColumn('project', 'project_id', projectId);
    if (!existing) return null;

    const now = new Date().toISOString();

    // Auto-calculate project status from tasks
    const allTasks = await TaskRepository.findAll();
    const autoStatus = calcProjectStatus(projectId, allTasks);

    const updated: Record<string, unknown> = {
      ...existing,
      ...updates,
      project_status: autoStatus,
      updated_by: updatedBy,
      updated_at: now,
    };
    await updateRow('project', rowNum, toValues(updated, headers));

    // Log status change
    if (existing.project_status !== autoStatus) {
      await ProjectLogRepository.create(
        {
          project_id: projectId,
          project_status_old: existing.project_status,
          project_status_new: autoStatus,
        },
        updatedBy
      );
    }

    return rowToProject(updated as Record<string, string>);
  },

  async softDelete(projectId: string, deletedBy: string): Promise<boolean> {
    const rowNum = await findRowByColumn('project', 'project_id', projectId);
    if (rowNum === -1) return false;

    const headers = await getHeaders('project');
    const existing = await getRowByColumn('project', 'project_id', projectId);
    if (!existing) return false;

    const now = new Date().toISOString();
    const updated: Record<string, unknown> = {
      ...existing,
      deleted_by: deletedBy,
      deleted_at: now,
    };
    await updateRow('project', rowNum, toValues(updated, headers));
    return true;
  },
};

// ============ PROJECT TEAM REPOSITORY ============

export const ProjectTeamRepository = {
  async findByProjectId(projectId: string): Promise<ProjectTeam[]> {
    const rows = await getRowsByColumn('project_team', 'project_id', projectId);
    return rows.map(rowToProjectTeam).filter((pt) => !pt.deleted_at);
  },

  async findByUserId(userId: string): Promise<ProjectTeam[]> {
    const rows = await getRowsByColumn('project_team', 'user_id', userId);
    return rows.map(rowToProjectTeam).filter((pt) => !pt.deleted_at);
  },

  async create(
    projectId: string,
    userId: string,
    createdBy: string
  ): Promise<ProjectTeam> {
    const headers = await getHeaders('project_team');
    const now = new Date().toISOString();
    const existing = await readSheet('project_team');
    const id = `pt-${String(existing.length + 1).padStart(3, '0')}`;

    const newPT: ProjectTeam = {
      id,
      project_id: projectId,
      user_id: userId,
      created_by: createdBy,
      created_at: now,
      updated_by: null,
      updated_at: null,
      deleted_by: null,
      deleted_at: null,
    };

    await appendRow('project_team', toValues(newPT as unknown as Record<string, unknown>, headers));
    return newPT;
  },

  async softDelete(id: string, deletedBy: string): Promise<boolean> {
    const rowNum = await findRowByColumn('project_team', 'id', id)
    if (rowNum === -1) return false
    const headers = await getHeaders('project_team')
    const existing = await getRowByColumn('project_team', 'id', id)
    if (!existing) return false
    const now = new Date().toISOString()
    const updated = { ...existing, deleted_by: deletedBy, deleted_at: now }
    await updateRow('project_team', rowNum, toValues(updated as unknown as Record<string, unknown>, headers))
    return true
  },
};

// ============ TASK REPOSITORY ============

export const TaskRepository = {
  async findAll(): Promise<Task[]> {
    const rows = await readSheet('task');
    return rows.map(rowToTask).filter((t) => !t.deleted_at);
  },

  async findByProjectId(projectId: string): Promise<Task[]> {
    const rows = await getRowsByColumn('task', 'project_id', projectId);
    return rows.map(rowToTask).filter((t) => !t.deleted_at);
  },

  async findById(taskId: string): Promise<Task | null> {
    const row = await getRowByColumn('task', 'id', taskId);
    if (!row) return null;
    const task = rowToTask(row);
    return task.deleted_at ? null : task;
  },

  async create(
    task: {
      project_id: string;
      task_description: string;
      task_status?: string;
      task_latest_percentage?: string;
    },
    createdBy: string
  ): Promise<Task> {
    const headers = await getHeaders('task');
    const now = new Date().toISOString();
    const existing = await readSheet('task');
    const id = `t-${String(existing.length + 1).padStart(3, '0')}`;

    const newTask: Task = {
      id,
      project_id: task.project_id,
      task_description: task.task_description,
      task_status: STATUS.NOT_STARTED,
      task_latest_percentage: '0',
      created_by: createdBy,
      created_at: now,
      updated_by: null,
      updated_at: null,
      deleted_by: null,
      deleted_at: null,
    };

    await appendRow('task', toValues(newTask as unknown as Record<string, unknown>, headers));

    // Auto-update parent project status after adding a task
    await TaskRepository._syncProjectStatus(task.project_id, createdBy);

    return newTask;
  },

  async update(
    taskId: string,
    updates: Partial<Pick<Task, 'task_description' | 'task_status' | 'task_latest_percentage'>>,
    updatedBy: string
  ): Promise<Task | null> {
    const rowNum = await findRowByColumn('task', 'id', taskId);
    if (rowNum === -1) return null;

    const headers = await getHeaders('task');
    const existing = await getRowByColumn('task', 'id', taskId);
    if (!existing) return null;

    const now = new Date().toISOString();
    const updated: Record<string, unknown> = {
      ...existing,
      ...updates,
      updated_by: updatedBy,
      updated_at: now,
    };
    await updateRow('task', rowNum, toValues(updated, headers));

    // Log status change
    if (updates.task_status && existing.task_status !== updates.task_status) {
      await TaskLogRepository.create(
        {
          task_id: taskId,
          task_status_old: existing.task_status,
          task_status_new: updates.task_status,
        },
        updatedBy
      );
    }

    // Auto-update parent project status after task change
    const projectId = existing.project_id;
    if (projectId) {
      await TaskRepository._syncProjectStatus(projectId, updatedBy);
    }

    return rowToTask(updated as Record<string, string>);
  },

  /**
   * Sync project status based on its tasks' statuses.
   * Called automatically when tasks change.
   */
  async _syncProjectStatus(projectId: string, updatedBy: string): Promise<void> {
    const allTasks = await TaskRepository.findAll();
    const autoStatus = calcProjectStatus(projectId, allTasks);

    const rowNum = await findRowByColumn('project', 'project_id', projectId);
    if (rowNum === -1) return;

    const headers = await getHeaders('project');
    const existing = await getRowByColumn('project', 'project_id', projectId);
    if (!existing) return;

    if (existing.project_status !== autoStatus) {
      const now = new Date().toISOString();
      const updated: Record<string, unknown> = {
        ...existing,
        project_status: autoStatus,
        updated_by: updatedBy,
        updated_at: now,
      };
      await updateRow('project', rowNum, toValues(updated, headers));

      await ProjectLogRepository.create(
        {
          project_id: projectId,
          project_status_old: existing.project_status,
          project_status_new: autoStatus,
        },
        updatedBy
      );
    }
  },

  async softDelete(taskId: string, deletedBy: string): Promise<boolean> {
    const rowNum = await findRowByColumn('task', 'id', taskId);
    if (rowNum === -1) return false;

    const headers = await getHeaders('task');
    const existing = await getRowByColumn('task', 'id', taskId);
    if (!existing) return false;

    const now = new Date().toISOString();
    const updated: Record<string, unknown> = {
      ...existing,
      deleted_by: deletedBy,
      deleted_at: now,
    };
    await updateRow('task', rowNum, toValues(updated, headers));
    return true;
  },
};

// ============ TASK TEAM REPOSITORY ============

export const TaskTeamRepository = {
  async findByTaskId(taskId: string): Promise<TaskTeam[]> {
    const rows = await getRowsByColumn('task_team', 'task_id', taskId);
    return rows.map(rowToTaskTeam).filter((tt) => !tt.deleted_at);
  },

  async findByUserId(userId: string): Promise<TaskTeam[]> {
    const rows = await getRowsByColumn('task_team', 'user_id', userId);
    return rows.map(rowToTaskTeam).filter((tt) => !tt.deleted_at);
  },

  async create(taskId: string, userId: string, createdBy: string): Promise<TaskTeam> {
    const headers = await getHeaders('task_team');
    const now = new Date().toISOString();
    const existing = await readSheet('task_team');
    const id = `tt-${String(existing.length + 1).padStart(3, '0')}`;

    const newTT: TaskTeam = {
      id,
      task_id: taskId,
      user_id: userId,
      created_by: createdBy,
      created_at: now,
      updated_by: null,
      updated_at: null,
      deleted_by: null,
      deleted_at: null,
    };

    await appendRow('task_team', toValues(newTT as unknown as Record<string, unknown>, headers));
    return newTT;
  },

  async softDelete(id: string, deletedBy: string): Promise<boolean> {
    const rowNum = await findRowByColumn('task_team', 'id', id)
    if (rowNum === -1) return false
    const headers = await getHeaders('task_team')
    const existing = await getRowByColumn('task_team', 'id', id)
    if (!existing) return false
    const now = new Date().toISOString()
    const updated = { ...existing, deleted_by: deletedBy, deleted_at: now }
    await updateRow('task_team', rowNum, toValues(updated as unknown as Record<string, unknown>, headers))
    return true
  },
};

// ============ DAILY REPORT REPOSITORY ============

export const DailyReportRepository = {
  async findAll(): Promise<DailyReport[]> {
    const rows = await readSheet('report');
    return rows.map(rowToDailyReport).filter((r) => !r.deleted_at);
  },

  async findById(reportId: string): Promise<DailyReport | null> {
    const row = await getRowByColumn('report', 'report_id', reportId);
    if (!row) return null;
    const report = rowToDailyReport(row);
    return report.deleted_at ? null : report;
  },

  async findByTaskId(taskId: string): Promise<DailyReport[]> {
    const rows = await getRowsByColumn('report', 'task_id', taskId);
    return rows.map(rowToDailyReport).filter((r) => !r.deleted_at);
  },

  async findByUserId(userId: string): Promise<DailyReport[]> {
    const rows = await getRowsByColumn('report', 'user_id', userId);
    return rows.map(rowToDailyReport).filter((r) => !r.deleted_at);
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
    const headers = await getHeaders('report');
    const now = new Date().toISOString();
    const existing = await readSheet('report');
    const reportId = `r-${String(existing.length + 1).padStart(3, '0')}`;

    const newReport: DailyReport = {
      report_id: reportId,
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

    await appendRow('report', toValues(newReport as unknown as Record<string, unknown>, headers));

    // Auto-update task progress and status from latest report
    await DailyReportRepository._syncTaskFromLatestReport(report.task_id, createdBy);

    return newReport;
  },

  async update(
    reportId: string,
    updates: Partial<Pick<DailyReport, 'date' | 'progress_percentage' | 'remarks'>>
  ): Promise<DailyReport | null> {
    const rowNum = await findRowByColumn('report', 'report_id', reportId);
    if (rowNum === -1) return null;

    const headers = await getHeaders('report');
    const existing = await getRowByColumn('report', 'report_id', reportId);
    if (!existing) return null;

    const updated: Record<string, unknown> = { ...existing, ...updates };
    await updateRow('report', rowNum, toValues(updated, headers));

    return rowToDailyReport(updated as Record<string, string>);
  },

  async softDelete(reportId: string, deletedBy: string): Promise<boolean> {
    const rowNum = await findRowByColumn('report', 'report_id', reportId);
    if (rowNum === -1) return false;

    const headers = await getHeaders('report');
    const existing = await getRowByColumn('report', 'report_id', reportId);
    if (!existing) return false;

    const now = new Date().toISOString();
    const updated: Record<string, unknown> = {
      ...existing,
      deleted_by: deletedBy,
      deleted_at: now,
    };
    await updateRow('report', rowNum, toValues(updated, headers));
    return true;
  },

  /**
   * Sync task progress and status from its latest report.
   */
  async _syncTaskFromLatestReport(taskId: string, updatedBy: string): Promise<void> {
    const taskReports = await DailyReportRepository.findByTaskId(taskId);
    if (taskReports.length === 0) return;

    const latest = taskReports.reduce((max, r) => {
      if (!r.date) return max;
      if (!max.date) return r;
      return r.date > max.date ? r : max;
    }, taskReports[0]);

    const progress = parseFloat(latest.progress_percentage ?? '0') || 0;

    let autoStatus: string = STATUS.NOT_STARTED;
    if (progress >= 100) autoStatus = STATUS.DONE;
    else if (progress > 0) autoStatus = STATUS.ON_PROGRESS;

    const rowNum = await findRowByColumn('task', 'id', taskId);
    if (rowNum === -1) return;

    const headers = await getHeaders('task');
    const existing = await getRowByColumn('task', 'id', taskId);
    if (!existing) return;

    const now = new Date().toISOString();
    const updated: Record<string, unknown> = {
      ...existing,
      task_latest_percentage: String(progress),
      task_status: autoStatus,
      updated_by: updatedBy,
      updated_at: now,
    };
    await updateRow('task', rowNum, toValues(updated, headers));

    if (existing.task_status !== autoStatus) {
      await TaskLogRepository.create(
        { task_id: taskId, task_status_old: existing.task_status, task_status_new: autoStatus },
        updatedBy
      );
    }

    if (existing.project_id) {
      await TaskRepository._syncProjectStatus(existing.project_id, updatedBy);
    }
  },
};

// ============ STATUS REPOSITORY ============

export const StatusRepository = {
  async findAll(): Promise<Status[]> {
    const rows = await readSheet('status');
    return rows.map(rowToStatus);
  },

  async findById(id: string): Promise<Status | null> {
    const row = await getRowByColumn('status', 'id', id);
    if (!row) return null;
    return rowToStatus(row);
  },
};

// ============ LOG REPOSITORIES ============

export const ProjectLogRepository = {
  async create(
    log: {
      project_id: string;
      project_status_old: string | null;
      project_status_new: string;
    },
    createdBy: string
  ): Promise<ProjectLog> {
    const headers = await getHeaders('project_log');
    const now = new Date().toISOString();
    const existing = await readSheet('project_log');
    const id = `pl-${String(existing.length + 1).padStart(3, '0')}`;

    const newLog: ProjectLog = {
      id,
      project_id: log.project_id,
      project_status_old: log.project_status_old,
      project_status_new: log.project_status_new,
      created_by: createdBy,
      created_at: now,
    };

    await appendRow('project_log', toValues(newLog as unknown as Record<string, unknown>, headers));
    return newLog;
  },

  async findByProjectId(projectId: string): Promise<ProjectLog[]> {
    const rows = await getRowsByColumn('project_log', 'project_id', projectId);
    return rows.map(rowToProjectLog);
  },
};

export const TaskLogRepository = {
  async create(
    log: {
      task_id: string;
      task_status_old: string | null;
      task_status_new: string;
    },
    createdBy: string
  ): Promise<TaskLog> {
    const headers = await getHeaders('task_log');
    const now = new Date().toISOString();
    const existing = await readSheet('task_log');
    const id = `tl-${String(existing.length + 1).padStart(3, '0')}`;

    const newLog: TaskLog = {
      id,
      task_id: log.task_id,
      task_status_old: log.task_status_old,
      task_status_new: log.task_status_new,
      created_by: createdBy,
      created_at: now,
    };

    await appendRow('task_log', toValues(newLog as unknown as Record<string, unknown>, headers));
    return newLog;
  },

  async findByTaskId(taskId: string): Promise<TaskLog[]> {
    const rows = await getRowsByColumn('task_log', 'task_id', taskId);
    return rows.map(rowToTaskLog);
  },
};

// ============ ANALYTICS HELPERS ============

/**
 * Calculate total hours for a specific task from its reports.
 */
export async function getTaskTotalHours(taskId: string): Promise<number> {
  const reports = await DailyReportRepository.findByTaskId(taskId);
  return reports.reduce((sum, r) => {
    const h = parseFloat(r.total_hours ?? '0');
    return sum + (isNaN(h) ? 0 : h);
  }, 0);
}

/**
 * Calculate total hours for a project from all its tasks' reports.
 */
export async function getProjectTotalHours(projectId: string): Promise<number> {
  const tasks = await TaskRepository.findByProjectId(projectId);
  let total = 0;
  for (const task of tasks) {
    const hours = await getTaskTotalHours(task.id);
    total += hours;
  }
  return total;
}

/**
 * Get contribution data: daily aggregated hours from reports.
 * Returns a map of date -> total hours.
 */
export async function getContributionData(options?: {
  userId?: string;
  projectId?: string;
  taskId?: string;
  startDate?: string;
  endDate?: string;
}): Promise<Record<string, number>> {
  let reports = await DailyReportRepository.findAll();

  if (options?.userId) {
    reports = reports.filter((r) => r.user_id === options.userId);
  }
  if (options?.taskId) {
    reports = reports.filter((r) => r.task_id === options.taskId);
  }
  if (options?.projectId) {
    const tasks = await TaskRepository.findByProjectId(options.projectId);
    const taskIds = new Set(tasks.map((t) => t.id));
    reports = reports.filter((r) => taskIds.has(r.task_id));
  }
  if (options?.startDate) {
    reports = reports.filter((r) => (r.date ?? '') >= (options.startDate ?? ''));
  }
  if (options?.endDate) {
    reports = reports.filter((r) => (r.date ?? '') <= (options.endDate ?? ''));
  }

  const data: Record<string, number> = {};
  for (const report of reports) {
    const date = report.date ?? 'unknown';
    const hours = parseFloat(report.total_hours ?? '0') || 0;
    data[date] = (data[date] ?? 0) + hours;
  }
  return data;
}

/**
 * Get contribution summary statistics.
 */
export async function getContributionSummary(options?: {
  userId?: string;
  projectId?: string;
  taskId?: string;
  startDate?: string;
  endDate?: string;
}) {
  const data = await getContributionData(options);
  const entries = Object.entries(data);
  const totalHours = entries.reduce((sum, [, h]) => sum + h, 0);
  const totalReports = entries.length;
  const avgHoursPerDay = totalReports > 0 ? totalHours / totalReports : 0;

  // Find most active user
  let mostActiveUser = '—';
  let mostActiveUserHours = 0;
  if (!options?.userId) {
    const allReports = await DailyReportRepository.findAll();
    const userHours: Record<string, number> = {};
    for (const r of allReports) {
      const uid = r.user_id ?? 'unknown';
      const h = parseFloat(r.total_hours ?? '0') || 0;
      userHours[uid] = (userHours[uid] ?? 0) + h;
    }
    for (const [uid, hours] of Object.entries(userHours)) {
      if (hours > mostActiveUserHours) {
        mostActiveUserHours = hours;
        mostActiveUser = uid;
      }
    }
  }

  // Find most active project
  let mostActiveProject = '—';
  let mostActiveProjectHours = 0;
  if (!options?.projectId) {
    const projects = await ProjectRepository.findAll();
    for (const p of projects) {
      const hours = await getProjectTotalHours(p.project_id);
      if (hours > mostActiveProjectHours) {
        mostActiveProjectHours = hours;
        mostActiveProject = p.project_name ?? p.project_id;
      }
    }
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
}

// ============ USER-SCOPED FILTERING ============

export async function getUserProjectIds(userId: string): Promise<string[]> {
  const projectTeams = await ProjectTeamRepository.findByUserId(userId);
  return [...new Set(projectTeams.map((pt) => pt.project_id))];
}

export async function getUserTaskIds(userId: string): Promise<string[]> {
  const taskTeams = await TaskTeamRepository.findByUserId(userId);
  return [...new Set(taskTeams.map((tt) => tt.task_id))];
}

/**
 * Filter projects for "My View":
 * Include if user is the creator OR user is in ProjectTeam
 */
export async function filterProjectsByUser(
  projects: Project[],
  userId: string
): Promise<Project[]> {
  if (!userId) return projects;
  const projectIds = await getUserProjectIds(userId);
  return projects.filter(
    (p) => p.created_by === userId || projectIds.includes(p.project_id)
  );
}

/**
 * Filter tasks for "My View":
 * Include if user is the creator OR user is in TaskTeam
 */
export async function filterTasksByUser(
  tasks: Task[],
  userId: string
): Promise<Task[]> {
  if (!userId) return tasks;
  const taskIds = await getUserTaskIds(userId);
  return tasks.filter(
    (t) => t.created_by === userId || taskIds.includes(t.id)
  );
}

/**
 * Filter reports for "My View":
 * Include if user is the creator (user_id or created_by)
 */
export async function filterReportsByUser(
  reports: DailyReport[],
  userId: string
): Promise<DailyReport[]> {
  if (!userId) return reports;
  return reports.filter(
    (r) => r.user_id === userId || r.created_by === userId
  );
}

// ============ USER LOOKUP ============

let _userMapCache: Record<string, string> | null = null

export async function getUserMap(): Promise<Record<string, string>> {
  if (_userMapCache) return _userMapCache
  const users = await UserRepository.findAll()
  const map: Record<string, string> = {}
  for (const u of users) {
    map[u.user_id] = u.user_name || u.user_email || u.user_id
  }
  _userMapCache = map
  return map
}

export async function resolveUserName(userId: string | null | undefined): Promise<string> {
  if (!userId) return "—"
  const map = await getUserMap()
  return map[userId] ?? userId
}

export async function resolveUserNames(userIds: (string | null | undefined)[]): Promise<string> {
  const valid = userIds.filter((id): id is string => !!id)
  if (valid.length === 0) return "—"
  const map = await getUserMap()
  return valid.map((id) => map[id] ?? id).join(", ")
}

export function invalidateUserMap() {
  _userMapCache = null
}

// ============ TRASH / SOFT-DELETED RECORDS ============

/** Get all projects including soft-deleted ones. */
export async function findAllProjectsIncludingDeleted(): Promise<Project[]> {
  const rows = await readSheet('project')
  return rows.map(rowToProject)
}

/** Get all tasks including soft-deleted ones. */
export async function findAllTasksIncludingDeleted(): Promise<Task[]> {
  const rows = await readSheet('task')
  return rows.map(rowToTask)
}

/** Get all reports including soft-deleted ones. */
export async function findAllReportsIncludingDeleted(): Promise<DailyReport[]> {
  const rows = await readSheet('report')
  return rows.map(rowToDailyReport)
}

/** Restore a soft-deleted project by clearing deleted_at and deleted_by. */
export async function restoreProject(projectId: string): Promise<boolean> {
  const rowNum = await findRowByColumn('project', 'project_id', projectId)
  if (rowNum === -1) return false
  const headers = await getHeaders('project')
  const existing = await getRowByColumn('project', 'project_id', projectId)
  if (!existing) return false
  const updated = { ...existing, deleted_by: '', deleted_at: '' }
  await updateRow('project', rowNum, toValues(updated as unknown as Record<string, unknown>, headers))
  return true
}

/** Restore a soft-deleted task. */
export async function restoreTask(taskId: string): Promise<boolean> {
  const rowNum = await findRowByColumn('task', 'id', taskId)
  if (rowNum === -1) return false
  const headers = await getHeaders('task')
  const existing = await getRowByColumn('task', 'id', taskId)
  if (!existing) return false
  const updated = { ...existing, deleted_by: '', deleted_at: '' }
  await updateRow('task', rowNum, toValues(updated as unknown as Record<string, unknown>, headers))
  return true
}

/** Restore a soft-deleted report. */
export async function restoreReport(reportId: string): Promise<boolean> {
  const rowNum = await findRowByColumn('report', 'report_id', reportId)
  if (rowNum === -1) return false
  const headers = await getHeaders('report')
  const existing = await getRowByColumn('report', 'report_id', reportId)
  if (!existing) return false
  const updated = { ...existing, deleted_by: '', deleted_at: '' }
  await updateRow('report', rowNum, toValues(updated as unknown as Record<string, unknown>, headers))
  return true
}
