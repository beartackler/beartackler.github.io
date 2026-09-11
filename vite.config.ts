import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';

type Role = {
  titleFull?: string;
  title: string;
  orgFull: string;
  where: string;
  whenFull: string;
  detail: string[];
};
type Study = {
  school: string;
  awardFull: string;
  extra?: string;
  whenFull: string;
  /** Baked into the document for everyone; removed at runtime in Europe and Russia. */
  withheld?: boolean;
};

/**
 * Bakes a real, semantic resume into index.html at build time from the same
 * JSON the canvas reads. Crawlers, screen readers and no-JS visitors get a
 * complete document without waiting for a single frame of the grid.
 */
function resumeDocument(): Plugin {
  return {
    name: 'resume-document',
    transformIndexHtml(html) {
      const data = JSON.parse(readFileSync('src/resume.json', 'utf8'));
      const p = data.person;

      const role = (r: Role) => `
          <article>
            <h3>${esc(r.titleFull ?? r.title)}</h3>
            <p class="meta">${esc(r.orgFull)} · ${esc(r.where)} · ${esc(r.whenFull)}</p>
            <ul>${r.detail.map((d: string) => `<li>${esc(d)}</li>`).join('')}</ul>
          </article>`;

      const study = (s: Study) => `
          <article${s.withheld ? ' data-withhold' : ''}>
            <h3>${esc(s.school)}</h3>
            <p class="meta">${esc(s.awardFull)}${s.extra ? ` · ${esc(s.extra)}` : ''} · ${esc(s.whenFull)}</p>
          </article>`;

      const doc = `
    <main id="doc" tabindex="-1">
      <header>
        <h1>${esc(p.properName)}</h1>
        <p class="meta bits">
          <span data-withhold><a href="mailto:${esc(p.email)}">${esc(p.email)}</a></span>
          <span data-withhold><a href="tel:${esc(p.phoneHref)}">${esc(p.phone)}</a></span>
          <span><a href="${esc(p.githubHref)}">${esc(p.github)}</a></span>
          <span><a href="${esc(p.linkedinHref)}">${esc(p.linkedin)}</a></span>
          <span data-withhold><a href="${esc(p.resume)}">resume.pdf</a></span>
        </p>
      </header>
      <section><h2>Now</h2>${data.now.map(role).join('')}</section>
      <section><h2>Experience</h2>${data.before.map(role).join('')}</section>
      <section><h2>Education</h2>${data.edu.map(study).join('')}</section>
      <section><h2>Technical skills</h2>
        <dl>${data.skillsFull
          .map(([k, v]: [string, string]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`)
          .join('')}</dl>
      </section>
      <footer>${QUOTES.map((k: string) => data[k])
        .map(
          (q: { lines: string[]; credit: string }) =>
            `<blockquote>${q.lines.map(esc).join(' ')}</blockquote>
        <p class="meta"><cite>${esc(q.credit)}</cite></p>`,
        )
        .join('')}
      </footer>
    </main>`;

      // One closing line per act, built from the same shape. The canvas copy
      // is aria-hidden because the footer above already carries both for
      // anything that reads rather than looks.
      const quote = (id: string, q: { lines: string[]; credit: string }) => `
    <figure id="${id}" class="coda" aria-hidden="true">
      <blockquote>${q.lines.map((l: string) => `<span>${esc(l)}</span>`).join('')}</blockquote>
      <figcaption>${esc(q.credit)}</figcaption>
    </figure>`;
      const coda = QUOTES.map((k: string) => quote(k, data[k])).join('');

      // The way out. Same data as the header above, because someone who has
      // just scrolled through the whole gallery should not have to scroll back
      // up to find out how to get in touch.
      //
      // The header's contacts are spans with their separators in CSS rather than
      // in the markup, because some of them are removed at runtime for visitors
      // in Europe and Russia and a middot baked between two anchors outlives the
      // anchor it was separating.
      //
      // These links are real: in the tab order, in the accessibility tree, and
      // announced. `visibility: hidden` takes the whole block out of both until
      // the scroll brings it in, which is what stops a screen reader meeting a
      // sign-off at the top of the page. The decorative bits — the blinking
      // block and the rule — are hidden by hand, because they are texture.
      const outro = `
    <div id="outro">
      <p class="outro-mark" aria-hidden="true"><span>&#9608;</span></p>
      <p class="outro-lede">that's all of it.</p>
      <p class="outro-rule" aria-hidden="true">...'''::::---===+++**##@@##**+++===---::::'''...</p>
      <ul class="outro-links">
        <li data-withhold><a href="mailto:${esc(p.email)}">${esc(p.email)}</a></li>
        <li><a href="${esc(p.githubHref)}">${esc(p.github)}</a></li>
        <li><a href="${esc(p.linkedinHref)}">${esc(p.linkedin)}</a></li>
      </ul>
      <p class="outro-acts">
        <a href="${esc(p.resume)}" target="_blank" rel="noopener" data-withhold>resume.pdf</a>
        <button id="to-top" type="button">back to the top</button>
      </p>
    </div>`;

      const head = `
    <meta name="description" content="${esc(p.summary)}" />
    <meta property="og:title" content="${esc(p.properName)}" />
    <meta property="og:description" content="${esc(p.summary)}" />
    <meta property="og:type" content="profile" />
    <meta property="og:url" content="https://beartackler.github.io/" />
    <meta property="og:image" content="https://beartackler.github.io/og.png" />
    <meta property="og:image:width" content="2400" />
    <meta property="og:image:height" content="1260" />
    <meta property="og:image:alt" content="A plum branch drawn in ASCII across the top of a black page, with four overlapping rings below it." />
    <meta name="twitter:card" content="summary_large_image" />
    <script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: p.properName,
      email: `mailto:${p.email}`,
      telephone: p.phoneHref,
      url: 'https://beartackler.github.io/',
      sameAs: [p.githubHref, p.linkedinHref],
      description: p.summary,
      alumniOf: { '@type': 'CollegeOrUniversity', name: 'Northeastern University' },
      worksFor: { '@type': 'Organization', name: data.now[0].orgFull },
      jobTitle: data.now[0].title,
    })}<\/script>`;

      return html
        .replace('<!--DOC-->', doc)
        .replace('<!--CODA-->', coda)
        .replace('<!--OUTRO-->', outro)
        .replace('<!--HEAD-->', head);
    },
  };
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

/**
 * The gallery's closing lines, in running order.
 *
 * One list, read by both the visual figures and the semantic footer, so a new
 * slide cannot end up drawn but unreadable — or credited in the document and
 * missing from the page.
 */
const QUOTES = ['coda', 'drive', 'sisyphus', 'iron', 'walle', 'hole'];

export default defineConfig({
  plugins: [resumeDocument()],
  build: { target: 'es2022', assetsInlineLimit: 0 },
});
