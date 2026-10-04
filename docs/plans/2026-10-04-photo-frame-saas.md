# Photo Frame SaaS Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a free multi-tenant web app where organizations upload transparent-frame PNGs into campaigns and visitors composite their own photo behind a frame, then download the result — all without any server-side photo handling.

**Architecture:** Next.js 14 App Router on Vercel talks to Supabase for auth (Google OAuth), Postgres (with RLS), and Storage (frame PNGs). Admin routes are protected server-side; the public `/c/<token>` page calls a single Next.js route handler that invokes a security-definer Postgres function. All photo manipulation runs in the browser on a `<canvas>`.

**Tech Stack:** Next.js 14 (TypeScript, App Router), Supabase (Auth, Postgres, Storage), Tailwind CSS, Vitest (unit), Playwright (E2E), heic2any (lazy-loaded), @supabase/ssr

---

## Task 1: Scaffold the Next.js project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `.env.local.example`, `.gitignore`

**Step 1: Bootstrap the project**

```bash
npx create-next-app@14 . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-git
```

Expected output: `Success! Created photo_frame_saas at ...`

**Step 2: Install runtime dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr
```

Expected: clean install, no peer-dep warnings.

**Step 3: Install dev dependencies**

```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @playwright/test
```

**Step 4: Add Vitest config**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
```

Create `src/test/setup.ts`:

```typescript
import '@testing-library/jest-dom'
```

**Step 5: Add npm scripts to `package.json`**

Add inside `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:e2e": "playwright test"
```

**Step 6: Add Playwright config**

Create `playwright.config.ts`:

```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 12'] } },
    { name: 'Desktop Chrome', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
```

**Step 7: Create `.env.local.example`**

```
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Copy to `.env.local` and fill in real values (from Supabase project settings → API).

**Step 8: Verify the project starts**

```bash
npm run dev
```

Expected: `ready on http://localhost:3000`

**Step 9: Commit**

```bash
git init
git add .
git commit -m "chore: scaffold Next.js 14 project with Vitest and Playwright"
```

---

## Task 2: Define shared constants

**Files:**
- Create: `src/lib/constants.ts`
- Test: `src/lib/constants.test.ts`

**Context:** Every limit (campaigns, frames, file size) is defined once here. The UI and API both import from this file. Easy to change later.

**Step 1: Write the failing test**

Create `src/lib/constants.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { LIMITS } from './constants'

describe('LIMITS', () => {
  it('caps campaigns per org at 20', () => {
    expect(LIMITS.CAMPAIGNS_PER_ORG).toBe(20)
  })
  it('caps frames per campaign at 12', () => {
    expect(LIMITS.FRAMES_PER_CAMPAIGN).toBe(12)
  })
  it('caps frame file size at 5 MB', () => {
    expect(LIMITS.FRAME_MAX_BYTES).toBe(5 * 1024 * 1024)
  })
})
```

**Step 2: Run the test — expect FAIL**

```bash
npm test -- src/lib/constants.test.ts
```

Expected: `Cannot find module './constants'`

**Step 3: Implement**

Create `src/lib/constants.ts`:

```typescript
export const LIMITS = {
  CAMPAIGNS_PER_ORG: 20,
  FRAMES_PER_CAMPAIGN: 12,
  FRAME_MAX_BYTES: 5 * 1024 * 1024, // 5 MB
} as const

export const ACCEPTED_FRAME_TYPES = ['image/png'] as const
export const ACCEPTED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'] as const

/** Largest long-edge in pixels before downscaling visitor photos. */
export const PHOTO_MAX_LONG_EDGE = 4096

/** Aspect-ratio comparison tolerance (absolute difference). */
export const ASPECT_RATIO_TOLERANCE = 0.01

/** Maximum zoom multiplier for the canvas editor. */
export const MAX_ZOOM = 4
```

**Step 4: Run the test — expect PASS**

```bash
npm test -- src/lib/constants.test.ts
```

Expected: `3 tests passed`

**Step 5: Commit**

```bash
git add src/lib/constants.ts src/lib/constants.test.ts
git commit -m "feat: add shared constants for limits and tolerances"
```

---

## Task 3: Database migrations

**Files:**
- Create: `supabase/migrations/001_schema.sql`
- Create: `supabase/migrations/002_rls.sql`
- Create: `supabase/migrations/003_public_lookup.sql`

**Context:** These SQL files are run once in the Supabase SQL editor (or via Supabase CLI). They create the tables, enable RLS, add policies, and create the security-definer lookup function. RLS ensures an admin can only touch their own org's data.

**Step 1: Create the schema migration**

Create `supabase/migrations/001_schema.sql`:

```sql
-- organizations
create table organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  owner_id   uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- campaigns
create table campaigns (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  name         text not null,
  public_token text not null unique,
  is_active    boolean not null default true,
  aspect_ratio numeric,          -- set from first frame; null until first upload
  created_at   timestamptz not null default now()
);

-- frames
create table frames (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references campaigns(id) on delete cascade,
  label        text not null,
  color_hex    text not null,
  storage_path text not null,
  width        integer not null,
  height       integer not null,
  sort_order   integer not null default 0
);
```

**Step 2: Create the RLS migration**

Create `supabase/migrations/002_rls.sql`:

```sql
-- Enable RLS
alter table organizations enable row level security;
alter table campaigns    enable row level security;
alter table frames       enable row level security;

-- organizations: owner only
create policy "org owner select" on organizations for select using (owner_id = auth.uid());
create policy "org owner insert" on organizations for insert with check (owner_id = auth.uid());
create policy "org owner update" on organizations for update using (owner_id = auth.uid());
create policy "org owner delete" on organizations for delete using (owner_id = auth.uid());

-- campaigns: admin owns the parent org
create policy "campaign owner select" on campaigns for select
  using (org_id in (select id from organizations where owner_id = auth.uid()));
create policy "campaign owner insert" on campaigns for insert
  with check (org_id in (select id from organizations where owner_id = auth.uid()));
create policy "campaign owner update" on campaigns for update
  using (org_id in (select id from organizations where owner_id = auth.uid()));
create policy "campaign owner delete" on campaigns for delete
  using (org_id in (select id from organizations where owner_id = auth.uid()));

-- frames: admin owns the campaign's org
create policy "frame owner select" on frames for select
  using (campaign_id in (
    select c.id from campaigns c
    join organizations o on o.id = c.org_id
    where o.owner_id = auth.uid()
  ));
create policy "frame owner insert" on frames for insert
  with check (campaign_id in (
    select c.id from campaigns c
    join organizations o on o.id = c.org_id
    where o.owner_id = auth.uid()
  ));
create policy "frame owner update" on frames for update
  using (campaign_id in (
    select c.id from campaigns c
    join organizations o on o.id = c.org_id
    where o.owner_id = auth.uid()
  ));
create policy "frame owner delete" on frames for delete
  using (campaign_id in (
    select c.id from campaigns c
    join organizations o on o.id = c.org_id
    where o.owner_id = auth.uid()
  ));

-- Storage bucket policies (run in Supabase Storage UI or via CLI):
-- Bucket: "frames", public: true
-- Upload policy: bucket_id = 'frames' AND (storage.foldername(name))[1] = auth.uid()::text
-- Delete policy: same as upload
```

**Step 3: Create the public lookup function**

Create `supabase/migrations/003_public_lookup.sql`:

