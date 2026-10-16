import { SammelcodeFehler, dekodieren, indexErzeugen, kodieren, pruefsumme } from './sammelcode';

describe('Sammelcode', () => {
  const index = indexErzeugen(['MS', 'B', 'AB', 'MÜ', 'ESB', 'GAP', 'HH']);

  const hinUndZurueck = (zeichen: string[]) => dekodieren(kodieren(new Set(zeichen), index), index);

  it('sortiert den Index unabhängig von der Spracheinstellung', () => {
    // Bewusst Code-Einheiten-Reihenfolge: localeCompare('de') würde die
    // Umlaute einsortieren und je nach Gerät abweichen.
    expect(index).toEqual(['AB', 'B', 'ESB', 'GAP', 'HH', 'MS', 'MÜ']);
  });

  it('entfernt Dubletten aus dem Index', () => {
    expect(indexErzeugen(['MS', 'MS', 'B'])).toEqual(['B', 'MS']);
  });

  it('führt einen Round-Trip verlustfrei aus', () => {
    expect(hinUndZurueck(['MS', 'MÜ', 'HH']).sort()).toEqual(['HH', 'MS', 'MÜ']);
  });

  it('verträgt die leere Sammlung', () => {
    expect(hinUndZurueck([])).toEqual([]);
  });

  it('verträgt die vollständige Sammlung', () => {
    expect(hinUndZurueck([...index])).toEqual(index);
  });

  it('trifft das erste und das letzte Bit genau', () => {
    expect(hinUndZurueck([index[0]])).toEqual([index[0]]);
    expect(hinUndZurueck([index.at(-1)!])).toEqual([index.at(-1)!]);
  });

  it('erzeugt einen Code aus Großbuchstaben, Ziffern und Bindestrich', () => {
    // Nur dann nutzt der QR-Code den kompakteren alphanumerischen Modus.
    expect(kodieren(new Set(['MS']), index)).toMatch(/^[A-Z0-9-]+$/);
  });

  it('toleriert Kleinschreibung und Leerzeichen beim Einlesen', () => {
    const code = kodieren(new Set(['MS', 'B']), index);
    const verunstaltet = `  ${code.toLowerCase().replace('-', ' - ')}  `;
    expect(dekodieren(verunstaltet, index).sort()).toEqual(['B', 'MS']);
  });

  describe('Prüfsumme', () => {
    it('ist für denselben Index stabil', () => {
      expect(pruefsumme(index)).toBe(pruefsumme(indexErzeugen([...index].reverse())));
    });

    it('ändert sich, sobald ein Zeichen dazukommt', () => {
      expect(pruefsumme(indexErzeugen([...index, 'XY']))).not.toBe(pruefsumme(index));
    });

    it('verhindert das Einlesen bei abweichendem Datenstand', () => {
      // Der gefährlichste Fall: verschobene Bitpositionen würden sonst
      // stillschweigend die falschen Kennzeichen eintragen.
      const code = kodieren(new Set(['MS']), index);
      const andererIndex = indexErzeugen([...index, 'XY']);
      expect(() => dekodieren(code, andererIndex)).toThrow(SammelcodeFehler);
    });
  });

  describe('fehlerhafte Eingaben', () => {
    for (const unsinn of ['', 'hallo', 'K1-ABC', 'K2-AAAAAAA-AA', 'K1--']) {
      it(`weist ${JSON.stringify(unsinn)} ab`, () => {
        expect(() => dekodieren(unsinn, index)).toThrow(SammelcodeFehler);
      });
    }

    it('weist einen abgeschnittenen Code ab', () => {
      const code = kodieren(new Set(index), index);
      expect(() => dekodieren(code.slice(0, code.length - 2), index)).toThrow(SammelcodeFehler);
    });
  });
});
