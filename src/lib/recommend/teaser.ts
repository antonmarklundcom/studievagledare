/**
 * Gäst-teaser (docs/01 §4): förslag #1 visas i sin helhet, 2–5 visas som
 * låsta kort — programnamnet syns, motiveringen inte. Done server-side (not
 * just CSS blur) so an unregistered guest's network response never contains
 * text they haven't "earned" yet; the account-creation CTA is what unlocks it.
 */
export function applyTeaserLock<T extends { rank: number; motivation: string }>(
  items: T[],
): Array<T & { locked: boolean }> {
  return items.map((item) =>
    item.rank === 1
      ? { ...item, locked: false }
      : { ...item, motivation: '', locked: true },
  );
}
