import { NextRequest, NextResponse } from 'next/server'
import { generateProfile } from '@/lib/generateProfile'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const expected = process.env.CRON_SECRET ?? process.env.NEXT_PUBLIC_CRON_SECRET
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await generateProfile()
  if (result.ok) return NextResponse.json({ ok: true, length: result.length })
  if ('skipped' in result) return NextResponse.json({ skipped: true, reason: result.reason })
  return NextResponse.json({ error: result.error }, { status: 500 })
}
