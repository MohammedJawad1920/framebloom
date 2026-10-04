import { MAX_ZOOM } from '@/lib/constants'

export type Transform = { x: number; y: number; scale: number }
export type Size = { w: number; h: number }
export type Point = { cx: number; cy: number }

/**
 * Minimum scale so photo covers the canvas (like CSS `object-fit: cover`).
 */
export function minScale(photo: Size, canvas: Size): number {
  return Math.max(canvas.w / photo.w, canvas.h / photo.h)
}

/**
 * Clamp transform so photo always covers the canvas and scale stays in [min, MAX_ZOOM].
 * x and y are normalized (fraction of canvas width/height; 0 = centered).
 */
export function clampTransform(t: Transform, photo: Size, canvas: Size): Transform {
  const min = minScale(photo, canvas)
  const scale = Math.max(min, Math.min(MAX_ZOOM, t.scale))

  // Rendered photo size in canvas pixels
  const pw = photo.w * scale
  const ph = photo.h * scale

  // How far the center can move from 0 (canvas center) before an edge is exposed
  const maxX = (pw - canvas.w) / 2 / canvas.w
  const maxY = (ph - canvas.h) / 2 / canvas.h

  const x = Math.max(-maxX, Math.min(maxX, t.x))
  const y = Math.max(-maxY, Math.min(maxY, t.y))

  return { x, y, scale }
}

/**
 * Apply a pan delta (in screen pixels) to the transform, then clamp.
 */
export function applyPan(
  t: Transform,
  delta: { dx: number; dy: number },
  canvas: Size
): Transform {
  return { ...t, x: t.x + delta.dx / canvas.w, y: t.y + delta.dy / canvas.h }
}

/**
 * Apply a zoom factor around a focal point (normalized canvas coords),
 * then clamp.
 */
export function applyZoom(
  t: Transform,
  factor: number,
  focal: Point,
  photo: Size,
  canvas: Size
): Transform {
  const newScale = t.scale * factor
  // Adjust x/y so the focal point stays fixed on screen
  const x = focal.cx + (t.x - focal.cx) * factor
  const y = focal.cy + (t.y - focal.cy) * factor
  return clampTransform({ x, y, scale: newScale }, photo, canvas)
}

/**
 * Convert normalized transform to canvas-pixel draw parameters for ctx.drawImage.
 */
export function toDrawParams(
  t: Transform,
  photo: Size,
  canvas: Size
): { dx: number; dy: number; dw: number; dh: number } {
  const dw = photo.w * t.scale
  const dh = photo.h * t.scale
  const dx = (canvas.w / 2) + t.x * canvas.w - dw / 2
  const dy = (canvas.h / 2) + t.y * canvas.h - dh / 2
  return { dx, dy, dw, dh }
}
