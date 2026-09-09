// Verifies a Gumroad sale directly against Gumroad's own API, instead of
// trusting whatever a webhook POST claims. Gumroad's Ping notifications
// aren't signed, so a forged request could put any values it likes in the
// body - but it can't make Gumroad's API return a real sale that doesn't
// exist on this account. That lookup is the actual security check.
async function verifyGumroadSale(saleId) {
  const token = process.env.GUMROAD_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      'Missing GUMROAD_ACCESS_TOKEN environment variable. Set it in Vercel → Project → Settings → Environment Variables.'
    );
  }

  const response = await fetch(`https://api.gumroad.com/v2/sales/${encodeURIComponent(saleId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data || data.success !== true || !data.sale) {
    return { verified: false, sale: null };
  }

  return { verified: true, sale: data.sale };
}

module.exports = { verifyGumroadSale };
