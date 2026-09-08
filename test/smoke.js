const assert = require('assert');
const path = require('path');
const Module = require('module');

const { makeFakeDb } = require('./fakeDb');
const fakeDb = makeFakeDb();

// Inject the fake DB in place of the real supabaseAdmin module before
// anything requires it, so the route handlers under test never touch the
// real @supabase/supabase-js client.
const supabaseAdminPath = require.resolve('../lib/supabaseAdmin');
require.cache[supabaseAdminPath] = {
  id: supabaseAdminPath,
  filename: supabaseAdminPath,
  loaded: true,
  exports: { supabaseAdmin: () => fakeDb },
};

const createHandler = require('../api/museums/index.js');
const museumHandler = require('../api/museums/[id]/index.js');
const photoHandler = require('../api/museums/[id]/photo.js');

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

async function run() {
  // 1. Create a museum
  let res = makeRes();
  await createHandler({ method: 'POST', body: {}, query: {} }, res);
  assert.strictEqual(res.statusCode, 201, 'create should return 201');
  assert.ok(res.body.id, 'create should return an id');
  assert.ok(res.body.editToken, 'create should return an editToken');
  const { id, editToken } = res.body;
  console.log('✓ create museum', { id, editToken });

  // 2. GET without a token should be public (canEdit false) and never leak the token
  res = makeRes();
  await museumHandler({ method: 'GET', query: { id } }, res);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.canEdit, false, 'no token supplied -> canEdit false');
  assert.strictEqual(res.body.editToken, undefined, 'editToken must never appear in GET response');
  assert.strictEqual(res.body.artworks.length, 9, 'should have 9 default artworks');
  console.log('✓ public GET has no edit rights and no leaked token');

  // 3. GET with the WRONG token should also be public
  res = makeRes();
  await museumHandler({ method: 'GET', query: { id, token: 'not-the-real-token' } }, res);
  assert.strictEqual(res.body.canEdit, false, 'wrong token -> canEdit false');
  console.log('✓ wrong token is rejected (canEdit false)');

  // 4. GET with the RIGHT token should grant edit rights
  res = makeRes();
  await museumHandler({ method: 'GET', query: { id, token: editToken } }, res);
  assert.strictEqual(res.body.canEdit, true, 'right token -> canEdit true');
  const firstArtworkId = res.body.artworks[0].id;
  console.log('✓ right token grants edit rights');

  // 5. PATCH without the right token should be refused
  res = makeRes();
  await museumHandler(
    { method: 'PATCH', query: { id }, body: { token: 'wrong', title: 'Hacked' } },
    res
  );
  assert.strictEqual(res.statusCode, 403, 'wrong token PATCH should be 403');
  console.log('✓ PATCH refused without the right token');

  // 6. PATCH with the right token should update title + one artwork's text
  res = makeRes();
  await museumHandler(
    {
      method: 'PATCH',
      query: { id },
      body: {
        token: editToken,
        title: 'Our First Year',
        artworks: [{ id: firstArtworkId, title: 'Our First Date', note: 'The rooftop bar' }],
      },
    },
    res
  );
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.title, 'Our First Year');
  assert.strictEqual(res.body.artworks[0].title, 'Our First Date');
  assert.strictEqual(res.body.artworks[0].note, 'The rooftop bar');
  console.log('✓ PATCH updates title and artwork fields');

  // 7. Photo upload with the right token should store a public URL
  const tinyJpegBase64 =
    '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9k=';
  res = makeRes();
  await photoHandler(
    {
      method: 'POST',
      query: { id },
      body: { token: editToken, artworkId: firstArtworkId, dataUrl: `data:image/jpeg;base64,${tinyJpegBase64}` },
    },
    res
  );
  assert.strictEqual(res.statusCode, 200, JSON.stringify(res.body));
  assert.ok(res.body.imageUrl && res.body.imageUrl.startsWith('https://'), 'should return a public URL');
  console.log('✓ photo upload stores file and returns public URL:', res.body.imageUrl);

  // 8. Reset should blank the artwork we just edited
  res = makeRes();
  await museumHandler(
    { method: 'POST', query: { id, action: 'reset' }, body: { token: editToken } },
    res
  );
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.artworks[0].title, '', 'reset should blank the title');
  assert.strictEqual(res.body.artworks[0].imageUrl, null, 'reset should clear the image');
  console.log('✓ reset blanks title, medium/year/note, and photo');

  console.log('\nAll smoke tests passed.');
}

run().catch((err) => {
  console.error('SMOKE TEST FAILED:', err);
  process.exit(1);
});
