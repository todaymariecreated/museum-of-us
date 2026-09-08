const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const base = 'http://localhost:4173';

  await page.goto(base + '/');
  await page.click('#startBtn');
  await page.waitForURL(/\/edit\.html\?/);
  console.log('✓ redirected to edit page:', page.url());

  await page.waitForSelector('.frame');
  const frameCount = await page.locator('.frame').count();
  console.log('frame count (expect 9):', frameCount);

  // Edit the first frame's title + note and save
  const firstFrame = page.locator('.frame').first();
  await firstFrame.locator('input[placeholder="Title"]').fill('Our First Date');
  await firstFrame.locator('input[placeholder="Note"]').fill('The rooftop bar downtown');
  await firstFrame.locator('button', { hasText: 'Save' }).click();
  await page.waitForTimeout(300);
  console.log('status after save:', await page.textContent('#status'));

  // Upload a tiny generated image into the first frame
  const tinyPngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64'
  );
  const fs = require('fs');
  const tmpPath = '/tmp/test-photo.png';
  fs.writeFileSync(tmpPath, tinyPngBuffer);
  await firstFrame.locator('input[type=file]').setInputFiles(tmpPath);
  await page.waitForTimeout(600);
  console.log('status after upload:', await page.textContent('#status'));
  const hasImg = await firstFrame.locator('img').count();
  console.log('frame now shows an <img> (expect 1):', hasImg);

  // Get gift link
  await page.click('#shareBtn');
  const giftUrl = await page.textContent('#linkOut');
  console.log('gift link:', giftUrl);

  // Visit the gift link and confirm it shows what we just entered
  await page.goto(giftUrl.trim());
  await page.waitForTimeout(300);
  const giftFrameCount = await page.locator('.frame').count();
  console.log('gift page frame count (expect 1, blanks are hidden):', giftFrameCount);
  const giftTitle = await page.locator('.frame h3').first().textContent();
  console.log('gift page shows title:', giftTitle);

  // Now go back to edit and test reset
  const url = new URL(page.url());
  const museumId = new URL(giftUrl.trim()).searchParams.get('id');
  await page.goto(base + '/'); // dummy nav away, then read edit token from localStorage we saved
  const editToken = await page.evaluate((id) => {
    const saved = JSON.parse(localStorage.getItem('museumEditTokens') || '{}');
    return saved[id];
  }, museumId);
  await page.goto(base + '/edit.html?id=' + museumId + '&token=' + editToken);
  await page.waitForSelector('.frame');
  page.once('dialog', (d) => d.accept());
  await page.click('#resetBtn');
  await page.waitForTimeout(300);
  const firstTitleAfterReset = await page.locator('.frame').first().locator('input[placeholder="Title"]').inputValue();
  console.log('title after reset (expect empty):', JSON.stringify(firstTitleAfterReset));

  await browser.close();
  console.log('\nEnd-to-end run complete.');
})().catch((e) => {
  console.error('E2E FAILED:', e);
  process.exit(1);
});
