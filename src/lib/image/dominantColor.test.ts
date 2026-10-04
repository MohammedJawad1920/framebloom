import { describe, it, expect } from 'vitest'
import { pickDominantColor } from './dominantColor'

describe('pickDominantColor', () => {
  it('ignores transparent pixels and returns most common opaque color', () => {
    // 3 pixels: transparent, red, red
    const data = new Uint8ClampedArray([
      255, 0, 0, 0,    // transparent — ignored
      255, 0, 0, 255,  // red opaque
      255, 0, 0, 255,  // red opaque
    ])
    expect(pickDominantColor(data)).toBe('#f80000')
  })

  it('returns #888888 fallback when all pixels are transparent', () => {
    const data = new Uint8ClampedArray([0, 0, 0, 0])
    expect(pickDominantColor(data)).toBe('#888888')
  })
})
