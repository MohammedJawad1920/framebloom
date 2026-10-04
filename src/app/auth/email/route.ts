import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function POST(req: Request) {
  if (process.env.NODE_ENV === 'production') return redirect('/login')
  const form = await req.formData()
  const supabase = createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: form.get('email') as string,
    password: form.get('password') as string,
  })
  if (error) redirect('/login?error=invalid_credentials')
  redirect('/dashboard')
}
