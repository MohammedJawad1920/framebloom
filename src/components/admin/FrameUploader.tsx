'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LIMITS, ACCEPTED_FRAME_TYPES, ASPECT_RATIO_TOLERANCE } from '@/lib/constants'
import { hasTransparentPixels, aspectRatioMatches } from '@/lib/image/frameValidation'
import { pickDominantColor } from '@/lib/image/dominantColor'

async function getImageData(file: File): Promise<{ imageData: ImageData; width: number; height: number }> {
  const bitmap = await createImageBitmap(file)
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0)
  const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height)
  return { imageData, width: bitmap.width, height: bitmap.height }
}

export default function FrameUploader({
  campaignId,
  frameCount,
  aspectRatio,
}: {
  campaignId: string
  frameCount: number
  aspectRatio: number | null
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setError(null)

    for (const file of Array.from(files)) {
      if (!ACCEPTED_FRAME_TYPES.includes(file.type as 'image/png')) {
        setError('Only PNG files are accepted.')
        return
      }
      if (file.size > LIMITS.FRAME_MAX_BYTES) {
        setError(`File too large. Maximum is ${LIMITS.FRAME_MAX_BYTES / 1024 / 1024} MB.`)
        return
      }

      const { imageData, width, height } = await getImageData(file)

      if (!hasTransparentPixels(imageData.data)) {
        setError(`"${file.name}" has no transparent pixels. Frames must have transparent windows for the user's photo.`)
        return
      }

      const fileRatio = width / height
      if (aspectRatio !== null && !aspectRatioMatches(fileRatio, aspectRatio, ASPECT_RATIO_TOLERANCE)) {
        setError(`"${file.name}" has a different aspect ratio (${fileRatio.toFixed(3)}) than existing frames (${Number(aspectRatio).toFixed(3)}).`)
        return
      }

      const colorHex = pickDominantColor(imageData.data)
      const label = file.name.replace(/\.png$/i, '')

      setUploading(true)
      const form = new FormData()
      form.append('file', file)
      form.append('campaignId', campaignId)
      form.append('label', label)
      form.append('colorHex', colorHex)
      form.append('width', String(width))
      form.append('height', String(height))
      form.append('sortOrder', String(frameCount))

      const res = await fetch('/api/frames', { method: 'POST', body: form })
      setUploading(false)

      if (!res.ok) {
        const { error: e } = await res.json()
        setError(e ?? 'Upload failed.')
        return
      }
    }

    router.refresh()
  }

  const atLimit = frameCount >= LIMITS.FRAMES_PER_CAMPAIGN

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-lg font-semibold mb-4 text-gray-900">Upload Frames</h2>
      {atLimit ? (
        <p className="text-sm text-gray-500">Frame limit reached ({LIMITS.FRAMES_PER_CAMPAIGN}).</p>
      ) : (
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors flex flex-col items-center gap-3"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 w-8 h-8"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <span className="text-gray-600 font-medium">{uploading ? 'Uploading…' : 'Drag PNG frames here or click to select'}</span>
          <input
            ref={inputRef}
            type="file"
            accept="image/png"
            multiple
            className="hidden"
            onChange={e => handleFiles(e.target.files)}
          />
        </div>
      )}
      {error && <p className="mt-4 text-sm text-red-600 font-medium bg-red-50 p-3 rounded-lg border border-red-100">{error}</p>}
    </div>
  )
}
