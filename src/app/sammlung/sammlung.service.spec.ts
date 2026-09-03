import { TestBed } from '@angular/core/testing';

import { SPEICHER, SammlungService } from './sammlung.service';
import { Speicher } from './speicher';

/** Speicher im Arbeitsspeicher – kein localStorage, keine Capacitor-Abhängigkeit. */
class FakeSpeicher implements Speicher {
  constructor(public inhalt: Record<string, string> = {}) {}
  async lesen(k: string) {
    return this.inhalt[k] ?? null;
  }
  async schreiben(k: string, v: string) {
    this.inhalt[k] = v;
  }
  async loeschen(k: string) {
    delete this.inhalt[k];
  }
}

const SCHLUESSEL = 'kfz-sammlung.v1';

/** Legt einen Service über dem gegebenen Speicher an und wartet auf das Laden. */
async function serviceMit(speicher: Speicher): Promise<SammlungService> {
  TestBed.configureTestingModule({
    providers: [{ provide: SPEICHER, useValue: Promise.resolve(speicher) }],
  });
  const dienst = TestBed.inject(SammlungService);
  // Auf den Ladevorgang im Konstruktor warten.
  await new Promise((fertig) => setTimeout(fertig, 0));
  return dienst;
}

describe('SammlungService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
  });

  it('startet leer und meldet sich als geladen', async () => {
    const dienst = await serviceMit(new FakeSpeicher());
    expect(dienst.geladen()).toBe(true);
    expect(dienst.anzahl()).toBe(0);
  });

  it('liest einen vorhandenen Bestand', async () => {
    const speicher = new FakeSpeicher({
      [SCHLUESSEL]: JSON.stringify({
        MS: { z: 'MS', gesehenAm: '2024-05-01T10:00:00.000Z', ort: 'Münster', notiz: null },
      }),
    });
    const dienst = await serviceMit(speicher);
    expect(dienst.hatGesehen('MS')).toBe(true);
  });

  it('überschreibt einen vorhandenen Bestand nicht beim Start', async () => {
    const speicher = new FakeSpeicher({
      [SCHLUESSEL]: JSON.stringify({
        MS: { z: 'MS', gesehenAm: '2024-05-01T10:00:00.000Z', ort: null, notiz: null },
      }),
    });
    await serviceMit(speicher);
    expect(JSON.parse(speicher.inhalt[SCHLUESSEL]).MS).toBeDefined();
  });

  it('schaltet ein Zeichen an und wieder aus', async () => {
    const dienst = await serviceMit(new FakeSpeicher());
    expect(dienst.umschalten('MS', 'Münster, Stadt')).toBe(true);
    expect(dienst.hatGesehen('MS')).toBe(true);
    expect(dienst.umschalten('MS')).toBe(false);
    expect(dienst.hatGesehen('MS')).toBe(false);
  });

  it('persistiert jede Änderung', async () => {
    const speicher = new FakeSpeicher();
    const dienst = await serviceMit(speicher);
    dienst.umschalten('AB', 'Aschaffenburg');
    await dienst.gespeichert();
    expect(speicher.inhalt[SCHLUESSEL]).toContain('AB');
  });

  it('führt Schreibvorgänge in der richtigen Reihenfolge aus', async () => {
    const speicher = new FakeSpeicher();
    const dienst = await serviceMit(speicher);
    dienst.umschalten('MS');
    dienst.umschalten('AB');
    dienst.umschalten('HH');
    await dienst.gespeichert();
    expect(Object.keys(JSON.parse(speicher.inhalt[SCHLUESSEL])).sort()).toEqual(['AB', 'HH', 'MS']);
  });

  it('übernimmt beim Erststart eine Sammlung aus dem localStorage', async () => {
    localStorage.setItem(
      SCHLUESSEL,
      JSON.stringify({
        GAP: { z: 'GAP', gesehenAm: '2023-01-01T00:00:00.000Z', ort: null, notiz: null },
      }),
    );
    const speicher = new FakeSpeicher(); // leer, also wie ein frisch installiertes Android
    const dienst = await serviceMit(speicher);
    expect(dienst.hatGesehen('GAP')).toBe(true);
    expect(speicher.inhalt[SCHLUESSEL]).toContain('GAP');
  });

  it('startet bei unlesbarem Speicherinhalt leer statt zu scheitern', async () => {
    const dienst = await serviceMit(new FakeSpeicher({ [SCHLUESSEL]: '{kaputt' }));
    expect(dienst.geladen()).toBe(true);
    expect(dienst.anzahl()).toBe(0);
  });

  it('behält bei Dubletten die ältere Sichtung', async () => {
    const dienst = await serviceMit(new FakeSpeicher());
    dienst.umschalten('MS', 'Münster, Stadt');
    const alt = JSON.stringify([
      { z: 'MS', gesehenAm: '2020-01-01T00:00:00.000Z', ort: 'Münster', notiz: 'alt' },
      { z: 'HH', gesehenAm: '2021-01-01T00:00:00.000Z', ort: 'Hamburg', notiz: null },
    ]);
    const neue = await dienst.importieren(new File([alt], 'sammlung.json'));
    expect(neue).toBe(1);
    expect(dienst.sichtung('MS')?.notiz).toBe('alt');
    expect(dienst.anzahl()).toBe(2);
  });

  it('ignoriert kaputte Einträge beim Import', async () => {
    const dienst = await serviceMit(new FakeSpeicher());
    const roh = JSON.stringify([
      { z: 'MS', gesehenAm: '2020-01-01T00:00:00.000Z' },
      { unsinn: true },
    ]);
    await dienst.importieren(new File([roh], 'sammlung.json'));
    expect(dienst.anzahl()).toBe(1);
  });
});
