import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

  const { data: feedback } = await supabase
    .from('user_feedback')
    .select('rating, reason, created_at, news_items(title, summary, category, source)')
    .gte('created_at', since)
    .order('created_at', { ascending: false })

  if (!feedback || feedback.length === 0) {
    return NextResponse.json({ skipped: true, reason: 'No feedback yet' })
  }

  const lines = feedback.map((f) => {
    const raw = f.news_items
    const item = (Array.isArray(raw) ? raw[0] : raw) as { title: string; summary?: string; category: string; source: string } | null
    const recent = f.created_at >= twoWeeksAgo ? ' [recent]' : ''
    const summaryLine = item?.summary ? `\n  → "${item.summary.slice(0, 120)}"` : ''
    const label = f.rating === 3 ? 'interessant' : f.rating === 2 ? 'mwah' : 'niet interessant'
    return `- ${label}${recent}: "${item?.title ?? 'onbekend'}" (${item?.category ?? ''}, ${item?.source ?? ''})${summaryLine}${f.reason ? `\n  opmerking: "${f.reason}"` : ''}`
  })

  // Recente feedback dubbel gewicht
  const recentLines = lines.filter((_, i) => feedback[i].created_at >= twoWeeksAgo)
  const allLines = [...lines, ...recentLines].join('\n')

  const prompt = `Op basis van de volgende nieuwsfeedback (interessant / mwah / niet interessant) van een gebruiker, schrijf een beknopt voorkeursprofiel van ~200 woorden in het Nederlands. Beschrijf welke onderwerpen, type berichten en bronnen de gebruiker interessant vindt, en wat hij/zij wil vermijden. Wees specifiek over patronen die je ziet.

Feedback:
${allLines}

Schrijf alleen het profiel, geen inleiding of afsluiting.`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
    })

    const profile = response.choices[0]?.message?.content?.trim()
    if (!profile) return NextResponse.json({ error: 'No profile generated' }, { status: 500 })

    const { error } = await supabase
      .from('user_profile')
      .upsert({ id: 1, profile, updated_at: new Date().toISOString() })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, length: profile.length })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
