import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function LoginPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-bold">Photo Frame SaaS</h1>
      <form action="/auth/google" method="post">
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700"
        >
          Continue with Google
        </button>
      </form>
    </main>
  )
}
