# Implementation Plan: Campaign Editor Polish

## Scope
Apply minimal visual polish to the Campaign Editor page (`/campaigns/[id]`) using raw Tailwind CSS.

## Decision Log
1. **Color circle:** via hidden `<input>` + styled `<label>`
2. **Filename:** Truncated filename extracted from `storage_path`
3. **Navigation:** `← Back to dashboard` text link at the top

## Tasks

### Task 1: Back Navigation
- **File:** `src/app/(admin)/campaigns/[id]/page.tsx`
- **Action:** Add a Next.js `<Link>` to `/dashboard` with text `← Back to dashboard` above the campaign name.

### Task 2: Frame List Polish (Color Picker & Filename)
- **File:** `src/components/admin/FrameList.tsx`
- **Action 1:** Replace the raw `<input type="color">` with a `<label>` wrapping a styled `<div>` (circle) and a visually hidden `<input>`.
- **Action 2:** Extract the filename from `frame.storage_path`, clean it up (remove dashes and extension), and render it inside a `<span className="truncate max-w-xs text-sm text-gray-300">`.

### Task 3: Commit
- Verify TypeScript compiles.
- Commit changes with message: `feat: polish campaign editor UI`.
