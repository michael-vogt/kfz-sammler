import { folgebuchstaben } from './tastenfeld';

describe('folgebuchstaben', () => {
  const codes = ['B', 'BA', 'BAD', 'MS', 'MÜ', 'ESB'];
  const karte = folgebuchstaben(codes);

  const bei = (praefix: string) => [...(karte.get(praefix) ?? [])].sort();

  it('gibt am Anfang alle Anfangsbuchstaben frei', () => {
    expect(bei('')).toEqual(['B', 'E', 'M']);
  });

  it('schränkt nach dem ersten Buchstaben ein', () => {
    expect(bei('M')).toEqual(['S', 'Ü']);
  });

  it('behandelt Umlaute wie normale Buchstaben', () => {
    expect(karte.get('M')?.has('Ü')).toBe(true);
  });

  it('gibt eine Fortsetzung frei, auch wenn das Präfix selbst gültig ist', () => {
    // "B" ist Berlin, "BA" und "BAD" existieren trotzdem.
    expect(bei('B')).toEqual(['A']);
  });

  it('liefert für ein vollständiges Zeichen ohne Verlängerung nichts', () => {
    expect(karte.get('MS')).toBeUndefined();
  });

  it('macht jedes Zeichen über das Tastenfeld erreichbar', () => {
    for (const z of codes) {
      let praefix = '';
      for (const buchstabe of z) {
        expect(karte.get(praefix)?.has(buchstabe)).toBe(true);
        praefix += buchstabe;
      }
    }
  });

  it('erzeugt keine Sackgassen', () => {
    const gueltig = new Set(codes);
    for (const praefix of karte.keys()) {
      if (!praefix) continue;
      // Jedes erreichbare Präfix ist entweder selbst gültig oder lässt sich fortsetzen.
      expect(gueltig.has(praefix) || (karte.get(praefix)?.size ?? 0) > 0).toBe(true);
    }
  });
});
