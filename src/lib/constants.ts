export const LIMITS = {
  CAMPAIGNS_PER_ORG: 20,
  FRAMES_PER_CAMPAIGN: 12,
  FRAME_MAX_BYTES: 5 * 1024 * 1024, // 5 MB
} as const

export const ACCEPTED_FRAME_TYPES = ['image/png'] as const
export const ACCEPTED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'] as const

/** Largest long-edge in pixels before downscaling visitor photos. */
export const PHOTO_MAX_LONG_EDGE = 4096

/** Aspect-ratio comparison tolerance (absolute difference). */
export const ASPECT_RATIO_TOLERANCE = 0.01

/** Maximum zoom multiplier for the canvas editor. */
export const MAX_ZOOM = 4
