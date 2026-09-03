import { analysiere, herleitungSegmente, normalisiere, parseErkennungsnummer } from './kennzeichen.parser';
import type { Datenbestand } from './kennzeichen.parser';

const daten: Datenbestand = {
  aktuell: [
    { z: 'MS', ort: 'Münster, Stadt', herleitung: 'MünSter', land: 'Nordrhein-Westfalen', landIso: 'DE-NW', fussnoten: [], bemerkung: null },
    { z: 'AB', ort: 'Aschaffenburg', herleitung: 'AschaffenBurg', land: 'Bayern', landIso: 'DE-BY', fussnoten: [1], bemerkung: null },
    { z: 'B', ort: 'Berlin', herleitung: 'Berlin', land: 'Berlin', landIso: 'DE-BE', fussnoten: [], bemerkung: null },
  ],
  auslaufend: [{ z: 'AL', bisher: 'Altena', abwicklung: 'Märkischer Kreis' }],
  sonder: [{ z: 'THW', typ: 'Bund', bedeutung: 'Technisches Hilfswerk', behoerde: null }],
  fussnoten: { '1': 'Stadt- und Landkreis führen das gleiche Unterscheidungszeichen.' },
};

describe('normalisiere', () => {
  it('vereinheitlicht Schreibweise und Trennzeichen', () => {
    expect(normalisiere(' ms–ab  123 ')).toBe('MS-AB 123');
  });
});

describe('analysiere', () => {
  it('trennt bei vorhandenem Bindestrich', () => {
    expect(analysiere('MS-AB 123', daten).unterscheidungszeichen).toBe('MS');
  });

  it('erkennt das Zeichen auch ohne Trennzeichen (längste Übereinstimmung)', () => {
    expect(analysiere('msab123', daten).unterscheidungszeichen).toBe('MS');
  });

  it('bevorzugt das längere Zeichen gegenüber dem kürzeren', () => {
    expect(analysiere('AB1234', daten).unterscheidungszeichen).toBe('AB');
  });

  it('liefert die Fußnoten im Volltext', () => {
    const a = analysiere('AB-C 1', daten);
    expect(a.fussnoten).toEqual([{ nummer: 1, text: daten.fussnoten['1'] }]);
  });

  it('findet Sonderkennzeichen', () => {
    expect(analysiere('THW-91234', daten).sonder[0].typ).toBe('Bund');
  });

  it('findet auslaufende Zeichen', () => {
    expect(analysiere('AL-X 1', daten).auslaufend).toHaveLength(1);
  });

  it('meldet unbekannte Zeichen und schlägt Ähnliches vor', () => {
    const a = analysiere('MZ-A 1', daten);
    expect(a.fehler).toContain('MZ');
    expect(a.vorschlaege).toContain('MS');
  });
});

describe('parseErkennungsnummer', () => {
  it('erkennt das E für Elektrofahrzeuge', () => {
    expect(parseErkennungsnummer('MW 4711E')?.suffix).toBe('E');
  });

  it('erkennt Saisonkennzeichen', () => {
    expect(parseErkennungsnummer('XY 42 03-11')?.saison).toEqual({ von: 3, bis: 11 });
  });

  it('erkennt rote Händlerkennzeichen', () => {
    expect(parseErkennungsnummer('06123')?.hinweise.join(' ')).toContain('Händlerkennzeichen');
  });
});

describe('herleitungSegmente', () => {
  it('hebt die namensgebenden Buchstaben hervor', () => {
    expect(herleitungSegmente('MünSter').filter((s) => s.hervorgehoben).map((s) => s.text))
      .toEqual(['M', 'S']);
  });
});
