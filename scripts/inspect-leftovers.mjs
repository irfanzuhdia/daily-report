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
  console.log('Checking database table row counts...');

  const userCount = await sql`SELECT count(*) FROM users`;
  const projCount = await sql`SELECT count(*) FROM projects`;
  const taskCount = await sql`SELECT count(*) FROM tasks`;
  const reportCount = await sql`SELECT count(*) FROM daily_reports`;
  const ticketCount = await sql`SELECT count(*) FROM tickets`;
  const ptCount = await sql`SELECT count(*) FROM project_teams`;
  const ttCount = await sql`SELECT count(*) FROM task_teams`;
  const tktCount = await sql`SELECT count(*) FROM ticket_team`;

  console.log('Total table counts:');
  console.log(`- Users: ${userCount[0].count}`);
  console.log(`- Projects: ${projCount[0].count}`);
  console.log(`- Tasks: ${taskCount[0].count}`);
  console.log(`- Daily Reports: ${reportCount[0].count}`);
  console.log(`- Tickets: ${ticketCount[0].count}`);
  console.log(`- Project Teams: ${ptCount[0].count}`);
  console.log(`- Task Teams: ${ttCount[0].count}`);
  console.log(`- Ticket Teams: ${tktCount[0].count}`);
}

main();
