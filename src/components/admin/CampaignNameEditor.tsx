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
        className="flex-1 rounded border px-3 py-2 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      {saving && <span className="self-center text-sm text-gray-400">Saving…</span>}
    </div>
  )
}
