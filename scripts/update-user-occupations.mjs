import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('No DATABASE_URL found in env');
  process.exit(1);
}

async function main() {
  const sql = neon(DATABASE_URL);

  console.log('Running database updates for user occupations...');

  // 1. Convert other Super Users to Co-Super User (excluding gadmin@multidayamitra.co.id)
  const updateOthersRes = await sql`
    UPDATE users 
    SET user_occupation = 'Co-Super User' 
    WHERE LOWER(user_occupation) = 'super user' 
      AND LOWER(user_email) != 'gadmin@multidayamitra.co.id'
    RETURNING user_id, user_email, user_occupation
  `;
  console.log(`Updated other Super Users to Co-Super User: ${updateOthersRes.length} rows.`);
  for (const row of updateOthersRes) {
    console.log(` - User ID: ${row.user_id}, Email: ${row.user_email}, New Occupation: ${row.user_occupation}`);
  }

  // 2. Guarantee gadmin@multidayamitra.co.id is Super User
  const updateSURes = await sql`
    UPDATE users 
    SET user_occupation = 'Super User' 
    WHERE LOWER(user_email) = 'gadmin@multidayamitra.co.id'
    RETURNING user_id, user_email, user_occupation
  `;
  console.log(`Ensured gadmin@multidayamitra.co.id is Super User: ${updateSURes.length} rows.`);
  for (const row of updateSURes) {
    console.log(` - User ID: ${row.user_id}, Email: ${row.user_email}, Occupation: ${row.user_occupation}`);
  }

  // 3. Demote irfanzuhdiabdillah@gmail.com to Members
  const updateIrfanRes = await sql`
    UPDATE users 
    SET user_occupation = 'Members' 
    WHERE LOWER(user_email) = 'irfanzuhdiabdillah@gmail.com'
    RETURNING user_id, user_email, user_occupation
  `;
  console.log(`Demoted irfanzuhdiabdillah@gmail.com to Members: ${updateIrfanRes.length} rows.`);
  for (const row of updateIrfanRes) {
    console.log(` - User ID: ${row.user_id}, Email: ${row.user_email}, Occupation: ${row.user_occupation}`);
  }

  console.log('Database update completed successfully.');
}

main().catch(console.error);
