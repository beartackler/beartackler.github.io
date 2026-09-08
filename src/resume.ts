/**
 * Typed view over resume.json.
 *
 * The data lives in JSON so that vite.config.ts can read the very same file
 * with `fs.readFileSync` and bake a semantic HTML resume into index.html at
 * build time. One source of truth for the grid, the screen reader, the plain
 * view, and the crawler.
 */

import data from './resume.json';

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
};

export const PERSON = data.person;
export const NOW = data.now as Role[];
export const BEFORE = data.before as Role[];
export const EDU = data.edu as Study[];
/** `[label, lines]` — a definition block, not a flat list. */
export type Craft = [string, string[]];

export const MAKES = data.makes as Craft[];
