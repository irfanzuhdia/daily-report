import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('No DATABASE_URL found in env');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

// Helper to get role level
async function getUserLevel(roleName) {
  const rows = await sql`SELECT level FROM role_levels WHERE role_name = ${roleName}`;
  return rows[0]?.level || 1;
}

async function runBenchmarkForUser(userId, roleLabel) {
  // 1. Fetch user info
  const userRows = await sql`SELECT * FROM users WHERE user_id = ${userId}`;
  const user = userRows[0];
  if (!user) {
    console.log(`User ${userId} not found.`);
    return null;
  }

  const level = await getUserLevel(user.user_occupation);
  const viewerOcc = (user.user_occupation || '').toLowerCase().trim();

  // Define scope conditions exactly matching our repository implementation
  let scopeConditionProjTask = '';
  let scopeConditionRep = '';
  const params = [userId];

  if (viewerOcc === 'kepala departement' || viewerOcc === 'kepala department') {
    params.push(user.user_departement || '');
    scopeConditionProjTask = `(LOWER(u.user_departement) = LOWER($2) OR LOWER(mu.user_departement) = LOWER($2))`;
    scopeConditionRep = `(LOWER(u.user_departement) = LOWER($2) OR LOWER(cu.user_departement) = LOWER($2))`;
  } else if (viewerOcc === 'site manager' || viewerOcc === 'site admin' || level === 5) {
    params.push(user.user_site || '');
    scopeConditionProjTask = `(LOWER(u.user_site) = LOWER($2) OR LOWER(mu.user_site) = LOWER($2))`;
    scopeConditionRep = `(LOWER(u.user_site) = LOWER($2) OR LOWER(cu.user_site) = LOWER($2))`;
  } else if (
    viewerOcc === 'divisi manager' || 
    viewerOcc === 'divisi admin' || 
    viewerOcc === 'div manager' || 
    viewerOcc === 'div admin' || 
    level === 4 || 
    level === 3
  ) {
    params.push(user.user_division || '');
    scopeConditionProjTask = `(LOWER(u.user_division) = LOWER($2) OR LOWER(mu.user_division) = LOWER($2))`;
    scopeConditionRep = `(LOWER(u.user_division) = LOWER($2) OR LOWER(cu.user_division) = LOWER($2))`;
  } else if (viewerOcc === 'team leader' || level === 2) {
    params.push(user.user_team || '');
    scopeConditionProjTask = `(LOWER(u.user_team) = LOWER($2) OR LOWER(mu.user_team) = LOWER($2))`;
    scopeConditionRep = `(LOWER(u.user_team) = LOWER($2) OR LOWER(cu.user_team) = LOWER($2))`;
  }

  const scopeInfo = 
    level >= 6 ? 'ALL' :
    scopeConditionProjTask ? (params[1] || 'OWN DATA') : 'OWN DATA';

  // ==================== A. BENCHMARK PROJECTS ====================
  let projCount = 0;
  let projTime = 0;
  
  const t0 = performance.now();
  if (level >= 6) {
    const rows = await sql`SELECT * FROM projects WHERE deleted_at IS NULL ORDER BY created_at DESC`;
    projCount = rows.length;
  } else {
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
    if (scopeConditionProjTask) {
      query += ` OR ${scopeConditionProjTask}`;
    }
    query += `) ORDER BY p.created_at DESC`;
    const rows = await sql.query(query, params);
    projCount = rows.length;
  }
  projTime = (performance.now() - t0).toFixed(2);

  // ==================== B. BENCHMARK TASKS ====================
  let taskCount = 0;
  let taskTime = 0;

  const t1 = performance.now();
  if (level >= 6) {
    const rows = await sql`SELECT * FROM tasks WHERE deleted_at IS NULL ORDER BY created_at DESC`;
    taskCount = rows.length;
  } else {
    let query = `
      SELECT DISTINCT t.* 
      FROM tasks t
      LEFT JOIN users u ON t.created_by = u.user_id
      LEFT JOIN task_teams tt ON t.id = tt.task_id AND tt.deleted_at IS NULL
      LEFT JOIN users mu ON tt.user_id = mu.user_id
      WHERE t.deleted_at IS NULL 
        AND (
          t.created_by = $1
          OR tt.user_id = $1
    `;
    if (scopeConditionProjTask) {
      query += ` OR ${scopeConditionProjTask}`;
    }
    query += `) ORDER BY t.created_at DESC`;
    const rows = await sql.query(query, params);
    taskCount = rows.length;
  }
  taskTime = (performance.now() - t1).toFixed(2);

  // ==================== C. BENCHMARK DAILY REPORTS ====================
  let repCount = 0;
  let repTime = 0;

  const t2 = performance.now();
  if (level >= 6) {
    const rows = await sql`SELECT * FROM daily_reports WHERE deleted_at IS NULL ORDER BY created_at DESC`;
    repCount = rows.length;
  } else {
    let query = `
      SELECT DISTINCT dr.* 
      FROM daily_reports dr
      LEFT JOIN users u ON dr.user_id = u.user_id
      LEFT JOIN users cu ON dr.created_by = cu.user_id
      WHERE dr.deleted_at IS NULL 
        AND (
          dr.user_id = $1
          OR dr.created_by = $1
    `;
    if (scopeConditionRep) {
      query += ` OR ${scopeConditionRep}`;
    }
    query += `) ORDER BY dr.created_at DESC`;
    const rows = await sql.query(query, params);
    repCount = rows.length;
  }
  repTime = (performance.now() - t2).toFixed(2);

  // ==================== D. BENCHMARK TICKETS (MY) ====================
  let myTktCount = 0;
  let myTktTime = 0;

  const t3 = performance.now();
  // Filter my tickets (created by the user)
  let myQuery = `
    SELECT DISTINCT t.* 
    FROM tickets t
    WHERE t.deleted_at IS NULL AND t.request_by = $1
    ORDER BY t.created_at DESC
  `;
  const myRows = await sql.query(myQuery, [userId]);
  myTktCount = myRows.length;
  myTktTime = (performance.now() - t3).toFixed(2);

  // ==================== E. BENCHMARK TICKETS (REQUESTED) ====================
  let reqTktCount = 0;
  let reqTktTime = 0;

  const t4 = performance.now();
  // Filter requested tickets (requested to user's division, or where user is tagged, or team member)
  const userDivision = user.user_division || '';
  let reqQuery = `
    SELECT DISTINCT t.* 
    FROM tickets t
    LEFT JOIN ticket_team tt ON t.id = tt.ticket_id
    WHERE t.deleted_at IS NULL 
      AND (
        (t.request_to_division IS NOT NULL AND LOWER(t.request_to_division) = LOWER($1))
        OR t.tag_person = $2
        OR tt.user_id = $2
      )
  `;
  const reqRows = await sql.query(reqQuery, [userDivision, userId]);
  reqTktCount = reqRows.length;
  reqTktTime = (performance.now() - t4).toFixed(2);

  return {
    roleLabel,
    scopeInfo,
    projects: { count: projCount, time: projTime },
    tasks: { count: taskCount, time: taskTime },
    reports: { count: repCount, time: repTime },
    myTickets: { count: myTktCount, time: myTktTime },
    reqTickets: { count: reqTktCount, time: reqTktTime }
  };
}

