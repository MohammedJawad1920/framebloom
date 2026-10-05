'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function CampaignNameEditor({ id, initialName }: { id: string; initialName: string }) {
  const [name, setName] = useState(initialName)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const save = async () => {
    if (!name.trim()) return
    setSaving(true)
    await supabase.from('campaigns').update({ name }).eq('id', id)
    setSaving(false)
  }

  return (
    <div className="flex gap-2">
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        onBlur={save}
        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 focus:ring-2 focus:ring-indigo-500 text-2xl font-bold transition-shadow"
      />
      {saving && <span className="self-center text-sm text-gray-500 font-medium">Saving…</span>}
    </div>
  )
}
