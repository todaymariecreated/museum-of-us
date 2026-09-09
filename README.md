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

Open your new Vercel URL. It drops you straight into a blank museum, open a
frame, type a title and a note, upload a photo, drag/zoom the photo into
place, click "Share Gift" → "Get link", and open that link in a private/incognito window
to see the exact read-only view a recipient would see (no edit controls, no
drag/zoom, plaques not editable). Reload your own edit link afterwards to
confirm your edits really saved to the database rather than just sitting in
the browser tab.

## 5. Sell it on Gumroad

A Gumroad sale now automatically creates a brand new museum and emails the
buyer their private edit link, no manual work needed once this is set up.

**A. Create the product on Gumroad**, if you haven't already, at whatever
price you want. Note the short name at the end of its page URL (e.g. if
your product page is `gumroad.com/l/museum-of-us`, that name is
`museum-of-us`). You'll use it as `GUMROAD_PRODUCT_PERMALINK` below, so a
sale of anything else on your account never creates a museum.

**B. Get a Gumroad access token**, so the app can check that a sale is
real before it does anything:

1. Go to `gumroad.com/settings/advanced` and find the "Applications" section.
2. Fill in an application name (anything, e.g. "Museum of Us fulfillment")
   and a redirect URI of `http://127.0.0.1`, then click "Create application."
3. On the page that opens, click "Edit" on your new application if it
   doesn't take you straight there, then click "Generate access token."
4. Copy that token. This is `GUMROAD_ACCESS_TOKEN` below.

**C. Set up Gmail to send the emails:**

1. In your Google Account, go to Security → 2-Step Verification and turn
   it on if it isn't already.
2. Still under Security, go to "App passwords," and generate one for
   "Mail." Copy the 16-character password it gives you.
3. `GMAIL_USER` is your Gmail address. `GMAIL_APP_PASSWORD` is that
   16-character password, not your normal Gmail password.

**D. Add these to Vercel** (Project → Settings → Environment Variables),
alongside the two you already have:

- `GUMROAD_ACCESS_TOKEN`, from step B
- `GUMROAD_PRODUCT_PERMALINK`, from step A
- `GUMROAD_WEBHOOK_SECRET`, any long random string you make up yourself
- `GMAIL_USER` and `GMAIL_APP_PASSWORD`, from step C
- `SITE_BASE_URL`, your live Vercel URL, e.g.
  `https://museum-of-us-amv3.vercel.app`
- `GIFT_SENDER_NAME` (optional), what shows as the email's sender name
- `GIFT_BCC_EMAIL` (optional), set to your own email to get a copy of
  every gift email sent

Redeploy after adding these (Vercel → Deployments → the "..." menu on the
latest one → Redeploy) so the new environment variables take effect.

**E. Point Gumroad at your app.** On your product's edit page, open the
"Ping" / advanced settings and set the notification URL to:

```
https://your-vercel-url.vercel.app/api/webhooks/gumroad?key=THE_RANDOM_STRING_YOU_MADE_UP
```

using the same random string you set as `GUMROAD_WEBHOOK_SECRET`.

**F. Test it.** Buy your own product on Gumroad (or use its test mode) and
confirm you get an email with a working edit link a few seconds later. If
something goes wrong, Vercel → your project → "Logs" will show exactly
which step failed.

**One more thing first:** re-run all of `supabase-setup.sql` in Supabase's
SQL Editor before testing. It's safe to run again since it only adds what's
missing, and this time it adds the new `fulfillments` table the webhook
needs.

## What's next

- Add the creation rate-limit and photo-count guardrails noted in the
  project's architecture doc — worth doing before sharing the free link
  widely (a paid Gumroad link is naturally rate-limited by, well, paying).
- Optional polish: a small "Saving…" / "Saved" indicator somewhere in the
  gallery UI, since saves now happen silently in the background rather than
  only on the explicit Share Gift click.

## Files

- `supabase-setup.sql` — run once in Supabase (safe to re-run any time).
- `lib/` — shared server-side code: the Supabase client, default layout,
  token check, response shaping, museum creation, Gumroad sale
  verification, and gift-email sending.
- `api/` — the serverless routes Vercel runs automatically, including
  `api/webhooks/gumroad.js`, the Gumroad fulfillment webhook.
- `public/index.html` — visiting the site creates a new museum (or opens
  your existing one, if this browser has already made one) and drops you
  straight into it.
- `public/museum.html` — the real interactive gallery, used for both the
  private editor (`?id=...&token=...`) and the public gift view (`?id=...`).
- `public/assets/` — the frame art, chandelier, spectators, and background
  music, extracted out of the original single-file prototype into real
  static files so the page loads fast instead of shipping ~9MB of inline
  base64 on every visit.
- `test/` — a fake in-memory database, logic smoke tests for the API and
  the Gumroad webhook (`node test/smoke.js`, `node test/webhookSmoke.js`),
  and a real end-to-end browser test (`node test/localServer.js` in one
  terminal, `node test/e2e.js` in another) that drives the actual gallery
  UI. Useful for checking changes before deploying.
