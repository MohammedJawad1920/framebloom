# Photo Frame SaaS: Design Spec (v1)

Status: approved design, awaiting spec review before implementation.

## 1. Overview

A free, multi-tenant web app. Organizations sign in with Google and create **campaigns**. Each campaign holds a set of transparent-window PNG **frames** in different colors and has one shareable public link. Anyone with the link opens a page, adds a photo, picks a frame color, positions the photo with touch gestures, and downloads the framed image. All photo handling happens in the user's browser; the photo is never sent to the server.

## 2. Goals and non-goals

**Goals**

- Admins can create campaigns, upload frames, and share a link in a few minutes.
- Visitors need no account and can finish the flow on a phone in under a minute.
- Tenants are strictly isolated from each other.
- Running cost stays near zero for a free product.

**Non-goals for v1**

- Any pricing, plans, payments, or billing fields.
- Server-side storage or processing of user photos; admins cannot see what users create.
- Multiple admins per organization (the data model allows it later).
- Rotation, filters, text, stickers, or any editing beyond move and zoom.
- Frames that are not transparent-window PNG overlays, or frames of different aspect ratios within a campaign.
- Analytics, galleries, or custom domains.

## 3. Decisions and assumptions

| Decision | Choice | Why |
| --- | --- | --- |
| Admin model | Many organizations, free, multi-tenant | Chosen by the product owner |
| Photo handling | Browser-only | Privacy, no storage cost, instant editing; revisit if admins need to collect results |
| Link scope | One link per campaign; an organization can have many campaigns | Chosen by the product owner |
| Frame format | Transparent-window PNG; photo sits behind the frame | Standard approach, no extra admin setup |
| Stack | Next.js (TypeScript) on Vercel, Supabase (Auth, Postgres, Storage) | Managed tenant isolation and storage; matches the owner's skills |
| Admin sign-in | Google only, through Supabase Auth | No passwords to manage |
| Visitor access | Anonymous; the link is the credential | Lowest friction |
| Photo adjustment | Gestures only (drag, pinch), no sliders or zoom buttons | Matches the WhatsApp profile-picture feel |
| Output | PNG at the frame's native pixel size | Full quality, matches the frame |

Assumption: an organization has exactly one admin in v1, created automatically on first Google sign-in.

## 4. Architecture

- **Next.js app** (Vercel) with two areas: the admin dashboard (authenticated) and the public campaign page at `/c/<token>`.
- **Supabase Auth** for Google OAuth.
- **Supabase Postgres** for organizations, campaigns, and frames, with row-level security (RLS).
- **Supabase Storage** with one bucket for frame PNGs.
- **Public lookup path:** the campaign page calls a Next.js route handler, which calls a Postgres function that takes a token and returns the campaign name and its frames, only if the campaign is active. Visitors never query tables directly.

## 5. Data model

**organizations**

- `id` (uuid, primary key)
- `name` (text)
- `owner_id` (uuid, the authenticated Google user)
- `created_at`

**campaigns**

- `id` (uuid, primary key)
- `org_id` (references organizations)
- `name` (text)
- `public_token` (text, unique, 128 bits of randomness, URL-safe)
- `is_active` (boolean, default true)
- `aspect_ratio` (numeric, set from the first frame uploaded)
- `created_at`

**frames**

- `id` (uuid, primary key, random)
- `campaign_id` (references campaigns, cascade delete)
- `label` (text, e.g. "Red")
- `color_hex` (text, swatch color)
- `storage_path` (text, `<org_id>/<campaign_id>/<frame_id>.png`)
- `width`, `height` (integers, native pixels)
- `sort_order` (integer)

## 6. Security and tenant isolation

- **RLS on all three tables:** an admin can select, insert, update, and delete only rows whose organization they own. Campaigns and frames are checked through their parent chain.
- **Storage policies:** upload and delete are allowed only under the path prefix of the admin's own `org_id`. The bucket is publicly readable so the public page can load frames; file names contain random IDs, so only frames from shared links are practically reachable.
- **Public lookup function:** defined as security definer, exposes only campaign name, frame labels, colors, dimensions, and frame URLs. Returns nothing for unknown or inactive tokens, with the same response for both so tokens cannot be probed.
- **Rate limiting** on the public lookup route to slow token guessing and scraping.
- **Link controls:** "Regenerate link" replaces the token and invalidates the old one; the active toggle disables the link without changing it.
- **Deletion:** deleting a campaign deletes its frame rows and its files in storage.
- **CORS:** the frame bucket must return CORS headers allowing the app's origins. Frames are loaded with `crossOrigin="anonymous"`; without this the browser blocks canvas export. A test must cover this.

## 7. Free-tier limits

- 20 campaigns per organization.
- 12 frames per campaign.
- PNG only, 5 MB per file.

Limits are enforced both in the UI and in the database or API layer, and are defined as constants so they are easy to change.

## 8. Admin flow

