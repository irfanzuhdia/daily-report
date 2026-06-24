import { sql } from './db';
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
  FileRecord,
  Comment,
  Notification,
} from './types';
import { unstable_cache as nextUnstableCache, revalidateTag as nextRevalidateTag } from 'next/cache';

/* eslint-disable @typescript-eslint/no-explicit-any */
// Custom wrapper to selectively disable caching for projects, tasks, reports, etc.
function unstable_cache<T extends (...args: any[]) => Promise<any>>(
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

function revalidateTag(tag: string) {
  nextRevalidateTag(tag, 'max');
}

// ============ STATUS & PROGRESS CALCULATION HELPERS ============

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

// ============ USER REPOSITORY ============

const getCachedUsers = unstable_cache(
  async (): Promise<User[]> => {
    const rows = await sql`SELECT * FROM users WHERE deleted_at IS NULL`;
    return rows as unknown as User[];
  },
  ['users-all'],
  { tags: ['users'], revalidate: 60 }
);

const getCachedUserByEmail = unstable_cache(
  async (email: string): Promise<User | null> => {
    const rows = await sql`SELECT * FROM users WHERE user_email = ${email} AND deleted_at IS NULL LIMIT 1`;
    return (rows[0] as unknown as User) || null;
  },
  ['user-by-email'],
  { tags: ['users'], revalidate: 60 }
);

const getCachedUserById = unstable_cache(
  async (userId: string): Promise<User | null> => {
    const rows = await sql`SELECT * FROM users WHERE user_id = ${userId} AND deleted_at IS NULL LIMIT 1`;
    return (rows[0] as unknown as User) || null;
  },
  ['user-by-id'],
  { tags: ['users'], revalidate: 60 }
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
    user: {
      user_email: string;
      user_name: string | null;
      user_occupation: string | null;
      user_division: string | null;
      user_departement: string | null;
    },
    createdBy: string
  ): Promise<User> {
    const res = await sql`SELECT COALESCE(MAX(NULLIF(regexp_replace(user_id, '\\D', '', 'g'), '')::int), 0) as max_val FROM users`;
    const nextId = 'U-' + String((res[0].max_val || 0) + 1).padStart(4, '0');
    const now = new Date().toISOString();

    const newUser: User = {
      user_id: nextId,
      user_email: user.user_email,
      user_name: user.user_name,
      user_occupation: user.user_occupation,
      user_division: user.user_division,
      user_departement: user.user_departement,
      created_by: createdBy,
      created_at: now,
      updated_by: null,
      updated_at: null,
      deleted_by: null,
      deleted_at: null,
    };

    await sql`
      INSERT INTO users (
        user_id, user_email, user_name, user_occupation, user_division, user_departement,
        created_by, created_at, updated_by, updated_at, deleted_by, deleted_at
      ) VALUES (
        ${newUser.user_id}, ${newUser.user_email}, ${newUser.user_name}, ${newUser.user_occupation},
        ${newUser.user_division}, ${newUser.user_departement}, ${newUser.created_by}, ${newUser.created_at},
        ${newUser.updated_by}, ${newUser.updated_at}, ${newUser.deleted_by}, ${newUser.deleted_at}
      )
    `;

    revalidateTag('users');
    return newUser;
  },
};

// ============ PROJECT REPOSITORY ============

const getCachedProjects = unstable_cache(
  async (): Promise<Project[]> => {
    const rows = await sql`SELECT * FROM projects WHERE deleted_at IS NULL`;
    return rows as unknown as Project[];
  },
  ['projects-all'],
  { tags: ['projects'], revalidate: 60 }
);

const getCachedProjectById = unstable_cache(
  async (projectId: string): Promise<Project | null> => {
    const rows = await sql`SELECT * FROM projects WHERE project_id = ${projectId} AND deleted_at IS NULL LIMIT 1`;
    return (rows[0] as unknown as Project) || null;
  },
  ['project-by-id'],
  { tags: ['projects'], revalidate: 60 }
);

