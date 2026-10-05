'use client'
import { useEffect, useRef, useState, RefObject } from 'react'
import type { Transform } from '@/lib/canvas/transform'
import { applyPan, applyZoom, clampTransform, toDrawParams } from '@/lib/canvas/transform'

type Props = {
  frame: { url: string; width: number; height: number; label: string }
  photo: ImageBitmap | null
  photoSize: { w: number; h: number } | null
  transform: Transform
  onTransformChange: (t: Transform) => void
  onPhotoRequest: () => void
  frameImgRef: RefObject<HTMLImageElement>
}

export default function CanvasEditor({
  frame, photo, photoSize, transform, onTransformChange, onPhotoRequest, frameImgRef,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [frameImg, setFrameImg] = useState<HTMLImageElement | null>(null)
  const [hint, setHint] = useState(false)
  const lastTouch = useRef<{ x: number; y: number } | null>(null)
  const lastPinch = useRef<number | null>(null)

  // Load frame image
  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = frame.url
    img.onload = () => {
      setFrameImg(img)
      if (frameImgRef) (frameImgRef as React.MutableRefObject<HTMLImageElement>).current = img
    }
  }, [frame.url, frameImgRef])

  // Show hint after photo loads
  useEffect(() => {
    if (photo) setHint(true)
  }, [photo])

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const cw = canvas.width
    const ch = canvas.height
    ctx.clearRect(0, 0, cw, ch)

    if (photo && photoSize) {
      const params = toDrawParams(transform, photoSize, { w: cw, h: ch })
      ctx.drawImage(photo, params.dx, params.dy, params.dw, params.dh)
    }
    if (frameImg) {
      ctx.drawImage(frameImg, 0, 0, cw, ch)
    }

    if (!photo) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      ctx.fillRect(0, 0, cw, ch)
      ctx.fillStyle = '#fff'
      ctx.font = `bold ${cw * 0.05}px sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText('Add your photo', cw / 2, ch / 2)
    }

    if (hint && photo) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)'
      ctx.fillRect(0, ch - 40, cw, 40)
      ctx.fillStyle = '#fff'
      ctx.font = `${cw * 0.035}px sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText('Pinch to zoom · drag to move', cw / 2, ch - 14)
    }
  }, [photo, photoSize, frameImg, transform, hint])

  const canvasSize = (el: HTMLCanvasElement | null) => ({
    w: el?.width ?? 1,
    h: el?.height ?? 1,
  })

  // Touch handlers
  const onTouchStart = (e: React.TouchEvent) => {
    setHint(false)
    if (e.touches.length === 1) {
      lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      lastPinch.current = Math.hypot(dx, dy)
      lastTouch.current = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      }
    }
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (!photoSize) return
    const canvas = canvasRef.current
    const cs = canvasSize(canvas)

    if (e.touches.length === 1 && lastTouch.current) {
      const dx = e.touches[0].clientX - lastTouch.current.x
      const dy = e.touches[0].clientY - lastTouch.current.y
      lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      onTransformChange(clampTransform(applyPan(transform, { dx, dy }, cs), photoSize, cs))
    } else if (e.touches.length === 2 && lastPinch.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.hypot(dx, dy)
      const factor = dist / lastPinch.current
      lastPinch.current = dist

      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2
      const panDx = lastTouch.current ? midX - lastTouch.current.x : 0
      const panDy = lastTouch.current ? midY - lastTouch.current.y : 0
      lastTouch.current = { x: midX, y: midY }

      const rect = canvas!.getBoundingClientRect()
      const focal = {
        cx: (midX - rect.left - rect.width / 2) / rect.width,
        cy: (midY - rect.top - rect.height / 2) / rect.height,
      }
      let t = applyPan(transform, { dx: panDx, dy: panDy }, cs)
      t = applyZoom(t, factor, focal, photoSize, cs)
      onTransformChange(t)
    }
  }

  // Mouse handlers
  const mouseDown = useRef<{ x: number; y: number } | null>(null)
  const onMouseDown = (e: React.MouseEvent) => {
    setHint(false)
    mouseDown.current = { x: e.clientX, y: e.clientY }
  }
  const onMouseMove = (e: React.MouseEvent) => {
    if (!mouseDown.current || !photoSize) return
    const cs = canvasSize(canvasRef.current)
    const dx = e.clientX - mouseDown.current.x
    const dy = e.clientY - mouseDown.current.y
    mouseDown.current = { x: e.clientX, y: e.clientY }
    onTransformChange(clampTransform(applyPan(transform, { dx, dy }, cs), photoSize, cs))
  }
  const onMouseUp = () => { mouseDown.current = null }

  const onWheel = (e: React.WheelEvent) => {
    if (!photoSize) return
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.1 : 0.9
    const canvas = canvasRef.current
    const rect = canvas!.getBoundingClientRect()
    const cs = canvasSize(canvas)
    const focal = {
      cx: (e.clientX - rect.left - rect.width / 2) / rect.width,
      cy: (e.clientY - rect.top - rect.height / 2) / rect.height,
    }
    onTransformChange(applyZoom(transform, factor, focal, photoSize, cs))
  }

  return (
    <canvas
      ref={canvasRef}
      width={frame.width}
      height={frame.height}
      className="w-full h-full cursor-grab active:cursor-grabbing shadow-sm"
      style={{ touchAction: 'none' }}
      onClick={!photo ? onPhotoRequest : undefined}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={() => { lastPinch.current = null; lastTouch.current = null }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onWheel={onWheel}
    />
  )
}
