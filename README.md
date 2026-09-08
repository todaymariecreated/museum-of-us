# Museum of Us — multi-user app

Anyone who opens the site can create their own museum — the full interactive
gallery, museum wall, chandelier, music, drag-to-reposition and pinch/slider
zoom on photos — edit it, upload photos, and generate a gift link for
someone else. All backed by a real database (Supabase) instead of one shared
document, so everyone's museum is private to them until they choose to share
it.

**What changed since the last version:** the plain `edit.html`/`gift.html`
placeholder pages are gone. `public/museum.html` is now the real gallery —
the same interactive experience from the original prototype — wired up to
the API routes instead of self-publishing. The same page serves both roles:
opened with `?id=...&token=...` it's the private editor; opened with just
`?id=...` (no token) it's the read-only gift view. Edits save automatically
a moment after you stop typing, dragging, or zooming, so nothing is lost if
you close the tab without clicking "Share Gift" — that button now just
finishes any pending save and hands you the link.

## 1. Set up Supabase

1. In your Supabase project, go to **SQL Editor → New query**.
2. Paste in the entire contents of `supabase-setup.sql` from this folder and run it.
   This creates the `museums` and `artworks` tables and a public `museum-photos` storage bucket.
3. Go to **Project Settings → API** and note two values (you'll need them in step 3 below):
   - **Project URL**
   - **service_role** secret key (NOT the `anon`/public key — this one must stay secret)

## 2. Push this code to GitHub

```bash
cd museum-of-us-app
git init
git add .
git commit -m "Initial multi-user backend for Museum of Us"
```

Then create a new empty repository on GitHub (no README/license, since this
folder already has one), and push:

```bash
git remote add origin https://github.com/<your-username>/museum-of-us.git
git branch -M main
git push -u origin main
```

## 3. Deploy on Vercel

1. In Vercel, **Add New → Project**, and import the GitHub repo you just pushed.
2. Before the first deploy, open **Project Settings → Environment Variables** and add:
   - `SUPABASE_URL` — the Project URL from step 1
   - `SUPABASE_SERVICE_ROLE_KEY` — the service_role key from step 1
   (Never put these in the code or in chat — only in Vercel's dashboard.)
3. Deploy. Vercel will serve everything in `public/` as static pages and
   everything in `api/` as serverless functions automatically — no build
   step needed for this project.
4. In **Settings → Deployment Protection**, make sure **Vercel Authentication**
   is off (or scoped to Preview only) — otherwise visitors get a login wall
   in front of the public gift links, which defeats the point of sharing them.

## 4. Try it

Open your new Vercel URL. Click "Start your museum," open a frame, type a
title and a note, upload a photo, drag/zoom the photo into place, click
"Share Gift" → "Get link", and open that link in a private/incognito window
to see the exact read-only view a recipient would see (no edit controls, no
drag/zoom, plaques not editable). Reload your own edit link afterwards to
confirm your edits really saved to the database rather than just sitting in
the browser tab.

## What's next

- Add the creation rate-limit and photo-count guardrails noted in the
  project's architecture doc — worth doing before sharing the link widely.
- Wire up the Gumroad → automated-fulfillment webhook once you're ready to
  start selling access (see the monetization section of that doc — no
  engineering blocks starting to sell manually before then).
- Optional polish: a small "Saving…" / "Saved" indicator somewhere in the
  gallery UI, since saves now happen silently in the background rather than
  only on the explicit Share Gift click.

## Files

- `supabase-setup.sql` — run once in Supabase.
- `lib/` — shared server-side code (Supabase client, default layout, token check, response shaping).
- `api/` — the serverless routes Vercel runs automatically.
- `public/index.html` — the landing page ("Start your museum").
- `public/museum.html` — the real interactive gallery, used for both the
  private editor (`?id=...&token=...`) and the public gift view (`?id=...`).
- `public/assets/` — the frame art, chandelier, spectators, and background
  music, extracted out of the original single-file prototype into real
  static files so the page loads fast instead of shipping ~9MB of inline
  base64 on every visit.
- `test/` — a fake in-memory database, a logic smoke test, and a real
  end-to-end browser test (`node test/localServer.js` in one terminal,
  `node test/e2e.js` in another) that drives the actual gallery UI — useful
  if you want to verify changes before deploying.
