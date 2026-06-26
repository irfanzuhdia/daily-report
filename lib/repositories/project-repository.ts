import { sql } from '../db';
import type { Project, ProjectTeam, ProjectLog, Task, User } from '../types';
import { unstable_cache, revalidateTag, calcProjectStatus, STATUS } from './shared';
import { UserRepository, getUserLevel } from './user-repository';
import { RoleLevelRepository } from './role-level-repository';
import { randomUUID } from 'crypto';

// ============ CACHING HELPERS ============

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

const getCachedProjectLogsByProjectId = unstable_cache(
  async (projectId: string): Promise<ProjectLog[]> => {
    const rows = await sql`SELECT * FROM project_logs WHERE project_id = ${projectId}`;
    return rows as unknown as ProjectLog[];
  },
  ['project-logs-by-project-id'],
  { tags: ['project_log'] }
);

const getCachedAllProjectsIncludingDeleted = unstable_cache(
  async (): Promise<Project[]> => {
    const rows = await sql`SELECT * FROM projects`;
    return rows as unknown as Project[];
  },
  ['projects-all-incl-deleted'],
  { tags: ['projects'], revalidate: 60 }
);

async function syncTicketStatus(ticketId: string | null | undefined, projectStatus: string | null, actorUserId: string) {
  if (!ticketId) return;
  
  let ticketStatus: string | null = null;
  if (projectStatus === STATUS.NOT_STARTED) {
    ticketStatus = 'Handled';
  } else if (projectStatus === STATUS.ON_PROGRESS) {
    ticketStatus = 'In Progress';
  } else if (projectStatus === STATUS.HOLD) {
    ticketStatus = 'On Hold';
  } else if (projectStatus === STATUS.DONE) {
    ticketStatus = 'Resolved';
  }

  if (ticketStatus) {
    try {
      // Check if current ticket status is already closed. If closed, we do not change it
      const ticketRows = await sql`SELECT status FROM tickets WHERE id = ${ticketId} LIMIT 1`;
      const currentStatus = ticketRows[0]?.status;
      if (currentStatus && currentStatus !== 'Closed') {
        console.log(`Syncing ticket ${ticketId} status to ${ticketStatus} due to project status ${projectStatus}...`);
        await sql`
          UPDATE tickets 
          SET status = ${ticketStatus}, 
              updated_by = ${actorUserId}, 
              updated_at = ${new Date().toISOString()} 
          WHERE id = ${ticketId}
        `;
        
        // Write to ticket_logs
        const logId = 'tl-' + String(Date.now()).slice(-6) + '-' + Math.random().toString(36).substring(2, 7);
        await sql`
          INSERT INTO ticket_logs (id, ticket_id, action, details, created_by, created_at)
          VALUES (${logId}, ${ticketId}, 'STATUS_CHANGE', ${`Changed status to "${ticketStatus}" via project update`}, ${actorUserId}, ${new Date().toISOString()})
        `;
      }
    } catch (e) {
      console.error(`Failed to sync ticket status for ticket ${ticketId}:`, e);
    }
  }
}

