/**
 * Where the visitor probably is, and what they probably read.
 *
 * Two signals, both already in the browser and both free. The IANA timezone is
 * the device's own clock setting — `Europe/Moscow`, `America/New_York` — and it
 * costs nothing, needs no permission, and makes no request. The language list
 * is a preference rather than a place. They answer different questions, so the
 * page asks both: *where you are* and *what you read* are not the same fact,
 * and a Russian speaker in Boston is a different case from a German in Moscow.
 *
 * Neither is IP geolocation and neither is trying to be. A VPN does not move
 * the clock; someone who flew to Berlin for the week has moved it. That is the
 * right trade here. Nothing this decides is access control — it is courtesy —
 * and a courtesy that costs a round trip to a third-party geolocation API is
 * not one, especially when that API is blockable in several of the places this
 * is meant to be polite to. The page makes no external requests and this does
 * not change that.
 */

export type Region = 'ru' | 'eu' | 'other';

export type Visitor = {
  region: Region;
  /** Whether the browser asks for Russian ahead of English. */
  russian: boolean;
  /** What it was resolved from, so the answer can be checked rather than trusted. */
  zone: string;
  lang: string;
};

/**
 * Russia's IANA zones, west to east. Eleven offsets and twenty-six names, which
 * is why this is a list and not a prefix test: nine of them are `Asia/`.
 */
const RU_ZONES = new Set([
  'Europe/Kaliningrad',
  'Europe/Moscow',
  'Europe/Kirov',
  'Europe/Volgograd',
  'Europe/Astrakhan',
  'Europe/Saratov',
  'Europe/Ulyanovsk',
  'Europe/Samara',
  'Asia/Yekaterinburg',
  'Asia/Omsk',
  'Asia/Novosibirsk',
  'Asia/Barnaul',
  'Asia/Tomsk',
  'Asia/Novokuznetsk',
  'Asia/Krasnoyarsk',
  'Asia/Irkutsk',
  'Asia/Chita',
  'Asia/Yakutsk',
  'Asia/Khandyga',
  'Asia/Vladivostok',
  'Asia/Ust-Nera',
  'Asia/Magadan',
  'Asia/Sakhalin',
  'Asia/Srednekolymsk',
  'Asia/Kamchatka',
  'Asia/Anadyr',
]);

/**
 * Does this browser want Russian before English?
 *
 * Not "is Russian in the list anywhere". `navigator.languages` is ordered by
 * preference, so someone running an English machine with Russian installed
 * reads `['en-US', 'ru']` and should be shown English. The first tag that is
 * either language wins; anything else in front of both is ignored, because a
 * German who also reads Russian is still not asking for Russian here.
 */
function prefersRussian(langs: readonly string[]): boolean {
  for (const tag of langs) {
    const primary = tag.toLowerCase().split('-')[0];
    if (primary === 'ru') return true;
    if (primary === 'en') return false;
  }
  return false;
}

function regionOf(zone: string): Region {
  if (RU_ZONES.has(zone)) return 'ru';
  // Europe the continent, not the union: this is a timezone, so it covers the
  // UK, Norway, Switzerland, Ukraine and Istanbul as well, and the distinction
  // the page cares about is distance from Boston rather than a trade bloc.
  if (zone.startsWith('Europe/')) return 'eu';
  return 'other';
}

/**
 * Resolved once, at load. The answer cannot change without a reload, and
 * recomputing it per frame would put an `Intl` construction inside the draw
 * loop for a value that is constant.
 *
 * `?region=` and `?lang=` override both signals. Without them there is no way
 * to see what anyone else sees — the page would have to be believed rather
 * than checked, and every harness that tests this would be testing itself.
 */
export const visitor: Visitor = (() => {
  let zone = '';
  try {
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  } catch {
    // Intl is in every browser that can run the rest of this page; the catch is
    // for the ones that report a timezone they cannot then resolve.
  }
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language ?? 'en'];
  const q = new URLSearchParams(location.search);
  const forcedRegion = q.get('region');
  const forcedLang = q.get('lang');
  return {
    region:
      forcedRegion === 'ru' || forcedRegion === 'eu' || forcedRegion === 'other'
        ? forcedRegion
        : regionOf(zone),
    russian: forcedLang ? forcedLang.toLowerCase().startsWith('ru') : prefersRussian(langs),
    zone: forcedRegion ? `${zone} (forced ${forcedRegion})` : zone,
    lang: forcedLang ? `${langs[0]} (forced ${forcedLang})` : langs[0],
  };
})();
