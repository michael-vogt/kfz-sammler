import {
  Analyse,
  AuslaufendesKennzeichen,
  Erkennungsnummer,
  Fussnoten,
  HerleitungSegment,
  Kennzeichen,
  Sonderkennzeichen,
} from './kennzeichen.model';

/** Alle Datensätze, gebündelt – wird vom Service geladen und hier nur gelesen. */
export interface Datenbestand {
  aktuell: Kennzeichen[];
  auslaufend: AuslaufendesKennzeichen[];
  sonder: Sonderkennzeichen[];
  fussnoten: Fussnoten;
}

const MAX_LAENGE_UZ = 3;
const BUCHSTABE = 'A-ZÄÖÜ';

/**
 * Vereinheitlicht die Eingabe: Grossschreibung, einheitliche Trennzeichen,
 * keine doppelten Leerzeichen. Umlaute bleiben erhalten (z. B. "MÜ" für Mühldorf).
 */
export function normalisiere(eingabe: string): string {
  return eingabe
    .toUpperCase()
    .replace(/[\u2010-\u2015\u2212_]/g, '-') // diverse Bindestrich-Varianten
    .replace(/\s+/g, ' ')
    .trim();
}

/** Zerlegt die Herleitung in hervorgehobene und normale Segmente. */
export function herleitungSegmente(herleitung: string): HerleitungSegment[] {
  const segmente: HerleitungSegment[] = [];
  for (const zeichen of herleitung) {
    const hervorgehoben = zeichen !== zeichen.toLowerCase();
    const letztes = segmente[segmente.length - 1];
    if (letztes && letztes.hervorgehoben === hervorgehoben) {
      letztes.text += zeichen;
    } else {
      segmente.push({ text: zeichen, hervorgehoben });
    }
  }
  return segmente;
}

/**
 * Trennt Unterscheidungszeichen und Erkennungsnummer.
 * Mit Bindestrich wird dieser respektiert, sonst greift die längste Übereinstimmung
 * (max. 3 Zeichen) gegen die bekannten Unterscheidungszeichen.
 */
function trenne(
  normalisiert: string,
  bekannt: Set<string>,
): { uz: string; rest: string } | null {
  const mitTrenner = normalisiert.match(new RegExp(`^([${BUCHSTABE}0-9]{1,3})\\s*-\\s*(.*)$`));
  if (mitTrenner) {
    return { uz: mitTrenner[1], rest: mitTrenner[2].trim() };
  }

  const kompakt = normalisiert.replace(/\s+/g, '');
  for (let laenge = Math.min(MAX_LAENGE_UZ, kompakt.length); laenge >= 1; laenge--) {
    const kandidat = kompakt.slice(0, laenge);
    if (bekannt.has(kandidat)) {
      return { uz: kandidat, rest: kompakt.slice(laenge) };
    }
  }

  // Nichts erkannt: den führenden Buchstabenblock als Vermutung zurückgeben.
  const vermutung = kompakt.match(new RegExp(`^[${BUCHSTABE}0-9]{1,3}`));
  return vermutung ? { uz: vermutung[0], rest: kompakt.slice(vermutung[0].length) } : null;
}

const MONATE = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

