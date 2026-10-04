import { describe, it, expect } from 'vitest'
import { clampTransform, applyPan, applyZoom } from './transform'

// photo 200x200, canvas 100x100 → scale must be at least 0.5 to cover canvas
const photo = { w: 200, h: 200 }
const canvas = { w: 100, h: 100 }

describe('clampTransform', () => {
  it('clamps scale to cover minimum (photo fills canvas)', () => {
    // scale 0.4 means photo becomes 80x80, smaller than 100x100 canvas
    const clamped = clampTransform({ x: 0, y: 0, scale: 0.4 }, photo, canvas)
    // min scale = max(100/200, 100/200) = 0.5
    expect(clamped.scale).toBeGreaterThanOrEqual(0.5)
  })

  it('clamps scale to MAX_ZOOM', () => {
    const clamped = clampTransform({ x: 0, y: 0, scale: 10 }, photo, canvas)
    expect(clamped.scale).toBeLessThanOrEqual(4)
  })

  it('clamps x so photo left edge stays at or left of canvas left edge', () => {
    // photo 200x200 at scale 0.5 = 100x100 = exactly covers 100x100 canvas
    // x must be 0 (photo edge == canvas edge)
    const clamped = clampTransform({ x: 50, y: 0, scale: 0.5 }, photo, canvas)
    expect(clamped.x).toBeLessThanOrEqual(0.5) // normalized: 50/100
  })
})

describe('applyPan', () => {
  it('shifts x and y by the given delta', () => {
    const result = applyPan({ x: 0.1, y: 0.1, scale: 1 }, { dx: 10, dy: -5 }, canvas)
    expect(result.x).toBeCloseTo(0.1 + 10 / canvas.w)
    expect(result.y).toBeCloseTo(0.1 - 5 / canvas.h)
  })
})

describe('applyZoom', () => {
  it('scales around the given focal point', () => {
    const before = { x: 0, y: 0, scale: 1 }
    const after = applyZoom(before, 2, { cx: 0, cy: 0 }, photo, canvas)
    expect(after.scale).toBeCloseTo(2)
  })
})
