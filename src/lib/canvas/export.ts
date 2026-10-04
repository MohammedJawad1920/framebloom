import { toDrawParams, type Transform, type Size } from './transform'

/**
 * Render photo + frame at the frame's native resolution and return a Blob.
 * Returns null if the canvas export fails (e.g. CORS taint).
 */
export async function exportComposition(
  photo: ImageBitmap,
  photoSize: Size,
  frameImg: HTMLImageElement,
  frameSize: Size,
  transform: Transform
): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  canvas.width = frameSize.w
  canvas.height = frameSize.h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const params = toDrawParams(transform, photoSize, frameSize)
  ctx.drawImage(photo, params.dx, params.dy, params.dw, params.dh)
  ctx.drawImage(frameImg, 0, 0, frameSize.w, frameSize.h)

  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
}
