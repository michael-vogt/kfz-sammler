import { Injectable, computed, inject } from '@angular/core';
import qrcode from 'qrcode-generator';

import { KennzeichenService } from '../kennzeichen/kennzeichen.service';
import { SammlungService } from '../sammlung/sammlung.service';
import { dekodieren, indexErzeugen, kodieren } from './sammelcode';

/** Ein fertig gerechnetes QR-Bild: ein einziger SVG-Pfad plus Rastergröße. */
export interface QrBild {
  /** Kantenlänge in Modulen, inklusive Ruhezone. */
  groesse: number;
  /** Pfad aller dunklen Module, ein Quadrat je Modul. */
  d: string;
}

/** Ruhezone laut Spezifikation: vier Module ringsum, sonst scannen manche Lesegeräte nicht. */
const RUHEZONE = 4;

@Injectable({ providedIn: 'root' })
export class AbgleichService {
  private readonly kennzeichen = inject(KennzeichenService);
  private readonly sammlung = inject(SammlungService);

  /** Alle sammelbaren Zeichen in stabiler Reihenfolge – die Grundlage des Bitfelds. */
  readonly index = computed(() =>
    indexErzeugen([
      ...this.kennzeichen.alleKennzeichen().map((k) => k.z),
      ...this.kennzeichen.alleAuslaufend().map((k) => k.z),
    ]),
  );

  /** Zeichen -> Ortsname, damit übernommene Einträge nicht ohne Bezeichnung dastehen. */
  private readonly orte = computed(() => {
    const karte = new Map<string, string>();
    for (const k of this.kennzeichen.alleAuslaufend()) karte.set(k.z, k.bisher);
    for (const k of this.kennzeichen.alleKennzeichen()) karte.set(k.z, k.ort);
    return karte;
  });

  /** Der eigene Stand als Text. Aktualisiert sich nach jedem Abgleich von selbst. */
  readonly eigenerCode = computed(() => {
    const index = this.index();
    return index.length ? kodieren(this.sammlung.gesammelteZeichen(), index) : '';
  });

  readonly bereit = computed(() => this.index().length > 0 && this.sammlung.geladen());

  /** Der eigene Stand als QR-Bild. */
  readonly eigenesQr = computed<QrBild | null>(() => {
    const code = this.eigenerCode();
    return code ? this.qrErzeugen(code) : null;
  });

  private qrErzeugen(text: string): QrBild {
    // Typennummer 0 wählt die kleinste passende Version; Fehlerkorrektur M ist
    // der übliche Kompromiss aus Robustheit und Größe.
    const qr = qrcode(0, 'M');
    // Der Code besteht nur aus Großbuchstaben, Ziffern und Bindestrich und passt
    // damit in den alphanumerischen Modus – der braucht eine QR-Version weniger
    // als der Byte-Modus.
    qr.addData(text, 'Alphanumeric');
    qr.make();

    // Nicht "module" nennen: manche Bundler verpacken ES-Module in CommonJS,
    // wo der Bezeichner belegt ist.
    const raster = qr.getModuleCount();
    let d = '';
    for (let y = 0; y < raster; y++) {
      for (let x = 0; x < raster; x++) {
        if (qr.isDark(y, x)) d += `M${x + RUHEZONE} ${y + RUHEZONE}h1v1h-1z`;
      }
    }

    return { groesse: raster + RUHEZONE * 2, d };
  }

  /**
   * Übernimmt einen fremden Sammelcode. Die Sammlungen werden vereinigt;
   * nichts wird dabei entfernt.
   *
   * Gibt zurück, wie viele Zeichen neu hinzugekommen sind. Wirft einen
   * SammelcodeFehler mit anzeigbarer Meldung, wenn der Code nicht passt.
   */
  uebernehmen(code: string): number {
    const zeichen = dekodieren(code, this.index());
    return this.sammlung.vereinigen(zeichen, this.orte());
  }
}
