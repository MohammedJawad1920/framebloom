# Implementation Plan: Dashboard Logout

## Scope
Add a simple, minimal logout button to the admin dashboard.

## Tasks

### Task 1: Create Logout Component
- **File:** `src/components/admin/LogoutButton.tsx`
- **Action:** Create a Client Component that uses `supabase.auth.signOut()` and `next/navigation` router to log the user out and redirect to `/login`.

### Task 2: Integrate into Dashboard
- **File:** `src/app/(admin)/dashboard/page.tsx`
- **Action:** Import the `LogoutButton` and place it immediately next to the `{org.name}` header inside a flex container (`gap-4`, `items-baseline`).

### Task 3: Commit
- Verify TypeScript compiles.
- Commit changes with message: `feat: add dashboard logout button`.
