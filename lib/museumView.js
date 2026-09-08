// Shapes a museum + artworks row set for a JSON response, and enforces the
// one security rule that matters most: edit_token NEVER leaves this file
// unless the caller already proved they have it.

function publicArtwork(a) {
  return {
    id: a.id,
    order: a.display_order,
    frame: a.frame,
    x: a.pos_x,
    y: a.pos_y,
    w: a.width,
    r: a.rotation,
    side: a.side,
    title: a.title,
    medium: a.medium,
    year: a.year,
    note: a.note,
    imageUrl: a.image_path || null,
    imgFit: a.img_fit || null,
  };
}

// `canEdit` is decided by the caller (did the supplied token match?), never
// by anything in this function.
function museumToJSON(museum, artworks, canEdit) {
  return {
    id: museum.id,
    title: museum.title,
    settings: museum.settings || {},
    canEdit: !!canEdit,
    // editToken is only ever included right after creation (see
    // api/museums/index.js) — never on subsequent GETs, even for the owner,
    // since the caller already has it once they've seen it the first time.
    artworks: artworks
      .slice()
      .sort((x, y) => x.display_order - y.display_order)
      .map(publicArtwork),
  };
}

module.exports = { museumToJSON, publicArtwork };
