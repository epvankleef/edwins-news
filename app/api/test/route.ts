import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const results: Record<string, string> = {}

  // Test 1: OpenAI
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

  // Test 2: Supabase
  try {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { error } = await sb.from('user_profile').select('id').limit(1)
    results.supabase = error ? '✗ ' + error.message : '✓ ok'
  } catch (e) {
    results.supabase = '✗ ' + String(e)
  }

  return NextResponse.json(results)
}
