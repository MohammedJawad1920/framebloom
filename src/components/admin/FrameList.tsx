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
      {frames.map(frame => {
        const displayName = frame.storage_path.split('/').pop()?.replace(/^[-—\s]+/, '')?.replace(/\.[^.]+$/, '') ?? 'Frame'
        return (
          <li key={frame.id} className="flex items-center gap-3 rounded border p-3">
            <label className="cursor-pointer flex-shrink-0">
              <div
                className="w-8 h-8 rounded-full border-2 border-white/20 shadow-md"
                style={{ backgroundColor: frame.color_hex }}
                title="Change color"
              />
              <input
                type="color"
                className="opacity-0 absolute w-0 h-0"
                value={frame.color_hex}
                onChange={(e) => updateColor(frame.id, e.target.value)}
              />
            </label>
            <Image
              src={getPublicUrl(frame.storage_path)}
              alt={frame.label}
              width={48}
              height={48}
              className="rounded object-contain"
              crossOrigin="anonymous"
            />
            <div className="flex-1 min-w-0">
              <span className="truncate max-w-[150px] sm:max-w-xs text-sm text-gray-300 block" title={frame.storage_path}>
                {displayName}
              </span>
            </div>
            <button
              onClick={() => deleteFrame(frame.id)}
              className="text-sm text-red-600 hover:underline flex-shrink-0"
            >
              Delete
            </button>
          </li>
        )
      })}
    </ul>
  )
}
