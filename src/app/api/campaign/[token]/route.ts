import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Very simple in-memory rate limiter per IP (resets on cold start — good enough for Vercel Edge)
const rateMap = new Map<string, { count: number; reset: number }>()
const RATE_LIMIT = 30        // requests
const RATE_WINDOW_MS = 60_000  // per minute

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = rateMap.get(ip) ?? { count: 0, reset: now + RATE_WINDOW_MS }
  if (now > entry.reset) {
    rateMap.set(ip, { count: 1, reset: now + RATE_WINDOW_MS })
    return false
  }
  entry.count++
  rateMap.set(ip, entry)
  return entry.count > RATE_LIMIT
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { token: string } }
) {
  const ip = _request.headers.get('x-forwarded-for') ?? 'unknown'
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const supabase = createClient()
  const { data, error } = await supabase.rpc('get_campaign_by_token', { p_token: params.token })

  if (error || !data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Resolve storage paths to public URLs
  const { data: { publicUrl: baseUrl } } = supabase.storage.from('frames').getPublicUrl('')
  const campaign = {
    ...data,
    frames: (data.frames ?? []).map((f: { storage_path: string; [key: string]: unknown }) => ({
      ...f,
      url: `${baseUrl}${f.storage_path}`,
    })),
  }

  return NextResponse.json(campaign)
}
