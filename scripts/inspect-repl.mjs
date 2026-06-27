import postgres from 'postgres'
import 'dotenv/config'

async function enableRealtime() {
  const targetDb = postgres(process.env.DATABASE_URL, { ssl: 'require' })
  
  try {
    // Check if publication exists
    const pubExists = await targetDb`
      SELECT pubname FROM pg_publication WHERE pubname = 'supabase_realtime'
    `
    
    if (pubExists.length === 0) {
      console.log('Creating supabase_realtime publication...')
      await targetDb`CREATE PUBLICATION supabase_realtime`
    }
    
    console.log('Adding tables to supabase_realtime publication...')
    await targetDb`
      ALTER PUBLICATION supabase_realtime ADD TABLE 
        tickets, ticket_comments, tasks, projects, project_logs, daily_reports;
    `
    
    const publications = await targetDb`
      SELECT pubname, tablename 
      FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime'
    `
    console.log('Realtime tables now:', publications.map(p => p.tablename))
  } catch (e) {
    console.error(e)
  } finally {
    await targetDb.end()
  }
}

enableRealtime()
