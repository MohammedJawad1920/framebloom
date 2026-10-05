import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CampaignList from '@/components/admin/CampaignList'
import NewCampaignButton from '@/components/admin/NewCampaignButton'
import LogoutButton from '@/components/admin/LogoutButton'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('owner_id', user.id)
    .single()

  if (!org) redirect('/login')

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, is_active, public_token, frames(count)')
    .eq('org_id', org.id)
    .order('created_at', { ascending: false })

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-baseline gap-4">
          <h1 className="text-2xl font-bold">{org.name}</h1>
          <LogoutButton />
        </div>
        <NewCampaignButton orgId={org.id} campaignCount={campaigns?.length ?? 0} />
      </div>
      <CampaignList campaigns={campaigns ?? []} />
    </main>
  )
}
