const { supabaseAdmin } = require('../../lib/supabaseAdmin');
const { DEFAULT_ARTWORKS } = require('../../lib/defaultLayout');

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

  const { data: museum, error: museumError } = await db
    .from('museums')
    .insert({})
    .select()
    .single();

  if (museumError) {
    console.error('create museum failed', museumError);
    return res.status(500).json({ error: 'create_failed' });
  }

  const artworksToInsert = DEFAULT_ARTWORKS.map((a) => ({
    museum_id: museum.id,
    ...a,
  }));

  const { error: artworksError } = await db.from('artworks').insert(artworksToInsert);

  if (artworksError) {
    console.error('create artworks failed', artworksError);
    // Clean up the orphaned museum row rather than leaving a broken one behind.
    await db.from('museums').delete().eq('id', museum.id);
    return res.status(500).json({ error: 'create_failed' });
  }

  return res.status(201).json({
    id: museum.id,
    editToken: museum.edit_token,
  });
};
