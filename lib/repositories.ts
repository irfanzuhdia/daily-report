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
import { unstable_cache, revalidateTag } from 'next/cache';

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

const getCachedUsers = unstable_cache(
  async (): Promise<User[]> => {
    const rows = await readSheet('user');
    return rows.map(rowToUser).filter((u) => !u.deleted_at);
  },
  ['users-all'],
  { tags: ['users'] }
);

const getCachedUserByEmail = unstable_cache(
  async (email: string): Promise<User | null> => {
    const row = await getRowByColumn('user', 'user_email', email);
    if (!row) return null;
    const user = rowToUser(row);
    return user.deleted_at ? null : user;
  },
  ['user-by-email'],
  { tags: ['users'] }
);

const getCachedUserById = unstable_cache(
  async (userId: string): Promise<User | null> => {
    const row = await getRowByColumn('user', 'user_id', userId);
    if (!row) return null;
    const user = rowToUser(row);
    return user.deleted_at ? null : user;
  },
  ['user-by-id'],
  { tags: ['users'] }
);

export const UserRepository = {
  async findAll(): Promise<User[]> {
    return getCachedUsers();
  },

  async findByEmail(email: string): Promise<User | null> {
    return getCachedUserByEmail(email);
  },

  async findById(userId: string): Promise<User | null> {
    return getCachedUserById(userId);
  },

  async create(
    user: Omit<User, 'user_id' | 'created_at'>,
    createdBy: string
  ): Promise<User> {
    const headers = await getHeaders('user');
    const now = new Date().toISOString();
    const existing = await readSheet('user');
    const userId = `U-${String(existing.length + 1).padStart(4, '0')}`;

    const newUser: User = {
      ...user,
      user_id: userId,
      created_by: createdBy,
      created_at: now,
    };

    await appendRow('user', toValues(newUser as unknown as Record<string, unknown>, headers));
    revalidateTag('users', 'max');
    return newUser;
  },
};

// ============ PROJECT REPOSITORY ============

const getCachedProjects = unstable_cache(
  async (): Promise<Project[]> => {
    const rows = await readSheet('project');
    return rows.map(rowToProject).filter((p) => !p.deleted_at);
  },
  ['projects-all'],
  { tags: ['projects'] }
);

const getCachedProjectById = unstable_cache(
  async (projectId: string): Promise<Project | null> => {
    const row = await getRowByColumn('project', 'project_id', projectId);
    if (!row) return null;
    const project = rowToProject(row);
    return project.deleted_at ? null : project;
  },
  ['project-by-id'],
  { tags: ['projects'] }
);

export const ProjectRepository = {
  async findAll(): Promise<Project[]> {
    return getCachedProjects();
  },

  async findById(projectId: string): Promise<Project | null> {
    return getCachedProjectById(projectId);
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

    // Log project creation
    await ProjectLogRepository.create(
      {
        project_id: projectId,
        project_status_old: "CREATED",
        project_status_new: STATUS.NOT_STARTED,
      },
      createdBy
    );

    revalidateTag('projects', 'max');
    revalidateTag('project_log', 'max');
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

    // If user explicitly sets project_status, use that. Otherwise auto-calculate from tasks.
    let newStatus: string;
    if (updates.project_status != null) {
      newStatus = updates.project_status;
    } else {
      const allTasks = await TaskRepository.findAll();
      newStatus = calcProjectStatus(projectId, allTasks);
    }

    const updated: Record<string, unknown> = {
      ...existing,
      ...updates,
      project_status: newStatus,
      updated_by: updatedBy,
      updated_at: now,
    };
    await updateRow('project', rowNum, toValues(updated, headers));

    // Log metadata change
    const isMetadataUpdated =
      (updates.project_name !== undefined && updates.project_name !== existing.project_name) ||
      (updates.project_description !== undefined && updates.project_description !== existing.project_description) ||
      (updates.project_start_date_plan !== undefined && updates.project_start_date_plan !== existing.project_start_date_plan) ||
      (updates.project_end_date_plan !== undefined && updates.project_end_date_plan !== existing.project_end_date_plan);

    if (isMetadataUpdated) {
      await ProjectLogRepository.create(
        {
          project_id: projectId,
          project_status_old: "UPDATED",
          project_status_new: "metadata",
        },
        updatedBy
      );
    }

    // Log file upload
    if (updates.project_file !== undefined && updates.project_file !== existing.project_file && updates.project_file) {
      await ProjectLogRepository.create(
        {
          project_id: projectId,
          project_status_old: "FILE_UPLOAD",
          project_status_new: updates.project_file,
        },
        updatedBy
      );
    }

    // Log status change
    if (existing.project_status !== newStatus) {
      await ProjectLogRepository.create(
        {
          project_id: projectId,
          project_status_old: existing.project_status,
          project_status_new: newStatus,
        },
        updatedBy
      );
    }

    revalidateTag('projects', 'max');
    revalidateTag('project_log', 'max');
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
    revalidateTag('projects', 'max');
    return true;
  },
};