/** Liest den Teil hinter dem Unterscheidungszeichen und erklärt seine Bestandteile. */
export function parseErkennungsnummer(rest: string): Erkennungsnummer | null {
  const roh = rest.replace(/\s+/g, ' ').trim();
  if (!roh) return null;

  const treffer = roh.match(
    new RegExp(`^([${BUCHSTABE}]{0,2})[\\s-]*(\\d{1,4})\\s*([EH])?(?:\\s*(\\d{1,2})\\s*-\\s*(\\d{1,2}))?$`),
  );
  if (!treffer) return null;

  const [, buchstaben, ziffern, suffix, saisonVon, saisonBis] = treffer;
  const hinweise: string[] = [];

  if (buchstaben) {
    hinweise.push(
      `Erkennungsnummer: ${buchstaben.length} Buchstabe${buchstaben.length > 1 ? 'n' : ''} ` +
        `und ${ziffern.length} Ziffer${ziffern.length > 1 ? 'n' : ''} – frei vergeben ` +
        `bzw. als Wunschkennzeichen reservierbar.`,
    );
  } else {
    hinweise.push(`Erkennungsnummer ohne Buchstabenteil (${ziffern.length}-stellig).`);
  }

  if (suffix === 'E') {
    hinweise.push('Das nachgestellte „E“ kennzeichnet ein Elektrofahrzeug (§ 9a FZV / EmoG).');
  }
  if (suffix === 'H') {
    hinweise.push(
      'Das nachgestellte „H“ steht für ein historisches Fahrzeug (Oldtimer, mindestens 30 Jahre alt).',
    );
  }

  let saison: Erkennungsnummer['saison'] = null;
  if (saisonVon && saisonBis) {
    const von = Number(saisonVon);
    const bis = Number(saisonBis);
    if (von >= 1 && von <= 12 && bis >= 1 && bis <= 12) {
      saison = { von, bis };
      hinweise.push(
        `Saisonkennzeichen: gültig von ${MONATE[von - 1]} bis einschliesslich ${MONATE[bis - 1]}.`,
      );
    }
  }

  // Sondernummernkreise: erkennbar an den führenden Ziffern (§§ 41 ff. FZV).
  if (!buchstaben) {
    const kreis: Record<string, string> = {
      '03': 'Kurzzeitkennzeichen: nur für Probe- und Überführungsfahrten, maximal fünf Tage gültig.',
      '04': 'Kurzzeitkennzeichen: nur für Probe- und Überführungsfahrten, maximal fünf Tage gültig.',
      '06': 'Rotes Händlerkennzeichen: wiederverwendbar, für Prüfungs-, Probe- und Überführungsfahrten.',
      '07': 'Rotes Oldtimerkennzeichen: für Probe- und Überführungsfahrten mit Oldtimern.',
    };
    const hinweis = kreis[ziffern.slice(0, 2)];
    if (hinweis && ziffern.length >= 4) hinweise.push(hinweis);
  }

  return {
    buchstaben,
    ziffern,
    suffix: (suffix as 'E' | 'H') ?? null,
    saison,
    hinweise,
  };
}

/** Levenshtein-Distanz für Vorschläge bei Tippfehlern. */
function distanz(a: string, b: string): number {
  const zeile = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let vorher = zeile[0];
    zeile[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = zeile[j];
      zeile[j] = Math.min(
        zeile[j] + 1,
        zeile[j - 1] + 1,
        vorher + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      vorher = temp;
    }
  }
  return zeile[b.length];
}

/** Analysiert eine komplette Kennzeichen-Eingabe gegen den Datenbestand. */
export function analysiere(eingabe: string, daten: Datenbestand): Analyse {
  const normalisiert = normalisiere(eingabe);
  const leer: Analyse = {
    eingabe,
    normalisiert,
    unterscheidungszeichen: null,
    erkennungsnummer: null,
    aktuell: [],
    auslaufend: [],
    sonder: [],
    fussnoten: [],
    fehler: null,
    vorschlaege: [],
  };

  if (!normalisiert) return leer;

  const bekannt = new Set<string>([
    ...daten.aktuell.map((k) => k.z),
    ...daten.auslaufend.map((k) => k.z),
    ...daten.sonder.map((k) => k.z),
  ]);

  const teile = trenne(normalisiert, bekannt);
  if (!teile) {
    return { ...leer, fehler: 'Die Eingabe enthält kein gültiges Unterscheidungszeichen.' };
  }

  const { uz, rest } = teile;
  const aktuell = daten.aktuell.filter((k) => k.z === uz);
  const auslaufend = daten.auslaufend.filter((k) => k.z === uz);
  const sonder = daten.sonder.filter((k) => k.z === uz);

  const nummern = [...new Set(aktuell.flatMap((k) => k.fussnoten))].sort((a, b) => a - b);
  const fussnoten = nummern
    .filter((n) => daten.fussnoten[String(n)])
    .map((n) => ({ nummer: n, text: daten.fussnoten[String(n)] }));

  const gefunden = aktuell.length + auslaufend.length + sonder.length > 0;

  return {
    ...leer,
    unterscheidungszeichen: uz,
    erkennungsnummer: parseErkennungsnummer(rest),
    aktuell,
    auslaufend,
    sonder,
    fussnoten,
    fehler: gefunden ? null : `„${uz}“ ist kein bekanntes Unterscheidungszeichen.`,
    vorschlaege: gefunden
      ? []
      : [...bekannt]
          .map((z) => ({ z, d: distanz(uz, z) }))
          .filter((e) => e.d <= 1)
          .sort((a, b) => a.d - b.d || a.z.localeCompare(b.z, 'de'))
          .slice(0, 6)
          .map((e) => e.z),
  };
}
