# Implementation Plan: Mobile-First Professional UI/UX Overhaul

## Scope
Rewrite the UI for the Admin Dashboard, Campaign Editor, and Public Page using a Clean & Light design system, ensuring mobile responsiveness, large touch targets (44px min), and fixing the gallery bug.

## Design System Tokens
- **Background**: `bg-gray-50 text-gray-900`
- **Cards**: `bg-white rounded-2xl shadow-sm border border-gray-100 p-6`
- **Primary button**: `bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-3 rounded-xl transition-colors min-h-[44px]`
- **Secondary button**: `bg-white hover:bg-gray-50 text-gray-700 font-medium px-5 py-3 rounded-xl border border-gray-200 shadow-sm transition-colors min-h-[44px]`
- **Inputs**: `w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 focus:ring-2 focus:ring-indigo-500`

## Tasks

### Task 1: Global Settings & Admin Layout
- **Files**: `src/app/globals.css`, `src/app/(admin)/layout.tsx`
- **Action**: Ensure global body background is `bg-gray-50` and text is `text-gray-900`. Remove any forced `dark` mode utilities. In the admin layout, ensure the structure uses the light theme and provides a top navigation bar holding the app title and `LogoutButton`.
- **Note**: Ensure `LogoutButton.tsx` is updated to look good on a white background (e.g., `text-gray-600 hover:text-gray-900 bg-gray-100/50`).

### Task 2: Dashboard Redesign
- **Files**: `src/app/(admin)/dashboard/page.tsx`, `src/components/admin/CampaignList.tsx`, `src/components/admin/NewCampaignButton.tsx`
- **Action**: Apply the Primary button token to `NewCampaignButton`. In `CampaignList`, wrap each campaign in a Card token. Use proper Flexbox spacing. Apply colored pills for "Active/Inactive" status. Make "Copy Link" and "Regenerate" proper 44px secondary buttons.

### Task 3: Campaign Editor Redesign
- **Files**: `src/app/(admin)/campaigns/[id]/page.tsx`, `src/components/admin/CampaignNameEditor.tsx`, `src/components/admin/FrameUploader.tsx`, `src/components/admin/FrameList.tsx`
- **Action**: 
  - `CampaignNameEditor`: Large, bold `text-2xl` input field.
  - `FrameUploader`: Proper dashed card, `p-8`, with an SVG upload icon and clear typography.
  - `FrameList`: Render each frame as a sleek row. Make the color picker `w-11 h-11`. Make the delete button a proper min-h-[44px] tappable zone.
  - Add a primary or secondary full-width button at the bottom for "Preview public page".

### Task 4: Public Page Redesign & Bug Fix
- **Files**: `src/components/public/CampaignEditor.tsx`, `src/components/public/CanvasEditor.tsx`, `src/components/public/SwatchRow.tsx`
- **Action**:
  - **CRITICAL**: Remove `capture="environment"` from the `<input type="file">` to fix the gallery bug!
  - `CampaignEditor`: Apply page styling. Stack action buttons on mobile (`flex-col sm:flex-row`). Make "Change photo" a secondary button. Ensure the main buttons use the Primary/Secondary button tokens.
  - `CanvasEditor`: Add a subtle shadow around the canvas.
  - `SwatchRow`: Make swatches `w-11 h-11` (44px) for mobile tapping. Use a clean ring (`ring-2 ring-offset-2 ring-indigo-500`) for the selected state.

### Task 5: Commit
- Verify TypeScript compiles.
- Commit changes with message: `feat: mobile-first professional UI overhaul and gallery fix`.
