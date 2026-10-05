'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
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
  const [sharing, setSharing] = useState(false)
  const [dlError, setDlError] = useState<string | null>(null)
  const [canShare, setCanShare] = useState(false)
  const frameImgRef = useRef<HTMLImageElement | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (typeof navigator !== 'undefined' && !!navigator.share) {
      setCanShare(true)
    }
  }, [])

  const pickPhoto = useCallback(async (files: FileList | null) => {
    if (!files?.[0]) return
    const bitmap = await loadPhoto(files[0])
    setPhoto(bitmap)
    setPhotoSize({ w: bitmap.width, h: bitmap.height })
    setTransform({ x: 0, y: 0, scale: 1 }) // reset position
  }, [])

  const getExportedFile = async () => {
    if (!photo || !photoSize || !frameImgRef.current) return null
    const blob = await exportComposition(
      photo,
      photoSize,
      frameImgRef.current,
      { w: selectedFrame.width, h: selectedFrame.height },
      transform
    )
    if (!blob) throw new Error('Canvas export failed.')
    const filename = `${campaign.name.toLowerCase().replace(/\s+/g, '-')}-${selectedFrame.label.toLowerCase()}.png`
    return new File([blob], filename, { type: 'image/png' })
  }

  const handleDownload = async () => {
    setDownloading(true)
    setDlError(null)
    try {
      const file = await getExportedFile()
      if (!file) return
      const a = document.createElement('a')
      a.href = URL.createObjectURL(file)
      a.download = file.name
      a.click()
    } catch (e) {
      console.error('Export error:', e)
      setDlError('Download failed. If the problem persists, try a different browser.')
    }
    setDownloading(false)
  }

  const handleShare = async () => {
    setSharing(true)
    setDlError(null)
    try {
      const file = await getExportedFile()
      if (!file) return
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] })
      } else {
        throw new Error('Sharing not supported for this file')
      }
    } catch (e) {
      console.error('Share error:', e)
      setDlError('Sharing failed or is not supported on this device.')
    }
    setSharing(false)
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
          className="bg-white hover:bg-gray-50 text-gray-700 font-medium px-5 py-3 rounded-xl border border-gray-200 shadow-sm transition-colors min-h-[44px]"
        >
          Change photo
        </button>
      )}

      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
        <button
          onClick={handleDownload}
          disabled={!photo || downloading || sharing}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-3 rounded-xl transition-colors min-h-[44px] disabled:opacity-50 flex-1"
        >
          {downloading ? 'Preparing…' : 'Save Image'}
        </button>

        {canShare && (
          <button
            onClick={handleShare}
            disabled={!photo || downloading || sharing}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-3 rounded-xl transition-colors min-h-[44px] disabled:opacity-50 flex-1"
          >
            {sharing ? 'Preparing…' : 'Share'}
          </button>
        )}
      </div>

      {dlError && <p className="text-sm text-red-600 font-medium">{dlError}</p>}

      <p className="text-xs text-gray-500 mt-4">Your photo stays on your device.</p>

      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => pickPhoto(e.target.files)}
      />
    </main>
  )
}
