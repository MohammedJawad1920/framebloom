# Deployment Guide

This guide will walk you through deploying the Photo Frame SaaS application to Vercel.

## 1. Push Code to GitHub

First, ensure all your code is committed and pushed to a GitHub repository.

```bash
git add .
git commit -m "Your commit message"
git branch -M main
git remote add origin https://github.com/yourusername/photo_frame_saas.git
git push -u origin main
```

## 2. Import Project in Vercel

1. Log in to [Vercel](https://vercel.com).
2. Click on **Add New...** -> **Project**.
3. Import your GitHub repository for `photo_frame_saas`.
4. Vercel will automatically detect that it's a Next.js project.

## 3. Add Environment Variables

During the import process, expand the **Environment Variables** section and add the following variables. You can find these in your local `.env.local` file or your Supabase Dashboard:

- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL (e.g., `https://xxxxxx.supabase.co`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon public key

Once added, click **Deploy**.

## 4. Update Supabase Authentication URLs

After Vercel finishes deploying, you will get a production URL (e.g., `https://photo-frame-saas.vercel.app`). You **must** update Supabase to allow this URL for authentication redirects.

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard).
2. Navigate to **Authentication** > **URL Configuration**.
3. Under **Site URL**, set your new Vercel domain: `https://photo-frame-saas.vercel.app`.
4. Under **Redirect URIs**, add the Vercel domain with the OAuth callback path: `https://photo-frame-saas.vercel.app/auth/callback`.

*Note: This is crucial for Google OAuth to redirect correctly back to your production app.*

## 5. Update Google Cloud Console Authorized Redirect URIs

If you are using Google OAuth, you also need to authorize your new Vercel domain in the Google Cloud Console (if it isn't covered by your Supabase provider setup).
When using Supabase, you usually authorize the Supabase Callback URL in Google Cloud (`https://<project-ref>.supabase.co/auth/v1/callback`). Since Supabase handles the OAuth flow, you just need to ensure your Google Cloud credentials allow the Supabase redirect URI, and then Supabase handles redirecting back to your Vercel app based on the URLs configured in Step 4.

## 6. Verify

Visit your Vercel production URL and attempt to sign in with Google to verify everything is working correctly!
