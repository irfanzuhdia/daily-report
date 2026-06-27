import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('No DATABASE_URL found in env');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

// Helper to parse numbers out of sequential IDs (e.g. "U-0005" -> 5)
function parseIdNumber(idStr, prefix) {
  if (!idStr) return 0;
  const numPart = idStr.replace(prefix, '');
  const parsed = parseInt(numPart, 10);
  return isNaN(parsed) ? 0 : parsed;
}

// Mock Data Arrays
const OCCUPATIONS = ['Direktur', 'Site Manager', 'Site Admin', 'Div Manager', 'Div Admin', 'Supervisor', 'Team Leader', 'Staff'];
const DEPARTMENTS = ['Operations', 'Engineering', 'Finance', 'Human Resources', 'Safety'];
const SITES = ['Jakarta Site', 'Surabaya Site', 'Medan Site', 'Bandung Site'];
const DIVISIONS = ['Civil', 'Mechanical', 'Electrical', 'HSE', 'Logistics'];
const TEAMS = ['Team Alpha', 'Team Beta', 'Team Gamma', 'Team Delta'];
const UNITS = ['Unit 1', 'Unit 2', 'Unit 3'];
const PROJECT_CATEGORIES = ['Construction', 'Infrastructure', 'Maintenance', 'IT Upgrade'];
const TICKET_PROBLEM_TYPES = ['Hardware', 'Software', 'Network', 'Facilities', 'HR Query'];

