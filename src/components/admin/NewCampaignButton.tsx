'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LIMITS } from '@/lib/constants'

function generateToken() {
  const bytes = new Uint8Array(16) // 128 bits
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

export default function NewCampaignButton({
  orgId,
  campaignCount,
}: {
  orgId: string
  campaignCount: number
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const create = async () => {
    if (campaignCount >= LIMITS.CAMPAIGNS_PER_ORG) {
      alert(`You've reached the limit of ${LIMITS.CAMPAIGNS_PER_ORG} campaigns.`)
      return
    }
    setBusy(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('campaigns')
      .insert({ org_id: orgId, name: 'New campaign', public_token: generateToken() })
      .select('id')
      .single()
    setBusy(false)
    if (error || !data) return alert('Failed to create campaign.')
    router.push(`/campaigns/${data.id}`)
  }

  return (
    <button
      onClick={create}
      disabled={busy}
      className="rounded-lg bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
    >
      {busy ? 'Creating…' : 'New campaign'}
    </button>
  )
}