// ============ PROJECT REPOSITORY ============
export const ProjectRepository = {
  async findAll(userId?: string): Promise<Project[]> {
    if (!userId) {
      return getCachedProjects();
    }

    const user = await UserRepository.findById(userId);
    if (!user) return [];

    const level = await getUserLevel(user.user_occupation);
    if (level >= 6) {
      return sql`SELECT * FROM projects WHERE deleted_at IS NULL ORDER BY created_at DESC` as unknown as Project[];
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
      SELECT DISTINCT p.* 
      FROM projects p
      LEFT JOIN users u ON p.created_by = u.user_id
      LEFT JOIN project_teams pt ON p.project_id = pt.project_id AND pt.deleted_at IS NULL
      LEFT JOIN users mu ON pt.user_id = mu.user_id
      WHERE p.deleted_at IS NULL 
        AND (
          p.created_by = $1
          OR pt.user_id = $1
    `;

    if (scopeCondition) {
      query += ` OR ${scopeCondition}`;
    }

    query += `) ORDER BY p.created_at DESC`;

    const rows = await (sql as any).query(query, params);
    return rows as unknown as Project[];
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
      ticket_reference?: string | null;
    },
    createdBy: string
  ): Promise<Project> {
    // Validate 1-to-1 unique active ticket reference
    if (project.ticket_reference) {
      const activeProjects = await sql`
        SELECT project_id 
        FROM projects 
        WHERE ticket_reference = ${project.ticket_reference} AND deleted_at IS NULL
      `;
      if (activeProjects.length > 0) {
        throw new Error('This ticket is already linked to an active project.');
      }
    }

    const lastRow = await sql`SELECT project_id FROM projects ORDER BY project_id DESC LIMIT 1`;
    const lastId = lastRow[0]?.project_id || 'P-260000';
    const lastNum = parseInt(lastId.replace('P-', ''), 10) || 260000;
    const nextVal = lastNum < 260000 ? 260001 : lastNum + 1;
    const nextId = 'P-' + String(nextVal);
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
      ticket_reference: project.ticket_reference ?? null,
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
        project_status, project_file, additional_link, category, ticket_reference, created_by, created_at, updated_by, updated_at, deleted_by, deleted_at
      ) VALUES (
        ${newProject.project_id}, ${newProject.project_name}, ${newProject.project_description},
        ${newProject.project_start_date_plan}, ${newProject.project_end_date_plan}, ${newProject.project_status},
        ${newProject.project_file}, ${newProject.additional_link}, ${newProject.category}, ${newProject.ticket_reference}, ${newProject.created_by}, ${newProject.created_at},
        ${newProject.updated_by}, ${newProject.updated_at}, ${newProject.deleted_by}, ${newProject.deleted_at}
      )
    `;

    // Sync status to the linked ticket
    if (newProject.ticket_reference) {
      await syncTicketStatus(newProject.ticket_reference, newProject.project_status, createdBy);
    }

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
        | 'ticket_reference'
      >
    >,
    updatedBy: string,
    /** Allow internal callers (ticket-sync) to override terminal status lock */
    forceStatusOverride = false
  ): Promise<Project | null> {
    const existing = await ProjectRepository.findById(projectId);
    if (!existing) return null;

    // ── Terminal status lock ──
    // Projects in DONE or CANCEL cannot be edited by external callers.
    const isTerminal = existing.project_status === STATUS.DONE || existing.project_status === STATUS.CANCEL;
    if (isTerminal && !forceStatusOverride) {
      throw new Error('This project is locked because its status is final (Done/Cancelled). No further changes are allowed.');
    }

    // Validate 1-to-1 unique active ticket reference on update
    if (updates.ticket_reference !== undefined && updates.ticket_reference !== existing.ticket_reference && updates.ticket_reference) {
      const activeProjects = await sql`
        SELECT project_id 
        FROM projects 
        WHERE ticket_reference = ${updates.ticket_reference} AND deleted_at IS NULL AND project_id != ${projectId}
      `;
      if (activeProjects.length > 0) {
        throw new Error('This ticket is already linked to another active project.');
      }
    }

    const now = new Date().toISOString();

    let newStatus: string;
    if (updates.project_status != null) {
      newStatus = updates.project_status;
    } else {
      // Direct SQL to avoid circular import with TaskRepository
      const allTasks = (await sql`SELECT * FROM tasks WHERE deleted_at IS NULL`) as unknown as Task[];
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
        ticket_reference = ${updated.ticket_reference !== undefined ? updated.ticket_reference : existing.ticket_reference},
        updated_by = ${updated.updated_by},
        updated_at = ${updated.updated_at}
      WHERE project_id = ${projectId}
    `;

    // Sync status to the linked ticket on status/reference updates
    const currentRef = updates.ticket_reference !== undefined ? updates.ticket_reference : existing.ticket_reference;
    if (currentRef && (existing.project_status !== newStatus || (updates.ticket_reference !== undefined && updates.ticket_reference !== existing.ticket_reference))) {
      await syncTicketStatus(currentRef, newStatus, updatedBy);
    }

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
    const nextId = 'pt-' + randomUUID();
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

// ============ PROJECT LOG REPOSITORY ============

export const ProjectLogRepository = {
  async create(
    log: {
      project_id: string;
      project_status_old: string | null;
      project_status_new: string;
    },
    createdBy: string
  ): Promise<ProjectLog> {
    const nextId = 'pl-' + randomUUID();
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

// ============ USER-SCOPED FILTERING HELPERS ============

export async function getUserProjectIds(userId: string): Promise<string[]> {
  const projectTeams = await ProjectTeamRepository.findByUserId(userId);
  return [...new Set(projectTeams.map((pt) => pt.project_id))];
}

function isSupervised(
  user: User, 
  userLevel: number, 
  x: User, 
  roleLevelMap: Map<string, number>
): boolean {
  if (x.user_id === user.user_id) return true;
  
  const viewerOcc = (user.user_occupation || "").toLowerCase().trim();
  const normViewer = viewerOcc.replace(/\s+/g, "");

  // Super User, Co-Super User, Direktur see everything
  if (
    ["superuser", "cosuperuser", "co-superuser", "direktur"].includes(normViewer) || 
    userLevel >= 6
  ) {
    return true;
  }

  // Kepala Departement
  if (viewerOcc === "kepala departement" || viewerOcc === "kepala department") {
    return !!x.user_departement && !!user.user_departement &&
           x.user_departement.toLowerCase().trim() === user.user_departement.toLowerCase().trim();
  }

  // Site Manager & Site Admin (Level 5)
  if (viewerOcc === "site manager" || viewerOcc === "site admin" || userLevel === 5) {
    return !!x.user_site && !!user.user_site &&
           x.user_site.toLowerCase().trim() === user.user_site.toLowerCase().trim();
  }

  // Divisi Manager & Divisi Admin & Supervisor (Level 4 / 3)
  if (
    viewerOcc === "divisi manager" || 
    viewerOcc === "divisi admin" || 
    viewerOcc === "div manager" || 
    viewerOcc === "div admin" || 
    userLevel === 4 || 
    userLevel === 3
  ) {
    return !!x.user_division && !!user.user_division &&
           x.user_division.toLowerCase().trim() === user.user_division.toLowerCase().trim();
  }

  // Team Leader (Level 2)
  if (viewerOcc === "team leader" || userLevel === 2) {
    return !!x.user_team && !!user.user_team &&
           x.user_team.toLowerCase().trim() === user.user_team.toLowerCase().trim();
  }

  return false;
}

export async function filterProjectsByUser(
  projects: Project[],
  userId: string
): Promise<Project[]> {
  if (!userId) return projects;
  const user = await UserRepository.findById(userId);
  if (!user) return [];

  const level = await getUserLevel(user.user_occupation);
  if (level >= 6) return projects; // Level 6 and 7 see everything

  const allUsers = await UserRepository.findAll();
  const userMap = new Map(allUsers.map((u) => [u.user_id, u]));

  const roles = await RoleLevelRepository.findAll();
  const roleLevelMap = new Map<string, number>();
  for (const r of roles) {
    roleLevelMap.set(r.role_name.toLowerCase(), r.level);
  }

  // Pre-fetch project team mappings
  const allProjectTeams = await sql`SELECT project_id, user_id FROM project_teams WHERE deleted_at IS NULL`;
  const projectTeamMap = new Map<string, string[]>();
  for (const pt of allProjectTeams) {
    const list = projectTeamMap.get(pt.project_id) || [];
    list.push(pt.user_id);
    projectTeamMap.set(pt.project_id, list);
  }

  return projects.filter((p) => {
    if (p.created_by === userId) return true;

    const teamMembers = projectTeamMap.get(p.project_id) || [];
    if (teamMembers.includes(userId)) return true;

    // Check if creator is supervised
    if (p.created_by) {
      const creatorUser = userMap.get(p.created_by);
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

export async function hasProjectWritePermission(projectId: string, userId: string): Promise<boolean> {
  const project = await ProjectRepository.findById(projectId);
  if (!project) return false;

  const user = await UserRepository.findById(userId);
  if (!user) return false;

  const userLevel = await getUserLevel(user.user_occupation);
  if (userLevel === 7) return true; // Super User has full access

  const projectTeam = await ProjectTeamRepository.findByProjectId(projectId);
  const isProjectTeamMember = projectTeam.some((pt) => pt.user_id === userId);
  const isCreatedBy = project.created_by === userId;

  return isProjectTeamMember || isCreatedBy;
}

export async function findAllProjectsIncludingDeleted(): Promise<Project[]> {
  return getCachedAllProjectsIncludingDeleted();
}

/** Restore a soft-deleted project */
export async function restoreProject(projectId: string, restoredBy: string): Promise<boolean> {
  // Validate unique active ticket reference before restoring
  const projectRows = await sql`SELECT ticket_reference, project_status FROM projects WHERE project_id = ${projectId}`;
  const ref = projectRows[0]?.ticket_reference;
  const status = projectRows[0]?.project_status;
  
  if (ref) {
    const activeRows = await sql`
      SELECT project_id 
      FROM projects 
      WHERE ticket_reference = ${ref} AND deleted_at IS NULL
    `;
    if (activeRows.length > 0) {
      throw new Error(`Cannot restore project because another active project is already linked to ticket ${ref}.`);
    }
  }

  await sql`
    UPDATE projects SET
      deleted_by = NULL,
      deleted_at = NULL
    WHERE project_id = ${projectId}
  `;

  // Sync ticket status to the restored project's status
  if (ref && status) {
    await syncTicketStatus(ref, status, restoredBy);
  }

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

// Expose internal isSupervised helper for Task repository filtering
export { isSupervised };