// ============ PROJECT TEAM REPOSITORY ============

const getCachedProjectTeamByProjectId = unstable_cache(
  async (projectId: string): Promise<ProjectTeam[]> => {
    const rows = await getRowsByColumn('project_team', 'project_id', projectId);
    return rows.map(rowToProjectTeam).filter((pt) => !pt.deleted_at);
  },
  ['project-team-by-project-id'],
  { tags: ['project_team'] }
);

const getCachedProjectTeamByUserId = unstable_cache(
  async (userId: string): Promise<ProjectTeam[]> => {
    const rows = await getRowsByColumn('project_team', 'user_id', userId);
    return rows.map(rowToProjectTeam).filter((pt) => !pt.deleted_at);
  },
  ['project-team-by-user-id'],
  { tags: ['project_team'] }
);

export const ProjectTeamRepository = {
  async findByProjectId(projectId: string): Promise<ProjectTeam[]> {
    return getCachedProjectTeamByProjectId(projectId);
  },

  async findByUserId(userId: string): Promise<ProjectTeam[]> {
    return getCachedProjectTeamByUserId(userId);
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

    // Log team member added
    await ProjectLogRepository.create(
      {
        project_id: projectId,
        project_status_old: "TEAM_ADD",
        project_status_new: userId,
      },
      createdBy
    );

    revalidateTag('project_team', 'max');
    revalidateTag('project_log', 'max');
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

    // Log team member removed
    await ProjectLogRepository.create(
      {
        project_id: existing.project_id,
        project_status_old: "TEAM_REMOVE",
        project_status_new: existing.user_id,
      },
      deletedBy
    );

    revalidateTag('project_team', 'max');
    revalidateTag('project_log', 'max');
    return true
  },
};

// ============ TASK REPOSITORY ============

const getCachedTasks = unstable_cache(
  async (): Promise<Task[]> => {
    const rows = await readSheet('task');
    return rows.map(rowToTask).filter((t) => !t.deleted_at);
  },
  ['tasks-all'],
  { tags: ['tasks'] }
);

const getCachedTasksByProjectId = unstable_cache(
  async (projectId: string): Promise<Task[]> => {
    const rows = await getRowsByColumn('task', 'project_id', projectId);
    return rows.map(rowToTask).filter((t) => !t.deleted_at);
  },
  ['tasks-by-project-id'],
  { tags: ['tasks'] }
);

const getCachedTaskById = unstable_cache(
  async (taskId: string): Promise<Task | null> => {
    const row = await getRowByColumn('task', 'id', taskId);
    if (!row) return null;
    const task = rowToTask(row);
    return task.deleted_at ? null : task;
  },
  ['task-by-id'],
  { tags: ['tasks'] }
);

export const TaskRepository = {
  async findAll(): Promise<Task[]> {
    return getCachedTasks();
  },

  async findByProjectId(projectId: string): Promise<Task[]> {
    return getCachedTasksByProjectId(projectId);
  },

  async findById(taskId: string): Promise<Task | null> {
    return getCachedTaskById(taskId);
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

    // Log task creation
    await TaskLogRepository.create(
      {
        task_id: id,
        task_status_old: "CREATED",
        task_status_new: STATUS.NOT_STARTED,
      },
      createdBy
    );

    // Auto-update parent project status after adding a task
    await TaskRepository._syncProjectStatus(task.project_id, createdBy);

    revalidateTag('tasks', 'max');
    revalidateTag('task_log', 'max');
    revalidateTag('projects', 'max');
    revalidateTag('project_log', 'max');
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

    // Log metadata change (description)
    const isMetadataUpdated = updates.task_description !== undefined && updates.task_description !== existing.task_description;
    if (isMetadataUpdated) {
      await TaskLogRepository.create(
        {
          task_id: taskId,
          task_status_old: "UPDATED",
          task_status_new: "metadata",
        },
        updatedBy
      );
    }

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

    revalidateTag('tasks', 'max');
    revalidateTag('task_log', 'max');
    revalidateTag('projects', 'max');
    revalidateTag('project_log', 'max');
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
    revalidateTag('tasks', 'max');
    revalidateTag('projects', 'max');
    return true;
  },
};

