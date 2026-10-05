import { createClient } from '@/lib/supabase/server'
import CampaignEditor from '@/components/public/CampaignEditor'

type Frame = {
  id: string
  label: string
  color_hex: string
  url: string
  width: number
  height: number
}

type Campaign = {
  name: string
  frames: Frame[]
}

async function getCampaign(token: string): Promise<Campaign | null> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('get_campaign_by_token', { p_token: token })

  if (error || !data) return null

  const { data: { publicUrl: baseUrl } } = supabase.storage.from('frames').getPublicUrl('')
  const campaign = {
    ...data,
    frames: (data.frames ?? []).map((f: { storage_path: string; [key: string]: unknown }) => ({
      ...f,
      url: `${baseUrl}${f.storage_path}`,
    })),
  }

  return campaign as Campaign
}

export default async function CampaignPage({ params }: { params: { token: string } }) {
  const campaign = await getCampaign(params.token)
  if (!campaign || !campaign.frames?.length) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8 text-center">
        <p className="text-lg text-gray-600">This link is no longer available.</p>
      </main>
    )
  }
  return <CampaignEditor campaign={campaign} />
}
