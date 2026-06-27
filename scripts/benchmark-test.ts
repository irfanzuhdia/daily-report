import dotenv from 'dotenv';
dotenv.config();

import { ProjectRepository } from '../lib/repositories/project-repository';
import { TaskRepository } from '../lib/repositories/task-repository';
import { DailyReportRepository } from '../lib/repositories/daily-report-repository';
import { TicketRepository } from '../lib/repositories/ticket-repository';
import { UserRepository } from '../lib/repositories/user-repository';
import { sql } from '../lib/db';

async function runBenchmarkForUser(userId: string, roleName: string) {
  const user = await UserRepository.findById(userId);
  if (!user) {
    console.log(`User ${userId} not found.`);
    return null;
  }

  const scopeInfo = 
    roleName === 'Super User' ? 'ALL' :
    roleName === 'Kepala Departement' ? user.user_departement :
    roleName === 'Site Manager' ? user.user_site :
    roleName === 'Div Manager' ? user.user_division :
    roleName === 'Team Leader' ? user.user_team :
    'OWN DATA';

  // 1. Benchmark Projects Fetch
  const t0 = performance.now();
  const projects = await ProjectRepository.findAll(userId);
  const t1 = performance.now();
  const projTime = (t1 - t0).toFixed(2);

  // 2. Benchmark Tasks Fetch
  const t2 = performance.now();
  const tasks = await TaskRepository.findAll(userId);
  const t3 = performance.now();
  const taskTime = (t3 - t2).toFixed(2);

  // 3. Benchmark Reports Fetch
  const t4 = performance.now();
  const reports = await DailyReportRepository.findAll(userId);
  const t5 = performance.now();
  const repTime = (t5 - t4).toFixed(2);

  // 4. Benchmark Tickets (My Tickets)
  const t6 = performance.now();
  const myTickets = await TicketRepository.findAll({ currentUserId: userId, tab: 'my' });
  const t7 = performance.now();
  const myTktTime = (t7 - t6).toFixed(2);

  // 5. Benchmark Tickets (Requested Tickets)
  const t8 = performance.now();
  const reqTickets = await TicketRepository.findAll({ currentUserId: userId, tab: 'requested', currentUserDivision: '' });
  const t9 = performance.now();
  const reqTktTime = (t9 - t8).toFixed(2);

  return {
    roleName,
    scopeInfo,
    projects: { count: projects.length, time: projTime },
    tasks: { count: tasks.length, time: taskTime },
    reports: { count: reports.length, time: repTime },
    myTickets: { count: myTickets.length, time: myTktTime },
    reqTickets: { count: reqTickets.length, time: reqTktTime }
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

  const selectedUsers: { userId: string; label: string }[] = [];
  for (const target of rolesToBenchmark) {
    const matched = users.find(u => u.user_occupation === target.role);
    if (matched) {
      selectedUsers.push({ userId: matched.user_id, label: target.label });
    }
  }

  // Fallback to existing users if mock users are not fully matched
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
      r.roleName.padEnd(25) + ' | ' +
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
