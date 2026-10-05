"use client"
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LogoutButton() {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.refresh()
    router.push('/login')
  }

  return (
    <button 
      onClick={handleLogout}
      className="group flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-400 bg-gray-900/40 border border-gray-800 rounded-lg hover:text-white hover:bg-gray-800 hover:border-gray-700 transition-all shadow-sm"
      title="Log out"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
        <polyline points="16 17 21 12 16 7"></polyline>
        <line x1="21" y1="12" x2="9" y2="12"></line>
      </svg>
      Log out
    </button>
  )
}
