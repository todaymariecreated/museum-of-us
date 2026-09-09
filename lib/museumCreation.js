const { DEFAULT_ARTWORKS } = require('./defaultLayout');

// Creates a brand new, blank museum plus its 9 default frames. Shared by
// the public "create a museum" endpoint (public/index.html's auto-redirect)
// and the Gumroad fulfillment webhook, so both paths build a museum exactly
// the same way instead of drifting apart.
async function createBlankMuseum(db, { title } = {}) {
  const insertFields = {};
  if (title) insertFields.title = title;

  const { data: museum, error: museumError } = await db
    .from('museums')
    .insert(insertFields)
    .select()
    .single();

  if (museumError) {
    throw new Error('create_museum_failed: ' + museumError.message);
  }

  const artworksToInsert = DEFAULT_ARTWORKS.map((a) => ({
    museum_id: museum.id,
    ...a,
  }));

  const { error: artworksError } = await db.from('artworks').insert(artworksToInsert);

  if (artworksError) {
    // Clean up the orphaned museum row rather than leaving a broken one behind.
    await db.from('museums').delete().eq('id', museum.id);
    throw new Error('create_artworks_failed: ' + artworksError.message);
  }

  return museum;
}

module.exports = { createBlankMuseum };
