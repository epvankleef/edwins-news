import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Haal IDs op van artikelen die 'interessant' zijn → nooit verwijderen
  const { data: saved } = await supabase
    .from('user_feedback')
    .select('news_item_id')
    .eq('rating', 'up')
  const savedIds = (saved ?? []).map((r) => r.news_item_id)

  const now = new Date()
  const day7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const day30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // Verwijder onbeoordeelde artikelen ouder dan 7 dagen
  const unratedQuery = supabase
    .from('news_items')
    .delete()
    .lt('created_at', day7)
    .not('id', 'in', `(${['00000000-0000-0000-0000-000000000000', ...savedIds].join(',')})`)

  // Verwijder mwah/niet-voor-mij ouder dan 30 dagen
  const { data: ratedDown } = await supabase
    .from('user_feedback')
    .select('news_item_id')
    .in('rating', ['neutral', 'down'])
  const downIds = (ratedDown ?? []).map((r) => r.news_item_id)

  let deletedDown = 0
  if (downIds.length > 0) {
    const { count } = await supabase
      .from('news_items')
      .delete({ count: 'exact' })
      .in('id', downIds)
      .lt('created_at', day30)
    deletedDown = count ?? 0
  }

  const { count: deletedUnrated } = await unratedQuery

  return NextResponse.json({
    ok: true,
    deleted_unrated: deletedUnrated ?? 0,
    deleted_old_rated: deletedDown,
  })
}
