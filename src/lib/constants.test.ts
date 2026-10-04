import { describe, it, expect } from 'vitest'
import { LIMITS } from './constants'

describe('LIMITS', () => {
  it('caps campaigns per org at 20', () => {
    expect(LIMITS.CAMPAIGNS_PER_ORG).toBe(20)
  })
  it('caps frames per campaign at 12', () => {
    expect(LIMITS.FRAMES_PER_CAMPAIGN).toBe(12)
  })
  it('caps frame file size at 5 MB', () => {
    expect(LIMITS.FRAME_MAX_BYTES).toBe(5 * 1024 * 1024)
  })
})