export const ProjectRepository = {
  async findAll(): Promise<Project[]> {
    return getCachedProjects();
  },

  async findById(projectId: string): Promise<Project | null> {
    return getCachedProjectById(projectId);
  },

  async findUniqueCategories(): Promise<string[]> {
    const rows = await sql`
      SELECT DISTINCT category 
      FROM projects 
      WHERE deleted_at IS NULL AND category IS NOT NULL AND category != ''
      ORDER BY category ASC
    `;
    return rows.map((r) => r.category as string);
  },

  async create(
    project: {
      project_name: string;
      project_description?: string;
      project_start_date_plan?: string;
      project_end_date_plan?: string;
      project_status?: string;
      project_file?: string;
      additional_link?: string;
      category?: string;
    },
    createdBy: string
  ): Promise<Project> {
    const res = await sql`SELECT COALESCE(MAX(NULLIF(regexp_replace(project_id, '\\D', '', 'g'), '')::int), 0) as max_val FROM projects`;
    const nextId = 'p-' + String((res[0].max_val || 0) + 1).padStart(3, '0');
    const now = new Date().toISOString();

    const newProject: Project = {
      project_id: nextId,
      project_name: project.project_name,
      project_description: project.project_description ?? null,
      project_start_date_plan: project.project_start_date_plan ?? null,
      project_end_date_plan: project.project_end_date_plan ?? null,
      project_status: project.project_status ?? STATUS.NOT_STARTED,
      project_file: project.project_file ?? null,
      additional_link: project.additional_link ?? null,
      category: project.category ?? null,
      created_by: createdBy,
      created_at: now,
      updated_by: null,
      updated_at: null,
      deleted_by: null,
      deleted_at: null,
    };

    await sql`
      INSERT INTO projects (
        project_id, project_name, project_description, project_start_date_plan, project_end_date_plan,
        project_status, project_file, additional_link, category, created_by, created_at, updated_by, updated_at, deleted_by, deleted_at
      ) VALUES (
        ${newProject.project_id}, ${newProject.project_name}, ${newProject.project_description},
        ${newProject.project_start_date_plan}, ${newProject.project_end_date_plan}, ${newProject.project_status},
        ${newProject.project_file}, ${newProject.additional_link}, ${newProject.category}, ${newProject.created_by}, ${newProject.created_at},
        ${newProject.updated_by}, ${newProject.updated_at}, ${newProject.deleted_by}, ${newProject.deleted_at}
      )
    `;

    await ProjectLogRepository.create(
      {
        project_id: nextId,
        project_status_old: 'CREATED',
        project_status_new: newProject.project_status || STATUS.NOT_STARTED,
      },
      createdBy
    );

    revalidateTag('projects');
    revalidateTag('project_log');
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
        | 'additional_link'
        | 'category'
      >
    >,
    updatedBy: string
  ): Promise<Project | null> {
    const existing = await ProjectRepository.findById(projectId);
    if (!existing) return null;

    const now = new Date().toISOString();

    let newStatus: string;
    if (updates.project_status != null) {
      newStatus = updates.project_status;
    } else {
      const allTasks = await TaskRepository.findAll();
      newStatus = calcProjectStatus(projectId, allTasks);
    }

    const updated: Project = {
      ...existing,
      ...updates,
      project_status: newStatus,
      updated_by: updatedBy,
      updated_at: now,
    };

    await sql`
      UPDATE projects SET
        project_name = ${updated.project_name},
        project_description = ${updated.project_description},
        project_start_date_plan = ${updated.project_start_date_plan},
        project_end_date_plan = ${updated.project_end_date_plan},
        project_status = ${updated.project_status},
        project_file = ${updated.project_file},
        additional_link = ${updated.additional_link},
        category = ${updated.category},
        updated_by = ${updated.updated_by},
        updated_at = ${updated.updated_at}
      WHERE project_id = ${projectId}
    `;

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
          project_status_old: 'UPDATED',
          project_status_new: 'metadata',
        },
        updatedBy
      );
    }

    // Log file upload
    if (updates.project_file !== undefined && updates.project_file !== existing.project_file && updates.project_file) {
      await ProjectLogRepository.create(
        {
          project_id: projectId,
          project_status_old: 'FILE_UPLOAD',
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

    revalidateTag('projects');
    revalidateTag('project_log');
    return updated;
  },

  async softDelete(projectId: string, deletedBy: string): Promise<boolean> {
    const existing = await ProjectRepository.findById(projectId);
    if (!existing) return false;

    const now = new Date().toISOString();

    await sql`
      UPDATE projects SET
        deleted_by = ${deletedBy},
        deleted_at = ${now}
      WHERE project_id = ${projectId}
    `;

    revalidateTag('projects');
    return true;
  },
};

// ============ PROJECT TEAM REPOSITORY ============

const getCachedProjectTeamByProjectId = unstable_cache(
  async (projectId: string): Promise<ProjectTeam[]> => {
    const rows = await sql`SELECT * FROM project_teams WHERE project_id = ${projectId} AND deleted_at IS NULL`;
    return rows as unknown as ProjectTeam[];
  },
  ['project-team-by-project-id'],
  { tags: ['project_team'], revalidate: 60 }
);

const getCachedProjectTeamByUserId = unstable_cache(
  async (userId: string): Promise<ProjectTeam[]> => {
    const rows = await sql`SELECT * FROM project_teams WHERE user_id = ${userId} AND deleted_at IS NULL`;
    return rows as unknown as ProjectTeam[];
  },
  ['project-team-by-user-id'],
  { tags: ['project_team'], revalidate: 60 }
);

const getCachedProjectTeamAll = unstable_cache(
  async (): Promise<ProjectTeam[]> => {
    const rows = await sql`SELECT * FROM project_teams WHERE deleted_at IS NULL`;
    return rows as unknown as ProjectTeam[];
  },
  ['project-team-all'],
  { tags: ['project_team'], revalidate: 60 }
);

export const ProjectTeamRepository = {
  async findAll(): Promise<ProjectTeam[]> {
    return getCachedProjectTeamAll();
  },

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
    const res = await sql`SELECT COALESCE(MAX(NULLIF(regexp_replace(id, '\\D', '', 'g'), '')::int), 0) as max_val FROM project_teams`;
    const nextId = 'pt-' + String((res[0].max_val || 0) + 1).padStart(3, '0');
    const now = new Date().toISOString();

    const newPT: ProjectTeam = {
      id: nextId,
      project_id: projectId,
      user_id: userId,
      created_by: createdBy,
      created_at: now,
      updated_by: null,
      updated_at: null,
      deleted_by: null,
      deleted_at: null,
    };

    await sql`
      INSERT INTO project_teams (
        id, project_id, user_id, created_by, created_at, updated_by, updated_at, deleted_by, deleted_at
      ) VALUES (
        ${newPT.id}, ${newPT.project_id}, ${newPT.user_id}, ${newPT.created_by}, ${newPT.created_at},
        ${newPT.updated_by}, ${newPT.updated_at}, ${newPT.deleted_by}, ${newPT.deleted_at}
      )
    `;

    // Log team member added
    await ProjectLogRepository.create(
      {
        project_id: projectId,
        project_status_old: 'TEAM_ADD',
        project_status_new: userId,
      },
      createdBy
    );

    revalidateTag('project_team');
    revalidateTag('project_log');
    return newPT;
  },

  async softDelete(id: string, deletedBy: string): Promise<boolean> {
    const rows = await sql`SELECT * FROM project_teams WHERE id = ${id} AND deleted_at IS NULL LIMIT 1`;
    const existing = rows[0] as unknown as ProjectTeam;
    if (!existing) return false;

    const now = new Date().toISOString();

    await sql`
      UPDATE project_teams SET
        deleted_by = ${deletedBy},
        deleted_at = ${now}
      WHERE id = ${id}
    `;

    // Log team member removed
    await ProjectLogRepository.create(
      {
        project_id: existing.project_id,
        project_status_old: 'TEAM_REMOVE',
        project_status_new: existing.user_id,
      },
      deletedBy
    );

    revalidateTag('project_team');
    revalidateTag('project_log');
    return true;
  },
};

