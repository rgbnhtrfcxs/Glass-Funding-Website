import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY // service key for server-side
const supabase = createClient(supabaseUrl, supabaseKey)

export async function authMiddleware(event) {
  const authHeader = event.headers.authorization || ''
  const token = authHeader.replace('Bearer ', '')

  if (!token) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) }
  }

  const { data: user, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) }
  }

  return { user } // returns user info if valid
}
