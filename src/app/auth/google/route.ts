import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function POST() {
  const supabase = createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  })
  if (error || !data.url) redirect('/login?error=oauth_failed')
  redirect(data.url)
}
