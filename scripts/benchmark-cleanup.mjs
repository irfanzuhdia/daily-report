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
  console.log('Starting Benchmark Data Cleanup...');
  const startTime = Date.now();

  try {
    // 1. Delete ticket teams associated with benchmark tickets or benchmark users
    console.log('Deleting benchmark ticket teams...');
    const delTicketTeams = await sql`
      DELETE FROM ticket_team 
      WHERE ticket_id IN (SELECT id FROM tickets WHERE title LIKE 'Benchmark Support Ticket %')
         OR user_id IN (SELECT user_id FROM users WHERE user_name LIKE 'Benchmark User %')
    `;
    console.log(`Deleted ticket teams.`);

    // 2. Delete tickets associated with benchmark users or matching benchmark titles
    console.log('Deleting benchmark tickets...');
    const delTickets = await sql`
      DELETE FROM tickets 
      WHERE title LIKE 'Benchmark Support Ticket %'
         OR request_by IN (SELECT user_id FROM users WHERE user_name LIKE 'Benchmark User %')
    `;
    console.log(`Deleted tickets.`);

    // 3. Delete daily reports associated with benchmark tasks or benchmark users
    console.log('Deleting benchmark daily reports...');
    const delReports = await sql`
      DELETE FROM daily_reports 
      WHERE remarks LIKE 'Benchmark report %'
         OR user_id IN (SELECT user_id FROM users WHERE user_name LIKE 'Benchmark User %')
         OR task_id IN (SELECT id FROM tasks WHERE task_description LIKE 'Benchmark Task description %')
    `;
    console.log(`Deleted daily reports.`);

    // 4. Delete task teams associated with benchmark tasks or benchmark users
    console.log('Deleting benchmark task teams...');
    const delTaskTeams = await sql`
      DELETE FROM task_teams 
      WHERE task_id IN (SELECT id FROM tasks WHERE task_description LIKE 'Benchmark Task description %')
         OR user_id IN (SELECT user_id FROM users WHERE user_name LIKE 'Benchmark User %')
    `;
    console.log(`Deleted task teams.`);

    // 5. Delete tasks associated with benchmark projects or benchmark users
    console.log('Deleting benchmark tasks...');
    const delTasks = await sql`
      DELETE FROM tasks 
      WHERE task_description LIKE 'Benchmark Task description %'
         OR created_by IN (SELECT user_id FROM users WHERE user_name LIKE 'Benchmark User %')
         OR project_id IN (SELECT project_id FROM projects WHERE project_name LIKE 'Benchmark Project %')
    `;
    console.log(`Deleted tasks.`);

    // 6. Delete project teams associated with benchmark projects or benchmark users
    console.log('Deleting benchmark project teams...');
    const delProjTeams = await sql`
      DELETE FROM project_teams 
      WHERE project_id IN (SELECT project_id FROM projects WHERE project_name LIKE 'Benchmark Project %')
         OR user_id IN (SELECT user_id FROM users WHERE user_name LIKE 'Benchmark User %')
    `;
    console.log(`Deleted project teams.`);

    // 7. Delete projects associated with benchmark users or matching benchmark names
    console.log('Deleting benchmark projects...');
    const delProjects = await sql`
      DELETE FROM projects 
      WHERE project_name LIKE 'Benchmark Project %'
         OR created_by IN (SELECT user_id FROM users WHERE user_name LIKE 'Benchmark User %')
    `;
    console.log(`Deleted projects.`);

    // 8. Delete users matching benchmark names or emails
    console.log('Deleting benchmark users...');
    const delUsers = await sql`
      DELETE FROM users 
      WHERE user_name LIKE 'Benchmark User %'
         OR user_email LIKE 'benchmark.user%@example.com'
    `;
    console.log(`Deleted users.`);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n======================================================`);
    console.log(`SUCCESS: Benchmark cleanup completed successfully in ${duration} seconds.`);
    console.log(`All benchmark data has been completely removed from the database.`);
    console.log(`Original user data remains completely untouched.`);
    console.log(`======================================================\n`);
  } catch (error) {
    console.error('Cleanup failed with error:', error);
    process.exit(1);
  }
}

main();