// ============ TASK TEAM REPOSITORY ============

const getCachedTaskTeamByTaskId = unstable_cache(
  async (taskId: string): Promise<TaskTeam[]> => {
    const rows = await getRowsByColumn('task_team', 'task_id', taskId);
    return rows.map(rowToTaskTeam).filter((tt) => !tt.deleted_at);
  },
  ['task-team-by-task-id'],
  { tags: ['task_team'] }
);

const getCachedTaskTeamByUserId = unstable_cache(
  async (userId: string): Promise<TaskTeam[]> => {
    const rows = await getRowsByColumn('task_team', 'user_id', userId);
    return rows.map(rowToTaskTeam).filter((tt) => !tt.deleted_at);
  },
  ['task-team-by-user-id'],
  { tags: ['task_team'] }
);

export const TaskTeamRepository = {
  async findByTaskId(taskId: string): Promise<TaskTeam[]> {
    return getCachedTaskTeamByTaskId(taskId);
  },

  async findByUserId(userId: string): Promise<TaskTeam[]> {
    return getCachedTaskTeamByUserId(userId);
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

    // Log team member added to task
    await TaskLogRepository.create(
      {
        task_id: taskId,
        task_status_old: "TEAM_ADD",
        task_status_new: userId,
      },
      createdBy
    );

    revalidateTag('task_team', 'max');
    revalidateTag('task_log', 'max');
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

    // Log team member removed from task
    await TaskLogRepository.create(
      {
        task_id: existing.task_id,
        task_status_old: "TEAM_REMOVE",
        task_status_new: existing.user_id,
      },
      deletedBy
    );

    revalidateTag('task_team', 'max');
    revalidateTag('task_log', 'max');
    return true
  },
};

// ============ DAILY REPORT REPOSITORY ============

const getCachedReports = unstable_cache(
  async (): Promise<DailyReport[]> => {
    const rows = await readSheet('report');
    return rows.map(rowToDailyReport).filter((r) => !r.deleted_at);
  },
  ['reports-all'],
  { tags: ['reports'] }
);

const getCachedReportById = unstable_cache(
  async (reportId: string): Promise<DailyReport | null> => {
    const row = await getRowByColumn('report', 'report_id', reportId);
    if (!row) return null;
    const report = rowToDailyReport(row);
    return report.deleted_at ? null : report;
  },
  ['report-by-id'],
  { tags: ['reports'] }
);

const getCachedReportsByTaskId = unstable_cache(
  async (taskId: string): Promise<DailyReport[]> => {
    const rows = await getRowsByColumn('report', 'task_id', taskId);
    return rows.map(rowToDailyReport).filter((r) => !r.deleted_at);
  },
  ['reports-by-task-id'],
  { tags: ['reports'] }
);

const getCachedReportsByUserId = unstable_cache(
  async (userId: string): Promise<DailyReport[]> => {
    const rows = await getRowsByColumn('report', 'user_id', userId);
    return rows.map(rowToDailyReport).filter((r) => !r.deleted_at);
  },
  ['reports-by-user-id'],
  { tags: ['reports'] }
);

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

    // Log report submission
    await TaskLogRepository.create(
      {
        task_id: report.task_id,
        task_status_old: "REPORT_SUBMIT",
        task_status_new: report.progress_percentage,
      },
      createdBy
    );

    // Auto-update task progress and status from latest report
    await DailyReportRepository._syncTaskFromLatestReport(report.task_id, createdBy);

    revalidateTag('reports', 'max');
    revalidateTag('tasks', 'max');
    revalidateTag('task_log', 'max');
    revalidateTag('projects', 'max');
    revalidateTag('project_log', 'max');
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

    revalidateTag('reports', 'max');
    revalidateTag('tasks', 'max');
    revalidateTag('projects', 'max');
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
    revalidateTag('reports', 'max');
    revalidateTag('tasks', 'max');
    revalidateTag('projects', 'max');
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

