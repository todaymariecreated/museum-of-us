const { supabaseAdmin } = require('../../lib/supabaseAdmin');
const { createBlankMuseum } = require('../../lib/museumCreation');

// POST /api/museums
// Creates a brand new, blank museum plus its 9 default frames.
// Returns the edit_token exactly once — the caller (the landing page) is
// responsible for putting it in the edit URL and saving it in the visitor's
// browser. We never return it again after this.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const db = supabaseAdmin();

  let museum;
  try {
    museum = await createBlankMuseum(db);
  } catch (err) {
    console.error('create museum failed', err);
    return res.status(500).json({ error: 'create_failed' });
  }

  return res.status(201).json({
    id: museum.id,
    editToken: museum.edit_token,
  });
};
