const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const base = 'http://localhost:4173';

  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('  [browser console error]', msg.text());
  });

  await page.goto(base + '/');
  await page.click('#startBtn');
  await page.waitForURL(/\/museum\.html\?/);
  console.log('redirected to museum page:', page.url());

  await page.waitForSelector('.frame-wrap', { timeout: 5000 });
  const frameCount = await page.locator('.frame-wrap').count();
  console.log('frame count (expect 9):', frameCount);

  const topControlsOpacity = await page.locator('.top-controls').evaluate((el) => getComputedStyle(el).opacity);
  console.log('top controls visible after load (expect 1):', topControlsOpacity);

  // Open the first frame and edit its plaque
  await page.locator('.frame-wrap').first().click();
  await page.waitForSelector('.viewing-room.open');
  await page.click('#plaqueTitle');
  await page.keyboard.type('Our First Date');
  await page.click('#plaqueNote');
  await page.keyboard.type('The rooftop bar downtown');
  // give the debounced save (900ms) time to fire
  await page.waitForTimeout(1300);

  // Upload a tiny generated image into that frame
  const fs = require('fs');
  const tinyPngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64'
  );
  const tmpPath = '/tmp/test-photo.png';
  fs.writeFileSync(tmpPath, tinyPngBuffer);
  await page.setInputFiles('#bigFileInput', tmpPath);
  await page.waitForTimeout(600);
  const bigImgSrc = await page.locator('.big-frame .photo-slot img').getAttribute('src');
  console.log('uploaded photo src (expect fake.supabase.co URL):', bigImgSrc);

  await page.click('#closeViewing');
  await page.waitForTimeout(200);

  const museumUrl = new URL(page.url());
  const museumId = museumUrl.searchParams.get('id');
  const editToken = museumUrl.searchParams.get('token');

  // Reload fresh (same edit URL) to prove the title/note/photo really saved server-side,
  // not just in local memory.
  await page.reload();
  await page.waitForSelector('.frame-wrap', { timeout: 5000 });
  await page.locator('.frame-wrap').first().click();
  await page.waitForSelector('.viewing-room.open');
  const titleAfterReload = await page.locator('#plaqueTitle').textContent();
  const noteAfterReload = await page.locator('#plaqueNote').textContent();
  const imgAfterReload = await page.locator('.big-frame .photo-slot img').count();
  console.log('title survived reload (expect "Our First Date"):', JSON.stringify(titleAfterReload));
  console.log('note survived reload (expect "The rooftop bar downtown"):', JSON.stringify(noteAfterReload));
  console.log('photo survived reload (expect 1):', imgAfterReload);
  await page.click('#closeViewing');

  // Share flow: get the gift link
  await page.click('#shareToggle');
  await page.waitForSelector('#shareOverlay:not([hidden])');
  await page.click('#shareGoBtn');
  await page.waitForSelector('#shareStepDone:not([hidden])', { timeout: 5000 });
  const giftUrl = await page.inputValue('#shareLinkInput');
  console.log('gift link (expect no token param):', giftUrl);
  await page.click('#shareDoneCloseBtn');
  await page.waitForTimeout(150);

  // Visit the gift link as a fresh, separate visitor (no token)
  const giftPage = await browser.newPage();
  await giftPage.goto(giftUrl);
  await giftPage.waitForSelector('.frame-wrap', { timeout: 5000 });
  const giftTopControlsDisplay = await giftPage.locator('.reset-toggle').evaluate((el) => getComputedStyle(el).display);
  console.log('reset button hidden on gift link (expect none):', giftTopControlsDisplay);
  await giftPage.locator('.frame-wrap').first().click();
  await giftPage.waitForSelector('.viewing-room.open');
  const giftTitle = await giftPage.locator('#plaqueTitle').textContent();
  const giftEditable = await giftPage.locator('#plaqueTitle').getAttribute('contenteditable');
  console.log('gift viewer sees title (expect "Our First Date"):', JSON.stringify(giftTitle));
  console.log('gift viewer plaque editable (expect false):', giftEditable);
  await giftPage.close();

  // Back on the edit page: reset everything
  await page.click('#resetToggle');
  await page.waitForSelector('#resetOverlay:not([hidden])');
  await page.click('#resetConfirmBtn');
  await page.waitForTimeout(500);
  await page.locator('.frame-wrap').first().click();
  await page.waitForSelector('.viewing-room.open');
  const titleAfterReset = await page.locator('#plaqueTitle').textContent();
  const imgAfterReset = await page.locator('.big-frame .photo-slot img').count();
  console.log('title after reset (expect empty):', JSON.stringify(titleAfterReset));
  console.log('photo after reset (expect 0):', imgAfterReset);

  await browser.close();
  console.log('\nEnd-to-end run complete.');
})().catch((e) => {
  console.error('E2E FAILED:', e);
  process.exit(1);
});
