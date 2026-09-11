/**
 * Typed view over resume.json.
 *
 * The data lives in JSON so that vite.config.ts can read the very same file
 * with `fs.readFileSync` and bake a semantic HTML resume into index.html at
 * build time. One source of truth for the grid, the screen reader, the plain
 * view, and the crawler.
 */

import data from './resume.json';
import { visitor } from './region';

/**
 * Whether this visitor is shown the withheld half of the resume.
 *
 * Contact detail and one study are held back in Europe and Russia. That is a
 * preference of Timur's, and it is worth being exact about what it is and is
 * not. It is a display filter: the same index.html is served to everyone, so
 * every withheld string is still in the page source, still in the structured
 * data a crawler reads, and still one query parameter away. The PDF stays at
 * its own public URL whether or not anything links to it.
 *
 * So this stops a European visitor *reading* a phone number off the page. It
 * does not stop anyone who goes looking, and nothing served from a static host
 * could — that needs a server that sees the request, which GitHub Pages is
 * not.
 *
 * Language counts as well as place. Someone whose browser asks for Russian
 * ahead of English is a Russian-speaking visitor wherever the clock says they
 * are, and "from Russia" is a fact about a person rather than about a
 * timezone. It costs something — a Russian-speaking recruiter in Boston is
 * withheld from too — and that is the trade the second signal was picked for.
 */
export const WITHHOLD = visitor.region === 'ru' || visitor.region === 'eu' || visitor.russian;

export type Role = {
  title: string;
  titleFull?: string;
  org: string;
  orgFull: string;
  where: string;
  when: string;
  whenFull: string;
  detail: string[];
};

export type Study = {
  school: string;
  award: string;
  awardFull: string;
  extra?: string;
  when: string;
  whenFull: string;
  /** Held back in Europe and Russia. Baked into the document either way. */
  withheld?: boolean;
};

export const PERSON = data.person;
export const NOW = data.now as Role[];
export const BEFORE = data.before as Role[];
export const EDU = (data.edu as Study[]).filter((s) => !(WITHHOLD && s.withheld));
/** `[label, lines]` — a definition block, not a flat list. */
export type Craft = [string, string[]];

export const MAKES = data.makes as Craft[];
