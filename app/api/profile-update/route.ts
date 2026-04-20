import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  // Check if we have enough new feedback since last profile update
  const { data: profile } = await supabase
    .from('user_profile')
    .select('updated_at')
    .eq('id', 1)
    .single()

  const since = profile?.updated_at ?? new Date(0).toISOString()

  const { count } = await supabase
    .from('user_feedback')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', since)

  if ((count ?? 0) < 10) {
    return NextResponse.json({ skipped: true, reason: `Only ${count} new ratings` })
  }

  // Trigger the cron profile route logic directly
  const res = await fetch(new URL('/api/cron/profile', process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'), {
    method: 'GET',
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  })

  return NextResponse.json({ triggered: true, status: res.status })
}
