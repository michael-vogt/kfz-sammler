/**
 * Kodiert eine Sammlung als kurzen Text, der in einen QR-Code passt.
 *
 * Aufbau: `K1-<PRÜFSUMME>-<BITFELD>`, zum Beispiel
 * `K1-7FQ2MXA-AAQEBAAA…`. Jedes bekannte Unterscheidungszeichen belegt ein Bit;
 * bei 769 Zeichen sind das 97 Byte, als Base32 rund 156 Zeichen.
 *
 * Alles ist Großbuchstabe oder Ziffer, damit der QR-Code den kompakteren
 * alphanumerischen Modus nutzen kann.
 *
 * Bewusst frei von Angular, damit die Logik ohne Testbed prüfbar ist.
 */

const PRAEFIX = 'K1';
const TRENNER = '-';

/** RFC-4648-Alphabet, ohne Polsterung. Alle Zeichen sind QR-alphanumerisch. */
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export class SammelcodeFehler extends Error {}

/**
 * Bringt die Zeichenliste in eine über Geräte hinweg identische Reihenfolge.
 *
 * Bewusst kein `localeCompare`: dessen Ergebnis hängt von der ICU-Version des
 * Geräts ab, und schon eine abweichende Einsortierung der Umlaute würde die
 * Bitpositionen verschieben.
 */
export function indexErzeugen(codes: Iterable<string>): string[] {
  return [...new Set(codes)].sort();
}

/**
 * Prüfsumme über die Zeichenliste (FNV-1a, 32 Bit).
 *
 * Sie verhindert den gefährlichsten Fehlerfall: Zwei Geräte mit
 * unterschiedlichen Datenständen hätten verschobene Bitpositionen, und der
 * Abgleich würde stillschweigend die falschen Kennzeichen eintragen.
 */
export function pruefsumme(index: readonly string[]): string {
  let hash = 0x811c9dc5;
  const text = index.join(',');
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    // FNV-Primzahl 16777619, in 32-Bit-Arithmetik
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  let aus = '';
  for (let i = 0; i < 7; i++) {
    aus = BASE32[hash & 31] + aus;
    hash >>>= 5;
  }
  return aus;
}

function base32Kodieren(bytes: Uint8Array): string {
  let aus = '';
  let puffer = 0;
  let bits = 0;

  for (const byte of bytes) {
    puffer = (puffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      aus += BASE32[(puffer >> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  // Rest mit Nullen auffüllen – die Länge des Bitfelds ist ohnehin bekannt.
  if (bits > 0) aus += BASE32[(puffer << (5 - bits)) & 31];
  return aus;
}

function base32Dekodieren(text: string): Uint8Array {
  const bytes: number[] = [];
  let puffer = 0;
  let bits = 0;

  for (const zeichen of text) {
    const wert = BASE32.indexOf(zeichen);
    if (wert < 0) throw new SammelcodeFehler('Der Code enthält ungültige Zeichen.');
    puffer = (puffer << 5) | wert;
    bits += 5;
    if (bits >= 8) {
      bytes.push((puffer >> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Uint8Array.from(bytes);
}

/** Verpackt die gesammelten Zeichen in einen Sammelcode. */
export function kodieren(gesammelt: Iterable<string>, index: readonly string[]): string {
  const menge = gesammelt instanceof Set ? gesammelt : new Set(gesammelt);
  const bytes = new Uint8Array(Math.ceil(index.length / 8));

  index.forEach((z, i) => {
    if (menge.has(z)) bytes[i >> 3] |= 0x80 >> (i & 7);
  });

  return [PRAEFIX, pruefsumme(index), base32Kodieren(bytes)].join(TRENNER);
}

/**
 * Liest einen Sammelcode zurück. Wirft einen SammelcodeFehler mit einer
 * Meldung, die direkt angezeigt werden kann.
 */
export function dekodieren(code: string, index: readonly string[]): string[] {
  const sauber = code.trim().toUpperCase().replace(/\s+/g, '');
  const teile = sauber.split(TRENNER);

  if (teile.length !== 3 || teile[0] !== PRAEFIX) {
    throw new SammelcodeFehler('Das ist kein Sammelcode dieser App.');
  }

  if (teile[1] !== pruefsumme(index)) {
    throw new SammelcodeFehler(
      'Die beiden Geräte haben unterschiedliche Kennzeichendaten. ' +
        'Bringt beide Apps auf denselben Stand und versucht es erneut.',
    );
  }

  const bytes = base32Dekodieren(teile[2]);
  if (bytes.length < Math.ceil(index.length / 8)) {
    throw new SammelcodeFehler('Der Code ist unvollständig.');
  }

  return index.filter((_, i) => (bytes[i >> 3] & (0x80 >> (i & 7))) !== 0);
}
