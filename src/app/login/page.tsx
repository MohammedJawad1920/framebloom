import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function LoginPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-bold tracking-tight">Frame Bloom</h1>
      <form action="/auth/google" method="post">
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700"
        >
          Continue with Google
        </button>
      </form>
      {process.env.NODE_ENV !== 'production' && (
        <form action="/auth/email" method="post" className="flex flex-col gap-2 w-full max-w-xs mt-4 border-t pt-4">
          <p className="text-xs text-gray-400 text-center">Dev login (not in production)</p>
          <input name="email" type="email" placeholder="Email" className="rounded border px-3 py-2" />
          <input name="password" type="password" placeholder="Password" className="rounded border px-3 py-2" />
          <button type="submit" className="rounded bg-gray-800 px-4 py-2 text-white">Sign in (dev)</button>
        </form>
      )}
    </main>
  )
}
