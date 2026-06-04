'use client'

import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'

export default function LogoutButton({ className = 'chip' }: { className?: string }) {
  const router = useRouter()

  async function onLogout() {
    await getSupabase().auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  return (
    <button className={className} onClick={onLogout} title="Uitloggen">
      ⏻ uitloggen
    </button>
  )
}
