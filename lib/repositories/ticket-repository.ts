import { sql } from '../db';
import type { Ticket, TicketComment, TicketLog } from '../types';
import { unstable_cache, revalidateTag, STATUS } from './shared';
import { NotificationRepository } from './notification-repository';
import { resolveUserName } from './user-repository';
import { randomUUID } from 'crypto';

// ============ CACHING HELPERS ============


const getCachedTicketById = unstable_cache(
  async (id: string): Promise<Ticket | null> => {
    const [ticketRows, teamRows] = await Promise.all([
      sql`SELECT * FROM tickets WHERE id = ${id} AND deleted_at IS NULL LIMIT 1`,
      sql`SELECT user_id FROM ticket_team WHERE ticket_id = ${id}`
    ]);

    const ticket = (ticketRows[0] as unknown as Ticket) || null;
    if (!ticket) return null;

    return {
      ...ticket,
      team_user_ids: teamRows.map(row => row.user_id)
    };
  },
  ['ticket-by-id'],
  { tags: ['tickets'], revalidate: 60 }
);

// ============ TICKET REPOSITORY ============

export const TicketRepository = {
  async findAll(filters?: {
    request_by?: string;
    request_to_division?: string;
    tag_person?: string;
    status?: string;
    priority?: string;
    search?: string;
    tab?: 'my' | 'requested';
    currentUserId?: string;
    currentUserDivision?: string;
  }): Promise<Ticket[]> {
    const params: any[] = [];
    let query = `
      SELECT t.* 
      FROM tickets t
      WHERE t.deleted_at IS NULL
    `;

    // Tab-based database-level filtering
    if (filters?.tab === 'my' && filters.currentUserId) {
      params.push(filters.currentUserId);
      query += ` AND t.request_by = $${params.length}`;
    } else if (filters?.tab === 'requested' && filters.currentUserId) {
      const uId = filters.currentUserId;
      const uDiv = filters.currentUserDivision || '';
      
      params.push(uId);
      const uIdIndex = params.length;
      
      params.push(uDiv);
      const uDivIndex = params.length;
      
      query += ` AND (
        (t.request_to_division IS NOT NULL AND LOWER(t.request_to_division) = LOWER($${uDivIndex}))
        OR t.tag_person = $${uIdIndex}
        OR t.id IN (SELECT ticket_id FROM ticket_team WHERE user_id = $${uIdIndex})
      )`;
    }

    // Individual parameter filters (retained for backward compatibility and API flexibility)
    if (filters?.request_by && filters.tab !== 'my') {
      params.push(filters.request_by);
      query += ` AND t.request_by = $${params.length}`;
    }
    if (filters?.request_to_division && filters.tab !== 'requested') {
      params.push(filters.request_to_division);
      query += ` AND t.request_to_division IS NOT NULL AND LOWER(t.request_to_division) = LOWER($${params.length})`;
    }
    if (filters?.tag_person && filters.tab !== 'requested') {
      params.push(filters.tag_person);
      const pIndex = params.length;
      query += ` AND (t.tag_person = $${pIndex} OR t.id IN (SELECT ticket_id FROM ticket_team WHERE user_id = $${pIndex}))`;
    }
    if (filters?.status) {
      params.push(filters.status);
      query += ` AND LOWER(t.status) = LOWER($${params.length})`;
    }
    if (filters?.priority) {
      params.push(filters.priority);
      query += ` AND LOWER(t.priority) = LOWER($${params.length})`;
    }
    if (filters?.search) {
      params.push(`%${filters.search.toLowerCase()}%`);
      const sIndex = params.length;
      query += ` AND (
        LOWER(t.title) LIKE $${sIndex}
        OR LOWER(t.description) LIKE $${sIndex}
        OR LOWER(t.id) LIKE $${sIndex}
        OR LOWER(t.problem_type) LIKE $${sIndex}
        OR (t.division_category IS NOT NULL AND LOWER(t.division_category) LIKE $${sIndex})
      )`;
    }

    query += ` ORDER BY t.created_at DESC`;

    const tickets = await sql.unsafe(query, params) as unknown as Ticket[];
    if (tickets.length === 0) return [];

    // Optimize: fetch team assignments ONLY for the retrieved tickets
    const ticketIds = tickets.map(t => t.id);
    const teamRows = await sql`
      SELECT ticket_id, user_id 
      FROM ticket_team 
      WHERE ticket_id = ANY(${ticketIds})
    `;

    const teamMap = new Map<string, string[]>();
    for (const row of teamRows) {
      const tId = row.ticket_id;
      if (!teamMap.has(tId)) {
        teamMap.set(tId, []);
      }
      teamMap.get(tId)!.push(row.user_id);
    }

    return tickets.map(t => ({
      ...t,
      team_user_ids: teamMap.get(t.id) || []
    }));
  },

  async findById(id: string): Promise<Ticket | null> {
    return getCachedTicketById(id);
  },

  async create(
    ticket: {
      title: string;
      description: string;
      request_by: string;
      request_to_division: string | null;
      problem_type: string;
      priority?: 'Low' | 'Medium' | 'High' | 'Critical';
      due_date?: string | null;
      attachment_link?: string | null;
      attachment_file?: string | null;
      tag_person?: string | null;
      team_user_ids?: string[]; // Multiple tagged people
    },
    createdBy: string
  ): Promise<Ticket> {
    // Due date validation: cannot be in the past
    if (ticket.due_date) {
      const today = new Date().toLocaleDateString('en-CA'); // 'en-CA' outputs YYYY-MM-DD
      if (ticket.due_date < today) {
        throw new Error('Due date cannot be in the past.');
      }
    }

    // Generate next TK ID
    const lastRow = await sql`SELECT id FROM tickets ORDER BY id DESC LIMIT 1`;
    const lastId = lastRow[0]?.id || 'TK-0000';
    const lastNum = parseInt(lastId.replace('TK-', ''), 10) || 0;
    const nextId = 'TK-' + String(lastNum + 1).padStart(4, '0');
    const now = new Date().toISOString();

    const newTicket: Ticket = {
      id: nextId,
      title: ticket.title,
      description: ticket.description,
      request_by: ticket.request_by,
      request_to_division: ticket.request_to_division,
      tag_person: ticket.tag_person || null,
      problem_type: ticket.problem_type,
      division_category: null,
      due_date: ticket.due_date || null,
      priority: ticket.priority || 'Medium',
      status: 'Open',
      attachment_link: ticket.attachment_link || null,
      attachment_file: ticket.attachment_file || null,
      created_by: createdBy,
      created_at: now,
      updated_by: null,
      updated_at: null,
      deleted_by: null,
      deleted_at: null,
    };

    // Insert ticket
    await sql`
      INSERT INTO tickets (
        id, title, description, request_by, request_to_division, tag_person,
        problem_type, division_category, due_date, priority, status,
        attachment_link, attachment_file, created_by, created_at,
        updated_by, updated_at, deleted_by, deleted_at
      ) VALUES (
        ${newTicket.id}, ${newTicket.title}, ${newTicket.description}, ${newTicket.request_by},
        ${newTicket.request_to_division}, ${newTicket.tag_person}, ${newTicket.problem_type},
        ${newTicket.division_category}, ${newTicket.due_date}, ${newTicket.priority}, ${newTicket.status},
        ${newTicket.attachment_link}, ${newTicket.attachment_file}, ${newTicket.created_by}, ${newTicket.created_at},
        ${newTicket.updated_by}, ${newTicket.updated_at}, ${newTicket.deleted_by}, ${newTicket.deleted_at}
      )
    `;

    // Write team assignments and send notifications
    const teamUserIds = ticket.team_user_ids || [];
    if (teamUserIds.length > 0) {
      const senderName = await resolveUserName(createdBy);
      for (let i = 0; i < teamUserIds.length; i++) {
        const userId = teamUserIds[i];
        const teamId = 'tkt-' + randomUUID();
        await sql`
          INSERT INTO ticket_team (id, ticket_id, user_id, created_by, created_at)
          VALUES (${teamId}, ${nextId}, ${userId}, ${createdBy}, ${now})
        `;

        // Send Notification
        if (userId !== createdBy) {
          await NotificationRepository.create({
            user_id: userId,
            type: 'ticket_tagged',
            title: 'Tagged in Ticket',
            content: `${senderName} tagged you in ticket: ${ticket.title} (${nextId})`,
            link: `/ticketing?ticketId=${nextId}`
          });
        }
      }
    } else if (ticket.request_to_division) {
      // If NO specific people are tagged, notify the Head of Division of the target division
      const targetDiv = ticket.request_to_division.toLowerCase();
      
      const usersRows = await sql`
        SELECT user_id, user_division, user_team 
        FROM users 
        WHERE deleted_at IS NULL
      `;

      const divisionHeads = usersRows.filter(u => 
        u.user_division?.toLowerCase() === targetDiv && 
        (!u.user_team || u.user_team.trim() === "")
      );

      const senderName = await resolveUserName(createdBy);

      for (const u of divisionHeads) {
        if (u.user_id === createdBy) continue;

        await NotificationRepository.create({
          user_id: u.user_id,
          type: 'ticket_new',
          title: 'New Division Ticket',
          content: `${senderName} submitted a new ticket to ${ticket.request_to_division}: ${ticket.title} (${nextId})`,
          link: `/ticketing?ticketId=${nextId}`
        });
      }
    }

    // Create log entry
    await this.createLog(nextId, 'TICKET_CREATE', 'Ticket created successfully', createdBy);

    revalidateTag('tickets');
    return {
      ...newTicket,
      team_user_ids: teamUserIds
    };
  },

  async update(
    id: string,
    updates: {
      title?: string;
      description?: string;
      request_to_division?: string | null;
      tag_person?: string | null;
      problem_type?: string;
      division_category?: string | null;
      due_date?: string | null;
      priority?: 'Low' | 'Medium' | 'High' | 'Critical';
      status?: 'Open' | 'In Progress' | 'Resolved' | 'Closed' | 'Pending';
      attachment_link?: string | null;
      attachment_file?: string | null;
      team_user_ids?: string[]; // Multiple tagged people
      actionReason?: string;
    },
    updatedBy: string
  ): Promise<Ticket | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    // If ticket is already closed, prevent all updates
    if (existing.status === 'Closed') {
      throw new Error('Cannot modify a closed ticket.');
    }

    const userRow = await sql`SELECT user_occupation FROM users WHERE user_id = ${updatedBy} LIMIT 1`;
    const userOcc = userRow[0]?.user_occupation || '';
    let isAdmin = false;
    if (userOcc) {
      const norm = userOcc.toLowerCase().replace(/\s+/g, "");
      if (['superuser', 'cosuperuser', 'co-superuser'].includes(norm)) {
        isAdmin = true;
      }
    }

    const isRequester = existing.request_by === updatedBy;

    // Detect if core fields are being modified
    const isCoreFieldModified = 
      updates.title !== undefined ||
      updates.description !== undefined ||
      updates.request_to_division !== undefined ||
      updates.problem_type !== undefined ||
      updates.priority !== undefined ||
      updates.attachment_link !== undefined ||
      updates.attachment_file !== undefined;

    // Detect if divisional assignment fields are being modified
    const isDivFieldModified =
      updates.division_category !== undefined ||
      updates.tag_person !== undefined ||
      updates.team_user_ids !== undefined;

    // 1. Due date validation and requester-only check
    if (updates.due_date !== undefined && updates.due_date !== existing.due_date) {
      // Only requester or admin can adjust the due date
      if (!isRequester && !isAdmin) {
        throw new Error('Only the ticket requester can adjust the due date.');
      }
      // Cannot adjust if resolved
      if (existing.status === 'Resolved') {
        throw new Error('Due date cannot be adjusted when the ticket is resolved.');
      }
      // Must not be in the past
      if (updates.due_date) {
        const today = new Date().toLocaleDateString('en-CA');
        if (updates.due_date < today) {
          throw new Error('Due date cannot be in the past.');
        }
      }
    }

    // 3. Status adjustment permission guards
    if (updates.status !== undefined && updates.status !== existing.status) {
      if (updates.status === 'Closed') {
        // Only requester or admin can close the ticket
        if (!isRequester && !isAdmin) {
          throw new Error('Only the ticket requester can close this ticket.');
        }
      } else {
        // Requester cannot set non-Closed status (e.g. In Progress, Resolved) unless they are admin
        if (isRequester && !isAdmin) {
          throw new Error('The ticket requester cannot process their own ticket. Only other staff can update the status.');
        }
      }
    }

    // 4. Core fields lock guard: if processed/commented, creator cannot edit details
    if (isCoreFieldModified && isRequester && !isAdmin) {
      // Check if anyone else has commented
      const comments = await this.findComments(id);
      const hasCommentsByOthers = comments.some(c => c.created_by !== existing.request_by);
      
      // Check if anyone else has logged
      const logs = await this.findLogs(id);
      const hasLogsByOthers = logs.some(l => l.created_by !== existing.request_by);

      if (existing.status !== 'Open' || hasCommentsByOthers || hasLogsByOthers) {
        throw new Error('Cannot edit ticket details because it has already been processed or commented on by others.');
      }
    }

    const now = new Date().toISOString();
    const logsToCreate: { action: string; details: string }[] = [];

    // Detect changes and build logs
    if (updates.status !== undefined && updates.status !== existing.status) {
      let details = `Changed status from "${existing.status}" to "${updates.status}"`;
      let action = 'STATUS_CHANGE';
      if (updates.status === 'Closed') {
        if (updates.actionReason === 'cancel') {
          action = 'TICKET_CANCEL';
          details = 'Ticket cancelled by requester';
        } else {
          action = 'TICKET_CLOSE';
          details = 'Ticket closed by requester';
        }
      }
      logsToCreate.push({ action, details });
    }
    if (updates.division_category !== undefined && updates.division_category !== existing.division_category) {
      logsToCreate.push({
        action: 'CATEGORY_ASSIGN',
        details: updates.division_category
          ? `Assigned category "${updates.division_category}"`
          : 'Removed division category',
      });
    }
    if (updates.priority !== undefined && updates.priority !== existing.priority) {
      logsToCreate.push({
        action: 'PRIORITY_CHANGE',
        details: `Changed priority from "${existing.priority}" to "${updates.priority}"`,
      });
    }
    if (updates.due_date !== undefined && updates.due_date !== existing.due_date) {
      logsToCreate.push({
        action: 'DUEDATE_CHANGE',
        details: updates.due_date
          ? `Updated due date to ${updates.due_date}`
          : 'Removed due date',
      });
    }

    // Handle Team Assignment Updates
    if (updates.team_user_ids !== undefined) {
      const currentTeam = existing.team_user_ids || [];
      const newTeam = updates.team_user_ids || [];

      const currentSet = new Set(currentTeam);
      const newSet = new Set(newTeam);

      const added = newTeam.filter(uid => !currentSet.has(uid));
      const removed = currentTeam.filter(uid => !newSet.has(uid));

      const senderName = await resolveUserName(updatedBy);

      // 1. Process removals
      for (const userId of removed) {
        await sql`
          DELETE FROM ticket_team 
          WHERE ticket_id = ${id} AND user_id = ${userId}
        `;
        const userName = await resolveUserName(userId);
        logsToCreate.push({
          action: 'PERSON_TAG',
          details: `Removed tagged staff: ${userName}`,
        });
      }

      // 2. Process additions
      for (const userId of added) {
        const teamId = 'tkt-' + randomUUID();
        await sql`
          INSERT INTO ticket_team (id, ticket_id, user_id, created_by, created_at)
          VALUES (${teamId}, ${id}, ${userId}, ${updatedBy}, ${now})
        `;
        const userName = await resolveUserName(userId);
        logsToCreate.push({
          action: 'PERSON_TAG',
          details: `Tagged staff member: ${userName}`,
        });

        // Notify newly added users
        if (userId !== updatedBy) {
          await NotificationRepository.create({
            user_id: userId,
            type: 'ticket_tagged',
            title: 'Tagged in Ticket',
            content: `${senderName} tagged you in ticket: ${existing.title} (${id})`,
            link: `/ticketing?ticketId=${id}`
          });
        }
      }
    }

    // Run update query for core fields
    await sql`
      UPDATE tickets
      SET title = ${updates.title !== undefined ? updates.title : existing.title},
          description = ${updates.description !== undefined ? updates.description : existing.description},
          request_to_division = ${updates.request_to_division !== undefined ? updates.request_to_division : existing.request_to_division},
          tag_person = ${updates.tag_person !== undefined ? updates.tag_person : existing.tag_person},
          problem_type = ${updates.problem_type !== undefined ? updates.problem_type : existing.problem_type},
          division_category = ${updates.division_category !== undefined ? updates.division_category : existing.division_category},
          due_date = ${updates.due_date !== undefined ? updates.due_date : existing.due_date},
          priority = ${updates.priority !== undefined ? updates.priority : existing.priority},
          status = ${updates.status !== undefined ? updates.status : existing.status},
          attachment_link = ${updates.attachment_link !== undefined ? updates.attachment_link : existing.attachment_link},
          attachment_file = ${updates.attachment_file !== undefined ? updates.attachment_file : existing.attachment_file},
          updated_by = ${updatedBy},
          updated_at = ${now}
      WHERE id = ${id}
    `;

    // Insert all change logs
    for (const log of logsToCreate) {
      await this.createLog(id, log.action, log.details, updatedBy);
    }

    // Send notifications to all recipients of the update
    const senderName = await resolveUserName(updatedBy);
    const recipients = new Set<string>();
    if (existing.request_by) recipients.add(existing.request_by);
    if (existing.tag_person) recipients.add(existing.tag_person);
    const teamIds = existing.team_user_ids || [];
    for (const uid of teamIds) {
      recipients.add(uid);
    }

    const updatedTeamIds = updates.team_user_ids || teamIds;
    for (const uid of updatedTeamIds) {
      recipients.add(uid);
    }

    if (updatedTeamIds.length === 0 && !updates.tag_person && !existing.tag_person) {
      const targetDivStr = updates.request_to_division || existing.request_to_division;
      if (targetDivStr) {
        const targetDiv = targetDivStr.toLowerCase();
        const usersRows = await sql`
          SELECT user_id, user_division, user_team 
          FROM users 
          WHERE deleted_at IS NULL
        `;

        const divisionHeads = usersRows.filter(u => 
          u.user_division?.toLowerCase() === targetDiv && 
          (!u.user_team || u.user_team.trim() === "")
        );

        for (const u of divisionHeads) {
          recipients.add(u.user_id);
        }
      }
    }

    const changesList: string[] = [];
    if (updates.status !== undefined && updates.status !== existing.status) {
      changesList.push(`status to "${updates.status}"`);
    }
    if (updates.priority !== undefined && updates.priority !== existing.priority) {
      changesList.push(`priority to "${updates.priority}"`);
    }
    if (updates.due_date !== undefined && updates.due_date !== existing.due_date) {
      changesList.push(`due date to ${updates.due_date || 'removed'}`);
    }
    if (updates.division_category !== undefined && updates.division_category !== existing.division_category) {
      changesList.push(`category to "${updates.division_category || 'removed'}"`);
    }

    if (changesList.length > 0) {
      const detailMessage = `updated: ${changesList.join(', ')}`;
      for (const recipientId of recipients) {
        if (recipientId !== updatedBy) {
          await NotificationRepository.create({
            user_id: recipientId,
            type: 'ticket_update',
            title: 'Ticket Updated',
            content: `${senderName} updated ticket ${existing.id} (${detailMessage})`,
            link: `/ticketing?ticketId=${existing.id}`
          });
        }
      }
    }

    // Sync to project status if this ticket is linked to a project and status is changed to Closed
    if (updates.status === 'Closed') {
      const linkedProjects = await sql`
        SELECT project_id, project_status 
        FROM projects 
        WHERE ticket_reference = ${id} AND deleted_at IS NULL
      `;
      
      for (const p of linkedProjects) {
        const newProjStatus = updates.actionReason === 'cancel' ? STATUS.CANCEL : STATUS.DONE;
        if (p.project_status !== newProjStatus) {
          // Update project status
          await sql`
            UPDATE projects 
            SET project_status = ${newProjStatus}, updated_by = ${updatedBy}, updated_at = ${now} 
            WHERE project_id = ${p.project_id}
          `;
          
          // Write project log
          const logId = 'pl-' + String(now).slice(-6) + '-' + Math.random().toString(36).substring(2, 7);
          await sql`
            INSERT INTO project_logs (id, project_id, project_status_old, project_status_new, created_by, created_at)
            VALUES (${logId}, ${p.project_id}, ${p.project_status}, ${newProjStatus}, ${updatedBy}, ${now})
          `;
        }
      }
      revalidateTag('projects');
      revalidateTag('project_log');
    }

    revalidateTag('tickets');
    return this.findById(id);
  },

  async softDelete(id: string, deletedBy: string): Promise<boolean> {
    const existing = await this.findById(id);
    if (!existing) return false;

    // A ticket can NEVER be deleted by anyone if it is not in "Open" status
    if (existing.status !== 'Open') {
      throw new Error('Cannot delete ticket because it has already been processed (started, handled, or closed).');
    }

    // Resolve if the deleter is an admin
    const userRow = await sql`SELECT user_occupation FROM users WHERE user_id = ${deletedBy} LIMIT 1`;
    const userOcc = userRow[0]?.user_occupation || '';
    let isAdmin = false;
    if (userOcc) {
      const norm = userOcc.toLowerCase().replace(/\s+/g, "");
      if (['superuser', 'cosuperuser', 'co-superuser'].includes(norm)) {
        isAdmin = true;
      }
    }

    // If the deleter is the creator (and NOT admin)
    if (deletedBy === existing.request_by && !isAdmin) {
      // Check if anyone else has commented
      const comments = await this.findComments(id);
      const hasCommentsByOthers = comments.some(c => c.created_by !== existing.request_by);
      
      // Check if anyone else has logged
      const logs = await this.findLogs(id);
      const hasLogsByOthers = logs.some(l => l.created_by !== existing.request_by);

      if (hasCommentsByOthers || hasLogsByOthers) {
        throw new Error('Cannot delete ticket because it has comments or activity logs by others.');
      }
    }

    const now = new Date().toISOString();
    await sql`
      UPDATE tickets
      SET deleted_by = ${deletedBy},
          deleted_at = ${now}
      WHERE id = ${id}
    `;

    await this.createLog(id, 'TICKET_DELETE', 'Ticket deleted (soft delete)', deletedBy);

    revalidateTag('tickets');
    return true;
  },

  // ============ COMMENTS ============

  async findComments(ticketId: string): Promise<(TicketComment & { author_name?: string; author_email?: string })[]> {
    const rows = await sql`
      SELECT tc.*, u.user_name as author_name, u.user_email as author_email
      FROM ticket_comments tc
      LEFT JOIN users u ON tc.created_by = u.user_id
      WHERE tc.ticket_id = ${ticketId}
      ORDER BY tc.created_at ASC
    `;
    return rows as any[];
  },

  async createComment(ticketId: string, content: string, createdBy: string): Promise<TicketComment> {
    const nextId = 'tkc-' + randomUUID();
    const now = new Date().toISOString();

    const comment: TicketComment = {
      id: nextId,
      ticket_id: ticketId,
      content,
      created_by: createdBy,
      created_at: now,
    };

    await sql`
      INSERT INTO ticket_comments (id, ticket_id, content, created_by, created_at)
      VALUES (${comment.id}, ${comment.ticket_id}, ${comment.content}, ${comment.created_by}, ${comment.created_at})
    `;

    // Notify all participants/recipients of the ticket
    const ticket = await this.findById(ticketId);
    if (ticket) {
      const senderName = await resolveUserName(createdBy);
      const recipients = new Set<string>();
      if (ticket.request_by) recipients.add(ticket.request_by);
      if (ticket.tag_person) recipients.add(ticket.tag_person);
      const teamIds = ticket.team_user_ids || [];
      for (const uid of teamIds) {
        recipients.add(uid);
      }

      if (teamIds.length === 0 && !ticket.tag_person && ticket.request_to_division) {
        const targetDiv = ticket.request_to_division.toLowerCase();
        const usersRows = await sql`
          SELECT user_id, user_division, user_team 
          FROM users 
          WHERE deleted_at IS NULL
        `;

        const divisionHeads = usersRows.filter(u => 
          u.user_division?.toLowerCase() === targetDiv && 
          (!u.user_team || u.user_team.trim() === "")
        );

        for (const u of divisionHeads) {
          recipients.add(u.user_id);
        }
      }

      // Fetch all active users for robust mention matching & user identification
      const usersRows = (await sql`SELECT user_id, user_name, user_email FROM users WHERE deleted_at IS NULL`) as { user_id: string; user_name: string; user_email: string }[];
      
      // Helper function to check if two user identifiers belong to the same person (id or email)
      const isSameUser = (idOrEmail1: string, idOrEmail2: string) => {
        if (!idOrEmail1 || !idOrEmail2) return false;
        const norm1 = idOrEmail1.trim().toLowerCase();
        const norm2 = idOrEmail2.trim().toLowerCase();
        if (norm1 === norm2) return true;
        const u1 = usersRows.find(u => u.user_id.toLowerCase() === norm1 || u.user_email.toLowerCase() === norm1);
        const u2 = usersRows.find(u => u.user_id.toLowerCase() === norm2 || u.user_email.toLowerCase() === norm2);
        if (u1 && u2 && u1.user_id === u2.user_id) return true;
        return false;
      };

      const lowerContent = content.toLowerCase();

      // Mention parsing matching first name, full name, email username, email, or user_id
      const mentionedUsers = usersRows.filter(u => {
        // Never tag/notify the commenter themselves!
        if (isSameUser(u.user_id, createdBy) || isSameUser(u.user_email, createdBy)) return false;

        const nameFull = u.user_name ? u.user_name.toLowerCase() : '';
        const firstName = nameFull.split(' ')[0];
        const emailPart = u.user_email.toLowerCase();
        const emailUsername = emailPart.split('@')[0];
        const userId = u.user_id.toLowerCase();

        return (
          (nameFull && lowerContent.includes(`@${nameFull}`)) ||
          (firstName && firstName.length >= 2 && lowerContent.includes(`@${firstName}`)) ||
          lowerContent.includes(`@${emailPart}`) ||
          (emailUsername && emailUsername.length >= 2 && lowerContent.includes(`@${emailUsername}`)) ||
          lowerContent.includes(`@${userId}`)
        );
      });

      const mentionedIds = new Set(mentionedUsers.map(u => u.user_id));
      const truncatedComment = content.length > 60 ? content.slice(0, 60) + '...' : content;

      // Send specific "Tagged in Ticket Comment" notifications to mentioned users
      for (const user of mentionedUsers) {
        await NotificationRepository.create({
          user_id: user.user_id,
          type: 'mention',
          title: 'Tagged in Ticket Comment',
          content: `${senderName} tagged you in ticket ${ticket.id}: "${truncatedComment}"`,
          link: `/ticketing?ticketId=${ticket.id}`
        });
      }

      // Filter recipients to exclude the commenter & mentioned users
      for (const recipientIdOrEmail of recipients) {
        if (!isSameUser(recipientIdOrEmail, createdBy)) {
          // Resolve canonical user_id for the recipient
          const matchedUser = usersRows.find(u => 
            u.user_id.toLowerCase() === recipientIdOrEmail.toLowerCase() || 
            u.user_email.toLowerCase() === recipientIdOrEmail.toLowerCase()
          );
          const targetUserId = matchedUser ? matchedUser.user_id : recipientIdOrEmail;

          // Check if already notified via @mention
          if (!mentionedIds.has(targetUserId)) {
            await NotificationRepository.create({
              user_id: targetUserId,
              type: 'ticket_comment',
              title: 'New Comment on Ticket',
              content: `${senderName} commented on ticket ${ticket.id}: "${truncatedComment}"`,
              link: `/ticketing?ticketId=${ticket.id}`
            });
          }
        }
      }
    }

    return comment;
  },

  // ============ AUDIT LOGS ============

  async findLogs(ticketId: string): Promise<(TicketLog & { actor_name?: string; actor_email?: string })[]> {
    const rows = await sql`
      SELECT tl.*, u.user_name as actor_name, u.user_email as actor_email
      FROM ticket_logs tl
      LEFT JOIN users u ON tl.created_by = u.user_id
      WHERE tl.ticket_id = ${ticketId}
      ORDER BY tl.created_at DESC
    `;
    return rows as any[];
  },

  async createLog(ticketId: string, action: string, details: string | null, createdBy: string): Promise<TicketLog> {
    const nextId = 'tkl-' + randomUUID();
    const now = new Date().toISOString();

    const log: TicketLog = {
      id: nextId,
      ticket_id: ticketId,
      action,
      details,
      created_by: createdBy,
      created_at: now,
    };

    await sql`
      INSERT INTO ticket_logs (id, ticket_id, action, details, created_by, created_at)
      VALUES (${log.id}, ${log.ticket_id}, ${log.action}, ${log.details}, ${log.created_by}, ${log.created_at})
    `;

    return log;
  },
};