async function main() {
  console.log('\n================================================================================');
  console.log('RUNNING REAL-TIME PERFORMANCE BENCHMARK ON 135,000+ ROW POSTGRES DATABASE');
  console.log('================================================================================\n');

  // We find users corresponding to different roles in our benchmark set
  const users = await sql`
    SELECT user_id, user_occupation, user_departement, user_site, user_division, user_team 
    FROM users 
    WHERE user_id LIKE 'U-%' 
    LIMIT 200
  `;

  // Select one user for each target role
  const rolesToBenchmark = [
    { role: 'Direktur', label: 'Super User (Direktur)' },
    { role: 'Kepala Departement', label: 'Kepala Departement' },
    { role: 'Site Manager', label: 'Site Manager' },
    { role: 'Div Manager', label: 'Division Manager' },
    { role: 'Team Leader', label: 'Team Leader' },
    { role: 'Staff', label: 'Regular Staff' }
  ];

  const selectedUsers = [];
  for (const target of rolesToBenchmark) {
    const matched = users.find(u => u.user_occupation === target.role);
    if (matched) {
      selectedUsers.push({ userId: matched.user_id, label: target.label });
    }
  }

  if (selectedUsers.length === 0) {
    console.log('No benchmark users found. Please make sure the seeder ran successfully.');
    process.exit(1);
  }

  const results = [];
  for (const u of selectedUsers) {
    console.log(`Running query benchmarks for ${u.label} (${u.userId})...`);
    const res = await runBenchmarkForUser(u.userId, u.label);
    if (res) results.push(res);
  }

  console.log('\n================================================================================');
  console.log('BENCHMARK RESULTS TABLE (DATABASE-LEVEL ROLE-SEGREGATION & QUERY TIMES)');
  console.log('================================================================================');
  console.log(
    String('ROLE').padEnd(25) + ' | ' +
    String('SCOPE').padEnd(16) + ' | ' +
    String('PROJECTS (QTY/TIME)').padEnd(21) + ' | ' +
    String('TASKS (QTY/TIME)').padEnd(18) + ' | ' +
    String('REPORTS (QTY/TIME)').padEnd(20) + ' | ' +
    String('TICKETS (MY/REQ)')
  );
  console.log('-'.repeat(120));

  for (const r of results) {
    const projStr = `${r.projects.count} items / ${r.projects.time}ms`;
    const taskStr = `${r.tasks.count} items / ${r.tasks.time}ms`;
    const repStr = `${r.reports.count} items / ${r.reports.time}ms`;
    const tktStr = `${r.myTickets.count} my / ${r.reqTickets.count} req`;
    
    console.log(
      r.roleLabel.padEnd(25) + ' | ' +
      String(r.scopeInfo || '').substring(0, 15).padEnd(16) + ' | ' +
      projStr.padEnd(21) + ' | ' +
      taskStr.padEnd(18) + ' | ' +
      repStr.padEnd(20) + ' | ' +
      tktStr
    );
  }
  console.log('================================================================================\n');
  process.exit(0);
}

main().catch(console.error);
