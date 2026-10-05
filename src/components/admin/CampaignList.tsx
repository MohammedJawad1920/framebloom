'use client'
import Link from 'next/link'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Campaign = {
  id: string
  name: string
  is_active: boolean
  public_token: string
  frames: { count: number }[]
}

export default function CampaignList({ campaigns }: { campaigns: Campaign[] }) {
  const supabase = createClient()
  const [rows, setRows] = useState(campaigns)

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from('campaigns').update({ is_active: !current }).eq('id', id)
    setRows(r => r.map(c => c.id === id ? { ...c, is_active: !current } : c))
  }

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/c/${token}`)
  }

  const regenerateLink = async (id: string) => {
    if (!confirm('This will invalidate the current link. Continue?')) return
    const res = await fetch(`/api/campaigns/${id}/regenerate-token`, { method: 'POST' })
    const { token } = await res.json()
    setRows(r => r.map(c => c.id === id ? { ...c, public_token: token } : c))
  }

  const deleteCampaign = async (id: string) => {
    if (!confirm('Are you sure you want to delete this campaign? This action cannot be undone.')) return
    
    setRows(r => r.filter(c => c.id !== id))
    const { error } = await supabase.from('campaigns').delete().eq('id', id)
    
    if (error) {
      alert('Failed to delete campaign.')
      // Revert optimistic delete if it fails
      setRows(campaigns)
    }
  }

  if (rows.length === 0) {
    return <p className="text-gray-500">No campaigns yet. Create your first one!</p>
  }

  return (
    <ul className="space-y-4">
      {rows.map(c => (
        <li key={c.id} className="flex flex-col sm:flex-row sm:items-center gap-4 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 transition-colors hover:border-gray-200">
          <div className="flex-1 flex flex-col gap-1">
            <Link href={`/campaigns/${c.id}`} prefetch={true} className="font-semibold text-lg hover:text-indigo-600 transition-colors">
              {c.name}
            </Link>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">{c.frames[0]?.count ?? 0} frames</span>
              <button
                onClick={() => toggleActive(c.id, c.is_active)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'} hover:opacity-80 transition-opacity`}
              >
                {c.is_active ? 'Active' : 'Inactive'}
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-2 mt-4 sm:mt-0 flex-wrap sm:flex-nowrap">
            <button
              onClick={() => copyLink(c.public_token)}
              className="bg-white hover:bg-gray-50 text-gray-700 font-medium text-sm sm:text-base whitespace-nowrap px-3 sm:px-5 py-2 sm:py-3 rounded-xl border border-gray-200 shadow-sm transition-colors min-h-[44px] flex-1 sm:flex-none text-center"
            >
              Copy link
            </button>
            <button
              onClick={() => regenerateLink(c.id)}
              className="bg-white hover:bg-gray-50 text-gray-700 font-medium text-sm sm:text-base whitespace-nowrap px-3 sm:px-5 py-2 sm:py-3 rounded-xl border border-gray-200 shadow-sm transition-colors min-h-[44px] flex-1 sm:flex-none text-center"
            >
              Regenerate link
            </button>
            <button
              onClick={() => deleteCampaign(c.id)}
              className="bg-white hover:bg-red-50 text-red-600 font-medium text-sm sm:text-base whitespace-nowrap px-3 sm:px-5 py-2 sm:py-3 rounded-xl border border-red-200 shadow-sm transition-colors min-h-[44px] flex-1 sm:flex-none text-center"
            >
              Delete
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