```sql
create or replace function public.get_campaign_by_token(p_token text)
returns json
language plpgsql
security definer   -- runs as the function owner, bypasses RLS for the caller
set search_path = public
as $$
declare
  v_result json;
begin
  select json_build_object(
    'name',   c.name,
    'frames', (
      select json_agg(
        json_build_object(
          'id',          f.id,
          'label',       f.label,
          'color_hex',   f.color_hex,
          'width',       f.width,
          'height',      f.height,
          'storage_path', f.storage_path
        ) order by f.sort_order
      )
      from frames f
      where f.campaign_id = c.id
    )
  )
  into v_result
  from campaigns c
  where c.public_token = p_token
    and c.is_active = true;

  -- Return null for both unknown and inactive tokens (same response, prevents probing)
  return v_result;
end;
$$;

-- Revoke direct table access from anon role; only the function is callable
revoke all on table campaigns from anon;
revoke all on table frames    from anon;
grant execute on function public.get_campaign_by_token(text) to anon;
```

**Step 4: Apply migrations**

Open the Supabase SQL editor for your project and run each file in order (001 → 002 → 003). Verify in the Table Editor that all three tables appear with RLS enabled.

**Step 5: Configure Storage**

In Supabase Storage UI:
1. Create bucket `frames`, toggle **Public** ON.
2. Add upload policy: `(storage.foldername(name))[1] = auth.uid()::text`
3. Add delete policy: same expression.
4. Under bucket settings → CORS, add:
   ```json
   [{ "origins": ["http://localhost:3000", "https://<your-vercel-domain>"], "methods": ["GET"], "maxAgeSeconds": 3600 }]
   ```

**Step 6: Commit**

```bash
git add supabase/
git commit -m "feat: add database migrations, RLS policies, and public lookup function"
```

---

## Task 4: Supabase client helpers

**Files:**
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/middleware.ts`
- Modify: `src/middleware.ts` (create if absent)

**Context:** `@supabase/ssr` provides cookie-based session management for Next.js App Router. The server helper is used in Server Components and Route Handlers; the client helper is used in Client Components. The middleware refreshes the session cookie on every request.

**Step 1: Create server helper**

Create `src/lib/supabase/server.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch { /* Server Component — ignored */ }
        },
      },
    }
  )
}

/** Service-role client — server-only, never expose to browser. */
export function createServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )
}
```

**Step 2: Create browser helper**

Create `src/lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**Step 3: Create middleware helper**

Create `src/lib/supabase/middleware.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — do not remove this line.
  await supabase.auth.getUser()

  return supabaseResponse
}
```

**Step 4: Create `src/middleware.ts`**

```typescript
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

**Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

**Step 6: Commit**

```bash
git add src/lib/supabase/ src/middleware.ts
git commit -m "feat: add Supabase server/client helpers and session middleware"
```

---

## Task 5: Google auth flow

**Files:**
- Create: `src/app/login/page.tsx`
- Create: `src/app/auth/callback/route.ts`
- Create: `src/app/(admin)/layout.tsx`

**Context:** Clicking "Continue with Google" triggers a Supabase OAuth redirect. After Google authenticates the user, Google redirects to `/auth/callback`, which exchanges the code for a session and redirects to the dashboard. The `(admin)` route group layout checks auth and redirects to `/login` if the user is not signed in.

**Step 1: Create the login page**

Create `src/app/login/page.tsx`:

```tsx
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
```

**Step 2: Create the Google OAuth route**

Create `src/app/auth/google/route.ts`:

```typescript
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
```

**Step 3: Create the callback handler**

Create `src/app/auth/callback/route.ts`:

```typescript
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
```

**Step 4: Create the admin layout (auth guard)**

Create `src/app/(admin)/layout.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return <>{children}</>
}
```

**Step 5: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

**Step 6: Manual smoke test**

```bash
npm run dev
```

Visit `http://localhost:3000/dashboard` — should redirect to `/login`. Click "Continue with Google". Should complete OAuth and land on `/dashboard` (404 is OK at this point; the org row will be created).

**Step 7: Commit**

```bash
git add src/app/
git commit -m "feat: Google OAuth login flow with auto-org creation"
```

---

## Task 6: Admin dashboard — campaign list

**Files:**
- Create: `src/app/(admin)/dashboard/page.tsx`
- Create: `src/components/admin/CampaignList.tsx`
- Create: `src/components/admin/NewCampaignButton.tsx`

**Context:** The dashboard lists every campaign belonging to the admin's organization. Each row shows: name, frame count, active toggle, copy-link button. A "New campaign" button creates an empty campaign and navigates to its edit page.

**Step 1: Write the dashboard page (Server Component)**

Create `src/app/(admin)/dashboard/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CampaignList from '@/components/admin/CampaignList'
import NewCampaignButton from '@/components/admin/NewCampaignButton'

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
        <h1 className="text-2xl font-bold">{org.name}</h1>
        <NewCampaignButton orgId={org.id} campaignCount={campaigns?.length ?? 0} />
      </div>
      <CampaignList campaigns={campaigns ?? []} />
    </main>
  )
}
```

**Step 2: Write `CampaignList` client component**

Create `src/components/admin/CampaignList.tsx`:

```tsx
'use client'
import Link from 'next/link'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Campaign = {
  id: string
  name: string
  is_active: boolean
  public_token: string
  frames: { count: number }[]
}

export default function CampaignList({ campaigns }: { campaigns: Campaign[] }) {
  const supabase = createClient()
  const [rows, setRows] = useState(campaigns)

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from('campaigns').update({ is_active: !current }).eq('id', id)
    setRows(r => r.map(c => c.id === id ? { ...c, is_active: !current } : c))
  }

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/c/${token}`)
  }

  if (rows.length === 0) {
    return <p className="text-gray-500">No campaigns yet. Create your first one!</p>
  }

  return (
    <ul className="space-y-3">
      {rows.map(c => (
        <li key={c.id} className="flex items-center gap-4 rounded-lg border p-4">
          <Link href={`/campaigns/${c.id}`} className="flex-1 font-medium hover:underline">
            {c.name}
          </Link>
          <span className="text-sm text-gray-500">{c.frames[0]?.count ?? 0} frames</span>
          <button
            onClick={() => toggleActive(c.id, c.is_active)}
            className={`rounded px-3 py-1 text-sm ${c.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}
          >
            {c.is_active ? 'Active' : 'Inactive'}
          </button>
          <button
            onClick={() => copyLink(c.public_token)}
            className="rounded px-3 py-1 text-sm bg-blue-50 text-blue-700 hover:bg-blue-100"
          >
            Copy link
          </button>
        </li>
      ))}
    </ul>
  )
}
```

**Step 3: Write `NewCampaignButton`**

Create `src/components/admin/NewCampaignButton.tsx`:

```tsx
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
```

**Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/app/(admin)/dashboard/ src/components/admin/
git commit -m "feat: admin dashboard with campaign list, toggle, and new campaign"
```

---

## Task 7: Frame image utilities (pure functions — unit tested)

**Files:**
- Create: `src/lib/image/frameValidation.ts`
- Create: `src/lib/image/dominantColor.ts`
- Test: `src/lib/image/frameValidation.test.ts`
- Test: `src/lib/image/dominantColor.test.ts`

**Context:** These pure functions run in the browser before upload. They must be fast and have no side effects, so they're easy to unit test with mock canvas/image data.

**Step 1: Write failing tests for `frameValidation`**

Create `src/lib/image/frameValidation.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { hasTransparentPixels, aspectRatioMatches } from './frameValidation'
import { ASPECT_RATIO_TOLERANCE } from '@/lib/constants'

describe('hasTransparentPixels', () => {
  it('returns true when at least one alpha < 255', () => {
    // 2x1 image: first pixel transparent, second opaque
    const data = new Uint8ClampedArray([0, 0, 0, 0,   255, 0, 0, 255])
    expect(hasTransparentPixels(data)).toBe(true)
  })

  it('returns false when all pixels are opaque', () => {
    const data = new Uint8ClampedArray([255, 0, 0, 255,  0, 255, 0, 255])
    expect(hasTransparentPixels(data)).toBe(false)
  })
})

describe('aspectRatioMatches', () => {
  it('returns true for identical ratios', () => {
    expect(aspectRatioMatches(1.5, 1.5, ASPECT_RATIO_TOLERANCE)).toBe(true)
  })

  it('returns true when difference equals tolerance', () => {
    expect(aspectRatioMatches(1.5, 1.5 + ASPECT_RATIO_TOLERANCE, ASPECT_RATIO_TOLERANCE)).toBe(true)
  })

  it('returns false when difference exceeds tolerance', () => {
    expect(aspectRatioMatches(1.5, 1.5 + ASPECT_RATIO_TOLERANCE + 0.001, ASPECT_RATIO_TOLERANCE)).toBe(false)
  })
})
```

**Step 2: Run — expect FAIL**

```bash
npm test -- src/lib/image/frameValidation.test.ts
```

Expected: `Cannot find module`

**Step 3: Implement `frameValidation.ts`**

Create `src/lib/image/frameValidation.ts`:

```typescript
/**
 * Returns true if the pixel data contains at least one pixel with alpha < 255.
 * @param data Raw RGBA pixel data from ImageData.data
 */
export function hasTransparentPixels(data: Uint8ClampedArray): boolean {
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) return true
  }
  return false
}

/**
 * Returns true if |a - b| <= tolerance.
 */
export function aspectRatioMatches(a: number, b: number, tolerance: number): boolean {
  return Math.abs(a - b) <= tolerance
}
```

**Step 4: Run — expect PASS**

```bash
npm test -- src/lib/image/frameValidation.test.ts
```

**Step 5: Write failing test for `dominantColor`**

Create `src/lib/image/dominantColor.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { pickDominantColor } from './dominantColor'

describe('pickDominantColor', () => {
  it('ignores transparent pixels and returns most common opaque color', () => {
    // 3 pixels: transparent, red, red
    const data = new Uint8ClampedArray([
      255, 0, 0, 0,    // transparent — ignored
      255, 0, 0, 255,  // red opaque
      255, 0, 0, 255,  // red opaque
    ])
    expect(pickDominantColor(data)).toBe('#ff0000')
  })

  it('returns #888888 fallback when all pixels are transparent', () => {
    const data = new Uint8ClampedArray([0, 0, 0, 0])
    expect(pickDominantColor(data)).toBe('#888888')
  })
})
```

**Step 6: Run — expect FAIL**

```bash
npm test -- src/lib/image/dominantColor.test.ts
```

**Step 7: Implement `dominantColor.ts`**

Create `src/lib/image/dominantColor.ts`:

```typescript
/**
 * Returns the most common opaque color as a hex string.
 * Uses a fast 3-bit-per-channel quantisation bucket to find the dominant hue.
 */
export function pickDominantColor(data: Uint8ClampedArray): string {
  const counts = new Map<string, number>()

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3]
    if (alpha < 128) continue // skip transparent/semi-transparent

    // Quantise to 32-step buckets (& 0xf8) so near-identical shades cluster
    const r = (data[i]     & 0xf8).toString(16).padStart(2, '0')
    const g = (data[i + 1] & 0xf8).toString(16).padStart(2, '0')
    const b = (data[i + 2] & 0xf8).toString(16).padStart(2, '0')
    const key = `#${r}${g}${b}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  if (counts.size === 0) return '#888888'

  return [...counts.entries()].reduce((a, b) => (b[1] > a[1] ? b : a))[0]
}
```

**Step 8: Run — expect PASS**

```bash
npm test -- src/lib/image/dominantColor.test.ts
```

**Step 9: Commit**

```bash
git add src/lib/image/
git commit -m "feat: frame validation (transparency, aspect ratio) and dominant color picker"
```

---

## Task 8: Campaign edit page — frame uploader

**Files:**
- Create: `src/app/(admin)/campaigns/[id]/page.tsx`
- Create: `src/components/admin/FrameUploader.tsx`
- Create: `src/components/admin/FrameList.tsx`
- Create: `src/components/admin/CampaignNameEditor.tsx`
- Create: `src/app/api/frames/route.ts`

**Context:** The campaign edit page shows the campaign name (editable), a drag-and-drop uploader, and the existing frames in sort order. Frame upload is validated client-side (PNG, size, transparency, aspect ratio), then POSTed to the API route which uploads to Supabase Storage and inserts a `frames` row. The aspect ratio is set on the campaign when the first frame is uploaded.

**Step 1: Create the campaign page (Server Component)**

Create `src/app/(admin)/campaigns/[id]/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import FrameUploader from '@/components/admin/FrameUploader'
import FrameList from '@/components/admin/FrameList'
import CampaignNameEditor from '@/components/admin/CampaignNameEditor'

export default async function CampaignPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, name, aspect_ratio, public_token, frames(*)')
    .eq('id', params.id)
    .single()

  if (!campaign) notFound()

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 space-y-8">
      <CampaignNameEditor id={campaign.id} initialName={campaign.name} />
      <FrameUploader
        campaignId={campaign.id}
        frameCount={campaign.frames.length}
        aspectRatio={campaign.aspect_ratio}
      />
      <FrameList campaignId={campaign.id} initialFrames={campaign.frames} />
      <a
        href={`/c/${campaign.public_token}`}
        target="_blank"
        className="inline-block text-blue-600 hover:underline"
      >
        Preview public page ↗
      </a>
    </main>
  )
}
```

**Step 2: Create the API route for frame upload**

Create `src/app/api/frames/route.ts`:

```typescript
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { LIMITS } from '@/lib/constants'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await request.formData()
  const file = form.get('file') as File | null
  const campaignId = form.get('campaignId') as string | null
  const label = form.get('label') as string | null
  const colorHex = form.get('colorHex') as string | null
  const width = Number(form.get('width'))
  const height = Number(form.get('height'))
  const sortOrder = Number(form.get('sortOrder') ?? 0)

  if (!file || !campaignId || !label || !colorHex) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  // Verify the campaign belongs to this admin
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, org_id, aspect_ratio, frames(count)')
    .eq('id', campaignId)
    .single()

  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if ((campaign.frames[0]?.count ?? 0) >= LIMITS.FRAMES_PER_CAMPAIGN) {
    return NextResponse.json({ error: 'Frame limit reached' }, { status: 422 })
  }

  // Upload to Storage
  const frameId = crypto.randomUUID()
  const storagePath = `${campaign.org_id}/${campaignId}/${frameId}.png`
  const serviceClient = createServiceClient()
  const { error: uploadError } = await serviceClient.storage
    .from('frames')
    .upload(storagePath, file, { contentType: 'image/png' })

  if (uploadError) return NextResponse.json({ error: 'Upload failed' }, { status: 500 })

  // Insert frame row
  const { data: frame, error: dbError } = await supabase
    .from('frames')
    .insert({
      id: frameId,
      campaign_id: campaignId,
      label,
      color_hex: colorHex,
      storage_path: storagePath,
      width,
      height,
      sort_order: sortOrder,
    })
    .select()
    .single()

  if (dbError) return NextResponse.json({ error: 'DB error' }, { status: 500 })

  // Set aspect ratio on campaign if this is the first frame
  if (!campaign.aspect_ratio) {
    await supabase.from('campaigns').update({ aspect_ratio: width / height }).eq('id', campaignId)
  }

  return NextResponse.json(frame)
}
```

**Step 3: Create `FrameUploader` client component**

Create `src/components/admin/FrameUploader.tsx`:

```tsx
'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LIMITS, ACCEPTED_FRAME_TYPES, ASPECT_RATIO_TOLERANCE } from '@/lib/constants'
import { hasTransparentPixels, aspectRatioMatches } from '@/lib/image/frameValidation'
import { pickDominantColor } from '@/lib/image/dominantColor'

async function getImageData(file: File): Promise<{ imageData: ImageData; width: number; height: number }> {
  const bitmap = await createImageBitmap(file)
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0)
  const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height)
  return { imageData, width: bitmap.width, height: bitmap.height }
}

export default function FrameUploader({
  campaignId,
  frameCount,
  aspectRatio,
}: {
  campaignId: string
  frameCount: number
  aspectRatio: number | null
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setError(null)

    for (const file of Array.from(files)) {
      if (!ACCEPTED_FRAME_TYPES.includes(file.type as 'image/png')) {
        setError('Only PNG files are accepted.')
        return
      }
      if (file.size > LIMITS.FRAME_MAX_BYTES) {
        setError(`File too large. Maximum is ${LIMITS.FRAME_MAX_BYTES / 1024 / 1024} MB.`)
        return
      }

      const { imageData, width, height } = await getImageData(file)

      if (!hasTransparentPixels(imageData.data)) {
        setError(`"${file.name}" has no transparent pixels. Frames must have transparent windows for the user's photo.`)
        return
      }

      const fileRatio = width / height
      if (aspectRatio !== null && !aspectRatioMatches(fileRatio, aspectRatio, ASPECT_RATIO_TOLERANCE)) {
        setError(`"${file.name}" has a different aspect ratio (${fileRatio.toFixed(3)}) than existing frames (${Number(aspectRatio).toFixed(3)}).`)
        return
      }

      const colorHex = pickDominantColor(imageData.data)
      const label = file.name.replace(/\.png$/i, '')

      setUploading(true)
      const form = new FormData()
      form.append('file', file)
      form.append('campaignId', campaignId)
      form.append('label', label)
      form.append('colorHex', colorHex)
      form.append('width', String(width))
      form.append('height', String(height))
      form.append('sortOrder', String(frameCount))

      const res = await fetch('/api/frames', { method: 'POST', body: form })
      setUploading(false)

      if (!res.ok) {
        const { error: e } = await res.json()
        setError(e ?? 'Upload failed.')
        return
      }
    }

    router.refresh()
  }

  const atLimit = frameCount >= LIMITS.FRAMES_PER_CAMPAIGN

  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Frames</h2>
      {atLimit ? (
        <p className="text-sm text-gray-500">Frame limit reached ({LIMITS.FRAMES_PER_CAMPAIGN}).</p>
      ) : (
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400"
        >
          {uploading ? 'Uploading…' : 'Drag PNG frames here or click to select'}
          <input
            ref={inputRef}
            type="file"
            accept="image/png"
            multiple
            className="hidden"
            onChange={e => handleFiles(e.target.files)}
          />
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}
```

**Step 4: Create `FrameList` client component**

Create `src/components/admin/FrameList.tsx`:

```tsx
'use client'
import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Frame = {
  id: string
  label: string
  color_hex: string
  storage_path: string
  sort_order: number
}

export default function FrameList({
  campaignId,
  initialFrames,
}: {
  campaignId: string
  initialFrames: Frame[]
}) {
  const [frames, setFrames] = useState([...initialFrames].sort((a, b) => a.sort_order - b.sort_order))
  const router = useRouter()
  const supabase = createClient()

  const deleteFrame = async (id: string) => {
    if (!confirm('Delete this frame?')) return
    await supabase.from('frames').delete().eq('id', id)
    setFrames(f => f.filter(fr => fr.id !== id))
    router.refresh()
  }

  const getPublicUrl = (path: string) =>
    supabase.storage.from('frames').getPublicUrl(path).data.publicUrl

  return (
    <ul className="space-y-2">
      {frames.map(frame => (
        <li key={frame.id} className="flex items-center gap-3 rounded border p-3">
          <div
            className="h-6 w-6 rounded-full border"
            style={{ backgroundColor: frame.color_hex }}
          />
          <Image
            src={getPublicUrl(frame.storage_path)}
            alt={frame.label}
            width={48}
            height={48}
            className="rounded object-contain"
            crossOrigin="anonymous"
          />
          <span className="flex-1 text-sm font-medium">{frame.label}</span>
          <button
            onClick={() => deleteFrame(frame.id)}
            className="text-sm text-red-600 hover:underline"
          >
            Delete
          </button>
        </li>
      ))}
    </ul>
  )
}
```

**Step 5: Create `CampaignNameEditor`**

Create `src/components/admin/CampaignNameEditor.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function CampaignNameEditor({ id, initialName }: { id: string; initialName: string }) {
  const [name, setName] = useState(initialName)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const save = async () => {
    if (!name.trim()) return
    setSaving(true)
    await supabase.from('campaigns').update({ name }).eq('id', id)
    setSaving(false)
  }

  return (
    <div className="flex gap-2">
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        onBlur={save}
        className="flex-1 rounded border px-3 py-2 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      {saving && <span className="self-center text-sm text-gray-400">Saving…</span>}
    </div>
  )
}
```

**Step 6: Verify TypeScript**

```bash
npx tsc --noEmit
```

**Step 7: Commit**

```bash
git add src/app/(admin)/campaigns/ src/components/admin/ src/app/api/frames/
git commit -m "feat: campaign edit page with frame upload, validation, and delete"
```

---

## Task 9: Canvas/gesture engine (pure math — unit tested)

**Files:**
- Create: `src/lib/canvas/transform.ts`
- Test: `src/lib/canvas/transform.test.ts`

**Context:** The canvas state is just `{ x, y, scale }` stored as normalized fractions of the canvas width/height. All gesture math is pure functions with no side effects, making them easy to test. The same normalized state drives both the on-screen preview and the full-resolution export.

**Step 1: Write failing tests**

Create `src/lib/canvas/transform.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { clampTransform, applyPan, applyZoom } from './transform'

// photo 200x200, canvas 100x100 → scale must be at least 0.5 to cover canvas
const photo = { w: 200, h: 200 }
const canvas = { w: 100, h: 100 }

describe('clampTransform', () => {
  it('clamps scale to cover minimum (photo fills canvas)', () => {
    // scale 0.4 means photo becomes 80x80, smaller than 100x100 canvas
    const clamped = clampTransform({ x: 0, y: 0, scale: 0.4 }, photo, canvas)
    // min scale = max(100/200, 100/200) = 0.5
    expect(clamped.scale).toBeGreaterThanOrEqual(0.5)
  })

  it('clamps scale to MAX_ZOOM', () => {
    const clamped = clampTransform({ x: 0, y: 0, scale: 10 }, photo, canvas)
    expect(clamped.scale).toBeLessThanOrEqual(4)
  })

  it('clamps x so photo left edge stays at or left of canvas left edge', () => {
    // photo 200x200 at scale 0.5 = 100x100 = exactly covers 100x100 canvas
    // x must be 0 (photo edge == canvas edge)
    const clamped = clampTransform({ x: 50, y: 0, scale: 0.5 }, photo, canvas)
    expect(clamped.x).toBeLessThanOrEqual(0.5) // normalized: 50/100
  })
})

describe('applyPan', () => {
  it('shifts x and y by the given delta', () => {
    const result = applyPan({ x: 0.1, y: 0.1, scale: 1 }, { dx: 10, dy: -5 }, canvas)
    expect(result.x).toBeCloseTo(0.1 + 10 / canvas.w)
    expect(result.y).toBeCloseTo(0.1 - 5 / canvas.h)
  })
})

describe('applyZoom', () => {
  it('scales around the given focal point', () => {
    const before = { x: 0, y: 0, scale: 1 }
    const after = applyZoom(before, 2, { cx: 0, cy: 0 }, photo, canvas)
    expect(after.scale).toBeCloseTo(2)
  })
})
```

**Step 2: Run — expect FAIL**

```bash
npm test -- src/lib/canvas/transform.test.ts
```

**Step 3: Implement**

Create `src/lib/canvas/transform.ts`:

```typescript
import { MAX_ZOOM } from '@/lib/constants'

export type Transform = { x: number; y: number; scale: number }
export type Size = { w: number; h: number }
export type Point = { cx: number; cy: number }

/**
 * Minimum scale so photo covers the canvas (like CSS `object-fit: cover`).
 */
export function minScale(photo: Size, canvas: Size): number {
  return Math.max(canvas.w / photo.w, canvas.h / photo.h)
}

/**
 * Clamp transform so photo always covers the canvas and scale stays in [min, MAX_ZOOM].
 * x and y are normalized (fraction of canvas width/height; 0 = centered).
 */
export function clampTransform(t: Transform, photo: Size, canvas: Size): Transform {
  const min = minScale(photo, canvas)
  const scale = Math.max(min, Math.min(MAX_ZOOM, t.scale))

  // Rendered photo size in canvas pixels
  const pw = photo.w * scale
  const ph = photo.h * scale

  // How far the center can move from 0 (canvas center) before an edge is exposed
  const maxX = (pw - canvas.w) / 2 / canvas.w
  const maxY = (ph - canvas.h) / 2 / canvas.h

  const x = Math.max(-maxX, Math.min(maxX, t.x))
  const y = Math.max(-maxY, Math.min(maxY, t.y))

  return { x, y, scale }
}

/**
 * Apply a pan delta (in screen pixels) to the transform, then clamp.
 */
export function applyPan(
  t: Transform,
  delta: { dx: number; dy: number },
  canvas: Size
): Transform {
  return { ...t, x: t.x + delta.dx / canvas.w, y: t.y + delta.dy / canvas.h }
}

/**
 * Apply a zoom factor around a focal point (normalized canvas coords),
 * then clamp.
 */
export function applyZoom(
  t: Transform,
  factor: number,
  focal: Point,
  photo: Size,
  canvas: Size
): Transform {
  const newScale = t.scale * factor
  // Adjust x/y so the focal point stays fixed on screen
  const x = focal.cx + (t.x - focal.cx) * factor
  const y = focal.cy + (t.y - focal.cy) * factor
  return clampTransform({ x, y, scale: newScale }, photo, canvas)
}

/**
 * Convert normalized transform to canvas-pixel draw parameters for ctx.drawImage.
 */
export function toDrawParams(
  t: Transform,
  photo: Size,
  canvas: Size
): { dx: number; dy: number; dw: number; dh: number } {
  const dw = photo.w * t.scale
  const dh = photo.h * t.scale
  const dx = (canvas.w / 2) + t.x * canvas.w - dw / 2
  const dy = (canvas.h / 2) + t.y * canvas.h - dh / 2
  return { dx, dy, dw, dh }
}
```

**Step 4: Run — expect PASS**

```bash
npm test -- src/lib/canvas/transform.test.ts
```

**Step 5: Commit**

```bash
git add src/lib/canvas/
git commit -m "feat: canvas transform math (pan, zoom, clamp) with unit tests"
```

---

## Task 10: Photo loading utilities

**Files:**
- Create: `src/lib/image/photoLoader.ts`
- Test: `src/lib/image/photoLoader.test.ts`

**Context:** This module handles HEIC→PNG conversion (lazy-loading the decoder only when needed), EXIF orientation correction, and downscaling large images. All logic is pure/async and testable in isolation.

**Step 1: Write failing test**

Create `src/lib/image/photoLoader.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { downscaleIfNeeded } from './photoLoader'
import { PHOTO_MAX_LONG_EDGE } from '@/lib/constants'

describe('downscaleIfNeeded', () => {
  it('returns original dimensions when within limit', () => {
    const result = downscaleIfNeeded(800, 600, PHOTO_MAX_LONG_EDGE)
    expect(result).toEqual({ w: 800, h: 600 })
  })

  it('scales down when long edge exceeds limit', () => {
    const result = downscaleIfNeeded(8000, 6000, PHOTO_MAX_LONG_EDGE)
    expect(result.w).toBeLessThanOrEqual(PHOTO_MAX_LONG_EDGE)
    expect(result.h).toBeLessThanOrEqual(PHOTO_MAX_LONG_EDGE)
    // Aspect ratio preserved
    expect(result.w / result.h).toBeCloseTo(8000 / 6000, 5)
  })
})
```

**Step 2: Run — expect FAIL**

```bash
npm test -- src/lib/image/photoLoader.test.ts
```

**Step 3: Implement**

Create `src/lib/image/photoLoader.ts`:

```typescript
import { PHOTO_MAX_LONG_EDGE } from '@/lib/constants'

export function downscaleIfNeeded(w: number, h: number, maxLongEdge: number): { w: number; h: number } {
  const longEdge = Math.max(w, h)
  if (longEdge <= maxLongEdge) return { w, h }
  const ratio = maxLongEdge / longEdge
  return { w: Math.round(w * ratio), h: Math.round(h * ratio) }
}

/**
 * Load a photo File into an ImageBitmap, applying EXIF orientation and downscaling.
 * Lazily imports heic2any only for HEIC files.
 */
export async function loadPhoto(file: File): Promise<ImageBitmap> {
  let blob: Blob = file

  if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
    const { default: heic2any } = await import('heic2any')
    blob = (await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 })) as Blob
  }

  // createImageBitmap applies EXIF orientation automatically in modern browsers
  const rawBitmap = await createImageBitmap(blob)
  const { w, h } = downscaleIfNeeded(rawBitmap.width, rawBitmap.height, PHOTO_MAX_LONG_EDGE)

  if (w === rawBitmap.width && h === rawBitmap.height) return rawBitmap

  // Redraw at target size
  const canvas = new OffscreenCanvas(w, h)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(rawBitmap, 0, 0, w, h)
  return createImageBitmap(canvas)
}
```

**Step 4: Install heic2any**

```bash
npm install heic2any
npm install -D @types/heic2any
```

**Step 5: Run — expect PASS**

```bash
npm test -- src/lib/image/photoLoader.test.ts
```

**Step 6: Commit**

```bash
git add src/lib/image/photoLoader.ts src/lib/image/photoLoader.test.ts
git commit -m "feat: photo loader with HEIC support, EXIF correction, and downscaling"
```

---

## Task 11: Public campaign page — data fetching

**Files:**
- Create: `src/app/api/campaign/[token]/route.ts`

**Context:** The public lookup route calls the `get_campaign_by_token` Postgres function through the Supabase service client. It adds rate limiting and wraps the result to include public CDN URLs. The function returns null for inactive/unknown tokens — the route returns 404 in that case.

**Step 1: Create the API route**

Create `src/app/api/campaign/[token]/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Very simple in-memory rate limiter per IP (resets on cold start — good enough for Vercel Edge)
const rateMap = new Map<string, { count: number; reset: number }>()
const RATE_LIMIT = 30        // requests
const RATE_WINDOW_MS = 60_000  // per minute

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = rateMap.get(ip) ?? { count: 0, reset: now + RATE_WINDOW_MS }
  if (now > entry.reset) {
    rateMap.set(ip, { count: 1, reset: now + RATE_WINDOW_MS })
    return false
  }
  entry.count++
  rateMap.set(ip, entry)
  return entry.count > RATE_LIMIT
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { token: string } }
) {
  const ip = _request.headers.get('x-forwarded-for') ?? 'unknown'
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const supabase = createClient()
  const { data, error } = await supabase.rpc('get_campaign_by_token', { p_token: params.token })

  if (error || !data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Resolve storage paths to public URLs
  const { data: { publicUrl: baseUrl } } = supabase.storage.from('frames').getPublicUrl('')
  const campaign = {
    ...data,
    frames: (data.frames ?? []).map((f: { storage_path: string; [key: string]: unknown }) => ({
      ...f,
      url: `${baseUrl}${f.storage_path}`,
    })),
  }

  return NextResponse.json(campaign)
}
```

**Step 2: Commit**

```bash
git add src/app/api/campaign/
git commit -m "feat: public campaign lookup route with rate limiting"
```

---

## Task 12: Public campaign page — UI

**Files:**
- Create: `src/app/c/[token]/page.tsx`
- Create: `src/components/public/CampaignEditor.tsx`
- Create: `src/components/public/CanvasEditor.tsx`
- Create: `src/components/public/SwatchRow.tsx`
- Create: `src/lib/canvas/export.ts`
- Test: `src/lib/canvas/export.test.ts`

**Context:** The public page fetches campaign data server-side, then renders the `CampaignEditor` client component. The canvas composites the user's photo (behind) and frame overlay (in front) using the transform state. All gesture handling, download, and photo picking happen on the client.

**Step 1: Create the page (Server Component)**

Create `src/app/c/[token]/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import CampaignEditor from '@/components/public/CampaignEditor'

type Frame = {
  id: string
  label: string
  color_hex: string
  url: string
  width: number
  height: number
}

type Campaign = {
  name: string
  frames: Frame[]
}

async function getCampaign(token: string): Promise<Campaign | null> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/campaign/${token}`,
    { cache: 'no-store' }
  )
  if (!res.ok) return null
  return res.json()
}

export default async function CampaignPage({ params }: { params: { token: string } }) {
  const campaign = await getCampaign(params.token)
  if (!campaign || !campaign.frames?.length) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8 text-center">
        <p className="text-lg text-gray-600">This link is no longer available.</p>
      </main>
    )
  }
  return <CampaignEditor campaign={campaign} />
}
```

**Step 2: Create `export.ts` and its test**

Create `src/lib/canvas/export.ts`:

```typescript
import { toDrawParams, type Transform, type Size } from './transform'

/**
 * Render photo + frame at the frame's native resolution and return a Blob.
 * Returns null if the canvas export fails (e.g. CORS taint).
 */
export async function exportComposition(
  photo: ImageBitmap,
  photoSize: Size,
  frameImg: HTMLImageElement,
  frameSize: Size,
  transform: Transform
): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  canvas.width = frameSize.w
  canvas.height = frameSize.h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const params = toDrawParams(transform, photoSize, frameSize)
  ctx.drawImage(photo, params.dx, params.dy, params.dw, params.dh)
  ctx.drawImage(frameImg, 0, 0, frameSize.w, frameSize.h)

  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
}
```

Create `src/lib/canvas/export.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { toDrawParams } from './transform'

describe('toDrawParams — composition math', () => {
  it('centers photo when transform is identity', () => {
    const photo = { w: 200, h: 200 }
    const canvas = { w: 100, h: 100 }
    // scale=0.5 → photo becomes 100x100, centered at (0,0)
    const params = toDrawParams({ x: 0, y: 0, scale: 0.5 }, photo, canvas)
    expect(params.dx).toBeCloseTo(0)
    expect(params.dy).toBeCloseTo(0)
    expect(params.dw).toBeCloseTo(100)
    expect(params.dh).toBeCloseTo(100)
  })

  it('shifts photo when transform has offset', () => {
    const photo = { w: 200, h: 200 }
    const canvas = { w: 100, h: 100 }
    // scale=0.5, x=0.1 → shift right by 10px
    const params = toDrawParams({ x: 0.1, y: 0, scale: 0.5 }, photo, canvas)
    expect(params.dx).toBeCloseTo(10)
  })
})
```

**Step 3: Run — expect PASS (function already implemented in Task 9)**

```bash
npm test -- src/lib/canvas/export.test.ts
```

**Step 4: Create `CampaignEditor` client component**

Create `src/components/public/CampaignEditor.tsx`:

```tsx
'use client'
import { useState, useRef, useCallback } from 'react'
import CanvasEditor from './CanvasEditor'
import SwatchRow from './SwatchRow'
import { loadPhoto } from '@/lib/image/photoLoader'
import { exportComposition } from '@/lib/canvas/export'
import type { Transform } from '@/lib/canvas/transform'

type Frame = { id: string; label: string; color_hex: string; url: string; width: number; height: number }

export default function CampaignEditor({ campaign }: { campaign: { name: string; frames: Frame[] } }) {
  const [photo, setPhoto] = useState<ImageBitmap | null>(null)
  const [photoSize, setPhotoSize] = useState<{ w: number; h: number } | null>(null)
  const [selectedFrame, setSelectedFrame] = useState(campaign.frames[0])
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 })
  const [downloading, setDownloading] = useState(false)
  const [dlError, setDlError] = useState<string | null>(null)
  const frameImgRef = useRef<HTMLImageElement | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const pickPhoto = useCallback(async (files: FileList | null) => {
    if (!files?.[0]) return
    const bitmap = await loadPhoto(files[0])
    setPhoto(bitmap)
    setPhotoSize({ w: bitmap.width, h: bitmap.height })
    setTransform({ x: 0, y: 0, scale: 1 }) // reset position
  }, [])

  const download = async () => {
    if (!photo || !photoSize || !frameImgRef.current) return
    setDownloading(true)
    setDlError(null)
    try {
      const blob = await exportComposition(
        photo,
        photoSize,
        frameImgRef.current,
        { w: selectedFrame.width, h: selectedFrame.height },
        transform
      )
      if (!blob) throw new Error('Canvas export failed.')

      const filename = `${campaign.name.toLowerCase().replace(/\s+/g, '-')}-${selectedFrame.label.toLowerCase()}.png`
      const file = new File([blob], filename, { type: 'image/png' })

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] })
      } else {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = filename
        a.click()
      }
    } catch (e) {
      console.error('Export error:', e)
      setDlError('Download failed. If the problem persists, try a different browser.')
    }
    setDownloading(false)
  }

  const aspectRatio = selectedFrame.width / selectedFrame.height

  return (
    <main className="flex min-h-screen flex-col items-center gap-4 px-4 py-6">
      <h1 className="text-xl font-bold text-center">{campaign.name}</h1>

      <div className="w-full max-w-sm" style={{ aspectRatio }}>
        <CanvasEditor
          frame={selectedFrame}
          photo={photo}
          photoSize={photoSize}
          transform={transform}
          onTransformChange={setTransform}
          onPhotoRequest={() => photoInputRef.current?.click()}
          frameImgRef={frameImgRef}
        />
      </div>

      <SwatchRow
        frames={campaign.frames}
        selected={selectedFrame.id}
        onSelect={id => setSelectedFrame(campaign.frames.find(f => f.id === id)!)}
      />

      {photo && (
        <button
          onClick={() => photoInputRef.current?.click()}
          className="text-sm text-blue-600 hover:underline"
        >
          Change photo
        </button>
      )}

      <button
        onClick={download}
        disabled={!photo || downloading}
        className="rounded-lg bg-green-600 px-6 py-3 text-white font-semibold disabled:opacity-40"
      >
        {downloading ? 'Preparing…' : 'Download'}
      </button>

      {dlError && <p className="text-sm text-red-600">{dlError}</p>}

      <p className="text-xs text-gray-400">Your photo stays on your device.</p>

      <input
        ref={photoInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        capture="environment"
        className="hidden"
        onChange={e => pickPhoto(e.target.files)}
      />
    </main>
  )
}
```

**Step 5: Create `CanvasEditor`**

Create `src/components/public/CanvasEditor.tsx`:

```tsx
'use client'
import { useEffect, useRef, useState, RefObject } from 'react'
import type { Transform } from '@/lib/canvas/transform'
import { applyPan, applyZoom, clampTransform, toDrawParams } from '@/lib/canvas/transform'

type Props = {
  frame: { url: string; width: number; height: number; label: string }
  photo: ImageBitmap | null
  photoSize: { w: number; h: number } | null
  transform: Transform
  onTransformChange: (t: Transform) => void
  onPhotoRequest: () => void
  frameImgRef: RefObject<HTMLImageElement>
}

export default function CanvasEditor({
  frame, photo, photoSize, transform, onTransformChange, onPhotoRequest, frameImgRef,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [frameImg, setFrameImg] = useState<HTMLImageElement | null>(null)
  const [hint, setHint] = useState(false)
  const lastTouch = useRef<{ x: number; y: number } | null>(null)
  const lastPinch = useRef<number | null>(null)

  // Load frame image
  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = frame.url
    img.onload = () => {
      setFrameImg(img)
      if (frameImgRef) (frameImgRef as React.MutableRefObject<HTMLImageElement>).current = img
    }
  }, [frame.url, frameImgRef])

  // Show hint after photo loads
  useEffect(() => {
    if (photo) setHint(true)
  }, [photo])

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const cw = canvas.width
    const ch = canvas.height
    ctx.clearRect(0, 0, cw, ch)

    if (photo && photoSize) {
      const params = toDrawParams(transform, photoSize, { w: cw, h: ch })
      ctx.drawImage(photo, params.dx, params.dy, params.dw, params.dh)
    }
    if (frameImg) {
      ctx.drawImage(frameImg, 0, 0, cw, ch)
    }

    if (!photo) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      ctx.fillRect(0, 0, cw, ch)
      ctx.fillStyle = '#fff'
      ctx.font = `bold ${cw * 0.05}px sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText('Add your photo', cw / 2, ch / 2)
    }

    if (hint && photo) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)'
      ctx.fillRect(0, ch - 40, cw, 40)
      ctx.fillStyle = '#fff'
      ctx.font = `${cw * 0.035}px sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText('Pinch to zoom · drag to move', cw / 2, ch - 14)
    }
  }, [photo, photoSize, frameImg, transform, hint])

  const canvasSize = (el: HTMLCanvasElement | null) => ({
    w: el?.width ?? 1,
    h: el?.height ?? 1,
  })

  // Touch handlers
  const onTouchStart = (e: React.TouchEvent) => {
    setHint(false)
    if (e.touches.length === 1) {
      lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      lastPinch.current = Math.hypot(dx, dy)
      lastTouch.current = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      }
    }
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (!photoSize) return
    const canvas = canvasRef.current
    const cs = canvasSize(canvas)

    if (e.touches.length === 1 && lastTouch.current) {
      const dx = e.touches[0].clientX - lastTouch.current.x
      const dy = e.touches[0].clientY - lastTouch.current.y
      lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      onTransformChange(clampTransform(applyPan(transform, { dx, dy }, cs), photoSize, cs))
    } else if (e.touches.length === 2 && lastPinch.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.hypot(dx, dy)
      const factor = dist / lastPinch.current
      lastPinch.current = dist

      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2
      const panDx = lastTouch.current ? midX - lastTouch.current.x : 0
      const panDy = lastTouch.current ? midY - lastTouch.current.y : 0
      lastTouch.current = { x: midX, y: midY }

      const rect = canvas!.getBoundingClientRect()
      const focal = {
        cx: (midX - rect.left - rect.width / 2) / rect.width,
        cy: (midY - rect.top - rect.height / 2) / rect.height,
      }
      let t = applyPan(transform, { dx: panDx, dy: panDy }, cs)
      t = applyZoom(t, factor, focal, photoSize, cs)
      onTransformChange(t)
    }
  }

  // Mouse handlers
  const mouseDown = useRef<{ x: number; y: number } | null>(null)
  const onMouseDown = (e: React.MouseEvent) => {
    setHint(false)
    mouseDown.current = { x: e.clientX, y: e.clientY }
  }
  const onMouseMove = (e: React.MouseEvent) => {
    if (!mouseDown.current || !photoSize) return
    const cs = canvasSize(canvasRef.current)
    const dx = e.clientX - mouseDown.current.x
    const dy = e.clientY - mouseDown.current.y
    mouseDown.current = { x: e.clientX, y: e.clientY }
    onTransformChange(clampTransform(applyPan(transform, { dx, dy }, cs), photoSize, cs))
  }
  const onMouseUp = () => { mouseDown.current = null }

  const onWheel = (e: React.WheelEvent) => {
    if (!photoSize) return
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.1 : 0.9
    const canvas = canvasRef.current
    const rect = canvas!.getBoundingClientRect()
    const cs = canvasSize(canvas)
    const focal = {
      cx: (e.clientX - rect.left - rect.width / 2) / rect.width,
      cy: (e.clientY - rect.top - rect.height / 2) / rect.height,
    }
    onTransformChange(applyZoom(transform, factor, focal, photoSize, cs))
  }

  return (
    <canvas
      ref={canvasRef}
      width={frame.width}
      height={frame.height}
      className="w-full h-full cursor-grab active:cursor-grabbing"
      style={{ touchAction: 'none' }}
      onClick={!photo ? onPhotoRequest : undefined}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={() => { lastPinch.current = null; lastTouch.current = null }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onWheel={onWheel}
    />
  )
}
```

