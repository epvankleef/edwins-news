import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const body = await req.json()
  const { news_item_id, rating, reason } = body

  if (!news_item_id || !Number.isInteger(rating) || ![1, 2, 3].includes(rating)) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const { error } = await supabase
    .from('user_feedback')
    .upsert(
      { news_item_id, rating, reason: reason ?? null },
      { onConflict: 'news_item_id' }
    )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
