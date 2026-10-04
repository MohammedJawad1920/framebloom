import { PHOTO_MAX_LONG_EDGE } from '@/lib/constants'

export function downscaleIfNeeded(w: number, h: number, maxLongEdge: number): { w: number; h: number } {
  const longEdge = Math.max(w, h)
  if (longEdge <= maxLongEdge) return { w, h }
  const ratio = maxLongEdge / longEdge
  return { w: Math.round(w * ratio), h: Math.round(h * ratio) }
}

/**
 * Load a photo File into an ImageBitmap, applying EXIF orientation and downscaling.
 * Lazily imports heic2any only for HEIC files.
 */
export async function loadPhoto(file: File): Promise<ImageBitmap> {
  let blob: Blob = file

  if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
    const { default: heic2any } = await import('heic2any')
    blob = (await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 })) as Blob
  }

  // createImageBitmap applies EXIF orientation automatically in modern browsers
  const rawBitmap = await createImageBitmap(blob)
  const { w, h } = downscaleIfNeeded(rawBitmap.width, rawBitmap.height, PHOTO_MAX_LONG_EDGE)

  if (w === rawBitmap.width && h === rawBitmap.height) return rawBitmap

  // Redraw at target size
  const canvas = new OffscreenCanvas(w, h)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(rawBitmap, 0, 0, w, h)
  return createImageBitmap(canvas)
}
