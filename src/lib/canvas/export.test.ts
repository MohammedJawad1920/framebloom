import { describe, it, expect } from 'vitest'
import { toDrawParams } from './transform'

describe('toDrawParams — composition math', () => {
  it('centers photo when transform is identity', () => {
    const photo = { w: 200, h: 200 }
    const canvas = { w: 100, h: 100 }
    // scale=0.5 → photo becomes 100x100, centered at (0,0)
    const params = toDrawParams({ x: 0, y: 0, scale: 0.5 }, photo, canvas)
    expect(params.dx).toBeCloseTo(0)
    expect(params.dy).toBeCloseTo(0)
    expect(params.dw).toBeCloseTo(100)
    expect(params.dh).toBeCloseTo(100)
  })

  it('shifts photo when transform has offset', () => {
    const photo = { w: 200, h: 200 }
    const canvas = { w: 100, h: 100 }
    // scale=0.5, x=0.1 → shift right by 10px
    const params = toDrawParams({ x: 0.1, y: 0, scale: 0.5 }, photo, canvas)
    expect(params.dx).toBeCloseTo(10)
  })
})
