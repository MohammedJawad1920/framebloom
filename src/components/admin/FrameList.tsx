'use client'
import { useState, useEffect } from 'react'
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

  useEffect(() => {
    setFrames([...initialFrames].sort((a, b) => a.sort_order - b.sort_order))
  }, [initialFrames])

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
    <ul className="space-y-3">
      {frames.map(frame => {
        const displayName = frame.storage_path.split('/').pop()?.replace(/^[-—\s]+/, '')?.replace(/\.[^.]+$/, '') ?? 'Frame'
        return (
          <li key={frame.id} className="flex items-center gap-4 rounded-xl border border-gray-100 p-3 hover:bg-gray-50 transition-colors">
            <label className="cursor-pointer flex-shrink-0 relative">
              <div
                className="w-11 h-11 rounded-full border-2 border-gray-200 shadow-inner"
                style={{ backgroundColor: frame.color_hex }}
                title="Change color"
              />
              <input
                type="color"
                className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                value={frame.color_hex}
                onChange={(e) => updateColor(frame.id, e.target.value)}
              />
            </label>
            <div className="flex-shrink-0 w-12 h-12 relative bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
              <Image
                src={getPublicUrl(frame.storage_path)}
                alt={frame.label}
                fill
                className="object-contain p-1"
                crossOrigin="anonymous"
              />
            </div>
            <div className="flex-1 min-w-0">
              <span className="truncate block font-medium text-gray-700" title={frame.storage_path}>
                {displayName}
              </span>
            </div>
            <button
              onClick={() => deleteFrame(frame.id)}
              className="text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 px-3 min-h-[44px] rounded-lg transition-colors flex-shrink-0 flex items-center justify-center"
            >
              Delete
            </button>
          </li>
        )
      })}
    </ul>
  )
}