const getCachedStatuses = unstable_cache(
  async (): Promise<Status[]> => {
    const rows = await readSheet('status');
    return rows.map(rowToStatus);
  },
  ['status-all'],
  { tags: ['status'] }
);

const getCachedStatusById = unstable_cache(
  async (id: string): Promise<Status | null> => {
    const row = await getRowByColumn('status', 'id', id);
    if (!row) return null;
    return rowToStatus(row);
  },
  ['status-by-id'],
  { tags: ['status'] }
);

export const StatusRepository = {
  async findAll(): Promise<Status[]> {
    return getCachedStatuses();
  },

  async findById(id: string): Promise<Status | null> {
    return getCachedStatusById(id);
  },
};

// ============ LOG REPOSITORIES ============

const getCachedProjectLogsByProjectId = unstable_cache(
  async (projectId: string): Promise<ProjectLog[]> => {
    const rows = await getRowsByColumn('project_log', 'project_id', projectId);
    return rows.map(rowToProjectLog);
  },
  ['project-logs-by-project-id'],
  { tags: ['project_log'] }
);

const getCachedTaskLogsByTaskId = unstable_cache(
  async (taskId: string): Promise<TaskLog[]> => {
    const rows = await getRowsByColumn('task_log', 'task_id', taskId);
    return rows.map(rowToTaskLog);
  },
  ['task-logs-by-task-id'],
  { tags: ['task_log'] }
);

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
    const id = `pl-${String(existing.length + 1).padStart(3, '0')}-${Math.random().toString(36).substring(2, 7)}`;

    const newLog: ProjectLog = {
      id,
      project_id: log.project_id,
      project_status_old: log.project_status_old,
      project_status_new: log.project_status_new,
      created_by: createdBy,
      created_at: now,
    };

    await appendRow('project_log', toValues(newLog as unknown as Record<string, unknown>, headers));
    revalidateTag('project_log', 'max');
    return newLog;
  },

  async findByProjectId(projectId: string): Promise<ProjectLog[]> {
    return getCachedProjectLogsByProjectId(projectId);
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
    const id = `tl-${String(existing.length + 1).padStart(3, '0')}-${Math.random().toString(36).substring(2, 7)}`;

    const newLog: TaskLog = {
      id,
      task_id: log.task_id,
      task_status_old: log.task_status_old,
      task_status_new: log.task_status_new,
      created_by: createdBy,
      created_at: now,
    };

    await appendRow('task_log', toValues(newLog as unknown as Record<string, unknown>, headers));
    revalidateTag('task_log', 'max');
    return newLog;
  },

  async findByTaskId(taskId: string): Promise<TaskLog[]> {
    return getCachedTaskLogsByTaskId(taskId);
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
  { tags: ['reports'] }
);

/**
 * Calculate total hours for a specific task from its reports.
 */
export async function getTaskTotalHours(taskId: string): Promise<number> {
  return getCachedTaskTotalHours(taskId);
}

const getCachedProjectTotalHours = unstable_cache(
  async (projectId: string): Promise<number> => {
    const tasks = await TaskRepository.findByProjectId(projectId);
    let total = 0;
    for (const task of tasks) {
      const hours = await getTaskTotalHours(task.id);
      total += hours;
    }
    return total;
  },
  ['project-total-hours'],
  { tags: ['reports', 'tasks'] }
);

