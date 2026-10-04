/**
 * Security tests for RLS and public lookup.
 * Requires two test users created in Supabase Auth (email/password).
 * Set TEST_USER_A_EMAIL, TEST_USER_A_PASSWORD, TEST_USER_B_EMAIL, TEST_USER_B_PASSWORD in .env.test.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function signedInClient(email: string, password: string) {
  const client = createClient(url, anon)
  await client.auth.signInWithPassword({ email, password })
  return client
}

describe('RLS — tenant isolation', () => {
  let clientA: ReturnType<typeof createClient>
  let clientB: ReturnType<typeof createClient>
  let orgAId: string

  beforeAll(async () => {
    clientA = await signedInClient(
      process.env.TEST_USER_A_EMAIL!,
      process.env.TEST_USER_A_PASSWORD!
    )
    clientB = await signedInClient(
      process.env.TEST_USER_B_EMAIL!,
      process.env.TEST_USER_B_PASSWORD!
    )

    const { data: orgA } = await clientA
      .from('organizations')
      .select('id')
      .single()
    orgAId = orgA!.id
  })

  it("user B cannot read user A's organization", async () => {
    const { data } = await clientB
      .from('organizations')
      .select('id')
      .eq('id', orgAId)
    expect(data).toHaveLength(0)
  })

  it("user B cannot insert a campaign into user A's org", async () => {
    const { error } = await clientB.from('campaigns').insert({
      org_id: orgAId,
      name: 'Attack',
      public_token: 'attack-token',
    })
    expect(error).not.toBeNull()
  })
})

describe('Public lookup — inactive/unknown tokens', () => {
  it('returns null for unknown token', async () => {
    const client = createClient(url, anon)
    const { data } = await client.rpc('get_campaign_by_token', { p_token: 'does-not-exist' })
    expect(data).toBeNull()
  })
})
