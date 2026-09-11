/**
 * Asserts who is shown what, against real timezones and real language headers.
 *
 *   npm run dev
 *   node tools/region.mjs
 *
 * Needs Playwright on the machine; it is not a dependency of the site, which
 * has none at runtime and three to build. A global install is not on Node's
 * ESM resolution path, so `PLAYWRIGHT` takes an explicit specifier:
 *
 *   PLAYWRIGHT=/opt/homebrew/lib/node_modules/playwright/index.mjs \
 *     node tools/region.mjs
 *
 * Both halves of the claim are tested, and the second half matters more than
 * the first. Withheld detail is gone from the DOM, gone from the tab order and
 * gone from the hotspots a visitor can click — *and* still present in the HTML
 * the server sent, because the server sent the same HTML to everyone. The last
 * line of output is that fact, asserted rather than promised, so nobody reads
 * this as redaction.
 */
const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');

const ORIGIN = process.env.ORIGIN ?? 'http://localhost:5187';

/** name, IANA zone, browser locale, whether detail should be withheld. */
const CASES = [
  ['boston', 'America/New_York', 'en-US', false],
  ['tokyo', 'Asia/Tokyo', 'ja-JP', false],
  ['moscow', 'Europe/Moscow', 'ru-RU', true],
  // Nine of Russia's twenty-six zones are `Asia/`, which is why the resolver
  // carries a list instead of a prefix test. This is the case that catches it.
  ['yekaterinburg', 'Asia/Yekaterinburg', 'ru-RU', true],
  ['berlin', 'Europe/Berlin', 'de-DE', true],
  ['london', 'Europe/London', 'en-GB', true],
  // Place says no, language says yes. "From Russia" is a fact about a person.
  ['russian in boston', 'America/New_York', 'ru-RU', true],
  // And the other way: an English machine with Russian installed reports
  // ['en-US', 'ru'] and is asking for English.
  ['english, ru installed', 'America/New_York', 'en-US,ru', false],
];

const browser = await chromium.launch();
let failed = 0;

for (const [name, timezoneId, locale, withheld] of CASES) {
  for (const [size, width, height] of [
    ['desktop', 1440, 860],
    ['phone', 393, 660],
  ]) {
    const ctx = await browser.newContext({ viewport: { width, height }, timezoneId, locale });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${ORIGIN}/?reveal`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1600);

    const got = await page.evaluate(async () => {
      const { visitor } = await import('/src/region.ts');
      const href = (sel) => [...document.querySelectorAll(sel)].map((a) => a.getAttribute('href'));
      const all = href('a[href]');
      const hot = href('#hotspots a[href]');
      return {
        region: visitor.region,
        russian: visitor.russian,
        mailto: all.some((h) => h.startsWith('mailto:')),
        tel: all.some((h) => h.startsWith('tel:')),
        pdf: all.some((h) => h.includes('resume.pdf')),
        hotMail: hot.some((h) => h.startsWith('mailto:')),
        hotPdf: hot.some((h) => h.includes('resume.pdf')),
        grad: /Graduate Certificate/.test(document.getElementById('doc')?.innerText ?? ''),
      };
    });

    const want = !withheld;
    const ok =
      got.mailto === want &&
      got.tel === want &&
      got.pdf === want &&
      got.grad === want &&
      got.hotMail === want &&
      got.hotPdf === want &&
      errors.length === 0;
    if (!ok) failed++;
    console.log(
      `${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(22)} ${size.padEnd(8)} ${got.region}/${got.russian ? 'ru' : 'en'}`,
      JSON.stringify({ mail: got.mailto, tel: got.tel, pdf: got.pdf, grad: got.grad }),
      errors.length ? errors : '',
    );
    await ctx.close();
  }
}

// The disclosure, as an assertion. If this ever prints false the README is
// wrong and somebody has started believing this is redaction.
const ctx = await browser.newContext({ timezoneId: 'Europe/Moscow', locale: 'ru-RU' });
const page = await ctx.newPage();
const source = await (await page.goto(ORIGIN)).text();
const inSource = {
  email: /monasypov\.t@/.test(source),
  grad: /Graduate Certificate/.test(source),
};
console.log('\nstill in the HTML served to Moscow:', JSON.stringify(inSource));
if (!inSource.email || !inSource.grad) {
  failed++;
  console.log('FAIL — the document is meant to stay whole for crawlers and no-JS readers');
}
await ctx.close();
await browser.close();
console.log(failed ? `\n${failed} FAILING` : '\nall cases pass');
process.exit(failed ? 1 : 0);
