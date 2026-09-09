// Logic-only test for the Gumroad fulfillment webhook: no browser, no real
// Gumroad account, no real email sent. Fakes the database (like smoke.js),
// plus Gumroad's verification API and the email sender, so we can prove the
// fulfillment logic itself is correct - including the security and
// idempotency behavior that matters most here.

const assert = require('assert');

const { makeFakeDb } = require('./fakeDb');
const fakeDb = makeFakeDb();

const supabaseAdminPath = require.resolve('../lib/supabaseAdmin');
require.cache[supabaseAdminPath] = {
  id: supabaseAdminPath,
  filename: supabaseAdminPath,
  loaded: true,
  exports: { supabaseAdmin: () => fakeDb },
};

// Only these two sale_ids exist as far as our fake Gumroad is concerned -
// anything else fails verification, exactly like a forged sale_id would
// against the real API.
const fakeSales = {
  'sale-real-1': { id: 'sale-real-1', email: 'buyer@example.com', product_permalink: 'museum-of-us' },
  'sale-wrong-product': { id: 'sale-wrong-product', email: 'other@example.com', product_permalink: 'some-other-thing' },
};
const gumroadPath = require.resolve('../lib/gumroad');
require.cache[gumroadPath] = {
  id: gumroadPath,
  filename: gumroadPath,
  loaded: true,
  exports: {
    verifyGumroadSale: async (saleId) => {
      const sale = fakeSales[saleId];
      return sale ? { verified: true, sale } : { verified: false, sale: null };
    },
  },
};

// Records what would have been emailed, instead of calling Gmail.
const sentEmails = [];
const emailPath = require.resolve('../lib/email');
require.cache[emailPath] = {
  id: emailPath,
  filename: emailPath,
  loaded: true,
  exports: {
    sendGiftEmail: async ({ to, editUrl }) => {
      sentEmails.push({ to, editUrl });
    },
  },
};

process.env.GUMROAD_PRODUCT_PERMALINK = 'museum-of-us';
process.env.SITE_BASE_URL = 'https://example.vercel.app';

const webhookHandler = require('../api/webhooks/gumroad.js');

function makeRes() {
  const res = {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    setHeader(k, v) {
      this.headers[k] = v;
    },
  };
  return res;
}

function ping(body) {
  const res = makeRes();
  return webhookHandler(
    { method: 'POST', query: {}, headers: { host: 'example.vercel.app' }, body },
    res
  ).then(() => res);
}

async function run() {
  // 1. A real sale of the right product creates a museum and emails the buyer.
  let res = await ping({
    resource_name: 'sale',
    sale_id: 'sale-real-1',
    email: 'buyer@example.com',
    product_permalink: 'museum-of-us',
    test: 'false',
  });
  assert.strictEqual(res.statusCode, 200, JSON.stringify(res.body));
  assert.strictEqual(res.body.emailSent, true, 'should report the email sent');
  assert.strictEqual(sentEmails.length, 1, 'should have sent exactly one email');
  assert.strictEqual(sentEmails[0].to, 'buyer@example.com');
  assert.ok(sentEmails[0].editUrl.includes('/museum.html?id='), 'edit url should point at the gallery');
  assert.ok(sentEmails[0].editUrl.includes('&token='), 'edit url should include the edit token');
  console.log('✓ real sale creates a museum and emails the buyer:', sentEmails[0].editUrl);

  // 2. The SAME sale_id pinged again (Gumroad retries a ping it doesn't get
  //    a response from) must not create a second museum or send a second
  //    email.
  res = await ping({
    resource_name: 'sale',
    sale_id: 'sale-real-1',
    email: 'buyer@example.com',
    product_permalink: 'museum-of-us',
    test: 'false',
  });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.alreadyFulfilled, true, 'duplicate ping should be recognized');
  assert.strictEqual(sentEmails.length, 1, 'must still be exactly one email sent');
  console.log('✓ duplicate ping for the same sale is ignored (no second museum, no second email)');

  // 3. A sale_id Gumroad's own API doesn't recognize must NOT create a
  //    museum - this is the actual defense against a forged webhook POST.
  res = await ping({
    resource_name: 'sale',
    sale_id: 'sale-fake-999',
    email: 'attacker@example.com',
    product_permalink: 'museum-of-us',
    test: 'false',
  });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.ignored, 'unverified_sale');
  assert.strictEqual(sentEmails.length, 1, 'a forged sale_id must not trigger a museum or an email');
  console.log("✓ a sale_id Gumroad doesn't recognize is rejected, not fulfilled");

  // 4. Gumroad's own "Send test ping" button should be a harmless no-op.
  res = await ping({
    resource_name: 'sale',
    sale_id: 'sale_id_string',
    email: 'test@example.com',
    product_permalink: 'museum-of-us',
    test: 'true',
  });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.ignored, 'test_ping');
  assert.strictEqual(sentEmails.length, 1, 'a test ping must not create a museum or send an email');
  console.log('✓ Gumroad test ping is ignored');

  // 5. A real, verified sale for a DIFFERENT Gumroad product on the same
  //    account must be ignored, even though it's a genuine sale - this is
  //    what stops a cheap purchase from being paired with a forged
  //    permalink to claim a free museum.
  res = await ping({
    resource_name: 'sale',
    sale_id: 'sale-wrong-product',
    email: 'other@example.com',
    product_permalink: 'museum-of-us', // forged in the POST body...
    test: 'false',
  });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.ignored, 'different_product', "must go by Gumroad's verified permalink, not the posted one");
  assert.strictEqual(sentEmails.length, 1, 'a sale of a different product must not trigger a museum or an email');
  console.log("✓ a verified sale for a different product is ignored, even with a forged permalink in the POST body");

  // 6. Wrong secret on the URL is refused outright, before any of the above.
  process.env.GUMROAD_WEBHOOK_SECRET = 'letmein';
  res = await ping({ resource_name: 'sale', sale_id: 'sale-real-1', test: 'false' });
  assert.strictEqual(res.statusCode, 403);
  delete process.env.GUMROAD_WEBHOOK_SECRET;
  console.log('✓ a ping without the configured secret is refused');

  console.log('\nAll webhook smoke tests passed.');
}

run().catch((err) => {
  console.error('WEBHOOK SMOKE TEST FAILED:', err);
  process.exit(1);
});
