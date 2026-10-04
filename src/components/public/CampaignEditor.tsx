'use client'
import { useState, useRef, useCallback } from 'react'
import CanvasEditor from './CanvasEditor'
import SwatchRow from './SwatchRow'
import { loadPhoto } from '@/lib/image/photoLoader'
import { exportComposition } from '@/lib/canvas/export'
import type { Transform } from '@/lib/canvas/transform'

type Frame = { id: string; label: string; color_hex: string; url: string; width: number; height: number }

export default function CampaignEditor({ campaign }: { campaign: { name: string; frames: Frame[] } }) {
  const [photo, setPhoto] = useState<ImageBitmap | null>(null)
  const [photoSize, setPhotoSize] = useState<{ w: number; h: number } | null>(null)
  const [selectedFrame, setSelectedFrame] = useState(campaign.frames[0])
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 })
  const [downloading, setDownloading] = useState(false)
  const [dlError, setDlError] = useState<string | null>(null)
  const frameImgRef = useRef<HTMLImageElement | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const pickPhoto = useCallback(async (files: FileList | null) => {
    if (!files?.[0]) return
    const bitmap = await loadPhoto(files[0])
    setPhoto(bitmap)
    setPhotoSize({ w: bitmap.width, h: bitmap.height })
    setTransform({ x: 0, y: 0, scale: 1 }) // reset position
  }, [])

  const download = async () => {
    if (!photo || !photoSize || !frameImgRef.current) return
    setDownloading(true)
    setDlError(null)
    try {
      const blob = await exportComposition(
        photo,
        photoSize,
        frameImgRef.current,
        { w: selectedFrame.width, h: selectedFrame.height },
        transform
      )
      if (!blob) throw new Error('Canvas export failed.')

      const filename = `${campaign.name.toLowerCase().replace(/\s+/g, '-')}-${selectedFrame.label.toLowerCase()}.png`
      const file = new File([blob], filename, { type: 'image/png' })

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] })
      } else {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = filename
        a.click()
      }
    } catch (e) {
      console.error('Export error:', e)
      setDlError('Download failed. If the problem persists, try a different browser.')
    }
    setDownloading(false)
  }

  const aspectRatio = selectedFrame.width / selectedFrame.height

  return (
    <main className="flex min-h-screen flex-col items-center gap-4 px-4 py-6">
      <h1 className="text-xl font-bold text-center">{campaign.name}</h1>

      <div className="w-full max-w-sm" style={{ aspectRatio }}>
        <CanvasEditor
          frame={selectedFrame}
          photo={photo}
          photoSize={photoSize}
          transform={transform}
          onTransformChange={setTransform}
          onPhotoRequest={() => photoInputRef.current?.click()}
          frameImgRef={frameImgRef}
        />
      </div>

      <SwatchRow
        frames={campaign.frames}
        selected={selectedFrame.id}
        onSelect={id => setSelectedFrame(campaign.frames.find(f => f.id === id)!)}
      />

      {photo && (
        <button
          onClick={() => photoInputRef.current?.click()}
          className="text-sm text-blue-600 hover:underline"
        >
          Change photo
        </button>
      )}

      <button
        onClick={download}
        disabled={!photo || downloading}
        className="rounded-lg bg-green-600 px-6 py-3 text-white font-semibold disabled:opacity-40"
      >
        {downloading ? 'Preparing…' : 'Download'}
      </button>

      {dlError && <p className="text-sm text-red-600">{dlError}</p>}

      <p className="text-xs text-gray-400">Your photo stays on your device.</p>

      <input
        ref={photoInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        capture="environment"
        className="hidden"
        onChange={e => pickPhoto(e.target.files)}
      />
    </main>
  )
}
