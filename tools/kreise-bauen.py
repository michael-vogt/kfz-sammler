#!/usr/bin/env python3
"""
Erzeugt public/data/kreise.json aus einer Kreis-GeoJSON und kennzeichen.json.

Ergebnis je Kreis: amtlicher Schlüssel, Name, Bundesland, zugeordnete
Unterscheidungszeichen und ein fertig projizierter, vereinfachter SVG-Pfad.
Die Projektion passiert hier, damit die App keine Geo-Bibliothek braucht.

Aufruf: python3 tools/kreise_bauen.py <counties.geojson> <kennzeichen.json> <ziel.json>
"""
import json
import math
import re
import sys

# Kreise, deren Name in den Kennzeichendaten anders geschrieben ist als in der
# Geometrie – oder die seit der Gebietsreform anders zugeschnitten sind.
# Schlüssel: Unterscheidungszeichen, Wert: Kreisnamen aus der GeoJSON.
KORREKTUREN = {
    'AC':  ['Städteregion Aachen'],
    'BRB': ['Brandenburg an der Havel'],
    'F':   ['Frankfurt am Main'],
    'H':   ['Region Hannover'],
    'HGW': ['Vorpommern-Greifswald'],
    'HST': ['Vorpommern-Rügen'],
    'HWI': ['Nordwestmecklenburg'],
    'IGB': ['Saarpfalz-Kreis'],
    'LD':  ['Landau in der Pfalz'],
    'MAK': ['Wunsiedel im Fichtelgebirge'],
    'MAL': ['Landshut', 'Straubing-Bogen'],
    'NB':  ['Mecklenburgische Seenplatte'],
    'NEA': ['Neustadt an der Aisch-Bad Windsheim'],
    'NK':  ['Neunkirchen'],
    'NM':  ['Neumarkt in der Oberpfalz'],
    'PAF': ['Pfaffenhofen an der Ilm'],
    'PAR': ['Kelheim', 'Neumarkt in der Oberpfalz'],
    'SEF': ['Neustadt an der Aisch-Bad Windsheim'],
    'SEL': ['Wunsiedel im Fichtelgebirge'],
    'UFF': ['Neustadt an der Aisch-Bad Windsheim'],
    'VK':  ['Regionalverband Saarbrücken'],
    'VOH': ['Neustadt an der Waldnaab'],
    'WEN': ['Weiden in der Oberpfalz'],
    'WW':  ['Westerwaldkreis'],
    'UL':  ['Ulm', 'Alb-Donau-Kreis'],
    'HB':  ['Bremen', 'Bremerhaven'],
    'OF':  ['Offenbach', 'Offenbach am Main'],   # Geometrie führt Stadt und Landkreis getrennt
}


def norm(s: str) -> str:
    """Vereinheitlicht Kreis- und Ortsnamen für den Abgleich."""
    s = s.lower()
    s = re.sub(r'\(.*?\)', '', s)
    s = re.sub(r'\b(hansestadt|freie und|freie|landeshauptstadt|universitaetsstadt|'
               r'wissenschaftsstadt|bundesstadt|dokumentationsstadt|lutherstadt|hochschulstadt)\b', '', s)
    s = re.sub(r'\b(landkreis|kreisfreie stadt|stadtkreis|kreis|stadt|lkr\.?|krs\.?|'
               r'regionalverband|staedteregion|zweckverband|zulassungsstelle|gemeinde)\b', '', s)
    s = s.replace('ä', 'ae').replace('ö', 'oe').replace('ü', 'ue').replace('ß', 'ss')
    return re.sub(r'[^a-z]', '', s)


def teile(ort: str) -> list[str]:
    """Zerlegt eine Ortsangabe in einzeln auflösbare Kandidaten."""
    ort = re.sub(r'\bau[sß]er\b.*$', '', ort)
    ort = re.sub(r'\bin\b\s+\S+.*$', '', ort)
    return [s for s in re.split(r'\s*,\s*|\s+und\s+', ort) if norm(s)]


def rdp(punkte: list[tuple[float, float]], toleranz: float) -> list[tuple[float, float]]:
    """Douglas-Peucker: entfernt Stützpunkte, die kaum zur Form beitragen."""
    if len(punkte) < 3:
        return punkte

    start, ende = punkte[0], punkte[-1]
    dx, dy = ende[0] - start[0], ende[1] - start[1]
    laenge = math.hypot(dx, dy)

    max_abstand, index = 0.0, 0
    for i in range(1, len(punkte) - 1):
        px, py = punkte[i]
        if laenge == 0:
            abstand = math.hypot(px - start[0], py - start[1])
        else:
            abstand = abs(dy * px - dx * py + ende[0] * start[1] - ende[1] * start[0]) / laenge
        if abstand > max_abstand:
            max_abstand, index = abstand, i

    if max_abstand <= toleranz:
        return [start, ende]
    return rdp(punkte[:index + 1], toleranz)[:-1] + rdp(punkte[index:], toleranz)


