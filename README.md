# Museum of Us — multi-user backend

This is the first working slice of the real, multi-user Museum of Us: anyone
who opens the site can create their own museum, edit it, upload photos, and
generate a gift link for someone else — all backed by a real database
(Supabase) instead of one shared document.

**What this is not yet:** the beautiful interactive gallery (frames on a
museum wall, drag/zoom, music, the polished editor) from the original
prototype. That's the next phase — porting that experience to call these
same API routes instead of self-publishing. What's here now is the
foundation underneath it: create → edit → upload → reset → share, for as
many people as use it, each with their own private data. `edit.html` and
`gift.html` are plain, functional stand-ins so the plumbing can be tested
end to end before the visual port happens.

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

## 4. Try it

Open your new Vercel URL. Click "Start your museum," edit a frame, upload a
photo, hit "Get gift link," and open that link in a private/incognito
window to see the read-only view a recipient would see. If all of that
works, the backend is live and correctly separating everyone's data.

## What's next

- Port the real gallery experience (the interactive museum wall, drag/zoom,
  music, all the visual polish already built) from the original artifact
  into `edit.html`/`gift.html`, calling the same API routes instead of
  self-publishing.
- Add the creation rate-limit and photo-count guardrails noted in the
  project's architecture doc.
- Wire up the Gumroad → automated-fulfillment webhook once you're ready to
  start selling access (see the monetization section of that doc — no
  engineering blocks starting to sell manually before then).

## Files

- `supabase-setup.sql` — run once in Supabase.
- `lib/` — shared server-side code (Supabase client, default layout, token check, response shaping).
- `api/` — the serverless routes Vercel runs automatically.
- `public/` — the static pages served to visitors.
- `test/` — a fake in-memory database, a logic smoke test, and a real end-to-end
  browser test (`node test/localServer.js` in one terminal, `node test/e2e.js`
  in another) — useful if you want to verify changes before deploying.