// ============ TASK REPOSITORY ============

const getCachedTasks = unstable_cache(
  async (): Promise<Task[]> => {
    const rows = await sql`SELECT * FROM tasks WHERE deleted_at IS NULL`;
    return rows as unknown as Task[];
  },
  ['tasks-all'],
  { tags: ['tasks'], revalidate: 60 }
);

const getCachedTasksByProjectId = unstable_cache(
  async (projectId: string): Promise<Task[]> => {
    const rows = await sql`SELECT * FROM tasks WHERE project_id = ${projectId} AND deleted_at IS NULL`;
    return rows as unknown as Task[];
  },
  ['tasks-by-project-id'],
  { tags: ['tasks'], revalidate: 60 }
);

const getCachedTaskById = unstable_cache(
  async (taskId: string): Promise<Task | null> => {
    const rows = await sql`SELECT * FROM tasks WHERE id = ${taskId} AND deleted_at IS NULL LIMIT 1`;
    return (rows[0] as unknown as Task) || null;
  },
  ['task-by-id'],
  { tags: ['tasks'], revalidate: 60 }
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
      task_file?: string;
      additional_link?: string;
    },
    createdBy: string
  ): Promise<Task> {
    const res = await sql`SELECT COALESCE(MAX(NULLIF(regexp_replace(id, '\\D', '', 'g'), '')::int), 0) as max_val FROM tasks`;
    const nextId = 't-' + String((res[0].max_val || 0) + 1).padStart(3, '0');
    const now = new Date().toISOString();

    const newTask: Task = {
      id: nextId,
      project_id: task.project_id,
      task_description: task.task_description,
      task_status: task.task_status ?? STATUS.NOT_STARTED,
      task_latest_percentage: task.task_latest_percentage ?? '0',
      task_file: task.task_file ?? null,
      additional_link: task.additional_link ?? null,
      created_by: createdBy,
      created_at: now,
      updated_by: null,
      updated_at: null,
      deleted_by: null,
      deleted_at: null,
    };

    await sql`
      INSERT INTO tasks (
        id, project_id, task_description, task_status, task_latest_percentage,
        task_file, additional_link, created_by, created_at, updated_by, updated_at, deleted_by, deleted_at
      ) VALUES (
        ${newTask.id}, ${newTask.project_id}, ${newTask.task_description}, ${newTask.task_status},
        ${newTask.task_latest_percentage}, ${newTask.task_file}, ${newTask.additional_link}, ${newTask.created_by}, ${newTask.created_at},
        ${newTask.updated_by}, ${newTask.updated_at}, ${newTask.deleted_by}, ${newTask.deleted_at}
      )
    `;

    // Log task creation
    await TaskLogRepository.create(
      {
        task_id: nextId,
        task_status_old: 'CREATED',
        task_status_new: newTask.task_status || STATUS.NOT_STARTED,
      },
      createdBy
    );

    // Auto-update parent project status after task change
    if (task.project_id) {
      await TaskRepository._syncProjectStatus(task.project_id, createdBy);
    }

    revalidateTag('tasks');
    revalidateTag('task_log');
    revalidateTag('projects');
    revalidateTag('project_log');
    return newTask;
  },

  async update(
    taskId: string,
    updates: Partial<Pick<Task, 'project_id' | 'task_description' | 'task_status' | 'task_latest_percentage' | 'task_file' | 'additional_link'>>,
    updatedBy: string
  ): Promise<Task | null> {
    const existing = await TaskRepository.findById(taskId);
    if (!existing) return null;

    const now = new Date().toISOString();
    const updated: Task = {
      ...existing,
      ...updates,
      updated_by: updatedBy,
      updated_at: now,
    };

    await sql`
      UPDATE tasks SET
        project_id = ${updated.project_id},
        task_description = ${updated.task_description},
        task_status = ${updated.task_status},
        task_latest_percentage = ${updated.task_latest_percentage},
        task_file = ${updated.task_file},
        additional_link = ${updated.additional_link},
        updated_by = ${updated.updated_by},
        updated_at = ${updated.updated_at}
      WHERE id = ${taskId}
    `;

    // Log metadata change (description)
    const isMetadataUpdated = updates.task_description !== undefined && updates.task_description !== existing.task_description;
    if (isMetadataUpdated) {
      await TaskLogRepository.create(
        {
          task_id: taskId,
          task_status_old: 'UPDATED',
          task_status_new: 'metadata',
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
    if (existing.project_id) {
      await TaskRepository._syncProjectStatus(existing.project_id, updatedBy);
    }
    if (updated.project_id && updated.project_id !== existing.project_id) {
      await TaskRepository._syncProjectStatus(updated.project_id, updatedBy);
    }

    revalidateTag('tasks');
    revalidateTag('task_log');
    revalidateTag('projects');
    revalidateTag('project_log');
    return updated;
  },

  async softDelete(taskId: string, deletedBy: string): Promise<boolean> {
    const existing = await TaskRepository.findById(taskId);
    if (!existing) return false;

    const now = new Date().toISOString();

    await sql`
      UPDATE tasks SET
        deleted_by = ${deletedBy},
        deleted_at = ${now}
      WHERE id = ${taskId}
    `;

    // Auto-update parent project status after task change
    const projectId = existing.project_id;
    if (projectId) {
      await TaskRepository._syncProjectStatus(projectId, deletedBy);
    }

    revalidateTag('tasks');
    revalidateTag('projects');
    revalidateTag('project_log');
    return true;
  },

  /**
   * Sync project status based on its tasks' statuses.
   * Called automatically when tasks change.
   */
  async _syncProjectStatus(projectId: string, updatedBy: string): Promise<void> {
    const allTasks = await TaskRepository.findAll();
    const autoStatus = calcProjectStatus(projectId, allTasks);

    const projRows = await sql`SELECT * FROM projects WHERE project_id = ${projectId} AND deleted_at IS NULL LIMIT 1`;
    const existing = projRows[0] as unknown as Project;
    if (!existing) return;

    if (existing.project_status !== autoStatus) {
      const now = new Date().toISOString();
      await sql`
        UPDATE projects SET
          project_status = ${autoStatus},
          updated_by = ${updatedBy},
          updated_at = ${now}
        WHERE project_id = ${projectId}
      `;

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
};

// ============ TASK TEAM REPOSITORY ============

const getCachedTaskTeamByTaskId = unstable_cache(
  async (taskId: string): Promise<TaskTeam[]> => {
    const rows = await sql`SELECT * FROM task_teams WHERE task_id = ${taskId} AND deleted_at IS NULL`;
    return rows as unknown as TaskTeam[];
  },
  ['task-team-by-task-id'],
  { tags: ['task_team'], revalidate: 60 }
);

const getCachedTaskTeamByUserId = unstable_cache(
  async (userId: string): Promise<TaskTeam[]> => {
    const rows = await sql`SELECT * FROM task_teams WHERE user_id = ${userId} AND deleted_at IS NULL`;
    return rows as unknown as TaskTeam[];
  },
  ['task-team-by-user-id'],
  { tags: ['task_team'], revalidate: 60 }
);

const getCachedTaskTeamAll = unstable_cache(
  async (): Promise<TaskTeam[]> => {
    const rows = await sql`SELECT * FROM task_teams WHERE deleted_at IS NULL`;
    return rows as unknown as TaskTeam[];
  },
  ['task-team-all'],
  { tags: ['task_team'], revalidate: 60 }
);

export const TaskTeamRepository = {
  async findAll(): Promise<TaskTeam[]> {
    return getCachedTaskTeamAll();
  },

  async findByTaskId(taskId: string): Promise<TaskTeam[]> {
    return getCachedTaskTeamByTaskId(taskId);
  },

  async findByUserId(userId: string): Promise<TaskTeam[]> {
    return getCachedTaskTeamByUserId(userId);
  },

  async create(taskId: string, userId: string, createdBy: string): Promise<TaskTeam> {
    const res = await sql`SELECT COALESCE(MAX(NULLIF(regexp_replace(id, '\\D', '', 'g'), '')::int), 0) as max_val FROM task_teams`;
    const nextId = 'tt-' + String((res[0].max_val || 0) + 1).padStart(3, '0');
    const now = new Date().toISOString();

    const newTT: TaskTeam = {
      id: nextId,
      task_id: taskId,
      user_id: userId,
      created_by: createdBy,
      created_at: now,
      updated_by: null,
      updated_at: null,
      deleted_by: null,
      deleted_at: null,
    };

    await sql`
      INSERT INTO task_teams (
        id, task_id, user_id, created_by, created_at, updated_by, updated_at, deleted_by, deleted_at
      ) VALUES (
        ${newTT.id}, ${newTT.task_id}, ${newTT.user_id}, ${newTT.created_by}, ${newTT.created_at},
        ${newTT.updated_by}, ${newTT.updated_at}, ${newTT.deleted_by}, ${newTT.deleted_at}
      )
    `;

    // Log team member added to task
    await TaskLogRepository.create(
      {
        task_id: taskId,
        task_status_old: 'TEAM_ADD',
        task_status_new: userId,
      },
      createdBy
    );

    revalidateTag('task_team');
    revalidateTag('task_log');
    return newTT;
  },

  async softDelete(id: string, deletedBy: string): Promise<boolean> {
    const rows = await sql`SELECT * FROM task_teams WHERE id = ${id} AND deleted_at IS NULL LIMIT 1`;
    const existing = rows[0] as unknown as TaskTeam;
    if (!existing) return false;

    const now = new Date().toISOString();

    await sql`
      UPDATE task_teams SET
        deleted_by = ${deletedBy},
        deleted_at = ${now}
      WHERE id = ${id}
    `;

    // Log team member removed from task
    await TaskLogRepository.create(
      {
        task_id: existing.task_id,
        task_status_old: 'TEAM_REMOVE',
        task_status_new: existing.user_id,
      },
      deletedBy
    );

    revalidateTag('task_team');
    revalidateTag('task_log');
    return true;
  },
};

// ============ DAILY REPORT REPOSITORY ============

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
    const res = await sql`SELECT COALESCE(MAX(NULLIF(regexp_replace(report_id, '\\D', '', 'g'), '')::int), 0) as max_val FROM daily_reports`;
    const nextId = 'r-' + String((res[0].max_val || 0) + 1).padStart(3, '0');
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

    // Log report submission
    await TaskLogRepository.create(
      {
        task_id: report.task_id,
        task_status_old: 'REPORT_SUBMIT',
        task_status_new: report.progress_percentage,
      },
      createdBy
    );

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
      await TaskRepository._syncProjectStatus(task.project_id, updatedBy);
    }
  },
};

// ============ STATUS REPOSITORY ============

const getCachedStatuses = unstable_cache(
  async (): Promise<Status[]> => {
    const rows = await sql`SELECT * FROM statuses`;
    return rows as unknown as Status[];
  },
  ['statuses-all'],
  { tags: ['statuses'] }
);

const getCachedStatusById = unstable_cache(
  async (id: string): Promise<Status | null> => {
    const rows = await sql`SELECT * FROM statuses WHERE id = ${id} LIMIT 1`;
    return (rows[0] as unknown as Status) || null;
  },
  ['status-by-id'],
  { tags: ['statuses'] }
);

export const StatusRepository = {
  async findAll(): Promise<Status[]> {
    return getCachedStatuses();
  },

  async findById(id: string): Promise<Status | null> {
    return getCachedStatusById(id);
  },
};

// ============ PROJECT LOG REPOSITORY ============

const getCachedProjectLogsByProjectId = unstable_cache(
  async (projectId: string): Promise<ProjectLog[]> => {
    const rows = await sql`SELECT * FROM project_logs WHERE project_id = ${projectId}`;
    return rows as unknown as ProjectLog[];
  },
  ['project-logs-by-project-id'],
  { tags: ['project_log'] }
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
    const res = await sql`SELECT COALESCE(MAX(NULLIF(split_part(id, '-', 2), '')::int), 0) as max_val FROM project_logs`;
    const nextId = 'pl-' + String((res[0].max_val || 0) + 1).padStart(3, '0') + '-' + Math.random().toString(36).substring(2, 7);
    const now = new Date().toISOString();

    const newLog: ProjectLog = {
      id: nextId,
      project_id: log.project_id,
      project_status_old: log.project_status_old,
      project_status_new: log.project_status_new,
      created_by: createdBy,
      created_at: now,
    };

    await sql`
      INSERT INTO project_logs (
        id, project_id, project_status_old, project_status_new, created_by, created_at
      ) VALUES (
        ${newLog.id}, ${newLog.project_id}, ${newLog.project_status_old}, ${newLog.project_status_new},
        ${newLog.created_by}, ${newLog.created_at}
      )
    `;

    revalidateTag('project_log');
    return newLog;
  },

  async findByProjectId(projectId: string): Promise<ProjectLog[]> {
    return getCachedProjectLogsByProjectId(projectId);
  },
};