def main() -> None:
    geo_pfad, kz_pfad, ziel_pfad = sys.argv[1:4]
    geo = json.load(open(geo_pfad, encoding='utf-8'))
    kennzeichen = json.load(open(kz_pfad, encoding='utf-8'))

    # --- Zuordnung Zeichen -> Kreise -------------------------------------
    geo_idx: dict[str, list] = {}
    for f in geo['features']:
        name = f['properties']['name']
        for variante in {name, name.split('/')[0]}:
            geo_idx.setdefault(norm(variante), []).append(f)

    zeichen_je_kreis: dict[str, set[str]] = {}
    ohne_treffer: list[tuple[str, str]] = []

    for k in kennzeichen:
        kandidaten = KORREKTUREN.get(k['z']) or teile(k['ort'])
        getroffen = False
        for kandidat in kandidaten:
            for f in geo_idx.get(norm(kandidat), []):
                zeichen_je_kreis.setdefault(f['id'], set()).add(k['z'])
                getroffen = True
        if not getroffen:
            ohne_treffer.append((k['z'], k['ort']))

    # --- Projektion ------------------------------------------------------
    # Gleichabständige Zylinderprojektion; für Deutschland genügt eine
    # Breitenkorrektur um den mittleren Breitengrad.
    mittlere_breite = math.radians(51.2)
    faktor = math.cos(mittlere_breite)

    def projiziere(lon: float, lat: float) -> tuple[float, float]:
        return lon * faktor, -lat

    alle = [projiziere(x, y)
            for f in geo['features']
            for ring in ringe(f['geometry'])
            for x, y in ring]
    min_x = min(p[0] for p in alle); max_x = max(p[0] for p in alle)
    min_y = min(p[1] for p in alle); max_y = max(p[1] for p in alle)

    BREITE = 1000.0
    skala = BREITE / (max_x - min_x)
    hoehe = round((max_y - min_y) * skala, 1)

    def auf_leinwand(punkt: tuple[float, float]) -> tuple[float, float]:
        return ((punkt[0] - min_x) * skala, (punkt[1] - min_y) * skala)

    # --- Pfade erzeugen --------------------------------------------------
    TOLERANZ = 0.8   # in Leinwand-Einheiten; ~0,08 % der Breite
    kreise = []
    for f in geo['features']:
        teilpfade = []
        for ring in ringe(f['geometry']):
            punkte = [auf_leinwand(projiziere(x, y)) for x, y in ring]
            punkte = rdp(punkte, TOLERANZ)
            if len(punkte) < 4:
                continue   # Rest einer zu stark vereinfachten Insel
            koordinaten = 'L'.join(f'{x:.1f},{y:.1f}' for x, y in punkte)
            teilpfade.append('M' + koordinaten + 'Z')

        if not teilpfade:
            continue

        kreise.append({
            'id': f['id'],
            'name': f['properties']['name'],
            'land': f['properties'].get('state', ''),
            'zeichen': sorted(zeichen_je_kreis.get(f['id'], []), key=lambda z: (len(z), z)),
            'd': ''.join(teilpfade),
        })

    ergebnis = {'breite': BREITE, 'hoehe': hoehe, 'kreise': kreise}
    with open(ziel_pfad, 'w', encoding='utf-8') as datei:
        json.dump(ergebnis, datei, ensure_ascii=False, separators=(',', ':'))

    # --- Bericht ---------------------------------------------------------
    ohne_zeichen = [k['name'] for k in kreise if not k['zeichen']]
    zugeordnet = len(kennzeichen) - len(ohne_treffer)
    print(f'{ziel_pfad}: {len(kreise)} Kreise, ViewBox 0 0 {BREITE:.0f} {hoehe:.0f}')
    print(f'Zeichen zugeordnet: {zugeordnet} von {len(kennzeichen)} '
          f'({zugeordnet * 100 // len(kennzeichen)} %)')
    if ohne_treffer:
        print('Ohne Kreis-Zuordnung: ' + ', '.join(z for z, _ in ohne_treffer))
    if ohne_zeichen:
        print(f'Kreise ohne Zeichen ({len(ohne_zeichen)}): ' + ', '.join(ohne_zeichen))


def ringe(geometry: dict):
    """Liefert alle Aussenringe einer (Multi-)Polygon-Geometrie."""
    if geometry['type'] == 'Polygon':
        yield geometry['coordinates'][0]
    elif geometry['type'] == 'MultiPolygon':
        for polygon in geometry['coordinates']:
            yield polygon[0]


if __name__ == '__main__':
    sys.setrecursionlimit(10000)
    main()
