const { supabaseAdmin } = require('../../../lib/supabaseAdmin');
const { museumToJSON } = require('../../../lib/museumView');
const { tokenMatches } = require('../../../lib/checkToken');
const { BLANK_ARTWORK_TEXT } = require('../../../lib/defaultLayout');

async function loadMuseum(db, id) {
  const { data: museum, error: museumError } = await db
    .from('museums')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (museumError || !museum) return { museum: null, artworks: [] };

  const { data: artworks, error: artworksError } = await db
    .from('artworks')
    .select('*')
    .eq('museum_id', id);
  if (artworksError) return { museum, artworks: [] };

  return { museum, artworks };
}

// GET    /api/museums/[id]?token=...   — read (public if no/-wrong token, full if it matches)
// PATCH  /api/museums/[id]             — body: { token, title?, settings?, artworks?: [{id, ...fields}] }
module.exports = async function handler(req, res) {
  const { id } = req.query;
  const db = supabaseAdmin();

  if (req.method === 'GET') {
    const { museum, artworks } = await loadMuseum(db, id);
    if (!museum) return res.status(404).json({ error: 'not_found' });

    const suppliedToken = req.query.token;
    const canEdit = tokenMatches(museum, suppliedToken);
    return res.status(200).json(museumToJSON(museum, artworks, canEdit));
  }

  if (req.method === 'PATCH') {
    const body = req.body || {};
    const { museum } = await loadMuseum(db, id);
    if (!museum) return res.status(404).json({ error: 'not_found' });
    if (!tokenMatches(museum, body.token)) {
      return res.status(403).json({ error: 'not_writer' });
    }

    if (typeof body.title === 'string') {
      await db.from('museums').update({ title: body.title }).eq('id', id);
    }
    if (body.settings && typeof body.settings === 'object') {
      await db.from('museums').update({ settings: body.settings }).eq('id', id);
    }

    if (Array.isArray(body.artworks)) {
      for (const patch of body.artworks) {
        if (!patch || !patch.id) continue;
        const allowed = {};
        for (const key of ['title', 'medium', 'year', 'note', 'image_path', 'img_fit']) {
          if (key in patch) allowed[key] = patch[key];
        }
        if (Object.keys(allowed).length === 0) continue;
        await db.from('artworks').update(allowed).eq('id', patch.id).eq('museum_id', id);
      }
    }

    const fresh = await loadMuseum(db, id);
    return res.status(200).json(museumToJSON(fresh.museum, fresh.artworks, true));
  }

  if (req.method === 'POST' && req.query.action === 'reset') {
    const body = req.body || {};
    const { museum, artworks } = await loadMuseum(db, id);
    if (!museum) return res.status(404).json({ error: 'not_found' });
    if (!tokenMatches(museum, body.token)) {
      return res.status(403).json({ error: 'not_writer' });
    }

    for (const a of artworks) {
      await db
        .from('artworks')
        .update({ ...BLANK_ARTWORK_TEXT, image_path: null, img_fit: null })
        .eq('id', a.id);
    }

    const fresh = await loadMuseum(db, id);
    return res.status(200).json(museumToJSON(fresh.museum, fresh.artworks, true));
  }

  res.setHeader('Allow', 'GET, PATCH, POST');
  return res.status(405).json({ error: 'method_not_allowed' });
};