/**
 * Calculate total hours for a project from all its tasks' reports.
 */
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
  },
  ['contribution-data'],
  { tags: ['reports', 'tasks'] }
);

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
  return getCachedContributionData(JSON.stringify(options ?? {}));
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

    const allReports = await DailyReportRepository.findAll();

    // Find most active user
    let mostActiveUser = '—';
    let mostActiveUserHours = 0;
    if (!options?.userId) {
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

    // Find most active project (in-memory join)
    let mostActiveProject = '—';
    let mostActiveProjectHours = 0;
    if (!options?.projectId) {
      const [projects, tasks] = await Promise.all([
        ProjectRepository.findAll(),
        TaskRepository.findAll(),
      ]);

      const taskProjectMap = new Map(tasks.map((t) => [t.id, t.project_id]));
      const projectHours: Record<string, number> = {};

      for (const r of allReports) {
        if (!r.task_id) continue;
        const pid = taskProjectMap.get(r.task_id);
        if (!pid) continue;
        const h = parseFloat(r.total_hours ?? '0') || 0;
        projectHours[pid] = (projectHours[pid] ?? 0) + h;
      }

      for (const p of projects) {
        const hours = projectHours[p.project_id] ?? 0;
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
  },
  ['contribution-summary'],
  { tags: ['reports', 'tasks', 'projects'] }
);

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
  return getCachedContributionSummary(JSON.stringify(options ?? {}));
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

const getCachedUserMap = unstable_cache(
  async (): Promise<Record<string, string>> => {
    const users = await UserRepository.findAll();
    const map: Record<string, string> = {};
    for (const u of users) {
      map[u.user_id] = u.user_name || u.user_email || u.user_id;
    }
    return map;
  },
  ['user-map'],
  { tags: ['users'] }
);

export async function getUserMap(): Promise<Record<string, string>> {
  return getCachedUserMap();
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
  revalidateTag('users', 'max');
}

// ============ TRASH / SOFT-DELETED RECORDS ============

const getCachedAllProjectsIncludingDeleted = unstable_cache(
  async (): Promise<Project[]> => {
    const rows = await readSheet('project');
    return rows.map(rowToProject);
  },
  ['projects-all-incl-deleted'],
  { tags: ['projects'] }
);

/** Get all projects including soft-deleted ones. */
export async function findAllProjectsIncludingDeleted(): Promise<Project[]> {
  return getCachedAllProjectsIncludingDeleted();
}

const getCachedAllTasksIncludingDeleted = unstable_cache(
  async (): Promise<Task[]> => {
    const rows = await readSheet('task');
    return rows.map(rowToTask);
  },
  ['tasks-all-incl-deleted'],
  { tags: ['tasks'] }
);

/** Get all tasks including soft-deleted ones. */
export async function findAllTasksIncludingDeleted(): Promise<Task[]> {
  return getCachedAllTasksIncludingDeleted();
}

const getCachedAllReportsIncludingDeleted = unstable_cache(
  async (): Promise<DailyReport[]> => {
    const rows = await readSheet('report');
    return rows.map(rowToDailyReport);
  },
  ['reports-all-incl-deleted'],
  { tags: ['reports'] }
);

/** Get all reports including soft-deleted ones. */
export async function findAllReportsIncludingDeleted(): Promise<DailyReport[]> {
  return getCachedAllReportsIncludingDeleted();
}

/** Restore a soft-deleted project by clearing deleted_at and deleted_by. */
export async function restoreProject(projectId: string, restoredBy: string): Promise<boolean> {
  const rowNum = await findRowByColumn('project', 'project_id', projectId)
  if (rowNum === -1) return false
  const headers = await getHeaders('project')
  const existing = await getRowByColumn('project', 'project_id', projectId)
  if (!existing) return false
  const updated = { ...existing, deleted_by: '', deleted_at: '' }
  await updateRow('project', rowNum, toValues(updated as unknown as Record<string, unknown>, headers))

  // Log project restoration
  await ProjectLogRepository.create(
    {
      project_id: projectId,
      project_status_old: "RESTORED",
      project_status_new: "",
    },
    restoredBy
  );

  revalidateTag('projects', 'max');
  revalidateTag('project_log', 'max');
  return true
}

/** Restore a soft-deleted task. */
export async function restoreTask(taskId: string, restoredBy: string): Promise<boolean> {
  const rowNum = await findRowByColumn('task', 'id', taskId)
  if (rowNum === -1) return false
  const headers = await getHeaders('task')
  const existing = await getRowByColumn('task', 'id', taskId)
  if (!existing) return false
  const updated = { ...existing, deleted_by: '', deleted_at: '' }
  await updateRow('task', rowNum, toValues(updated as unknown as Record<string, unknown>, headers))

  // Log task restoration
  await TaskLogRepository.create(
    {
      task_id: taskId,
      task_status_old: "RESTORED",
      task_status_new: "",
    },
    restoredBy
  );

  revalidateTag('tasks', 'max');
  revalidateTag('task_log', 'max');
  revalidateTag('projects', 'max');
  revalidateTag('project_log', 'max');
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

  revalidateTag('reports', 'max');
  revalidateTag('tasks', 'max');
  revalidateTag('projects', 'max');
  return true
}
