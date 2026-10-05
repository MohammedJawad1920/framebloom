'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function DeleteCampaignButton({ id }: { id: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const supabase = createClient()

  const deleteCampaign = async () => {
    if (!confirm('Are you sure you want to delete this campaign? This action cannot be undone.')) return
    
    setBusy(true)
    const { error } = await supabase.from('campaigns').delete().eq('id', id)
    
    if (error) {
      alert('Failed to delete campaign.')
      setBusy(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <button
      onClick={deleteCampaign}
      disabled={busy}
      className="text-sm font-medium text-red-600 hover:text-red-700 transition-colors disabled:opacity-50"
    >
      {busy ? 'Deleting...' : 'Delete Campaign'}
    </button>
  )
}
