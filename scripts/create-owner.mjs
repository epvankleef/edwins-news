// scripts/create-owner.mjs
// Gebruik: node --env-file=.env.local scripts/create-owner.mjs <email> <wachtwoord>
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const email = process.argv[2]
const password = process.argv[3]

if (!url || !serviceKey) {
  console.error('Ontbrekende env: NEXT_PUBLIC_SUPABASE_URL of SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
if (!email || !password) {
  console.error('Gebruik: node --env-file=.env.local scripts/create-owner.mjs <email> <wachtwoord>')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
})

if (error) {
  console.error('Fout bij aanmaken:', error.message)
  process.exit(1)
}
console.log('Account aangemaakt. user_id =', data.user.id)
