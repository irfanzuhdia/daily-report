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
  console.log('Running VACUUM FULL to reclaim disk space from deleted rows...');
  const startTime = Date.now();

  try {
    // Note: VACUUM FULL cannot run inside a transaction block, 
    // but the neon serverless driver executes queries individually, so this is fine.
    await sql`VACUUM FULL`;
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n======================================================`);
    console.log(`SUCCESS: VACUUM FULL completed in ${duration} seconds.`);
    console.log(`All dead space from deleted rows has been physically reclaimed.`);
    console.log(`The physical database files on Neon have been shrunk.`);
    console.log(`======================================================\n`);
  } catch (error) {
    console.error('VACUUM FULL failed:', error);
    process.exit(1);
  }
}

main();
