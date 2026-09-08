// The gallery's fixed wall layout — same frame positions as the original
// single-artifact version of Museum of Us. Every new museum starts with
// these 9 frames, all blank.

const DEFAULT_ARTWORKS = [
  { display_order: 1, frame: 1, pos_x: 6, pos_y: 16, width: 14.5, rotation: -2.2, side: null },
  { display_order: 2, frame: 6, pos_x: 8.4, pos_y: 44, width: 13, rotation: 2, side: 'left' },
  { display_order: 3, frame: 3, pos_x: 25, pos_y: 26.4, width: 12.7, rotation: -1.5, side: null },
  { display_order: 4, frame: 4, pos_x: 41.4, pos_y: 31.8, width: 17, rotation: 0, side: null },
  { display_order: 5, frame: 7, pos_x: 31.5, pos_y: 56, width: 13, rotation: 1.8, side: 'left' },
  { display_order: 6, frame: 8, pos_x: 55.8, pos_y: 56.4, width: 12.7, rotation: -1.8, side: 'right' },
  { display_order: 7, frame: 5, pos_x: 61.6, pos_y: 27.7, width: 13, rotation: 1.5, side: null },
  { display_order: 8, frame: 2, pos_x: 77.5, pos_y: 16, width: 14.75, rotation: 2.2, side: null },
  { display_order: 9, frame: 9, pos_x: 78.1, pos_y: 43.9, width: 14.5, rotation: -2, side: 'right' },
];

const BLANK_ARTWORK_TEXT = {
  title: '',
  medium: 'Photograph',
  year: '2026',
  note: '',
};

module.exports = { DEFAULT_ARTWORKS, BLANK_ARTWORK_TEXT };
