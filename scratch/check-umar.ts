import { sql } from '../lib/db'

async function run() {
  const users = await sql`SELECT user_name, user_occupation, user_departement, user_site, user_division, user_team FROM users WHERE user_name ILIKE '%umar%'`
  console.log('Users:', users)
  const roles = await sql`SELECT * FROM role_levels`
  console.log('Roles:', roles)
  process.exit(0)
}

run()
