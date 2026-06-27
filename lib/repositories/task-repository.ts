import { sql } from '../db';
import type { Task, TaskTeam, TaskLog, Comment, User } from '../types';
import { unstable_cache, revalidateTag, calcProjectStatus, STATUS } from './shared';
import { UserRepository, getUserLevel } from './user-repository';
import { RoleLevelRepository } from './role-level-repository';
import { isSupervised } from './project-repository';
import { randomUUID } from 'crypto';

// ============ CACHING HELPERS ============

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

const getCachedTaskTeamAll = unstable_cache(
  async (): Promise<TaskTeam[]> => {
    const rows = await sql`SELECT * FROM task_teams WHERE deleted_at IS NULL`;
    return rows as unknown as TaskTeam[];
  },
  ['task-team-all'],
  { tags: ['task_team'], revalidate: 60 }
);

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

const getCachedTaskLogsByTaskId = unstable_cache(
  async (taskId: string): Promise<TaskLog[]> => {
    const rows = await sql`SELECT * FROM task_logs WHERE task_id = ${taskId}`;
    return rows as unknown as TaskLog[];
  },
  ['task-logs-by-task-id'],
  { tags: ['task_log'] }
);

const getCachedAllTasksIncludingDeleted = unstable_cache(
  async (): Promise<Task[]> => {
    const rows = await sql`SELECT * FROM tasks`;
    return rows as unknown as Task[];
  },
  ['tasks-all-incl-deleted'],
  { tags: ['tasks'], revalidate: 60 }
);

// ============ TASK REPOSITORY ============

