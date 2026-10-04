'use client'
import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Frame = {
  id: string
  label: string
  color_hex: string
  storage_path: string
  sort_order: number
}

export default function FrameList({
  initialFrames,
}: {
  campaignId: string
  initialFrames: Frame[]
}) {
  const [frames, setFrames] = useState([...initialFrames].sort((a, b) => a.sort_order - b.sort_order))
  const router = useRouter()
  const supabase = createClient()

  const deleteFrame = async (id: string) => {
    if (!confirm('Delete this frame?')) return
    await supabase.from('frames').delete().eq('id', id)
    setFrames(f => f.filter(fr => fr.id !== id))
    router.refresh()
  }

  const updateColor = async (id: string, color: string) => {
    setFrames(f => f.map(fr => fr.id === id ? { ...fr, color_hex: color } : fr))
    await supabase.from('frames').update({ color_hex: color }).eq('id', id)
  }

  const getPublicUrl = (path: string) =>
    supabase.storage.from('frames').getPublicUrl(path).data.publicUrl

  return (
    <ul className="space-y-2">
      {frames.map(frame => (
        <li key={frame.id} className="flex items-center gap-3 rounded border p-3">
          <input
            type="color"
            value={frame.color_hex}
            onChange={(e) => updateColor(frame.id, e.target.value)}
            className="h-8 w-8 cursor-pointer rounded border p-0"
          />
          <Image
            src={getPublicUrl(frame.storage_path)}
            alt={frame.label}
            width={48}
            height={48}
            className="rounded object-contain"
            crossOrigin="anonymous"
          />
          <span className="flex-1 text-sm font-medium">{frame.label}</span>
          <button
            onClick={() => deleteFrame(frame.id)}
            className="text-sm text-red-600 hover:underline"
          >
            Delete
          </button>
        </li>
      ))}
    </ul>
  )
}
