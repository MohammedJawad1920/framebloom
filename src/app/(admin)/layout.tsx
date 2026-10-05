import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import LogoutButton from '@/components/admin/LogoutButton'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="font-semibold text-lg text-gray-900 tracking-tight">Frame Bloom</h1>
          <LogoutButton />
        </div>
      </header>
      <main className="flex-1">
        {children}
      </main>
    </div>
  )
}