**Step 6: Create `SwatchRow`**

Create `src/components/public/SwatchRow.tsx`:

```tsx
type Frame = { id: string; color_hex: string; label: string }

export default function SwatchRow({
  frames,
  selected,
  onSelect,
}: {
  frames: Frame[]
  selected: string
  onSelect: (id: string) => void
}) {
  return (
    <div className="flex gap-3 flex-wrap justify-center">
      {frames.map(f => (
        <button
          key={f.id}
          onClick={() => onSelect(f.id)}
          title={f.label}
          className={`h-8 w-8 rounded-full border-2 transition-transform ${
            f.id === selected ? 'border-gray-800 scale-110' : 'border-transparent hover:scale-105'
          }`}
          style={{ backgroundColor: f.color_hex }}
        />
      ))}
    </div>
  )
}
```

**Step 7: Run all unit tests**

```bash
npm test
```

Expected: all tests pass.

**Step 8: Commit**

```bash
git add src/app/c/ src/components/public/ src/lib/canvas/export.ts src/lib/canvas/export.test.ts
git commit -m "feat: public campaign page with canvas editor, gesture support, and download"
```

---

## Task 13: Link management — regenerate and share

**Files:**
- Modify: `src/components/admin/CampaignList.tsx`
- Create: `src/app/api/campaigns/[id]/regenerate-token/route.ts`

