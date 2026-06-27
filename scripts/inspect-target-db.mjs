import postgres from 'postgres'

async function inspect() {
  const targetDb = postgres('postgresql://postgres:ntEkcttr4vKoj7cv@db.gguqhxinkcdzauvitnuf.supabase.co:5432/postgres', { ssl: 'require' })
  
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