async function main() {
  console.log('Starting Benchmark Database Seeder...');
  const startTime = Date.now();

  // 1. Fetch highest existing IDs to preserve user data and avoid PK conflicts
  console.log('Fetching existing maximum IDs to preserve user data...');
  const [maxUserRow, maxProjRow, maxTaskRow, maxRepRow, maxTktRow] = await Promise.all([
    sql`SELECT user_id FROM users ORDER BY user_id DESC LIMIT 1`,
    sql`SELECT project_id FROM projects ORDER BY project_id DESC LIMIT 1`,
    sql`SELECT id FROM tasks ORDER BY id DESC LIMIT 1`,
    sql`SELECT report_id FROM daily_reports ORDER BY report_id DESC LIMIT 1`,
    sql`SELECT id FROM tickets ORDER BY id DESC LIMIT 1`
  ]);

  const userStartNum = parseIdNumber(maxUserRow[0]?.user_id, 'U-') + 1;
  const projStartNum = parseIdNumber(maxProjRow[0]?.project_id, 'P-') + 1;
  const taskStartNum = parseIdNumber(maxTaskRow[0]?.id, 'T-') + 1;
  const repStartNum = parseIdNumber(maxRepRow[0]?.report_id, 'R-') + 1;
  const tktStartNum = parseIdNumber(maxTktRow[0]?.id, 'TK-') + 1;

  console.log(`Starting sequence numbers:
  - Users start at: U-${String(userStartNum).padStart(4, '0')}
  - Projects start at: P-${String(projStartNum).padStart(6, '0')}
  - Tasks start at: T-${String(taskStartNum).padStart(5, '0')}
  - Reports start at: R-${String(repStartNum).padStart(4, '0')}
  - Tickets start at: TK-${String(tktStartNum).padStart(4, '0')}
  `);

  const nowStr = new Date().toISOString();

  // ==================== 2. SEED USERS (500) ====================
  console.log('Generating 500 mock users...');
  const mockUsers = [];
  const mockUserIds = [];

  for (let i = 0; i < 500; i++) {
    const num = userStartNum + i;
    const userId = `U-${String(num).padStart(4, '0')}`;
    const name = `Benchmark User ${num}`;
    const email = `benchmark.user${num}@example.com`;
    const occupation = OCCUPATIONS[i % OCCUPATIONS.length];
    const dept = DEPARTMENTS[i % DEPARTMENTS.length];
    const site = SITES[i % SITES.length];
    const division = DIVISIONS[i % DIVISIONS.length];
    const team = TEAMS[i % TEAMS.length];
    const unit = UNITS[i % UNITS.length];

    mockUsers.push({
      user_id: userId,
      user_email: email,
      user_name: name,
      user_occupation: occupation,
      user_division: division,
      user_departement: dept,
      user_site: site,
      user_team: team,
      user_unit: unit,
      created_by: 'SEED',
      created_at: nowStr
    });
    mockUserIds.push(userId);
  }

  console.log('Inserting 500 users in bulk...');
  // Bulk insert users in batches of 100
  for (let i = 0; i < mockUsers.length; i += 100) {
    const batch = mockUsers.slice(i, i + 100);
    const queryParts = [];
    const params = [];
    batch.forEach((u, index) => {
      const offset = index * 11;
      queryParts.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11})`);
      params.push(u.user_id, u.user_email, u.user_name, u.user_occupation, u.user_division, u.user_departement, u.user_site, u.user_team, u.user_unit, u.created_by, u.created_at);
    });
    const query = `
      INSERT INTO users (user_id, user_email, user_name, user_occupation, user_division, user_departement, user_site, user_team, user_unit, created_by, created_at)
      VALUES ${queryParts.join(', ')}
      ON CONFLICT (user_id) DO NOTHING
    `;
    await sql.query(query, params);
  }
  console.log('Users seeded successfully.');

  // ==================== 3. SEED PROJECTS (1,000) ====================
  console.log('Generating 1,000 mock projects...');
  const mockProjects = [];
  const mockProjIds = [];

  for (let i = 0; i < 1000; i++) {
    const num = projStartNum + i;
    const projId = `P-${String(num).padStart(6, '0')}`;
    const creator = mockUserIds[i % mockUserIds.length];
    const category = PROJECT_CATEGORIES[i % PROJECT_CATEGORIES.length];
    const status = ['NS', 'OP', 'H', 'D'][i % 4];

    mockProjects.push({
      project_id: projId,
      project_name: `Benchmark Project ${num}`,
      project_description: `This is a large scale benchmark project number ${num} designed to stress-test query plans and indexes.`,
      project_status: status,
      category: category,
      project_start_date_plan: '2026-06-01',
      project_end_date_plan: '2026-12-31',
      created_by: creator,
      created_at: nowStr
    });
    mockProjIds.push(projId);
  }

  console.log('Inserting 1,000 projects in bulk...');
  // Bulk insert projects in batches of 200
  for (let i = 0; i < mockProjects.length; i += 200) {
    const batch = mockProjects.slice(i, i + 200);
    const queryParts = [];
    const params = [];
    batch.forEach((p, index) => {
      const offset = index * 8;
      queryParts.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8})`);
      params.push(p.project_id, p.project_name, p.project_description, p.project_status, p.category, p.project_start_date_plan, p.project_end_date_plan, p.created_by);
    });
    const query = `
      INSERT INTO projects (project_id, project_name, project_description, project_status, category, project_start_date_plan, project_end_date_plan, created_by)
      VALUES ${queryParts.join(', ')}
      ON CONFLICT (project_id) DO NOTHING
    `;
    await sql.query(query, params);
  }

  // Seed project teams (2 members per project)
  console.log('Mapping teams to projects...');
  const projectTeams = [];
  mockProjIds.forEach((projId, index) => {
    // Add creator and 1 other random member
    const mem1 = mockUserIds[index % mockUserIds.length];
    const mem2 = mockUserIds[(index + 1) % mockUserIds.length];

    projectTeams.push({ id: randomUUID(), project_id: projId, user_id: mem1, created_by: mem1, created_at: nowStr });
    if (mem1 !== mem2) {
      projectTeams.push({ id: randomUUID(), project_id: projId, user_id: mem2, created_by: mem2, created_at: nowStr });
    }
  });

  // Bulk insert project teams in batches of 500
  for (let i = 0; i < projectTeams.length; i += 500) {
    const batch = projectTeams.slice(i, i + 500);
    const queryParts = [];
    const params = [];
    batch.forEach((pt, index) => {
      const offset = index * 5;
      queryParts.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`);
      params.push(pt.id, pt.project_id, pt.user_id, pt.created_by, pt.created_at);
    });
    const query = `
      INSERT INTO project_teams (id, project_id, user_id, created_by, created_at)
      VALUES ${queryParts.join(', ')}
    `;
    await sql.query(query, params);
  }
  console.log('Projects and project teams seeded successfully.');

  // ==================== 4. SEED TASKS (10,000) ====================
  console.log('Generating 10,000 mock tasks...');
  const mockTasks = [];
  const mockTaskIds = [];

  for (let i = 0; i < 10000; i++) {
    const num = taskStartNum + i;
    const taskId = `T-${String(num).padStart(5, '0')}`;
    const projId = mockProjIds[i % mockProjIds.length];
    const creator = mockUserIds[i % mockUserIds.length];
    const status = ['NS', 'OP', 'H', 'D'][i % 4];

    mockTasks.push({
      id: taskId,
      project_id: projId,
      task_description: `Benchmark Task description for task number ${num} under project ${projId}.`,
      task_status: status,
      task_latest_percentage: (i % 10) * 10,
      created_by: creator,
      created_at: nowStr
    });
    mockTaskIds.push(taskId);
  }

  console.log('Inserting 10,000 tasks in bulk...');
  // Bulk insert tasks in batches of 500
  for (let i = 0; i < mockTasks.length; i += 500) {
    const batch = mockTasks.slice(i, i + 500);
    const queryParts = [];
    const params = [];
    batch.forEach((t, index) => {
      const offset = index * 7;
      queryParts.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`);
      params.push(t.id, t.project_id, t.task_description, t.task_status, t.task_latest_percentage, t.created_by, t.created_at);
    });
    const query = `
      INSERT INTO tasks (id, project_id, task_description, task_status, task_latest_percentage, created_by, created_at)
      VALUES ${queryParts.join(', ')}
      ON CONFLICT (id) DO NOTHING
    `;
    await sql.query(query, params);
  }

  // Seed task teams (2 members per task)
  console.log('Mapping teams to tasks...');
  const taskTeams = [];
  mockTaskIds.forEach((taskId, index) => {
    const mem1 = mockUserIds[index % mockUserIds.length];
    const mem2 = mockUserIds[(index + 2) % mockUserIds.length];

    taskTeams.push({ id: randomUUID(), task_id: taskId, user_id: mem1, created_by: mem1, created_at: nowStr });
    if (mem1 !== mem2) {
      taskTeams.push({ id: randomUUID(), task_id: taskId, user_id: mem2, created_by: mem2, created_at: nowStr });
    }
  });

  // Bulk insert task teams in batches of 1000
  for (let i = 0; i < taskTeams.length; i += 1000) {
    const batch = taskTeams.slice(i, i + 1000);
    const queryParts = [];
    const params = [];
    batch.forEach((tt, index) => {
      const offset = index * 5;
      queryParts.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`);
      params.push(tt.id, tt.task_id, tt.user_id, tt.created_by, tt.created_at);
    });
    const query = `
      INSERT INTO task_teams (id, task_id, user_id, created_by, created_at)
      VALUES ${queryParts.join(', ')}
    `;
    await sql.query(query, params);
  }
  console.log('Tasks and task teams seeded successfully.');

  // ==================== 5. SEED DAILY REPORTS (100,000) ====================
  console.log('Generating 100,000 mock daily reports (this may take a few seconds)...');
  const mockReports = [];

  for (let i = 0; i < 100000; i++) {
    const num = repStartNum + i;
    const repId = `R-${String(num).padStart(4, '0')}`;
    const taskId = mockTaskIds[i % mockTaskIds.length];
    const userId = mockUserIds[i % mockUserIds.length];
    
    // Distribute report dates over the last 30 days
    const dateOffset = i % 30;
    const reportDate = new Date();
    reportDate.setDate(reportDate.getDate() - dateOffset);
    const dateStr = reportDate.toISOString().split('T')[0];

    mockReports.push({
      report_id: repId,
      task_id: taskId,
      date: dateStr,
      progress_percentage: (i % 10) * 10,
      total_hours: (i % 8) + 1,
      remarks: `Benchmark report number ${num} remarks on status details.`,
      user_id: userId,
      created_by: userId,
      created_at: nowStr
    });
  }

  console.log('Inserting 100,000 daily reports in bulk...');
  // Bulk insert daily reports in batches of 2000 for maximum throughput
  for (let i = 0; i < mockReports.length; i += 2000) {
    const batch = mockReports.slice(i, i + 2000);
    const queryParts = [];
    const params = [];
    batch.forEach((r, index) => {
      const offset = index * 9;
      queryParts.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9})`);
      params.push(
        r.report_id, r.task_id, r.date, r.progress_percentage, 
        r.total_hours, r.remarks, r.user_id, r.created_by, r.created_at
      );
    });
    const query = `
      INSERT INTO daily_reports (
        report_id, task_id, date, progress_percentage, 
        total_hours, remarks, user_id, created_by, created_at
      )
      VALUES ${queryParts.join(', ')}
      ON CONFLICT (report_id) DO NOTHING
    `;
    await sql.query(query, params);
    if (i > 0 && i % 20000 === 0) {
      console.log(`- Inserted ${i} reports...`);
    }
  }
  console.log('Daily reports seeded successfully.');

  // ==================== 6. SEED TICKETS (1,000) ====================
  console.log('Generating 1,000 mock tickets...');
  const mockTickets = [];
  const mockTktIds = [];

  for (let i = 0; i < 1000; i++) {
    const num = tktStartNum + i;
    const tktId = `TK-${String(num).padStart(4, '0')}`;
    const creator = mockUserIds[i % mockUserIds.length];
    const probType = TICKET_PROBLEM_TYPES[i % TICKET_PROBLEM_TYPES.length];
    const status = ['Open', 'In Progress', 'On Hold', 'Resolved', 'Closed'][i % 5];
    const priority = ['Low', 'Medium', 'High', 'Urgent'][i % 4];
    const div = ['IT', 'Finance', 'HR', 'GA'][i % 4];

    mockTickets.push({
      id: tktId,
      title: `Benchmark Support Ticket ${num}`,
      description: `Detailed description for support request ticket number ${num}. Addressing generic systems operations issues.`,
      status: status,
      priority: priority,
      request_by: creator,
      request_to_division: div,
      division_category: `${div} Category ${i % 3}`,
      tag_person: mockUserIds[(i + 3) % mockUserIds.length],
      attachment_link: `https://benchmark-task-ref-${num}.com`,
      problem_type: probType,
      due_date: '2026-07-15',
      created_by: creator,
      created_at: nowStr
    });
    mockTktIds.push(tktId);
  }

  console.log('Inserting 1,000 tickets in bulk...');
  // Bulk insert tickets in batches of 200
  for (let i = 0; i < mockTickets.length; i += 200) {
    const batch = mockTickets.slice(i, i + 200);
    const queryParts = [];
    const params = [];
    batch.forEach((t, index) => {
      const offset = index * 14;
      queryParts.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13}, $${offset + 14})`);
      params.push(
        t.id, t.title, t.description, t.request_by, t.request_to_division, t.tag_person,
        t.problem_type, t.division_category, t.due_date, t.priority, t.status,
        t.attachment_link, t.created_by, t.created_at
      );
    });
    const query = `
      INSERT INTO tickets (
        id, title, description, request_by, request_to_division, tag_person, 
        problem_type, division_category, due_date, priority, status, 
        attachment_link, created_by, created_at
      )
      VALUES ${queryParts.join(', ')}
      ON CONFLICT (id) DO NOTHING
    `;
    await sql.query(query, params);
  }

  // Seed ticket teams (2 handlers per ticket)
  console.log('Mapping teams to tickets...');
  const ticketTeams = [];
  mockTktIds.forEach((tktId, index) => {
    const mem1 = mockUserIds[index % mockUserIds.length];
    const mem2 = mockUserIds[(index + 4) % mockUserIds.length];

    ticketTeams.push({ id: randomUUID(), ticket_id: tktId, user_id: mem1, created_by: mem1, created_at: nowStr });
    if (mem1 !== mem2) {
      ticketTeams.push({ id: randomUUID(), ticket_id: tktId, user_id: mem2, created_by: mem2, created_at: nowStr });
    }
  });

  // Bulk insert ticket teams in batches of 500
  for (let i = 0; i < ticketTeams.length; i += 500) {
    const batch = ticketTeams.slice(i, i + 500);
    const queryParts = [];
    const params = [];
    batch.forEach((tt, index) => {
      const offset = index * 5;
      queryParts.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`);
      params.push(tt.id, tt.ticket_id, tt.user_id, tt.created_by, tt.created_at);
    });
    const query = `
      INSERT INTO ticket_team (id, ticket_id, user_id, created_by, created_at)
      VALUES ${queryParts.join(', ')}
    `;
    await sql.query(query, params);
  }
  console.log('Tickets and ticket teams seeded successfully.');

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n======================================================`);
  console.log(`SUCCESS: Seeding completed successfully in ${duration} seconds.`);
  console.log(`Generated and inserted:
  - 500 Users
  - 1,000 Projects & ~2,000 team assignments
  - 10,000 Tasks & ~20,000 team assignments
  - 100,000 Daily Reports
  - 1,000 Support Tickets & ~2,000 team assignments
  `);
  console.log(`All existing user data has been preserved intact.`);
  console.log(`======================================================\n`);
}

main().catch((e) => {
  console.error('Seeder crashed with error:', e);
  process.exit(1);
});
