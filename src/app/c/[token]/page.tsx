import { notFound } from 'next/navigation'
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
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/campaign/${token}`,
    { cache: 'no-store' }
  )
  if (!res.ok) return null
  return res.json()
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
