import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

function decodeHTML(str: string): string {
  return str
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ').trim()
}

function cleanDesc(raw: string): string {
  return decodeHTML(raw
    .replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
  ).slice(0, 300)
}

export async function GET() {
  const results: Record<string, unknown> = {}

  // Test 1: OpenAI verbinding
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const r = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [{ role: 'user', content: 'Zeg hoi' }],
      max_tokens: 5,
    })
    results.openai = '✓ ' + r.choices[0]?.message?.content
  } catch (e) {
    results.openai = '✗ ' + String(e)
  }

  // Test 2: Supabase verbinding
  try {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { error } = await sb.from('user_profile').select('id').limit(1)
    results.supabase = error ? '✗ ' + error.message : '✓ ok'
  } catch (e) {
    results.supabase = '✗ ' + String(e)
  }

  // Test 3: RSS ophalen + HTML strippen (VentureBeat)
  try {
    const res = await fetch('https://venturebeat.com/category/ai/feed/', {
      headers: { 'User-Agent': 'NewsDigest/1.0' },
      signal: AbortSignal.timeout(5000),
    })
    const xml = await res.text()
    const items = xml.match(/<item[\s\S]*?<\/item>/g) ?? []
    const first = items[0] ?? ''
    const title = decodeHTML((first.match(/<title[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ?? first.match(/<title[^>]*>([\s\S]*?)<\/title>/))?.[1] ?? '')
    const rawDesc = (first.match(/<description[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) ?? first.match(/<description[^>]*>([\s\S]*?)<\/description>/))?.[1] ?? ''
    results.rss = { title, raw_desc: rawDesc.slice(0, 200), clean_desc: cleanDesc(rawDesc) }
  } catch (e) {
    results.rss = '✗ ' + String(e)
  }

  // Test 4: GPT vertaling met json_object
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const r = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: 'Je bent een nieuwsredacteur. Je antwoordt ALTIJD in het Nederlands. Je antwoordt ALLEEN met geldige JSON.' },
        { role: 'user', content: 'Verwerk dit artikel:\n1. OpenAI releases new model | OpenAI has released a powerful new AI model today.\n\nGeef terug als JSON: {"articles":[{"index":1,"score":8,"title":"Nederlandse titel","summary":"Nederlandse samenvatting"}]}' },
      ],
      temperature: 0,
      max_tokens: 200,
      response_format: { type: 'json_object' },
    })
    const raw = r.choices[0]?.message?.content ?? ''
    let parsed = null
    try { parsed = JSON.parse(raw) } catch { /* */ }
    results.translation = { raw_response: raw, parsed }
  } catch (e) {
    results.translation = '✗ ' + String(e)
  }

  return NextResponse.json(results, { status: 200 })
}
