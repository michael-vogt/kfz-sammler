/**
 * Zoom- und Verschiebezustand für eine SVG-Karte.
 *
 * Gerechnet wird durchgehend in Nutzereinheiten der viewBox, nicht in Pixeln.
 * Ein Punkt p der Grundkarte landet bei p * skala + verschiebung.
 */
export class Kartenblick {
  static readonly MIN = 1;
  static readonly MAX = 14;

  /** Ab dieser Bewegung (in Pixeln) gilt eine Geste als Wischen, nicht als Tippen. */
  static readonly TIPP_SCHWELLE = 8;

  skala = 1;
  x = 0;
  y = 0;

  constructor(
    private readonly breite: number,
    private readonly hoehe: number,
  ) {}

  get transform(): string {
    return `translate(${this.x.toFixed(2)} ${this.y.toFixed(2)}) scale(${this.skala.toFixed(4)})`;
  }

  get istVergroessert(): boolean {
    return this.skala > Kartenblick.MIN + 0.001;
  }

  /** Zoomt so, dass der Punkt (zx, zy) unter dem Finger stehen bleibt. */
  zoomeAuf(faktor: number, zx: number, zy: number): void {
    const vorher = this.skala;
    const nachher = Math.min(Kartenblick.MAX, Math.max(Kartenblick.MIN, vorher * faktor));
    if (nachher === vorher) return;

    const verhaeltnis = nachher / vorher;
    this.x = zx - (zx - this.x) * verhaeltnis;
    this.y = zy - (zy - this.y) * verhaeltnis;
    this.skala = nachher;
    this.begrenze();
  }

  verschiebe(dx: number, dy: number): void {
    this.x += dx;
    this.y += dy;
    this.begrenze();
  }

  zuruecksetzen(): void {
    this.skala = 1;
    this.x = 0;
    this.y = 0;
  }

  /** Verhindert, dass die Karte aus dem sichtbaren Bereich geschoben wird. */
  private begrenze(): void {
    const minX = this.breite * (1 - this.skala);
    const minY = this.hoehe * (1 - this.skala);
    this.x = Math.min(0, Math.max(minX, this.x));
    this.y = Math.min(0, Math.max(minY, this.y));
  }
}
