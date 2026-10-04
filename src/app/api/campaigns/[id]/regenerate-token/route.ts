import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

function generateToken() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const newToken = generateToken()
  const { data, error } = await supabase
    .from('campaigns')
    .update({ public_token: newToken })
    .eq('id', params.id)
    .select('public_token')
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ token: data.public_token })
}
