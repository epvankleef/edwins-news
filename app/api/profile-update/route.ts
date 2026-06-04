import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateProfile } from '@/lib/generateProfile'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const THRESHOLD = 10

export async function POST() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  // Genoeg nieuwe beoordelingen sinds de laatste profielupdate?
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

  if ((count ?? 0) < THRESHOLD) {
    return NextResponse.json({ skipped: true, reason: `Only ${count} new ratings` })
  }

  // Drempel gehaald → genereer het profiel direct (geen HTTP-omweg)
  const result = await generateProfile()
  if (result.ok) {
    return NextResponse.json({ triggered: true, ok: true, length: result.length })
  }
  const reason = 'error' in result ? result.error : result.reason
  return NextResponse.json({ triggered: true, ok: false, reason })
}
