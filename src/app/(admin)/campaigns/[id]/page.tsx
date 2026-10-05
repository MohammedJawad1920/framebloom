import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import FrameUploader from '@/components/admin/FrameUploader'
import FrameList from '@/components/admin/FrameList'
import CampaignNameEditor from '@/components/admin/CampaignNameEditor'

export default async function CampaignPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, name, aspect_ratio, public_token, frames(*)')
    .eq('id', params.id)
    .single()

  if (!campaign) notFound()

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 space-y-8">
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors mb-6">← Back to dashboard</Link>
      <CampaignNameEditor id={campaign.id} initialName={campaign.name} />
      <FrameUploader
        campaignId={campaign.id}
        frameCount={campaign.frames.length}
        aspectRatio={campaign.aspect_ratio}
      />
      <FrameList campaignId={campaign.id} initialFrames={campaign.frames} />
      <a
        href={`/c/${campaign.public_token}`}
        target="_blank"
        className="inline-block text-blue-600 hover:underline"
      >
        Preview public page ↗
      </a>
    </main>
  )
}
