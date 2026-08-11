const { chromium } = require('playwright');
const path = require('path');

const URL = 'https://freq-sand.vercel.app';
const OUT = process.argv[2] || '.';
const W = 430;
const H = 900;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Expo Router keeps previously-visited screens mounted but hidden, so every
 * onboarding step's inputs and "Next" all match at once. Everything here has
 * to pick the *visible* match, never the first one in the DOM.
 */
async function tapText(page, text, { exact = false } = {}) {
  const all = exact ? page.getByText(text, { exact: true }) : page.getByText(text);
  const visible = all.locator('visible=true').first();
  await visible.waitFor({ state: 'visible', timeout: 20000 });
  await visible.click();
}

async function fillVisible(page, placeholder, value) {
  const input = page.getByPlaceholder(placeholder).locator('visible=true').first();
  await input.waitFor({ state: 'visible', timeout: 20000 });
  await input.fill(value);
}

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file });
  console.log('  saved', file);
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
  });
  const page = await ctx.newPage();

  console.log('landing…');
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await wait(2500);
  await shot(page, '01-landing');

  console.log('demo sign-in → onboarding…');
  await tapText(page, 'Try the demo');
  await wait(2500);

  await fillVisible(page, 'Your first name', 'Parrv');
  await tapText(page, 'Next');
  await wait(1200);

  await fillVisible(page, '24', '19');
  await tapText(page, 'Next');
  await wait(1200);

  await fillVisible(page, 'NYU', 'NST');
  await tapText(page, 'Next');
  await wait(1200);

  await tapText(page, 'Date', { exact: true });
  await tapText(page, 'Next');
  await wait(1500);

  console.log('connect step (skip → sample profile)…');
  await shot(page, '02-connect');
  // Skip rather than connect: the seeded profile is what a demo visitor
  // actually lands on, and it exercises the same building sequence.
  await tapText(page, 'Skip for now');

  // The building screen runs a ~3.5s orchestrated sequence.
  await wait(9000);
  await shot(page, '03-archetype');

  await tapText(page, 'Enter FREQ');
  await wait(3000);

  console.log('sealed deck…');
  await page.goto(`${URL}/discover`, { waitUntil: 'domcontentloaded' });
  await wait(3500);
  await shot(page, '04-deck-sealed');

  console.log('overlap face…');
  await tapText(page, 'FLIP');
  await wait(1500);
  await shot(page, '05-deck-overlap');

  console.log('like → mutual reveal…');
  // Two nodes read "LIKE": the drag-overlay label and the button. The overlay
  // sits at opacity 0 but still counts as visible, so target the round button
  // by position instead — it is the accent-filled circle in the action row.
  const likeBtn = page.locator('div[class*="bg-primary"]').locator('visible=true').last();
  await likeBtn.click();
  await wait(4500);
  await shot(page, '06-reveal');

  console.log('chat…');
  await tapText(page, 'Say something');
  await wait(4000);
  await shot(page, '07-chat');

  await browser.close();
  console.log('done');
})().catch(async (e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
