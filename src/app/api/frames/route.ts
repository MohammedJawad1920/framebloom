import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { LIMITS } from '@/lib/constants'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await request.formData()
  const file = form.get('file') as File | null
  const campaignId = form.get('campaignId') as string | null
  const label = form.get('label') as string | null
  const colorHex = form.get('colorHex') as string | null
  const width = Number(form.get('width'))
  const height = Number(form.get('height'))
  const sortOrder = Number(form.get('sortOrder') ?? 0)

  if (!file || !campaignId || !label || !colorHex) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  // Verify the campaign belongs to this admin
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, org_id, aspect_ratio, frames(count)')
    .eq('id', campaignId)
    .single()

  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if ((campaign.frames[0]?.count ?? 0) >= LIMITS.FRAMES_PER_CAMPAIGN) {
    return NextResponse.json({ error: 'Frame limit reached' }, { status: 422 })
  }

  // Upload to Storage
  const frameId = crypto.randomUUID()
  const storagePath = `${campaign.org_id}/${campaignId}/${frameId}.png`
  const serviceClient = createServiceClient()
  const { error: uploadError } = await serviceClient.storage
    .from('frames')
    .upload(storagePath, file, { contentType: 'image/png' })

  if (uploadError) return NextResponse.json({ error: 'Upload failed' }, { status: 500 })

  // Insert frame row
  const { data: frame, error: dbError } = await supabase
    .from('frames')
    .insert({
      id: frameId,
      campaign_id: campaignId,
      label,
      color_hex: colorHex,
      storage_path: storagePath,
      width,
      height,
      sort_order: sortOrder,
    })
    .select()
    .single()

  if (dbError) return NextResponse.json({ error: 'DB error' }, { status: 500 })

  // Set aspect ratio on campaign if this is the first frame
  if (!campaign.aspect_ratio) {
    await supabase.from('campaigns').update({ aspect_ratio: width / height }).eq('id', campaignId)
  }

  return NextResponse.json(frame)
}
