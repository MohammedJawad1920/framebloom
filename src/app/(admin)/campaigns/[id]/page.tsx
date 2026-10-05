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
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-6">← Back to dashboard</Link>
      <CampaignNameEditor id={campaign.id} initialName={campaign.name} />
      <FrameUploader
        campaignId={campaign.id}
        frameCount={campaign.frames.length}
        aspectRatio={campaign.aspect_ratio}
      />
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold mb-4 text-gray-900">Frames</h2>
        <FrameList campaignId={campaign.id} initialFrames={campaign.frames} />
      </div>
      <a
        href={`/c/${campaign.public_token}`}
        target="_blank"
        className="bg-white hover:bg-gray-50 text-gray-700 font-medium px-5 py-3 rounded-xl border border-gray-200 shadow-sm transition-colors min-h-[44px] block text-center w-full mt-8"
      >
        Preview public page ↗
      </a>
    </main>
  )
}
