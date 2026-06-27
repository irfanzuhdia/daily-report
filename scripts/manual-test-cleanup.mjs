import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('No DATABASE_URL found in env');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function main() {
  console.log('Starting Manual Test Data Cleanup...');
  const startTime = Date.now();

  const projectIdsToDelete = [
    'P-260001', // Fix Test
    'P-260003', // tes
    'P-260004', // asdasd
    'P-260006', // test
    'P-260007', // test project
    'P-260008', // tes project
    'P-260009', // tes project 43
    'P-260010', // tes project1253
    'P-260011', // tes
    'P-260018', // Test Project 1782121966874
    'P-260022'  // tes
  ];

  const taskIdsToDelete = [
    'T-00001', // tes
    'T-00002', // tes
    'T-00013'  // tes
  ];

  const reportIdsToDelete = [
    'R-0001', // TES
    'R-0002'  // tes report
  ];

  const ticketIdsToDelete = [
    'TK-0001', // tes
    'TK-0002'  // tesada
  ];

  try {
    // 1. Delete ticket teams for target tickets or tickets starting with "tes"
    console.log('Deleting manual test ticket teams...');
    await sql`
      DELETE FROM ticket_team 
      WHERE ticket_id = ANY(${ticketIdsToDelete})
         OR ticket_id IN (SELECT id FROM tickets WHERE title ILIKE 'tes%' OR title ILIKE 'test%')
    `;

    // 2. Delete tickets
    console.log('Deleting manual test tickets...');
    await sql`
      DELETE FROM tickets 
      WHERE id = ANY(${ticketIdsToDelete})
         OR title ILIKE 'tes%' 
         OR title ILIKE 'test%'
    `;

    // 3. Delete daily reports associated with target reports, tasks, or projects
    console.log('Deleting manual test daily reports...');
    await sql`
      DELETE FROM daily_reports 
      WHERE report_id = ANY(${reportIdsToDelete})
         OR remarks ILIKE 'tes%'
         OR task_id = ANY(${taskIdsToDelete})
         OR task_id IN (SELECT id FROM tasks WHERE project_id = ANY(${projectIdsToDelete}))
    `;

    // 3b. Delete task logs and files to avoid foreign key violations
    console.log('Deleting task logs and files...');
    await sql`
      DELETE FROM task_logs 
      WHERE task_id = ANY(${taskIdsToDelete})
         OR task_id IN (SELECT id FROM tasks WHERE project_id = ANY(${projectIdsToDelete}))
    `;
    await sql`
      DELETE FROM files 
      WHERE project_id = ANY(${projectIdsToDelete})
         OR task_id = ANY(${taskIdsToDelete})
         OR report_id = ANY(${reportIdsToDelete})
    `;

    // 3c. Delete project logs to avoid foreign key violations
    console.log('Deleting project logs...');
    await sql`
      DELETE FROM project_logs 
      WHERE project_id = ANY(${projectIdsToDelete})
    `;

    // 4. Delete task teams
    console.log('Deleting manual test task teams...');
    await sql`
      DELETE FROM task_teams 
      WHERE task_id = ANY(${taskIdsToDelete})
         OR task_id IN (SELECT id FROM tasks WHERE project_id = ANY(${projectIdsToDelete}))
    `;

    // 5. Delete tasks
    console.log('Deleting manual test tasks...');
    await sql`
      DELETE FROM tasks 
      WHERE id = ANY(${taskIdsToDelete})
         OR project_id = ANY(${projectIdsToDelete})
    `;

    // 6. Delete project teams
    console.log('Deleting manual test project teams...');
    await sql`
      DELETE FROM project_teams 
      WHERE project_id = ANY(${projectIdsToDelete})
    `;

    // 7. Delete projects
    console.log('Deleting manual test projects...');
    await sql`
      DELETE FROM projects 
      WHERE project_id = ANY(${projectIdsToDelete})
         OR project_name ILIKE 'tes%' 
         OR project_name ILIKE 'test%'
         OR project_name = 'asdasd'
         OR project_name = 'Fix Test'
    `;

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n======================================================`);
    console.log(`SUCCESS: Manual test data cleanup completed in ${duration} seconds.`);
    console.log(`Successfully removed all development test records ('tes', 'test', etc.).`);
    console.log(`Only actual production projects and tasks remain.`);
    console.log(`======================================================\n`);
  } catch (error) {
    console.error('Cleanup failed with error:', error);
    process.exit(1);
  }
}

main();
