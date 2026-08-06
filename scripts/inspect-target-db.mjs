import postgres from 'postgres'

async function inspect() {
  const targetDb = postgres(process.env.DATABASE_URL, { ssl: 'require' })
  
  try {
    const tables = await targetDb`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema='public'
    `
    console.log('Tables in Target DB:', tables.map(t => t.table_name))
  } catch (e) {
    console.error(e)
  } finally {
    await targetDb.end()
  }
}

inspect()
