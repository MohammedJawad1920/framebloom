import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Ensure the org row exists (first sign-in)
      await ensureOrganization(supabase)
      return NextResponse.redirect(`${origin}/dashboard`)
    }
  }
  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}

async function ensureOrganization(supabase: ReturnType<typeof createClient>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: existing } = await supabase
    .from('organizations')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!existing) {
    const name = user.user_metadata?.full_name ?? user.email ?? 'My Organization'
    await supabase.from('organizations').insert({ name, owner_id: user.id })
  }
}