export const TaskRepository = {
  async findAll(userId?: string): Promise<Task[]> {
    if (!userId) {
      return getCachedTasks();
    }

    const user = await UserRepository.findById(userId);
    if (!user) return [];

    const level = await getUserLevel(user.user_occupation);
    if (level >= 6) {
      return sql`SELECT * FROM tasks WHERE deleted_at IS NULL ORDER BY created_at DESC` as unknown as Task[];
    }

    let scopeCondition = '';
    const params: any[] = [userId];

    const viewerOcc = (user.user_occupation || '').toLowerCase().trim();
    if (viewerOcc === 'kepala departement' || viewerOcc === 'kepala department') {
      params.push(user.user_departement || '');
      scopeCondition = `(LOWER(u.user_departement) = LOWER($2) OR LOWER(mu.user_departement) = LOWER($2))`;
    } else if (viewerOcc === 'site manager' || viewerOcc === 'site admin' || level === 5) {
      params.push(user.user_site || '');
      scopeCondition = `(LOWER(u.user_site) = LOWER($2) OR LOWER(mu.user_site) = LOWER($2))`;
    } else if (
      viewerOcc === 'divisi manager' || 
      viewerOcc === 'divisi admin' || 
      viewerOcc === 'div manager' || 
      viewerOcc === 'div admin' || 
      level === 4 || 
      level === 3
    ) {
      params.push(user.user_division || '');
      scopeCondition = `(LOWER(u.user_division) = LOWER($2) OR LOWER(mu.user_division) = LOWER($2))`;
    } else if (viewerOcc === 'team leader' || level === 2) {
      params.push(user.user_team || '');
      scopeCondition = `(LOWER(u.user_team) = LOWER($2) OR LOWER(mu.user_team) = LOWER($2))`;
    }

    let query = `
      SELECT t.*
      FROM tasks t
      LEFT JOIN users u ON t.created_by = u.user_id
      LEFT JOIN task_teams tt ON t.id = tt.task_id AND tt.deleted_at IS NULL
      LEFT JOIN users mu ON tt.user_id = mu.user_id
      WHERE t.deleted_at IS NULL 
        AND (
          t.created_by = $1
          OR tt.user_id = $1
    `;

    if (scopeCondition) {
      query += ` OR ${scopeCondition}`;
    }

    query += `) GROUP BY t.id ORDER BY t.created_at DESC`;

    const rows = await sql.unsafe(query, params);
    return rows as unknown as Task[];
  },

  async findPaginated(userId: string, filters: any, limit: number, offset: number): Promise<{ data: Task[], total: number }> {
    const user = await UserRepository.findById(userId);
    if (!user) return { data: [], total: 0 };
    const level = await getUserLevel(user.user_occupation);

    const conditions = ["t.deleted_at IS NULL"];
    const params: any[] = [];
    let paramIndex = 1;

    // RBAC
    if (level < 6) {
      let rbacCondition = `(t.created_by = $${paramIndex} OR tt.user_id = $${paramIndex})`;
      params.push(userId);
      paramIndex++;

      const viewerOcc = (user.user_occupation || '').toLowerCase().trim();
      let scopeCondition = '';
      if (viewerOcc === 'kepala departement' || viewerOcc === 'kepala department') {
        params.push(user.user_departement || '');
        scopeCondition = `(LOWER(u.user_departement) = LOWER($${paramIndex}) OR LOWER(mu.user_departement) = LOWER($${paramIndex}))`;
        paramIndex++;
      } else if (viewerOcc === 'site manager' || viewerOcc === 'site admin' || level === 5) {
        params.push(user.user_site || '');
        scopeCondition = `(LOWER(u.user_site) = LOWER($${paramIndex}) OR LOWER(mu.user_site) = LOWER($${paramIndex}))`;
        paramIndex++;
      } else if (viewerOcc === 'divisi manager' || viewerOcc === 'divisi admin' || viewerOcc === 'div manager' || viewerOcc === 'div admin' || level === 4 || level === 3) {
        params.push(user.user_division || '');
        scopeCondition = `(LOWER(u.user_division) = LOWER($${paramIndex}) OR LOWER(mu.user_division) = LOWER($${paramIndex}))`;
        paramIndex++;
      } else if (viewerOcc === 'team leader' || level === 2) {
        params.push(user.user_team || '');
        scopeCondition = `(LOWER(u.user_team) = LOWER($${paramIndex}) OR LOWER(mu.user_team) = LOWER($${paramIndex}))`;
        paramIndex++;
      }

      if (scopeCondition) {
        rbacCondition = `(${rbacCondition} OR ${scopeCondition})`;
      }
      conditions.push(rbacCondition);
    }

    if (filters.viewMode === 'my') {
       conditions.push(`(t.created_by = $${paramIndex} OR tt.user_id = $${paramIndex})`);
       params.push(userId);
       paramIndex++;
    }

    if (filters.dept_filter) {
       conditions.push(`LOWER(u.user_departement) = LOWER($${paramIndex})`);
       params.push(filters.dept_filter);
       paramIndex++;
    }
    if (filters.site_filter) {
       conditions.push(`LOWER(u.user_site) = LOWER($${paramIndex})`);
       params.push(filters.site_filter);
       paramIndex++;
    }
    if (filters.div_filter) {
       conditions.push(`LOWER(u.user_division) = LOWER($${paramIndex})`);
       params.push(filters.div_filter);
       paramIndex++;
    }
    if (filters.team_filter) {
       conditions.push(`LOWER(u.user_team) = LOWER($${paramIndex})`);
       params.push(filters.team_filter);
       paramIndex++;
    }
    if (filters.project_id) {
       conditions.push(`t.project_id = $${paramIndex}`);
       params.push(filters.project_id);
       paramIndex++;
    }
    if (filters.status) {
       conditions.push(`t.task_status = $${paramIndex}`);
       params.push(filters.status);
       paramIndex++;
    }
    if (filters.created_by) {
       conditions.push(`t.created_by = $${paramIndex}`);
       params.push(filters.created_by);
       paramIndex++;
    }
    if (filters.member_id) {
       conditions.push(`(t.created_by = $${paramIndex} OR tt.user_id = $${paramIndex})`);
       params.push(filters.member_id);
       paramIndex++;
    }
    if (filters.search) {
       const q = `%${filters.search.toLowerCase()}%`;
       conditions.push(`(
         LOWER(t.task_description) LIKE $${paramIndex} OR 
         LOWER(u.user_name) LIKE $${paramIndex} OR
         LOWER(mu.user_name) LIKE $${paramIndex}
       )`);
       params.push(q);
       paramIndex++;
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const countQuery = `
      SELECT COUNT(DISTINCT t.id)::int as count
      FROM tasks t
      LEFT JOIN users u ON t.created_by = u.user_id
      LEFT JOIN task_teams tt ON t.id = tt.task_id AND tt.deleted_at IS NULL
      LEFT JOIN users mu ON tt.user_id = mu.user_id
      ${whereClause}
    `;

    const dataQuery = `
      SELECT t.*
      FROM tasks t
      LEFT JOIN users u ON t.created_by = u.user_id
      LEFT JOIN task_teams tt ON t.id = tt.task_id AND tt.deleted_at IS NULL
      LEFT JOIN users mu ON tt.user_id = mu.user_id
      ${whereClause}
      GROUP BY t.id
      ORDER BY t.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const dataParams = [...params, limit, offset];
    
    const countRes = await sql.unsafe(countQuery, params);
    const total = countRes[0]?.count || 0;

    const rows = await sql.unsafe(dataQuery, dataParams);
    
    return { data: rows as unknown as Task[], total };
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
    const lastRow = await sql`SELECT id FROM tasks ORDER BY id DESC LIMIT 1`;
    const lastId = lastRow[0]?.id || 'T-00000';
    const lastNum = parseInt(lastId.replace('T-', ''), 10) || 0;
    const nextId = 'T-' + String(lastNum + 1).padStart(5, '0');
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

    if (existing.project_id) {
      await TaskRepository._syncProjectStatus(existing.project_id, deletedBy);
    }

    revalidateTag('tasks');
    return true;
  },

  async _syncProjectStatus(projectId: string, userId: string) {
    const allTasks = await TaskRepository.findByProjectId(projectId);
    const newStatus = calcProjectStatus(projectId, allTasks);
    // Direct SQL update to decouple from ProjectRepository
    await sql`
      UPDATE projects SET
        project_status = ${newStatus},
        updated_by = ${userId},
        updated_at = ${new Date().toISOString()}
      WHERE project_id = ${projectId}
    `;
    revalidateTag('projects');
    revalidateTag('project_log');
  }
};

// ============ TASK TEAM REPOSITORY ============

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

  async create(
    taskId: string,
    userId: string,
    createdBy: string
  ): Promise<TaskTeam> {
    const nextId = 'tt-' + randomUUID();
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

// ============ TASK LOG REPOSITORY ============

export const TaskLogRepository = {
  async create(
    log: {
      task_id: string;
      task_status_old: string | null;
      task_status_new: string;
    },
    createdBy: string
  ): Promise<TaskLog> {
    const nextId = 'tl-' + randomUUID();
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
    const nextId = 'c-' + randomUUID();
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

// ============ USER-SCOPED FILTERING HELPERS ============

export async function getUserTaskIds(userId: string): Promise<string[]> {
  const taskTeams = await TaskTeamRepository.findByUserId(userId);
  return [...new Set(taskTeams.map((tt) => tt.task_id))];
}

export async function filterTasksByUser(
  tasks: Task[],
  userId: string
): Promise<Task[]> {
  if (!userId) return tasks;
  const user = await UserRepository.findById(userId);
  if (!user) return [];

  const level = await getUserLevel(user.user_occupation);
  if (level >= 6) return tasks;

  const allUsers = await UserRepository.findAll();
  const userMap = new Map(allUsers.map((u) => [u.user_id, u]));

  const roles = await RoleLevelRepository.findAll();
  const roleLevelMap = new Map<string, number>();
  for (const r of roles) {
    roleLevelMap.set(r.role_name.toLowerCase(), r.level);
  }

  // Pre-fetch task team mappings
  const allTaskTeams = await sql`SELECT task_id, user_id FROM task_teams WHERE deleted_at IS NULL`;
  const taskTeamMap = new Map<string, string[]>();
  for (const tt of allTaskTeams) {
    const list = taskTeamMap.get(tt.task_id) || [];
    list.push(tt.user_id);
    taskTeamMap.set(tt.task_id, list);
  }

  return tasks.filter((t) => {
    if (t.created_by === userId) return true;

    const teamMembers = taskTeamMap.get(t.id) || [];
    if (teamMembers.includes(userId)) return true;

    // Check if creator is supervised
    if (t.created_by) {
      const creatorUser = userMap.get(t.created_by);
      if (creatorUser && isSupervised(user, level, creatorUser, roleLevelMap)) return true;
    }

    // Check if any team member is supervised
    for (const memberId of teamMembers) {
      const memberUser = userMap.get(memberId);
      if (memberUser && isSupervised(user, level, memberUser, roleLevelMap)) return true;
    }

    return false;
  });
}

export async function hasTaskWritePermission(taskId: string, userId: string): Promise<boolean> {
  const task = await TaskRepository.findById(taskId);
  if (!task) return false;

  const user = await UserRepository.findById(userId);
  if (!user) return false;

  const userLevel = await getUserLevel(user.user_occupation);
  if (userLevel === 7) return true; // Super User has full access

  const taskTeam = await TaskTeamRepository.findByTaskId(taskId);
  const isTaskTeamMember = taskTeam.some((tt) => tt.user_id === userId);
  const isCreatedBy = task.created_by === userId;

  // Direct SQL queries to check parent project to avoid importing ProjectRepository / ProjectTeamRepository
  const projectTeam = (await sql`SELECT * FROM project_teams WHERE project_id = ${task.project_id} AND deleted_at IS NULL`) as unknown as any[];
  const isProjectTeamMember = projectTeam.some((pt) => pt.user_id === userId);
  
  const project = (await sql`SELECT * FROM projects WHERE project_id = ${task.project_id} AND deleted_at IS NULL LIMIT 1`) as unknown as any[];
  const isProjectCreator = project.length > 0 ? project[0].created_by === userId : false;

  return isTaskTeamMember || isProjectTeamMember || isCreatedBy || isProjectCreator;
}

export async function findAllTasksIncludingDeleted(userId?: string): Promise<Task[]> {
  if (!userId) {
    return getCachedAllTasksIncludingDeleted();
  }

  const user = await UserRepository.findById(userId);
  if (!user) return [];

  const level = await getUserLevel(user.user_occupation);
  if (level >= 6) {
    return sql.unsafe(`SELECT * FROM tasks ORDER BY created_at DESC`) as unknown as Task[];
  }

  let scopeCondition = '';
  const params: any[] = [userId];

  const viewerOcc = (user.user_occupation || '').toLowerCase().trim();
  if (viewerOcc === 'kepala departement' || viewerOcc === 'kepala department') {
    params.push(user.user_departement || '');
    scopeCondition = `(LOWER(u.user_departement) = LOWER($2) OR LOWER(mu.user_departement) = LOWER($2))`;
  } else if (viewerOcc === 'site manager' || viewerOcc === 'site admin' || level === 5) {
    params.push(user.user_site || '');
    scopeCondition = `(LOWER(u.user_site) = LOWER($2) OR LOWER(mu.user_site) = LOWER($2))`;
  } else if (
    viewerOcc === 'divisi manager' || 
    viewerOcc === 'divisi admin' || 
    viewerOcc === 'div manager' || 
    viewerOcc === 'div admin' || 
    level === 4 || 
    level === 3
  ) {
    params.push(user.user_division || '');
    scopeCondition = `(LOWER(u.user_division) = LOWER($2) OR LOWER(mu.user_division) = LOWER($2))`;
  } else if (viewerOcc === 'team leader' || level === 2) {
    params.push(user.user_team || '');
    scopeCondition = `(LOWER(u.user_team) = LOWER($2) OR LOWER(mu.user_team) = LOWER($2))`;
  }

  let query = `
    SELECT t.*
    FROM tasks t
    LEFT JOIN users u ON t.created_by = u.user_id
    LEFT JOIN task_teams tt ON t.id = tt.task_id AND tt.deleted_at IS NULL
    LEFT JOIN users mu ON tt.user_id = mu.user_id
    WHERE (
        t.created_by = $1
        OR tt.user_id = $1
  `;

  if (scopeCondition) {
    query += ` OR ${scopeCondition}`;
  }

  query += `) GROUP BY t.id ORDER BY t.created_at DESC`;

  const rows = await sql.unsafe(query, params);
  return rows as unknown as Task[];
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

  // Decoupled sync parent project status after restore
  const task = await TaskRepository.findById(taskId);
  if (task && task.project_id) {
    await TaskRepository._syncProjectStatus(task.project_id, restoredBy);
  }

  revalidateTag('tasks');
  revalidateTag('task_log');
  return true;
}
