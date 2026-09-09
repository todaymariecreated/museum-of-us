const { supabaseAdmin } = require('../../../lib/supabaseAdmin');
const { tokenMatches } = require('../../../lib/checkToken');

// Defense in depth: the client already compresses photos to ~170KB before
// sending them (see compressImageFile in the app), but never trust that
// alone — a modified client or a direct API call could send anything.
const MAX_PHOTO_BYTES = 2 * 1024 * 1024; // 2MB, generous headroom over the ~170KB target

// POST /api/museums/[id]/photo
// body: { token, artworkId, dataUrl }  — dataUrl is a "data:image/jpeg;base64,..." string
// Uploads to Supabase Storage and stores the resulting public URL on the artwork.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const { id } = req.query;
  const body = req.body || {};
  const db = supabaseAdmin();

  const { data: museum, error: museumError } = await db
    .from('museums')
    .select('id, edit_token')
    .eq('id', id)
    .maybeSingle();
  if (museumError || !museum) return res.status(404).json({ error: 'not_found' });
  if (!tokenMatches(museum, body.token)) return res.status(403).json({ error: 'not_writer' });

  const { artworkId, dataUrl } = body;
  if (!artworkId || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
    return res.status(400).json({ error: 'invalid_content' });
  }

  const { data: artwork } = await db
    .from('artworks')
    .select('id')
    .eq('id', artworkId)
    .eq('museum_id', id)
    .maybeSingle();
  if (!artwork) return res.status(404).json({ error: 'artwork_not_found' });

  const commaIdx = dataUrl.indexOf(',');
  const meta = dataUrl.slice(5, commaIdx); // e.g. "image/jpeg;base64"
  const mimeType = meta.split(';')[0] || 'image/jpeg';
  const base64 = dataUrl.slice(commaIdx + 1);
  const buffer = Buffer.from(base64, 'base64');

  if (buffer.byteLength > MAX_PHOTO_BYTES) {
    return res.status(413).json({ error: 'too_large' });
  }

  const ext = mimeType.split('/')[1] || 'jpg';
  const path = `${id}/${artworkId}.${ext}`;

  const { error: uploadError } = await db.storage
    .from('museum-photos')
    .upload(path, buffer, { contentType: mimeType, upsert: true });

  if (uploadError) {
    console.error('photo upload failed', uploadError);
    return res.status(500).json({ error: 'upload_failed' });
  }

  const { data: publicUrlData } = db.storage.from('museum-photos').getPublicUrl(path);
  // The storage path is deterministic (same museum + artwork + extension), so
  // re-uploading a replacement photo reuses the exact same URL as before.
  // Without a cache-busting suffix, browsers (and Supabase's CDN) keep
  // serving the OLD cached image at that URL even though the file itself
  // was replaced — which looks exactly like "changing the photo doesn't
  // work." Appending a version stamp makes every upload's URL unique so the
  // new photo always actually loads, both right away and on future visits.
  const imageUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;

  await db.from('artworks').update({ image_path: imageUrl }).eq('id', artworkId);

  return res.status(200).json({ imageUrl });
};
