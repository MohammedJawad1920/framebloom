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

  if (rows.length === 0) {
    return <p className="text-gray-500">No campaigns yet. Create your first one!</p>
  }

  return (
    <ul className="space-y-3">
      {rows.map(c => (
        <li key={c.id} className="flex items-center gap-4 rounded-lg border p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
          <Link href={`/campaigns/${c.id}`} className="flex-1 font-medium hover:underline">
            {c.name}
          </Link>
          <span className="text-sm text-gray-500">{c.frames[0]?.count ?? 0} frames</span>
          <button
            onClick={() => toggleActive(c.id, c.is_active)}
            className={`rounded px-3 py-1 text-sm ${c.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'} hover:opacity-80 transition-opacity`}
          >
            {c.is_active ? 'Active' : 'Inactive'}
          </button>
          <button
            onClick={() => copyLink(c.public_token)}
            className="rounded px-3 py-1 text-sm bg-blue-50 text-blue-700 hover:bg-blue-100"
          >
            Copy link
          </button>
          <button
            onClick={() => regenerateLink(c.id)}
            className="rounded px-3 py-1 text-sm text-gray-500 hover:text-red-600"
          >
            Regenerate link
          </button>
        </li>
      ))}
    </ul>
  )
}