**Step 1: Create the regenerate-token API route**

Create `src/app/api/campaigns/[id]/regenerate-token/route.ts`:

```typescript
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
```

**Step 2: Add `regenerateLink` function and button to `CampaignList`**

In `src/components/admin/CampaignList.tsx`, add the handler inside the component:

```tsx
const regenerateLink = async (id: string) => {
  if (!confirm('This will invalidate the current link. Continue?')) return
  const res = await fetch(`/api/campaigns/${id}/regenerate-token`, { method: 'POST' })
  const { token } = await res.json()
  setRows(r => r.map(c => c.id === id ? { ...c, public_token: token } : c))
}
```

Add this button inside each `<li>`:

```tsx
<button
  onClick={() => regenerateLink(c.id)}
  className="rounded px-3 py-1 text-sm text-gray-500 hover:text-red-600"
>
  Regenerate link
</button>
```

**Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/app/api/campaigns/ src/components/admin/CampaignList.tsx
git commit -m "feat: regenerate campaign link endpoint and button"
```

---

## Task 14: Security tests (RLS + public lookup)

**Files:**
- Create: `src/tests/security/rls.test.ts`

**Context:** These tests use two separate Supabase client instances authenticated as different users to verify tenant isolation. They require a real Supabase project (not mocked). Run them against your staging environment with two email/password test users created in Supabase Auth.

**Step 1: Write security tests**

Create `src/tests/security/rls.test.ts`:

```typescript
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
```

**Step 2: Run security tests**

```bash
npx dotenv -e .env.test -- vitest run src/tests/security/rls.test.ts
```

Expected: all pass.

**Step 3: Commit**

```bash
git add src/tests/
git commit -m "test: RLS tenant isolation and public lookup security tests"
```

---

## Task 15: End-to-end tests (Playwright)

**Files:**
- Create: `e2e/admin-campaign.spec.ts`
- Create: `e2e/public-page.spec.ts`
- Create: `e2e/fixtures/` (directory with test assets)
- Modify: `src/app/login/page.tsx` (add dev-only email login)
- Create: `src/app/auth/email/route.ts`

**Context:** These tests use real Chromium (mobile emulation) against a running dev server. Google OAuth cannot be automated, so a dev-only email/password sign-in route is added. Set `TEST_ADMIN_EMAIL`, `TEST_ADMIN_PASSWORD`, `TEST_CAMPAIGN_TOKEN` in `.env.test`.

**Step 1: Add dev-only email login to `src/app/login/page.tsx`**

Append this block inside `<main>` after the Google button:

```tsx
{process.env.NODE_ENV !== 'production' && (
  <form action="/auth/email" method="post" className="flex flex-col gap-2 w-full max-w-xs mt-4 border-t pt-4">
    <p className="text-xs text-gray-400 text-center">Dev login (not in production)</p>
    <input name="email" type="email" placeholder="Email" className="rounded border px-3 py-2" />
    <input name="password" type="password" placeholder="Password" className="rounded border px-3 py-2" />
    <button type="submit" className="rounded bg-gray-800 px-4 py-2 text-white">Sign in (dev)</button>
  </form>
)}
```

**Step 2: Create `src/app/auth/email/route.ts`**

```typescript
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
```

**Step 3: Create the admin E2E test**

Create `e2e/admin-campaign.spec.ts`:

```typescript
import { test, expect } from '@playwright/test'