// ============ TASK LOG REPOSITORY ============

const getCachedTaskLogsByTaskId = unstable_cache(
  async (taskId: string): Promise<TaskLog[]> => {
    const rows = await sql`SELECT * FROM task_logs WHERE task_id = ${taskId}`;
    return rows as unknown as TaskLog[];
  },
  ['task-logs-by-task-id'],
  { tags: ['task_log'] }
);

export const TaskLogRepository = {
  async create(
    log: {
      task_id: string;
      task_status_old: string | null;
      task_status_new: string;
    },
    createdBy: string
  ): Promise<TaskLog> {
    const res = await sql`SELECT COALESCE(MAX(NULLIF(split_part(id, '-', 2), '')::int), 0) as max_val FROM task_logs`;
    const nextId = 'tl-' + String((res[0].max_val || 0) + 1).padStart(3, '0') + '-' + Math.random().toString(36).substring(2, 7);
    const now = new Date().toISOString();

    const newLog: TaskLog = {
      id: nextId,
      task_id: log.task_id,
      task_status_old: log.task_status_old,
      task_status_new: log.task_status_new,
      created_by: createdBy,
      created_at: now,
    };

    await sql`
      INSERT INTO task_logs (
        id, task_id, task_status_old, task_status_new, created_by, created_at
      ) VALUES (
        ${newLog.id}, ${newLog.task_id}, ${newLog.task_status_old}, ${newLog.task_status_new},
        ${newLog.created_by}, ${newLog.created_at}
      )
    `;

    revalidateTag('task_log');
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
      const proj = await ProjectRepository.findById(options.projectId);
      mostActiveProject = proj?.project_name || options.projectId;
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

// ============ USER-SCOPED FILTERING ============

export async function getUserProjectIds(userId: string): Promise<string[]> {
  const projectTeams = await ProjectTeamRepository.findByUserId(userId);
  return [...new Set(projectTeams.map((pt) => pt.project_id))];
}

export async function getUserTaskIds(userId: string): Promise<string[]> {
  const taskTeams = await TaskTeamRepository.findByUserId(userId);
  return [...new Set(taskTeams.map((tt) => tt.task_id))];
}

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
  { tags: ['users'], revalidate: 60 }
);

export async function getUserMap(): Promise<Record<string, string>> {
  return getCachedUserMap();
}

export async function resolveUserName(userId: string | null | undefined): Promise<string> {
  if (!userId) return '—';
  const map = await getUserMap();
  return map[userId] ?? userId;
}

export async function resolveUserNames(userIds: (string | null | undefined)[]): Promise<string> {
  const valid = userIds.filter((id): id is string => !!id);
  if (valid.length === 0) return '—';
  const map = await getUserMap();
  return valid.map((id) => map[id] ?? id).join(', ');
}

export function invalidateUserMap() {
  revalidateTag('users');
}

// ============ TRASH / SOFT-DELETED RECORDS ============

const getCachedAllProjectsIncludingDeleted = unstable_cache(
  async (): Promise<Project[]> => {
    const rows = await sql`SELECT * FROM projects`;
    return rows as unknown as Project[];
  },
  ['projects-all-incl-deleted'],
  { tags: ['projects'], revalidate: 60 }
);

export async function findAllProjectsIncludingDeleted(): Promise<Project[]> {
  return getCachedAllProjectsIncludingDeleted();
}

const getCachedAllTasksIncludingDeleted = unstable_cache(
  async (): Promise<Task[]> => {
    const rows = await sql`SELECT * FROM tasks`;
    return rows as unknown as Task[];
  },
  ['tasks-all-incl-deleted'],
  { tags: ['tasks'], revalidate: 60 }
);

export async function findAllTasksIncludingDeleted(): Promise<Task[]> {
  return getCachedAllTasksIncludingDeleted();
}

const getCachedAllReportsIncludingDeleted = unstable_cache(
  async (): Promise<DailyReport[]> => {
    const rows = await sql`SELECT * FROM daily_reports`;
    return rows as unknown as DailyReport[];
  },
  ['reports-all-incl-deleted'],
  { tags: ['reports'], revalidate: 60 }
);

export async function findAllReportsIncludingDeleted(): Promise<DailyReport[]> {
  return getCachedAllReportsIncludingDeleted();
}

/** Restore a soft-deleted project */
export async function restoreProject(projectId: string, restoredBy: string): Promise<boolean> {
  await sql`
    UPDATE projects SET
      deleted_by = NULL,
      deleted_at = NULL
    WHERE project_id = ${projectId}
  `;

  await ProjectLogRepository.create(
    {
      project_id: projectId,
      project_status_old: 'RESTORED',
      project_status_new: '',
    },
    restoredBy
  );

  revalidateTag('projects');
  revalidateTag('project_log');
  return true;
}

/** Restore a soft-deleted task */
export async function restoreTask(taskId: string, restoredBy: string): Promise<boolean> {
  await sql`
    UPDATE tasks SET
      deleted_by = NULL,
      deleted_at = NULL
    WHERE id = ${taskId}
  `;

  await TaskLogRepository.create(
    {
      task_id: taskId,
      task_status_old: 'RESTORED',
      task_status_new: '',
    },
    restoredBy
  );

  revalidateTag('tasks');
  revalidateTag('task_log');
  revalidateTag('projects');
  revalidateTag('project_log');
  return true;
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

// ============ FILE REPOSITORY ============

const getCachedFiles = unstable_cache(
  async (): Promise<FileRecord[]> => {
    const rows = await sql`SELECT * FROM files WHERE deleted_at IS NULL`;
    return rows as unknown as FileRecord[];
  },
  ['files-all'],
  { tags: ['files'], revalidate: 60 }
);

const getCachedFilesByProjectId = unstable_cache(
  async (projectId: string): Promise<FileRecord[]> => {
    const rows = await sql`SELECT * FROM files WHERE project_id = ${projectId} AND deleted_at IS NULL`;
    return rows as unknown as FileRecord[];
  },
  ['files-by-project-id'],
  { tags: ['files'], revalidate: 60 }
);

const getCachedFilesByTaskId = unstable_cache(
  async (taskId: string): Promise<FileRecord[]> => {
    const rows = await sql`SELECT * FROM files WHERE task_id = ${taskId} AND deleted_at IS NULL`;
    return rows as unknown as FileRecord[];
  },
  ['files-by-task-id'],
  { tags: ['files'], revalidate: 60 }
);

const getCachedFilesByReportId = unstable_cache(
  async (reportId: string): Promise<FileRecord[]> => {
    const rows = await sql`SELECT * FROM files WHERE report_id = ${reportId} AND deleted_at IS NULL`;
    return rows as unknown as FileRecord[];
  },
  ['files-by-report-id'],
  { tags: ['files'], revalidate: 60 }
);

export const FileRepository = {
  async findAll(): Promise<FileRecord[]> {
    return getCachedFiles();
  },

  async findByProjectId(projectId: string): Promise<FileRecord[]> {
    return getCachedFilesByProjectId(projectId);
  },

  async findByTaskId(taskId: string): Promise<FileRecord[]> {
    return getCachedFilesByTaskId(taskId);
  },

  async findByReportId(reportId: string): Promise<FileRecord[]> {
    return getCachedFilesByReportId(reportId);
  },

  async create(
    fileData: {
      project_id: string | null;
      task_id: string | null;
      report_id: string | null;
      file_url: string;
      file_description: string | null;
    },
    createdBy: string
  ): Promise<FileRecord> {
    const res = await sql`SELECT COALESCE(MAX(NULLIF(regexp_replace(id, '\\D', '', 'g'), '')::int), 0) as max_val FROM files`;
    const nextId = 'f-' + String((res[0].max_val || 0) + 1).padStart(3, '0');
    const now = new Date().toISOString();

    const newFile: FileRecord = {
      id: nextId,
      project_id: fileData.project_id || null,
      task_id: fileData.task_id || null,
      report_id: fileData.report_id || null,
      file_url: fileData.file_url,
      file_description: fileData.file_description || null,
      created_by: createdBy,
      created_at: now,
      updated_by: null,
      updated_at: null,
      deleted_by: null,
      deleted_at: null,
    };

    await sql`
      INSERT INTO files (
        id, project_id, task_id, report_id, file_url, file_description,
        created_by, created_at, updated_by, updated_at, deleted_by, deleted_at
      ) VALUES (
        ${newFile.id}, ${newFile.project_id}, ${newFile.task_id}, ${newFile.report_id},
        ${newFile.file_url}, ${newFile.file_description}, ${newFile.created_by}, ${newFile.created_at},
        ${newFile.updated_by}, ${newFile.updated_at}, ${newFile.deleted_by}, ${newFile.deleted_at}
      )
    `;

    revalidateTag('files');
    return newFile;
  },

  async softDelete(fileId: string, deletedBy: string): Promise<boolean> {
    const now = new Date().toISOString();
    await sql`
      UPDATE files SET
        deleted_by = ${deletedBy},
        deleted_at = ${now}
      WHERE id = ${fileId}
    `;

    revalidateTag('files');
    return true;
  },
};

// ============ COMMENT REPOSITORY ============

export const CommentRepository = {
  async findById(id: string): Promise<Comment | null> {
    const rows = await sql`SELECT * FROM comments WHERE id = ${id}`;
    if (rows.length === 0) return null;
    return rows[0] as unknown as Comment;
  },

  async findByProjectId(projectId: string): Promise<Comment[]> {
    const rows = await sql`SELECT * FROM comments WHERE project_id = ${projectId} ORDER BY created_at ASC`;
    return rows as unknown as Comment[];
  },

  async findByTaskId(taskId: string): Promise<Comment[]> {
    const rows = await sql`SELECT * FROM comments WHERE task_id = ${taskId} ORDER BY created_at ASC`;
    return rows as unknown as Comment[];
  },

  async create(
    comment: {
      project_id: string | null;
      task_id: string | null;
      parent_id: string | null;
      content: string;
    },
    createdBy: string
  ): Promise<Comment> {
    const res = await sql`SELECT COALESCE(MAX(NULLIF(regexp_replace(id, '\\D', '', 'g'), '')::int), 0) as max_val FROM comments`;
    const nextId = 'c-' + String((res[0].max_val || 0) + 1).padStart(3, '0');
    const now = new Date().toISOString();

    const newComment: Comment = {
      id: nextId,
      project_id: comment.project_id,
      task_id: comment.task_id,
      parent_id: comment.parent_id ?? null,
      content: comment.content,
      created_by: createdBy,
      created_at: now,
    };

    await sql`
      INSERT INTO comments (
        id, project_id, task_id, parent_id, content, created_by, created_at
      ) VALUES (
        ${newComment.id}, ${newComment.project_id}, ${newComment.task_id}, ${newComment.parent_id}, ${newComment.content},
        ${newComment.created_by}, ${newComment.created_at}
      )
    `;

    return newComment;
  },
};

// ============ NOTIFICATION REPOSITORY ============

export const NotificationRepository = {
  async findByUserId(userId: string): Promise<Notification[]> {
    const rows = await sql`SELECT * FROM notifications WHERE user_id = ${userId} ORDER BY created_at DESC`;
    return rows as unknown as Notification[];
  },

  async findPaginated(userId: string, limit: number, offset: number): Promise<Notification[]> {
    const rows = await sql`
      SELECT * FROM notifications 
      WHERE user_id = ${userId} 
      ORDER BY created_at DESC 
      LIMIT ${limit} OFFSET ${offset}
    `;
    return rows as unknown as Notification[];
  },

  async findUnreadCount(userId: string): Promise<number> {
    const res = await sql`SELECT COUNT(*)::int as count FROM notifications WHERE user_id = ${userId} AND is_read = false`;
    return res[0].count || 0;
  },

  async markAsRead(id: string, userId: string): Promise<boolean> {
    await sql`UPDATE notifications SET is_read = true WHERE id = ${id} AND user_id = ${userId}`;
    return true;
  },

  async markAllAsRead(userId: string): Promise<boolean> {
    await sql`UPDATE notifications SET is_read = true WHERE user_id = ${userId}`;
    return true;
  },

  async create(
    notification: {
      user_id: string;
      type: string;
      title: string;
      content: string;
      link: string;
    }
  ): Promise<Notification> {
    const res = await sql`SELECT COALESCE(MAX(NULLIF(regexp_replace(id, '\\D', '', 'g'), '')::int), 0) as max_val FROM notifications`;
    const nextId = 'n-' + String((res[0].max_val || 0) + 1).padStart(3, '0');
    const now = new Date().toISOString();

    const newNotification: Notification = {
      id: nextId,
      user_id: notification.user_id,
      type: notification.type,
      title: notification.title,
      content: notification.content,
      link: notification.link,
      is_read: false,
      created_at: now,
    };

    await sql`
      INSERT INTO notifications (
        id, user_id, type, title, content, link, is_read, created_at
      ) VALUES (
        ${newNotification.id}, ${newNotification.user_id}, ${newNotification.type}, ${newNotification.title},
        ${newNotification.content}, ${newNotification.link}, ${newNotification.is_read}, ${newNotification.created_at}
      )
    `;

    return newNotification;
  },
};
