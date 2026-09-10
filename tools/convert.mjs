// Konvertiert die CSV-Dateien aus openpotato/kfz-kennzeichen nach JSON.
// Aufruf: node tools/convert.mjs <pfad-zu-kfz-kennzeichen/src/de> <ziel-verzeichnis>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const [src, dest] = process.argv.slice(2);
if (!src || !dest) { console.error('Aufruf: node tools/convert.mjs <src/de> <public/data>'); process.exit(1); }
mkdirSync(dest, { recursive: true });

/** Minimaler RFC-4180-Parser (Quoting + eingebettete Kommata/Zeilenumbrüche). */
function parseCsv(text) {
  const rows = []; let row = [], field = '', quoted = false;
  text = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift();
  return rows.filter(r => r.some(v => v !== ''))
             .map(r => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])));
}

const read = f => parseCsv(readFileSync(join(src, f), 'utf8'));
const write = (f, data) => {
  writeFileSync(join(dest, f), JSON.stringify(data, null, 0), 'utf8');
  console.log(`${f}: ${Array.isArray(data) ? data.length : Object.keys(data).length} Einträge`);
};

// Die Quelle hängt die Fussnotenmarke an jeden Ort einer Aufzählung, sodass
// dieselbe Nummer mehrfach in der Spalte steht.
const fussnoten = (s) =>
  s ? [...new Set(s.split(/[;,\s]+/).filter(Boolean).map(Number))].sort((a, b) => a - b) : [];

write('kennzeichen.json', read('kennzeichen.csv').map(r => ({
  z: r['Unterscheidungszeichen'],
  ort: r['StadtOderKreis'],
  herleitung: r['Herleitung'],
  land: r['Bundesland.Name'],
  landIso: r['Bundesland.Iso3166-2'],
  fussnoten: fussnoten(r['Fußnoten']),
  bemerkung: r['Bemerkung'] || null,
})));

write('auslaufend.json', read('kennzeichen.auslaufend.csv').map(r => ({
  z: r['Unterscheidungszeichen'],
  bisher: r['BisherigerVerwaltungsbezirkOderKreis'],
  abwicklung: r['Abwicklung'],
})));

write('sonderkennzeichen.json', read('sonderkennzeichen.csv').map(r => ({
  z: r['Unterscheidungszeichen'],
  typ: r['Typ'],
  bedeutung: r['Bedeutung'],
  behoerde: r['Zulassungsbehörde'] || null,
})));

write('fussnoten.json', Object.fromEntries(
  read('kennzeichen.fussnoten.csv').map(r => [r['Nummer'], r['Text']])
));