test('admin creates campaign and uploads a frame', async ({ page }) => {
  await page.goto('/login')
  await page.fill('input[name="email"]', process.env.TEST_ADMIN_EMAIL!)
  await page.fill('input[name="password"]', process.env.TEST_ADMIN_PASSWORD!)
  await page.click('button[type="submit"]:has-text("Sign in")')
  await page.waitForURL('/dashboard')

  await page.click('text=New campaign')
  await page.waitForURL(/\/campaigns\//)

  // Upload a test frame PNG
  await page.setInputFiles('input[type="file"]', 'e2e/fixtures/test-frame.png')
  await expect(page.locator('text=test-frame')).toBeVisible({ timeout: 10_000 })
})
```

**Step 4: Create the public page E2E test**

Create `e2e/public-page.spec.ts`:

```typescript
import { test, expect } from '@playwright/test'

test('visitor uploads photo, download button activates', async ({ page }) => {
  await page.goto(`/c/${process.env.TEST_CAMPAIGN_TOKEN}`)
  await expect(page.locator('canvas')).toBeVisible()

  await page.setInputFiles('input[type="file"]', 'e2e/fixtures/test-photo.jpg')
  await expect(page.locator('button:has-text("Download")')).toBeEnabled({ timeout: 5000 })

  // Click second color swatch if present
  const swatches = page.locator('button[title]')
  const count = await swatches.count()
  if (count > 1) await swatches.nth(1).click()
  await expect(page.locator('canvas')).toBeVisible()
})
```

**Step 5: Create test fixture assets**

```bash
mkdir -p e2e/fixtures
```

Place in `e2e/fixtures/`:
- `test-frame.png` — a 400×400 transparent-window PNG (e.g., a simple border with a transparent center)
- `test-photo.jpg` — any small JPEG photo

**Step 6: Install Playwright browsers**

```bash
npx playwright install chromium
```

**Step 7: Run E2E tests**

```bash
npm run test:e2e
```

Expected: all tests pass.

**Step 8: Commit**

```bash
git add e2e/ src/app/auth/email/ src/app/login/page.tsx
git commit -m "test: E2E tests for admin campaign creation and public visitor flow"
```

---

## Task 16: CORS test for frame canvas export

**Files:**
- Create: `e2e/cors.spec.ts`

**Context:** If CORS is misconfigured on Supabase Storage, `canvas.toBlob()` silently fails due to security taint. This test catches that by checking no error message appears after a download click.

**Step 1: Create the CORS Playwright test**

Create `e2e/cors.spec.ts`:

```typescript
import { test, expect } from '@playwright/test'

test('frame loads without CORS taint and canvas export succeeds', async ({ page }) => {
  await page.goto(`/c/${process.env.TEST_CAMPAIGN_TOKEN}`)
  await page.setInputFiles('input[type="file"]', 'e2e/fixtures/test-photo.jpg')
  await expect(page.locator('button:has-text("Download")')).toBeEnabled({ timeout: 5000 })

  await page.click('button:has-text("Download")')

  // If CORS is broken, the "Download failed" error appears
  await expect(page.locator('text=Download failed')).not.toBeVisible({ timeout: 4000 })
})
```

**Step 2: Run**

```bash
npm run test:e2e -- cors.spec.ts
```

**Step 3: Commit**

```bash
git add e2e/cors.spec.ts
git commit -m "test: CORS taint check for frame canvas export"
```

---

## Task 17: Production deployment

**Files:**
- Modify: `next.config.ts`
- Create: `vercel.json`

**Step 1: Configure `next.config.ts` for Supabase image domains**

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

export default nextConfig
```

**Step 2: Create `vercel.json`**

```json
{
  "env": {
    "NEXT_PUBLIC_APP_URL": "https://your-project.vercel.app"
  }
}
```

**Step 3: Deploy to Vercel**

```bash
npx vercel --prod
```

Set environment variables in the Vercel dashboard (Project → Settings → Environment Variables):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL` (your actual Vercel domain)

**Step 4: Update Supabase Storage CORS with the production domain**

In Supabase Storage → bucket `frames` → CORS:
```json
[{ "origins": ["https://your-project.vercel.app"], "methods": ["GET"], "maxAgeSeconds": 3600 }]
```

**Step 5: Run the full test suite against production**

```bash
TEST_CAMPAIGN_TOKEN=<real-token> npm run test:e2e
```

**Step 6: Final commit**

```bash
git add next.config.ts vercel.json
git commit -m "chore: production Next.js config and Vercel deployment"
```

---

## Summary

| Task | What it delivers |
|------|-----------------|
| 1 | Scaffolded Next.js 14 project, Vitest, Playwright |
| 2 | Shared constants for all limits and tolerances |
| 3 | Database schema, RLS policies, public lookup function |
| 4 | Supabase client helpers + session middleware |
| 5 | Google OAuth login + auto-org creation |
| 6 | Admin dashboard with campaign list, toggle, copy link |
| 7 | Frame validation (transparency, aspect ratio) + dominant color — unit tested |
| 8 | Campaign edit page with validated frame upload, FrameList, delete |
| 9 | Canvas transform math (pan, zoom, clamp) — unit tested |
| 10 | Photo loader (HEIC, EXIF, downscale) — unit tested |
| 11 | Public campaign lookup route with rate limiting |
| 12 | Full public campaign page with gesture canvas, swatch row, download |
| 13 | Regenerate-link endpoint and button |
| 14 | Security tests (RLS tenant isolation, inactive token) |
| 15 | E2E Playwright tests (admin flow, visitor flow) |
| 16 | CORS taint test for canvas export |
| 17 | Production deployment to Vercel |
