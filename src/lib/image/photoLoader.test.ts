import { describe, it, expect } from 'vitest'
import { downscaleIfNeeded } from './photoLoader'
import { PHOTO_MAX_LONG_EDGE } from '@/lib/constants'

describe('downscaleIfNeeded', () => {
  it('returns original dimensions when within limit', () => {
    const result = downscaleIfNeeded(800, 600, PHOTO_MAX_LONG_EDGE)
    expect(result).toEqual({ w: 800, h: 600 })
  })

  it('scales down when long edge exceeds limit', () => {
    const result = downscaleIfNeeded(8000, 6000, PHOTO_MAX_LONG_EDGE)
    expect(result.w).toBeLessThanOrEqual(PHOTO_MAX_LONG_EDGE)
    expect(result.h).toBeLessThanOrEqual(PHOTO_MAX_LONG_EDGE)
    // Aspect ratio preserved
    expect(result.w / result.h).toBeCloseTo(8000 / 6000, 5)
  })
})
