import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getServerSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function DELETE(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const hasCronSecret = !!cronSecret && req.headers.get('authorization') === `Bearer ${cronSecret}`
  let isLoggedIn = false
  if (!hasCronSecret) {
    const sb = await getServerSupabase()
    const { data: { user } } = await sb.auth.getUser()
    isLoggedIn = !!user
  }
  if (!hasCronSecret && !isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const today = new Date().toISOString().split('T')[0]
  const { count, error } = await supabase
    .from('news_items')
    .delete({ count: 'exact' })
    .gte('created_at', today + 'T00:00:00')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, deleted: count ?? 0 })
}