1. **Sign in** with "Continue with Google". On first sign-in an organization is created, named from the Google profile and editable later.
2. **Dashboard** lists campaigns with name, frame count, active toggle, and "Copy link", plus a "New campaign" button.
3. **Campaign page:** name the campaign and drag in frame PNGs. Each frame has a label, a color swatch, and a delete button; frames can be reordered by dragging. The swatch is auto-picked from the frame's dominant opaque color and can be overridden. "Preview" opens the public page as visitors will see it.
4. **Upload validation in the browser before upload:**
   - PNG only, within the size limit.
   - The file must contain transparent pixels; a fully opaque PNG is rejected with an explanation, because it would hide the user's photo.
   - Every frame must match the aspect ratio of the first frame uploaded to the campaign (within a small tolerance). This keeps the user's photo in place when they switch colors. The first frame sets the campaign's `aspect_ratio`; if all frames are deleted, the ratio resets.
5. **Sharing:** "Copy link" gives `<app-domain>/c/<token>`; "Regenerate link" and the active toggle as described in section 6.

## 9. Public campaign page

**Loading:** `/c/<token>` fetches the campaign through the public lookup. An unknown or inactive token shows "This link is no longer available" and nothing else.

**Layout (mobile first), top to bottom:**

1. Campaign name.
2. Canvas sized to the frame's aspect ratio. Before a photo is added it shows the first frame and an "Add your photo" prompt; tapping it opens the picker.
3. Row of color swatches, one per frame.
4. "Change photo" text link, shown only after a photo is loaded.
5. Download button, disabled until a photo is added.
6. Note: "Your photo stays on your device."

**Photo input:**

- Accepts JPG, PNG, WebP, and HEIC. HEIC is converted by a small decoder that is lazy-loaded only when a HEIC file is chosen.
- On mobile the picker offers the camera.
- EXIF orientation is applied on load so portrait photos are not sideways.
- Images larger than about 4096 px on the long side are downscaled on load to avoid memory problems on low-end phones.

## 10. Gesture behavior

There are no sliders, zoom buttons, or rotation. Positioning works like the WhatsApp profile picture screen:

- **One finger:** drag to move the photo.
- **Two fingers:** pinch to zoom, centered between the fingers; moving the fingers together also pans at the same time.
- **Desktop:** click and drag to move; mouse wheel or trackpad pinch to zoom.

**Guardrails**

- The photo can never be smaller than the canvas ("cover" minimum), so no blank gaps appear behind the frame. Maximum zoom is 4x.
- Movement is clamped so the photo's edges cannot be dragged inside the canvas.
- While a finger is on the canvas, the page does not scroll or browser-zoom (`touch-action: none` on the canvas).
- A hint ("Pinch to zoom, drag to move") appears after the photo loads, fades on the first touch, and does not return.

**State:** position and zoom are stored as normalized values (fractions of the canvas, not pixels), so the on-screen preview and the final export are identical at any resolution.

## 11. Color switching and download

- Tapping a swatch swaps the frame overlay instantly. The photo stays exactly where the user placed it, because all frames in a campaign share one aspect ratio.
- **Export:** the photo and the selected frame are drawn on an off-screen canvas at the frame's native pixel size using the normalized position, then exported as PNG named like `annual-day-2026-red.png`.
- **iPhone Safari:** uses the share sheet (Web Share API with a file) so the user can save to Photos. Fallback: open the image in a new tab with a "long-press to save" hint.
- **Other browsers:** standard download.

## 12. Error states

Each has a plain-language message and a retry where it makes sense:

- Unsupported file type or file too large (admin and visitor).
- A photo that fails to decode.
- A frame that fails to load.
- Export failure (including CORS misconfiguration, with a clear internal log).
- Admin upload rejected for opaque PNG, wrong aspect ratio, or limit reached.
- Unknown or inactive campaign link.

## 13. Testing

- **Unit tests:** pan, zoom, and clamping math; normalized-to-pixel conversion; aspect-ratio validation; transparency detection.
- **Composition test:** preview and export produce the same composition for the same normalized state.
- **Security tests:** an admin cannot read or modify another organization's campaigns, frames, or storage files; the public lookup returns nothing for inactive or unknown tokens.
- **End-to-end (Playwright, phone viewport):** admin creates a campaign and uploads frames; a visitor uploads a photo, simulates drag and two-finger pinch, switches color, and downloads.
- **Manual device checks:** feel of gestures and the download path on a real iPhone (Safari) and a real Android phone (Chrome), since these cannot be fully judged in automation.

## 14. Setup requirements

- A Supabase project with Google OAuth enabled (Google Cloud OAuth client with the Supabase callback URL as an authorized redirect).
- The frame storage bucket created with public read, owner-scoped write policies, and CORS configured.
- A Vercel project with Supabase URL and keys as environment variables; the service key stays server-side only.
- RLS policies and the public lookup function applied through versioned database migrations.

## 15. Future work (explicitly out of v1)

- Pricing and billing, which would attach to the existing free-tier limits.
- Optional server storage so admins can collect submissions.
- Multiple admins per organization.
- Rotation, alternate frame shapes, and custom domains.

## 16. Risks

- **CORS misconfiguration** breaks downloads silently; mitigated by a dedicated test and an explicit setup step.
- **Gesture feel** varies by device; mitigated by real-device testing.
- **iOS download behavior** differs from other browsers; mitigated by the share-sheet path and fallback.
- **Memory on low-end phones** with very large photos; mitigated by downscaling on load.
- **Link leakage** exposes a campaign; mitigated by regenerate and deactivate controls.
