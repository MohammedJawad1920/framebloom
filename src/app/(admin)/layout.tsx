import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return <>{children}</>
}
