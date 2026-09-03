/** Ein aktuell vergebenes Unterscheidungszeichen. */
export interface Kennzeichen {
  /** Unterscheidungszeichen, z. B. "MS" */
  z: string;
  /** Stadt oder Kreis, z. B. "Münster, Stadt" */
  ort: string;
  /** Herleitung mit grossgeschriebenen namensgebenden Buchstaben, z. B. "MünSter" */
  herleitung: string;
  land: string;
  landIso: string;
  fussnoten: number[];
  bemerkung: string | null;
}

/** Ein nicht mehr vergebenes ("auslaufendes") Unterscheidungszeichen. */
export interface AuslaufendesKennzeichen {
  z: string;
  bisher: string;
  abwicklung: string;
}

export type SonderTyp = 'Bund' | 'Länder' | 'Diplo';

/** Behörden-, Polizei- oder Diplomatenkennzeichen. */
export interface Sonderkennzeichen {
  z: string;
  typ: SonderTyp;
  bedeutung: string;
  behoerde: string | null;
}

/** Nummer -> Fussnotentext */
export type Fussnoten = Record<string, string>;

export interface Fussnote {
  nummer: number;
  text: string;
}

/** Der Teil hinter dem Unterscheidungszeichen. */
export interface Erkennungsnummer {
  buchstaben: string;
  ziffern: string;
  /** "E" = Elektrofahrzeug, "H" = Oldtimer */
  suffix: 'E' | 'H' | null;
  /** Saisonkennzeichen, z. B. { von: 3, bis: 10 } */
  saison: { von: number; bis: number } | null;
  /** Klartext-Erläuterungen zur Erkennungsnummer. */
  hinweise: string[];
}

/** Ein Segment der Herleitung – hervorgehoben sind die namensgebenden Buchstaben. */
export interface HerleitungSegment {
  text: string;
  hervorgehoben: boolean;
}

/** Vollständiges Analyseergebnis für eine Eingabe. */
export interface Analyse {
  eingabe: string;
  normalisiert: string;
  unterscheidungszeichen: string | null;
  erkennungsnummer: Erkennungsnummer | null;
  aktuell: Kennzeichen[];
  auslaufend: AuslaufendesKennzeichen[];
  sonder: Sonderkennzeichen[];
  fussnoten: Fussnote[];
  /** Gefüllt, wenn nichts gefunden wurde. */
  fehler: string | null;
  /** Ähnliche Zeichen als Vorschlag, wenn nichts gefunden wurde. */
  vorschlaege: string[];
}
