import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _supabase: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return _supabase
}

/** @deprecated use getSupabase() */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabase() as unknown as Record<string | symbol, unknown>)[prop]
  },
})

export type NewsItem = {
  id: string
  title: string
  summary: string | null
  url: string | null
  source: string | null
  category: string | null
  score: number | null
  published_at: string | null
  created_at: string
}

export type FeedbackRating = 1 | 2 | 3
