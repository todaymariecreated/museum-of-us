const { supabaseAdmin } = require('../../lib/supabaseAdmin');
const { createBlankMuseum } = require('../../lib/museumCreation');
const { verifyGumroadSale } = require('../../lib/gumroad');
const { sendGiftEmail } = require('../../lib/email');

// Builds the private edit link for a freshly created museum. Prefers an
// explicit SITE_BASE_URL (set this once in Vercel so emails always point at
// your real domain), and falls back to the request's own host if that
// isn't set.
function buildEditUrl(req, museum) {
  const explicitBase = process.env.SITE_BASE_URL;
  const host = req.headers && req.headers.host;
  const base = explicitBase || (host ? `https://${host}` : '');
  return `${base.replace(/\/$/, '')}/museum.html?id=${encodeURIComponent(museum.id)}&token=${encodeURIComponent(museum.edit_token)}`;
}

// POST /api/webhooks/gumroad — set this URL as your Gumroad product's Ping
// notification. Fulfillment for a paid "Museum of Us" gift: creates a
// brand new blank museum and emails the buyer their private edit link.
//
// Gumroad's Ping notifications aren't signed, so the POST body alone proves
// nothing - the real check is verifyGumroadSale(), which asks Gumroad's own
// API whether that sale_id genuinely exists on this account. A forged
// request can't make that come back true.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  // Optional extra layer: put a random string in the Ping URL itself
  // (?key=...) so unrelated traffic never even reaches the Gumroad API
  // call below. Not required, since that API check is the real gate, but
  // cheap insurance.
  const requiredSecret = process.env.GUMROAD_WEBHOOK_SECRET;
  if (requiredSecret && req.query.key !== requiredSecret) {
    return res.status(403).json({ error: 'forbidden' });
  }

  const body = req.body || {};

  // Gumroad's "Send test ping" button posts a placeholder sale_id that will
  // never resolve via the real API. Recognize it up front instead of
  // logging it as a failed verification every time you test the setup.
  if (body.test === 'true' || body.test === true) {
    console.log('gumroad webhook: test ping received, ignoring');
    return res.status(200).json({ ok: true, ignored: 'test_ping' });
  }

  const saleId = body.sale_id;
  if (!saleId) {
    return res.status(400).json({ error: 'missing_sale_id' });
  }

  const db = supabaseAdmin();

  // Idempotency first: Gumroad retries a ping it doesn't get a response
  // from (up to 3 times), and this also protects against a buyer's browser
  // firing the same event twice. Never create a second museum or send a
  // second email for the same sale.
  const { data: existing } = await db
    .from('fulfillments')
    .select('*')
    .eq('sale_id', saleId)
    .maybeSingle();
  if (existing) {
    return res.status(200).json({ ok: true, alreadyFulfilled: true });
  }

  let verification;
  try {
    verification = await verifyGumroadSale(saleId);
  } catch (err) {
    console.error('gumroad webhook: could not reach Gumroad to verify sale', saleId, err);
    // Let Gumroad retry - this is our own failure to check, not evidence
    // the sale is fake.
    return res.status(500).json({ error: 'verification_unreachable' });
  }

  if (!verification.verified) {
    console.error("gumroad webhook: sale_id did not verify against Gumroad's API", saleId);
    return res.status(200).json({ ok: true, ignored: 'unverified_sale' });
  }

  const sale = verification.sale;

  // Only fulfill sales of the actual product this webhook is for, sourced
  // from Gumroad's own verified response (never the raw posted body) -
  // otherwise a real sale of something cheap could be paired with a forged
  // permalink to claim a free museum.
  const expectedPermalink = process.env.GUMROAD_PRODUCT_PERMALINK;
  const soldPermalink = sale.product_permalink || sale.permalink;
  if (expectedPermalink && soldPermalink && soldPermalink !== expectedPermalink) {
    console.log('gumroad webhook: sale is for a different product, ignoring', soldPermalink);
    return res.status(200).json({ ok: true, ignored: 'different_product' });
  }

  const buyerEmail = sale.email;
  if (!buyerEmail) {
    console.error('gumroad webhook: verified sale has no email on file', saleId);
    return res.status(200).json({ ok: true, ignored: 'no_email_on_sale' });
  }

  let museum;
  try {
    museum = await createBlankMuseum(db, { title: 'A Museum for You' });
  } catch (err) {
    console.error('gumroad webhook: creating the museum failed', saleId, err);
    return res.status(500).json({ error: 'create_failed' });
  }

  const { error: fulfillmentError } = await db
    .from('fulfillments')
    .insert({ sale_id: saleId, museum_id: museum.id, email: buyerEmail })
    .select()
    .single();

  if (fulfillmentError) {
    // A concurrent retry recorded this sale first - skip sending a second
    // email rather than risk a duplicate.
    console.log('gumroad webhook: fulfillment already recorded concurrently, skipping email', saleId);
    return res.status(200).json({ ok: true, alreadyFulfilled: true });
  }

  const editUrl = buildEditUrl(req, museum);

  try {
    await sendGiftEmail({ to: buyerEmail, editUrl });
  } catch (err) {
    console.error('gumroad webhook: museum created but the email failed to send', {
      saleId,
      museumId: museum.id,
      editUrl,
      error: err.message,
    });
    return res.status(200).json({ ok: true, emailSent: false, museumId: museum.id });
  }

  return res.status(200).json({ ok: true, emailSent: true, museumId: museum.id });
};
