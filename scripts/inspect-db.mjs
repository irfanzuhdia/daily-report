import postgres from 'postgres'
import 'dotenv/config'

async function inspect() {
  const targetDb = postgres(process.env.DATABASE_URL, { ssl: 'require' })
  
  try {
    const columns = await targetDb`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='tasks'
    `
    console.log('Columns in tasks:', columns.map(c => c.column_name))
  } catch (e) {
    console.error(e)
  } finally {
    await targetDb.end()
  }
}

inspect()
