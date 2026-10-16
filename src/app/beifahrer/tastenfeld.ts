/**
 * Logik des Buchstabenfelds: zu jedem bereits getippten Präfix die Buchstaben,
 * mit denen ein gültiges Unterscheidungszeichen weitergeht.
 *
 * Bewusst frei von Angular, damit sie ohne Testbed prüfbar ist.
 */
export function folgebuchstaben(codes: Iterable<string>): Map<string, Set<string>> {
  const karte = new Map<string, Set<string>>();
  for (const z of codes) {
    for (let i = 0; i < z.length; i++) {
      const praefix = z.slice(0, i);
      let menge = karte.get(praefix);
      if (!menge) {
        menge = new Set<string>();
        karte.set(praefix, menge);
      }
      menge.add(z[i]);
    }
  }
  return karte;
}
