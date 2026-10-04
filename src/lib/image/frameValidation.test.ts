import { describe, it, expect } from 'vitest'
import { hasTransparentPixels, aspectRatioMatches } from './frameValidation'
import { ASPECT_RATIO_TOLERANCE } from '@/lib/constants'

describe('hasTransparentPixels', () => {
  it('returns true when at least one alpha < 255', () => {
    // 2x1 image: first pixel transparent, second opaque
    const data = new Uint8ClampedArray([0, 0, 0, 0,   255, 0, 0, 255])
    expect(hasTransparentPixels(data)).toBe(true)
  })

  it('returns false when all pixels are opaque', () => {
    const data = new Uint8ClampedArray([255, 0, 0, 255,  0, 255, 0, 255])
    expect(hasTransparentPixels(data)).toBe(false)
  })
})

describe('aspectRatioMatches', () => {
  it('returns true for identical ratios', () => {
    expect(aspectRatioMatches(1.5, 1.5, ASPECT_RATIO_TOLERANCE)).toBe(true)
  })

  it('returns true when difference equals tolerance', () => {
    expect(aspectRatioMatches(1.5, 1.5 + ASPECT_RATIO_TOLERANCE, ASPECT_RATIO_TOLERANCE)).toBe(true)
  })

  it('returns false when difference exceeds tolerance', () => {
    expect(aspectRatioMatches(1.5, 1.5 + ASPECT_RATIO_TOLERANCE + 0.001, ASPECT_RATIO_TOLERANCE)).toBe(false)
  })
})
